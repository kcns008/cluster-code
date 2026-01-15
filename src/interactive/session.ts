import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/logger';
import { buildCLIContext, generateSystemPrompt, formatCLIContext, CLIContext } from '../utils/cli-context';
import { ConfigManager } from '../config';
import { ProviderManager, LLMClient } from '../llm';
import { setManualToken } from '../auth';

const execAsync = promisify(exec);

export interface SessionOptions {
  autoExecute?: boolean;
  verbose?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Interactive Session Manager
 * Handles the conversational interface for cluster-code
 */
export class InteractiveSession {
  private llmClient: LLMClient;
  private logger: Logger;
  private configManager: ConfigManager;
  private messages: Message[] = [];
  private cliContext?: CLIContext;
  private systemPrompt?: string;
  private options: SessionOptions;
  private running: boolean = false;

  constructor(options: SessionOptions = {}) {
    this.logger = new Logger();
    this.configManager = new ConfigManager();
    this.options = options;

    // Initialize LLM client with provider manager
    const llmConfig = this.configManager.getLLMConfig();
    const providers = this.configManager.getProviders();
    const providerManager = new ProviderManager(providers);
    this.llmClient = new LLMClient(providerManager, llmConfig);
  }

  /**
   * Initialize the session by building CLI context
   */
  async initialize(): Promise<void> {
    this.logger.startSpinner('Initializing session...');

    try {
      const config = this.configManager.getConfig();
      this.cliContext = await buildCLIContext(config.cluster);
      this.systemPrompt = generateSystemPrompt(this.cliContext);

      this.logger.succeedSpinner('Session initialized');

      if (this.options.verbose) {
        this.logger.info('\n' + formatCLIContext(this.cliContext));
      }
    } catch (error: any) {
      this.logger.failSpinner('Failed to initialize session');
      throw error;
    }
  }

  /**
   * Start the interactive session loop
   */
  async start(): Promise<void> {
    this.running = true;

    // Display welcome message
    this.displayWelcome();

    // Main conversation loop
    while (this.running) {
      try {
        const userInput = await this.getUserInput();

        // Handle special commands
        if (await this.handleSpecialCommand(userInput)) {
          continue;
        }

        // Process with AI
        await this.processUserMessage(userInput);

      } catch (error: any) {
        if (error.isTtyError || error.name === 'ExitPromptError') {
          // User interrupted (Ctrl+C)
          this.logger.info('\nGoodbye!');
          this.running = false;
        } else {
          this.logger.error(`Error: ${error.message}`);
        }
      }
    }
  }

  /**
   * Display welcome message
   */
  private displayWelcome(): void {
    this.logger.section('Cluster Code - Interactive Mode');
    this.logger.info('Ask me anything about your cluster in natural language!');
    this.logger.info('Type /help for available commands, /exit to quit\n');

    // Show LLM provider info
    const providerInfo = this.llmClient.getProviderInfo();
    this.logger.info(`LLM Provider: ${providerInfo.provider}`);
    this.logger.info(`Model: ${providerInfo.model}\n`);

    if (this.cliContext?.clusterInfo) {
      const { context, namespace, type } = this.cliContext.clusterInfo;
      this.logger.info(`Connected to ${type} cluster`);
      if (context) this.logger.info(`Context: ${context}`);
      if (namespace) this.logger.info(`Namespace: ${namespace}`);
      this.logger.newline();
    }
  }

  /**
   * Get input from user
   */
  private async getUserInput(): Promise<string> {
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: ' ',
        prefix: '>>'
      }
    ]);

    return input.trim();
  }

  /**
   * Handle special commands like /help, /exit, etc.
   * Returns true if command was handled, false otherwise
   */
  private async handleSpecialCommand(input: string): Promise<boolean> {
    // Handle ? shortcut for help
    if (input === '?' || input === 'help') {
      this.displayHelp();
      return true;
    }

    if (!input.startsWith('/')) {
      return false;
    }

    const [command, ...args] = input.slice(1).split(' ');

    switch (command.toLowerCase()) {
      case 'exit':
      case 'quit':
      case 'q':
        this.logger.info('Goodbye!');
        this.running = false;
        return true;

      case 'help':
      case 'h':
        this.displayHelp();
        return true;

      case 'context':
      case 'ctx':
        this.displayContext();
        return true;

      case 'clear':
      case 'c':
        this.clearHistory();
        return true;

      case 'history':
        this.displayHistory();
        return true;

      case 'verbose':
        this.options.verbose = !this.options.verbose;
        this.logger.success(`Verbose mode ${this.options.verbose ? 'enabled' : 'disabled'}`);
        return true;

      case 'auto':
      case 'autoexec':
        this.options.autoExecute = !this.options.autoExecute;
        this.logger.success(`Auto-execute ${this.options.autoExecute ? 'enabled' : 'disabled'}`);
        return true;

      case 'exec':
      case 'run':
        if (args.length === 0) {
          this.logger.warning('Usage: /exec <command>');
        } else {
          this.executeCommand(args.join(' '), true);
        }
        return true;

      case 'github':
      case 'gh':
        if (args.length >= 2 && args[0] === 'token') {
          await this.setGitHubToken(args[1]);
        } else if (args.length >= 1 && args[0] === 'login') {
          this.logger.info('Please run: cluster-code github login (outside interactive mode)');
        } else {
          this.logger.info('Usage: /github token <YOUR_PAT> or /github login');
        }
        return true;

      case 'login':
        this.logger.info('Please run: cluster-code github login (outside interactive mode)');
        this.logger.info('Or use: /github token <YOUR_PAT>');
        return true;

      default:
        this.logger.warning(`Unknown command: /${command}`);
        this.logger.info('Type /help for available commands');
        return true;
    }
  }

  /**
   * Display help message
   */
  private displayHelp(): void {
    this.logger.section('Available Commands');
    this.logger.info('/help, /h             - Show this help message');
    this.logger.info('/exit, /quit, /q      - Exit interactive mode');
    this.logger.info('/context, /ctx        - Show current cluster context and available tools');
    this.logger.info('/clear, /c            - Clear conversation history');
    this.logger.info('/history              - Show conversation history');
    this.logger.info('/verbose              - Toggle verbose mode');
    this.logger.info('/auto, /autoexec      - Toggle auto-execute commands (skip confirmation)');
    this.logger.info('/exec, /run <cmd>     - Execute a command directly');
    this.logger.info('/github token <PAT>   - Set GitHub Copilot token');
    this.logger.info('/login                - Show GitHub login instructions');
    this.logger.newline();
  }

  /**
   * Display current context
   */
  private displayContext(): void {
    if (this.cliContext) {
      this.logger.section('Current Context');
      this.logger.info(formatCLIContext(this.cliContext));
    } else {
      this.logger.warning('Context not initialized');
    }
  }

  /**
   * Clear conversation history
   */
  private clearHistory(): void {
    this.messages = [];
    this.logger.success('Conversation history cleared');
  }

  /**
   * Display conversation history
   */
  private displayHistory(): void {
    if (this.messages.length === 0) {
      this.logger.info('No conversation history');
      return;
    }

    this.logger.section('Conversation History');
    this.messages.forEach((msg, i) => {
      const prefix = msg.role === 'user' ? 'You:' : 'Assistant:';
      this.logger.info(`${i + 1}. ${prefix} ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
    });
  }

  /**
   * Process user message with AI
   */
  private async processUserMessage(userInput: string): Promise<void> {
    // Add user message to history
    this.messages.push({
      role: 'user',
      content: userInput
    });

    this.logger.startSpinner('Thinking...');

    try {
      // Generate response using LLM client
      const assistantMessage = await this.llmClient.generate({
        system: this.systemPrompt,
        messages: this.messages,
      });

      this.logger.stopSpinner();

      // Add assistant response to history
      this.messages.push({
        role: 'assistant',
        content: assistantMessage
      });

      // Display response
      this.displayAssistantMessage(assistantMessage);

      // Check if there are commands to execute
      await this.handleCommandExecution(assistantMessage);

    } catch (error: any) {
      this.logger.failSpinner('Error processing request');

      if (error.message.includes('API key')) {
        this.logger.error('Invalid or missing API key. Please check your configuration.');
        this.logger.info('Use: cluster-code config provider add <name> to configure a provider');
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        this.logger.error('Rate limit exceeded. Please try again later.');
      } else {
        this.logger.error(`Error: ${error.message}`);
      }
    }
  }

  /**
   * Display assistant message with formatting
   */
  private displayAssistantMessage(message: string): void {
    this.logger.section('Assistant');

    // Split message into lines for better formatting
    const lines = message.split('\n');
    let inCodeBlock = false;

    lines.forEach(line => {
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        this.logger.info(line);
      } else if (inCodeBlock) {
        // In code block - display as-is
        this.logger.info(line);
      } else if (line.startsWith('**') && line.endsWith('**')) {
        // Bold headers
        this.logger.info(line);
      } else if (line.trim() === '') {
        // Empty line
        this.logger.newline();
      } else {
        // Regular line
        this.logger.info(line);
      }
    });

    this.logger.newline();
  }

  /**
   * Extract and handle command execution from assistant response
   */
  private async handleCommandExecution(message: string): Promise<void> {
    // Extract commands from markdown code blocks
    const codeBlockRegex = /```(?:bash|sh|shell)?\n(.*?)\n```/gs;
    const matches = [...message.matchAll(codeBlockRegex)];

    if (matches.length === 0) {
      return;
    }

    for (const match of matches) {
      const command = match[1].trim();

      // Skip empty commands or comments
      if (!command || command.startsWith('#')) {
        continue;
      }

      // Auto-execute or ask for confirmation
      if (this.options.autoExecute) {
        await this.executeCommand(command, false);
      } else {
        const { shouldExecute } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldExecute',
            message: `Execute this command?\n  ${command}`,
            default: false
          }
        ]);

        if (shouldExecute) {
          await this.executeCommand(command, false);
        }
      }
    }
  }

  /**
   * Execute a shell command
   */
  private async executeCommand(command: string, direct: boolean = false): Promise<void> {
    if (!direct) {
      this.logger.section('Executing Command');
      this.logger.info(`$ ${command}\n`);
    }

    this.logger.startSpinner('Running...');

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000, // 60 second timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      this.logger.succeedSpinner('Command completed');

      if (stdout) {
        this.logger.info('Output:');
        this.logger.info(stdout);
      }

      if (stderr) {
        this.logger.warning('Warnings/Errors:');
        this.logger.warning(stderr);
      }

      this.logger.newline();

    } catch (error: any) {
      this.logger.failSpinner('Command failed');

      if (error.stdout) {
        this.logger.info('Output:');
        this.logger.info(error.stdout);
      }

      if (error.stderr) {
        this.logger.error('Error:');
        this.logger.error(error.stderr);
      }

      this.logger.newline();
    }
  }

  /**
   * Set GitHub token from within the interactive session
   */
  private async setGitHubToken(token: string): Promise<void> {
    this.logger.startSpinner('Setting GitHub token...');

    try {
      const result = await setManualToken(token);

      if (result.success) {
        this.logger.succeedSpinner('Token saved successfully!');
        if (result.user) {
          this.logger.info(`Authenticated as: @${result.user.login}`);
        }
        
        // Reinitialize the LLM client with new credentials
        const llmConfig = this.configManager.getLLMConfig();
        const providers = this.configManager.getProviders();
        const providerManager = new ProviderManager(providers);
        this.llmClient = new LLMClient(providerManager, llmConfig);
        
        this.logger.success('GitHub Copilot is now ready to use!');
      } else {
        this.logger.failSpinner('Failed to set token');
        if (result.error) {
          this.logger.error(result.error);
        }
      }
    } catch (error: any) {
      this.logger.failSpinner('Failed to set token');
      this.logger.error(error.message);
    }
  }

  /**
   * Stop the session
   */
  stop(): void {
    this.running = false;
  }
}
