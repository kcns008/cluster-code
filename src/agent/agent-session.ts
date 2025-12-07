/**
 * Agent Session
 * 
 * Interactive agentic session using the Claude Agent SDK
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { AgentClient, AgentClientOptions } from './agent-client';
import { ConfigManager } from '../config';

export interface AgentSessionOptions extends AgentClientOptions {
    /**
     * Show welcome message
     */
    showWelcome?: boolean;
}

interface ParsedMessage {
    type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'error';
    content: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    isError?: boolean;
}

/**
 * Parse SDK messages into displayable format
 */
function parseMessage(message: SDKMessage): ParsedMessage[] {
    const parsed: ParsedMessage[] = [];

    switch (message.type) {
        case 'assistant':
            const assistantMsg = message as any;
            if (assistantMsg.message?.content) {
                for (const block of assistantMsg.message.content) {
                    if (block.type === 'text') {
                        parsed.push({
                            type: 'text',
                            content: block.text,
                        });
                    } else if (block.type === 'tool_use') {
                        parsed.push({
                            type: 'tool_use',
                            content: `Using tool: ${block.name}`,
                            toolName: block.name,
                            toolInput: block.input,
                        });
                    } else if (block.type === 'thinking') {
                        parsed.push({
                            type: 'thinking',
                            content: block.thinking || 'Thinking...',
                        });
                    }
                }
            }
            break;

        case 'result':
            const resultMsg = message as any;
            parsed.push({
                type: 'tool_result',
                content: resultMsg.content || '',
                toolName: resultMsg.tool_name,
                isError: resultMsg.is_error,
            });
            break;

        case 'system':
            const systemMsg = message as any;
            if (systemMsg.subtype === 'error') {
                parsed.push({
                    type: 'error',
                    content: systemMsg.message || 'An error occurred',
                    isError: true,
                });
            }
            break;
    }

    return parsed;
}

/**
 * Agent Session for interactive agentic operations
 */
export class AgentSession {
    private client: AgentClient;
    private configManager: ConfigManager;
    private options: AgentSessionOptions;
    private running: boolean = false;
    private conversationHistory: string[] = [];

    constructor(options: AgentSessionOptions = {}) {
        this.options = {
            showWelcome: true,
            ...options,
        };
        this.configManager = new ConfigManager();

        // Set up message handlers
        this.client = new AgentClient({
            ...options,
            onMessage: (message) => this.handleMessage(message),
            onToolCall: (toolName, input) => this.handleToolCall(toolName, input),
            onToolResult: (toolName, result) => this.handleToolResult(toolName, result),
        });
    }

    /**
     * Check if agent mode is available
     */
    isAvailable(): boolean {
        return this.client.isConfigured();
    }

    /**
     * Handle streaming messages
     */
    private handleMessage(message: SDKMessage): void {
        const parsed = parseMessage(message);

        for (const item of parsed) {
            switch (item.type) {
                case 'text':
                    // Display text content directly
                    if (item.content.trim()) {
                        console.log(chalk.white(item.content));
                    }
                    break;

                case 'thinking':
                    // Show thinking indicator
                    if (this.options.verbose) {
                        console.log(chalk.gray.italic(`💭 ${item.content.substring(0, 100)}...`));
                    }
                    break;

                case 'error':
                    console.log(chalk.red(`\n❌ Error: ${item.content}`));
                    break;
            }
        }
    }

    /**
     * Handle tool call notifications
     */
    private handleToolCall(toolName: string, input: Record<string, unknown>): void {
        const displayName = toolName.replace('mcp__kubernetes-tools__', '');

        if (this.options.verbose) {
            console.log(chalk.cyan(`\n🔧 ${displayName}`));
            console.log(chalk.gray(JSON.stringify(input, null, 2)));
        } else {
            // Show a minimal indicator
            const inputStr = Object.entries(input)
                .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
                .join(', ')
                .substring(0, 80);
            console.log(chalk.cyan(`\n🔧 ${displayName}: ${inputStr}${inputStr.length >= 80 ? '...' : ''}`));
        }
    }

    /**
     * Handle tool result notifications
     */
    private handleToolResult(toolName: string, result: string): void {
        if (this.options.verbose && result) {
            const displayName = toolName.replace('mcp__kubernetes-tools__', '');
            console.log(chalk.green(`\n📋 ${displayName} result:`));
            // Truncate long results
            const truncated = result.length > 1000 ? result.substring(0, 1000) + '\n...(truncated)' : result;
            console.log(chalk.gray(truncated));
        }
    }

    /**
     * Display welcome message
     */
    private displayWelcome(): void {
        console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════╗'));
        console.log(chalk.bold.cyan('║           Cluster Code - Agent Mode                   ║'));
        console.log(chalk.bold.cyan('║         Powered by Claude Agent SDK                   ║'));
        console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════╝\n'));

        console.log(chalk.white('I can help you manage and troubleshoot your Kubernetes cluster.'));
        console.log(chalk.white('Type your request in natural language, or use these commands:\n'));

        console.log(chalk.gray('  /help     - Show available commands'));
        console.log(chalk.gray('  /exit     - Exit agent mode'));
        console.log(chalk.gray('  /verbose  - Toggle verbose output'));
        console.log(chalk.gray('  /auto     - Toggle auto-execute mode'));
        console.log(chalk.gray('  /plan     - Toggle planning mode\n'));

        const cluster = this.configManager.getCluster();
        if (cluster) {
            console.log(chalk.green(`✓ Connected to: ${cluster.context || 'default context'}`));
            console.log(chalk.green(`✓ Namespace: ${cluster.namespace || 'default'}`));
            console.log(chalk.green(`✓ Type: ${cluster.type || 'kubernetes'}\n`));
        } else {
            console.log(chalk.yellow('⚠ No cluster configured. Run: cluster-code init\n'));
        }

        if (this.options.autoExecute) {
            console.log(chalk.yellow('⚡ Auto-execute mode is ON - commands will run without confirmation\n'));
        }

        if (this.options.planMode) {
            console.log(chalk.blue('📋 Planning mode is ON - no commands will be executed\n'));
        }
    }

    /**
     * Display help
     */
    private displayHelp(): void {
        console.log(chalk.bold('\n📖 Agent Mode Commands\n'));
        console.log(chalk.white('  /help             Show this help message'));
        console.log(chalk.white('  /exit, /quit, /q  Exit agent mode'));
        console.log(chalk.white('  /verbose, /v      Toggle verbose output'));
        console.log(chalk.white('  /auto             Toggle auto-execute mode'));
        console.log(chalk.white('  /plan             Toggle planning mode'));
        console.log(chalk.white('  /clear            Clear conversation history'));
        console.log(chalk.white('  /status           Show current settings\n'));

        console.log(chalk.bold('💡 Example Prompts\n'));
        console.log(chalk.gray('  "Show me all pods that are not running"'));
        console.log(chalk.gray('  "Why is my nginx deployment failing?"'));
        console.log(chalk.gray('  "Check the logs for the api-server pod"'));
        console.log(chalk.gray('  "Analyze my cluster for issues with K8sGPT"'));
        console.log(chalk.gray('  "Scale the frontend deployment to 5 replicas"'));
        console.log();
    }

    /**
     * Display current status
     */
    private displayStatus(): void {
        console.log(chalk.bold('\n⚙️ Current Settings\n'));
        console.log(chalk.white(`  Verbose:      ${this.options.verbose ? chalk.green('ON') : chalk.gray('OFF')}`));
        console.log(chalk.white(`  Auto-execute: ${this.options.autoExecute ? chalk.yellow('ON') : chalk.gray('OFF')}`));
        console.log(chalk.white(`  Plan mode:    ${this.options.planMode ? chalk.blue('ON') : chalk.gray('OFF')}`));

        const cluster = this.configManager.getCluster();
        if (cluster) {
            console.log(chalk.white(`  Context:      ${chalk.cyan(cluster.context || 'default')}`));
            console.log(chalk.white(`  Namespace:    ${chalk.cyan(cluster.namespace || 'default')}`));
        }
        console.log();
    }

    /**
     * Handle special commands
     */
    private handleCommand(input: string): boolean {
        const [command] = input.slice(1).toLowerCase().split(' ');

        switch (command) {
            case 'exit':
            case 'quit':
            case 'q':
                console.log(chalk.cyan('\nGoodbye! 👋\n'));
                this.running = false;
                return true;

            case 'help':
            case 'h':
                this.displayHelp();
                return true;

            case 'verbose':
            case 'v':
                this.options.verbose = !this.options.verbose;
                this.client.setOptions({ verbose: this.options.verbose });
                console.log(chalk.green(`\n✓ Verbose mode ${this.options.verbose ? 'enabled' : 'disabled'}\n`));
                return true;

            case 'auto':
                this.options.autoExecute = !this.options.autoExecute;
                this.client.setOptions({ autoExecute: this.options.autoExecute });
                console.log(chalk.green(`\n✓ Auto-execute ${this.options.autoExecute ? 'enabled' : 'disabled'}\n`));
                return true;

            case 'plan':
                this.options.planMode = !this.options.planMode;
                this.client.setOptions({ planMode: this.options.planMode });
                console.log(chalk.green(`\n✓ Planning mode ${this.options.planMode ? 'enabled' : 'disabled'}\n`));
                return true;

            case 'clear':
                this.conversationHistory = [];
                console.log(chalk.green('\n✓ Conversation history cleared\n'));
                return true;

            case 'status':
                this.displayStatus();
                return true;

            default:
                console.log(chalk.yellow(`\nUnknown command: /${command}`));
                console.log(chalk.gray('Type /help for available commands\n'));
                return true;
        }
    }

    /**
     * Get user input
     */
    private async getUserInput(): Promise<string> {
        const { input } = await inquirer.prompt([
            {
                type: 'input',
                name: 'input',
                message: chalk.bold.cyan('You:'),
                prefix: '',
            },
        ]);

        return input.trim();
    }

    /**
     * Process user message
     */
    private async processMessage(message: string): Promise<void> {
        if (!message) {
            return;
        }

        // Add to conversation history
        this.conversationHistory.push(`User: ${message}`);

        console.log(chalk.bold.green('\n🤖 Assistant:\n'));

        try {
            const { success } = await this.client.runQuery(message);

            if (!success) {
                console.log(chalk.yellow('\n⚠ Query was interrupted\n'));
            }
        } catch (error: any) {
            console.log(chalk.red(`\n❌ Error: ${error.message}\n`));

            if (error.message.includes('API key')) {
                console.log(chalk.yellow('Set your API key: export ANTHROPIC_API_KEY=your-key\n'));
            }
        }

        console.log(); // Add spacing after response
    }

    /**
     * Start the interactive session
     */
    async start(): Promise<void> {
        // Check if configured
        if (!this.isAvailable()) {
            console.log(chalk.red('\n❌ Agent mode requires Claude API key.\n'));
            console.log(chalk.white('Set one of:'));
            console.log(chalk.gray('  export ANTHROPIC_API_KEY=your-key'));
            console.log(chalk.gray('  export CLAUDE_CODE_USE_BEDROCK=1 (with AWS credentials)'));
            console.log(chalk.gray('  export CLAUDE_CODE_USE_VERTEX=1 (with Google Cloud credentials)\n'));
            return;
        }

        // Display welcome
        if (this.options.showWelcome) {
            this.displayWelcome();
        }

        this.running = true;

        // Main interaction loop
        while (this.running) {
            try {
                const input = await this.getUserInput();

                if (!input) {
                    continue;
                }

                // Handle commands
                if (input.startsWith('/')) {
                    this.handleCommand(input);
                    continue;
                }

                // Process message
                await this.processMessage(input);

            } catch (error: any) {
                if (error.isTtyError || error.name === 'ExitPromptError') {
                    // User pressed Ctrl+C
                    console.log(chalk.cyan('\n\nGoodbye! 👋\n'));
                    this.running = false;
                } else {
                    console.log(chalk.red(`\nError: ${error.message}\n`));
                }
            }
        }
    }

    /**
     * Run a single query (non-interactive)
     */
    async runSingle(prompt: string): Promise<void> {
        if (!this.isAvailable()) {
            console.log(chalk.red('Agent mode requires Claude API key.'));
            return;
        }

        console.log(chalk.bold.green('\n🤖 Assistant:\n'));

        try {
            await this.client.runQuery(prompt);
        } catch (error: any) {
            console.log(chalk.red(`\nError: ${error.message}\n`));
        }

        console.log();
    }

    /**
     * Stop the session
     */
    stop(): void {
        this.running = false;
        this.client.abort();
    }
}
