/**
 * Agent Session
 * 
 * Interactive agentic session using the Claude Agent SDK
 * Enhanced with session persistence, better streaming, and improved UX
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { AgentClient, AgentClientOptions } from './agent-client';
import { ConfigManager } from '../config';

export interface AgentSessionOptions extends AgentClientOptions {
    /**
     * Show welcome message
     */
    showWelcome?: boolean;
    /**
     * Custom logger for TUI integration
     */
    logger?: (message: string) => void;
    /**
     * Persist session ID for resumption
     */
    persistSession?: boolean;
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
 * Enhanced with session persistence, cost tracking, and improved UX
 */
export class AgentSession {
    private client: AgentClient;
    private configManager: ConfigManager;
    private options: AgentSessionOptions;
    private running: boolean = false;
    private conversationHistory: string[] = [];
    private currentSessionId: string | null = null;
    private sessionCost: number = 0;
    private sessionTurns: number = 0;

    constructor(options: AgentSessionOptions = {}) {
        this.options = {
            showWelcome: true,
            persistSession: true,
            ...options,
        };
        this.configManager = new ConfigManager();

        // Set up message handlers
        this.client = new AgentClient({
            ...options,
            onMessage: (message) => this.handleMessage(message),
            onToolCall: (toolName, input) => this.handleToolCall(toolName, input),
            onToolResult: (toolName, result) => this.handleToolResult(toolName, result),
            onSessionStart: (sessionId) => this.handleSessionStart(sessionId),
            onSessionEnd: (result) => this.handleSessionEnd(result),
            onPermissionRequest: async (toolName, input) => this.handlePermissionRequest(toolName, input),
        });
    }

    /**
     * Internal logger that routes to console or custom logger
     */
    private log(message: string): void {
        if (this.options.logger) {
            this.options.logger(message);
        } else {
            console.log(message);
        }
    }

    /**
     * Check if agent mode is available
     */
    isAvailable(): boolean {
        return this.client.isConfigured();
    }

    /**
     * Get current session ID
     */
    getSessionId(): string | null {
        return this.currentSessionId;
    }

    /**
     * Handle session start
     */
    private handleSessionStart(sessionId: string): void {
        this.currentSessionId = sessionId;
        if (this.options.verbose) {
            this.log(chalk.gray(`📍 Session ID: ${sessionId}`));
        }
    }

    /**
     * Handle session end
     */
    private handleSessionEnd(result: SDKResultMessage): void {
        if (result.subtype === 'success') {
            this.sessionCost += result.total_cost_usd || 0;
            this.sessionTurns += result.num_turns || 0;

            if (this.options.verbose) {
                this.log(chalk.gray(`\n💰 Query cost: $${(result.total_cost_usd || 0).toFixed(4)}`));
                this.log(chalk.gray(`🔄 Turns: ${result.num_turns || 0}`));
            }
        } else if (result.subtype === 'error_max_turns') {
            this.log(chalk.yellow('\n⚠ Maximum turns reached. Please continue with a follow-up question.'));
        } else if (result.subtype === 'error_max_budget_usd') {
            this.log(chalk.red('\n❌ Budget limit reached.'));
        } else if (result.subtype === 'error_during_execution') {
            this.log(chalk.red(`\n❌ Error during execution: ${(result as any).errors?.join(', ') || 'Unknown error'}`));
        }
    }

    /**
     * Handle permission request for dangerous operations
     */
    private async handlePermissionRequest(toolName: string, input: Record<string, unknown>): Promise<boolean> {
        const displayName = toolName.replace('mcp__kubernetes-tools__', '');
        const command = (input.command as string) || JSON.stringify(input);

        this.log(chalk.yellow(`\n⚠️ Permission required for ${displayName}:`));
        this.log(chalk.gray(`   ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`));

        if (this.options.logger) {
            // In TUI mode, auto-approve or use a different mechanism
            return this.options.autoExecute || false;
        }

        const { approved } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'approved',
                message: 'Allow this operation?',
                default: false,
            },
        ]);

        return approved;
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
                        this.log(chalk.white(item.content));
                    }
                    break;

                case 'thinking':
                    // Show thinking indicator
                    if (this.options.verbose) {
                        this.log(chalk.gray.italic(`💭 ${item.content.substring(0, 100)}...`));
                    }
                    break;

                case 'error':
                    this.log(chalk.red(`\n❌ Error: ${item.content}`));
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
            this.log(chalk.cyan(`\n🔧 ${displayName}`));
            this.log(chalk.gray(JSON.stringify(input, null, 2)));
        } else {
            // Show a minimal indicator
            const inputStr = Object.entries(input)
                .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
                .join(', ')
                .substring(0, 80);
            this.log(chalk.cyan(`\n🔧 ${displayName}: ${inputStr}${inputStr.length >= 80 ? '...' : ''}`));
        }
    }

    /**
     * Handle tool result notifications
     */
    private handleToolResult(toolName: string, result: string): void {
        if (this.options.verbose && result) {
            const displayName = toolName.replace('mcp__kubernetes-tools__', '');
            this.log(chalk.green(`\n📋 ${displayName} result:`));
            // Truncate long results
            const truncated = result.length > 1000 ? result.substring(0, 1000) + '\n...(truncated)' : result;
            this.log(chalk.gray(truncated));
        }
    }

    /**
     * Display welcome message
     */
    private displayWelcome(): void {
        this.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════╗'));
        this.log(chalk.bold.cyan('║           Cluster Code - Agent Mode                   ║'));
        this.log(chalk.bold.cyan('║         Powered by Claude Agent SDK                   ║'));
        this.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════╝\n'));

        this.log(chalk.white('I can help you manage and troubleshoot your Kubernetes cluster.'));
        this.log(chalk.white('Type your request in natural language, or use these commands:\n'));

        this.log(chalk.gray('  /help     - Show available commands'));
        this.log(chalk.gray('  /exit     - Exit agent mode'));
        this.log(chalk.gray('  /verbose  - Toggle verbose output'));
        this.log(chalk.gray('  /auto     - Toggle auto-execute mode'));
        this.log(chalk.gray('  /plan     - Toggle planning mode\n'));

        const cluster = this.configManager.getCluster();
        if (cluster) {
            this.log(chalk.green(`✓ Connected to: ${cluster.context || 'default context'}`));
            this.log(chalk.green(`✓ Namespace: ${cluster.namespace || 'default'}`));
            this.log(chalk.green(`✓ Type: ${cluster.type || 'kubernetes'}\n`));
        } else {
            this.log(chalk.yellow('⚠ No cluster configured. Run: cluster-code init\n'));
        }

        if (this.options.autoExecute) {
            this.log(chalk.yellow('⚡ Auto-execute mode is ON - commands will run without confirmation\n'));
        }

        if (this.options.planMode) {
            this.log(chalk.blue('📋 Planning mode is ON - no commands will be executed\n'));
        }
    }

    /**
     * Display help
     */
    private displayHelp(): void {
        this.log(chalk.bold('\n📖 Agent Mode Commands\n'));
        this.log(chalk.white('  /help             Show this help message'));
        this.log(chalk.white('  /exit, /quit, /q  Exit agent mode'));
        this.log(chalk.white('  /verbose, /v      Toggle verbose output'));
        this.log(chalk.white('  /auto             Toggle auto-execute mode'));
        this.log(chalk.white('  /plan             Toggle planning mode'));
        this.log(chalk.white('  /clear            Clear conversation history'));
        this.log(chalk.white('  /status           Show current settings'));
        this.log(chalk.white('  /session          Show current session info'));
        this.log(chalk.white('  /cost             Show session cost summary\n'));

        this.log(chalk.bold('💡 Example Prompts\n'));
        this.log(chalk.gray('  "Show me all pods that are not running"'));
        this.log(chalk.gray('  "Why is my nginx deployment failing?"'));
        this.log(chalk.gray('  "Check the logs for the api-server pod"'));
        this.log(chalk.gray('  "Analyze my cluster for issues with K8sGPT"'));
        this.log(chalk.gray('  "Scale the frontend deployment to 5 replicas"'));
        this.log(chalk.gray('  "Get the YAML for the nginx deployment"'));
        this.log('');
    }

    /**
     * Display current status
     */
    private displayStatus(): void {
        this.log(chalk.bold('\n⚙️ Current Settings\n'));
        this.log(chalk.white(`  Verbose:      ${this.options.verbose ? chalk.green('ON') : chalk.gray('OFF')}`));
        this.log(chalk.white(`  Auto-execute: ${this.options.autoExecute ? chalk.yellow('ON') : chalk.gray('OFF')}`));
        this.log(chalk.white(`  Plan mode:    ${this.options.planMode ? chalk.blue('ON') : chalk.gray('OFF')}`));

        const cluster = this.configManager.getCluster();
        if (cluster) {
            this.log(chalk.white(`  Context:      ${chalk.cyan(cluster.context || 'default')}`));
            this.log(chalk.white(`  Namespace:    ${chalk.cyan(cluster.namespace || 'default')}`));
        }
        this.log('');
    }

    /**
     * Display session info
     */
    private displaySessionInfo(): void {
        this.log(chalk.bold('\n📍 Session Information\n'));
        this.log(chalk.white(`  Session ID:   ${this.currentSessionId ? chalk.cyan(this.currentSessionId) : chalk.gray('Not started')}`));
        this.log(chalk.white(`  Total Cost:   ${chalk.yellow('$' + this.sessionCost.toFixed(4))}`));
        this.log(chalk.white(`  Total Turns:  ${chalk.cyan(this.sessionTurns.toString())}`));
        this.log(chalk.white(`  Queries:      ${chalk.cyan(this.conversationHistory.length.toString())}`));
        this.log('');
    }

    /**
     * Display cost summary
     */
    private displayCostSummary(): void {
        this.log(chalk.bold('\n💰 Cost Summary\n'));
        this.log(chalk.white(`  Session Cost:   ${chalk.yellow('$' + this.sessionCost.toFixed(4))}`));
        this.log(chalk.white(`  Total Turns:    ${this.sessionTurns}`));
        this.log(chalk.white(`  Avg per Query:  ${chalk.gray('$' + (this.sessionCost / Math.max(1, this.conversationHistory.length)).toFixed(4))}`));
        this.log('');
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
                this.displayCostSummary();
                this.log(chalk.cyan('\nGoodbye! 👋\n'));
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
                this.log(chalk.green(`\n✓ Verbose mode ${this.options.verbose ? 'enabled' : 'disabled'}\n`));
                return true;

            case 'auto':
                this.options.autoExecute = !this.options.autoExecute;
                this.client.setOptions({ autoExecute: this.options.autoExecute });
                this.log(chalk.green(`\n✓ Auto-execute ${this.options.autoExecute ? 'enabled' : 'disabled'}\n`));
                return true;

            case 'plan':
                this.options.planMode = !this.options.planMode;
                this.client.setOptions({ planMode: this.options.planMode });
                this.log(chalk.green(`\n✓ Planning mode ${this.options.planMode ? 'enabled' : 'disabled'}\n`));
                return true;

            case 'clear':
                this.conversationHistory = [];
                this.currentSessionId = null;
                this.sessionCost = 0;
                this.sessionTurns = 0;
                this.log(chalk.green('\n✓ Conversation history cleared\n'));
                return true;

            case 'status':
                this.displayStatus();
                return true;

            case 'session':
                this.displaySessionInfo();
                return true;

            case 'cost':
                this.displayCostSummary();
                return true;

            default:
                this.log(chalk.yellow(`\nUnknown command: /${command}`));
                this.log(chalk.gray('Type /help for available commands\n'));
                return true;
        }
    }

    /**
     * Get user input
     */
    private async getUserInput(): Promise<string> {
        // If headless/custom logger (likely TUI), getUserInput should not be called this way
        // TUI manages input loop. This method is only for CLI interactive mode.
        // However, if we reuse start() loop for TUI, we need to abstract input too.
        // For TUI, we won't call start(), we'll likely call runSingle() or a new method.

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

        this.log(chalk.bold.green('\n🤖 Assistant:\n'));

        try {
            const { success } = await this.client.runQuery(message);

            if (!success) {
                this.log(chalk.yellow('\n⚠ Query was interrupted\n'));
            }
        } catch (error: any) {
            this.log(chalk.red(`\n❌ Error: ${error.message}\n`));

            if (error.message.includes('API key')) {
                this.log(chalk.yellow('Set your API key: export ANTHROPIC_API_KEY=your-key\n'));
            }
        }

        this.log(''); // Add spacing after response
    }

    /**
     * Start the interactive session
     */
    async start(): Promise<void> {
        // Check if configured
        if (!this.isAvailable()) {
            this.log(chalk.red('\n❌ Agent mode requires Claude API key.\n'));
            this.log(chalk.white('Set one of:'));
            this.log(chalk.gray('  export ANTHROPIC_API_KEY=your-key'));
            this.log(chalk.gray('  export CLAUDE_CODE_USE_BEDROCK=1 (with AWS credentials)'));
            this.log(chalk.gray('  export CLAUDE_CODE_USE_VERTEX=1 (with Google Cloud credentials)\n'));
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
                    this.log(chalk.cyan('\n\nGoodbye! 👋\n'));
                    this.running = false;
                } else {
                    this.log(chalk.red(`\nError: ${error.message}\n`));
                }
            }
        }
    }

    /**
     * Run a single query (non-interactive)
     */
    async runSingle(prompt: string): Promise<void> {
        if (!this.isAvailable()) {
            this.log(chalk.red('Agent mode requires Claude API key.'));
            return;
        }

        this.log(chalk.bold.green('\n🤖 Assistant:\n'));

        try {
            await this.client.runQuery(prompt);
        } catch (error: any) {
            this.log(chalk.red(`\nError: ${error.message}\n`));
        }

        this.log('');
    }

    /**
     * Stop the session
     */
    stop(): void {
        this.running = false;
        this.client.abort();
    }
}
