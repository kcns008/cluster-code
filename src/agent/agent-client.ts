/**
 * Agent SDK Client
 * 
 * Client for interacting with the Claude Agent SDK for agentic Kubernetes operations
 * Enhanced with session management, hooks, and improved streaming support
 * 
 * This client automatically selects between:
 * - Claude Agent SDK (when using Anthropic API directly)
 * - Copilot Agent (when using GitHub Copilot with any model)
 */

import { 
    query, 
    SDKMessage, 
    SDKResultMessage, 
    SDKSystemMessage,
    HookCallback,
    HookCallbackMatcher,
    PreToolUseHookInput,
    PostToolUseHookInput,
    CanUseTool,
    PermissionResult,
    AgentDefinition
} from '@anthropic-ai/claude-agent-sdk';
import { createKubernetesMcpServer, getKubernetesToolNames } from './mcp-kubernetes';
import { configManager } from '../config';
import { getCopilotModelConfig, isCopilotConfigured } from '../llm';
import { CopilotAgent, CopilotAgentOptions } from './copilot-agent';

/**
 * Subagent definitions for specialized Kubernetes operations
 */
const KUBERNETES_SUBAGENTS: Record<string, AgentDefinition> = {
    'diagnostics': {
        description: 'Specialized agent for diagnosing Kubernetes cluster and pod issues. Use this agent when troubleshooting errors, crashes, or unexpected behavior.',
        prompt: `You are a Kubernetes diagnostics specialist. Your job is to:
1. Analyze pod statuses, events, and logs to identify issues
2. Check resource constraints (CPU, memory limits)
3. Examine networking issues (services, endpoints, network policies)
4. Review configuration problems (ConfigMaps, Secrets, environment variables)
5. Provide clear root cause analysis and remediation steps

Always start by gathering relevant information (events, logs, describe) before making conclusions.`,
        tools: [
            'mcp__kubernetes-tools__kubectl',
            'mcp__kubernetes-tools__describe_resource',
            'mcp__kubernetes-tools__get_logs',
            'mcp__kubernetes-tools__get_events',
            'mcp__kubernetes-tools__cluster_health',
            'mcp__kubernetes-tools__k8sgpt_analyze',
            'Read',
            'Grep',
            'Glob',
        ],
        model: 'sonnet',
    },
    'scaling': {
        description: 'Specialized agent for scaling operations and capacity planning. Use this agent when scaling deployments, analyzing resource usage, or planning capacity.',
        prompt: `You are a Kubernetes scaling and capacity planning specialist. Your job is to:
1. Analyze current resource usage and utilization
2. Recommend appropriate replica counts and resource limits
3. Evaluate HPA and VPA configurations
4. Plan scaling strategies based on traffic patterns
5. Execute scaling operations safely

Always check current state before making scaling changes.`,
        tools: [
            'mcp__kubernetes-tools__kubectl',
            'mcp__kubernetes-tools__describe_resource',
            'mcp__kubernetes-tools__scale_resource',
            'mcp__kubernetes-tools__rollout_status',
            'mcp__kubernetes-tools__cluster_health',
        ],
        model: 'sonnet',
    },
    'security': {
        description: 'Specialized agent for Kubernetes security analysis and hardening. Use this agent when reviewing security configurations, RBAC, or security best practices.',
        prompt: `You are a Kubernetes security specialist. Your job is to:
1. Review RBAC configurations and service accounts
2. Analyze network policies and pod security policies/standards
3. Check for security misconfigurations
4. Review container security contexts
5. Provide security hardening recommendations

Never execute destructive commands. Focus on analysis and recommendations.`,
        tools: [
            'mcp__kubernetes-tools__kubectl',
            'mcp__kubernetes-tools__describe_resource',
            'mcp__kubernetes-tools__get_resource_yaml',
            'Read',
            'Grep',
            'Glob',
        ],
        model: 'sonnet',
    },
    'helm': {
        description: 'Specialized agent for Helm chart management. Use this agent when installing, upgrading, or managing Helm releases.',
        prompt: `You are a Helm package management specialist. Your job is to:
1. Manage Helm releases (install, upgrade, rollback)
2. Analyze Helm chart values and configurations
3. Troubleshoot Helm release issues
4. Recommend chart versions and configurations
5. Manage Helm repositories

Always verify the current state before making changes.`,
        tools: [
            'mcp__kubernetes-tools__kubectl',
            'mcp__kubernetes-tools__helm',
            'mcp__kubernetes-tools__describe_resource',
            'mcp__kubernetes-tools__rollout_status',
            'Read',
            'Write',
            'Edit',
        ],
        model: 'sonnet',
    },
    'yaml-generator': {
        description: 'Specialized agent for generating and editing Kubernetes YAML manifests. Use this agent when creating or modifying resource definitions.',
        prompt: `You are a Kubernetes manifest specialist. Your job is to:
1. Generate well-structured Kubernetes YAML manifests
2. Follow Kubernetes best practices and conventions
3. Include appropriate labels, annotations, and selectors
4. Set reasonable resource limits and requests
5. Add proper health checks and probes

Always validate generated YAML and explain the configuration choices.`,
        tools: [
            'mcp__kubernetes-tools__kubectl',
            'mcp__kubernetes-tools__get_resource_yaml',
            'Read',
            'Write',
            'Edit',
            'Glob',
        ],
        model: 'sonnet',
    },
};

// Dangerous commands that require explicit confirmation
const DANGEROUS_COMMANDS = [
    'delete',
    'drain',
    'cordon',
    'taint',
    'scale --replicas=0',
    'rollout undo',
    'delete namespace',
    'delete pv',
    'delete pvc',
    'apply -f',
    'create -f',
    'patch',
    'edit',
    'rm -rf',
    'drop database',
    'truncate',
];

// Commands that are read-only and safe
const SAFE_COMMANDS = [
    'get',
    'describe',
    'logs',
    'top',
    'explain',
    'api-resources',
    'api-versions',
    'cluster-info',
    'version',
];

export interface AgentClientOptions {
    /**
     * Automatically execute commands without confirmation
     */
    autoExecute?: boolean;

    /**
     * Planning mode - generate plans without executing
     */
    planMode?: boolean;

    /**
     * Verbose mode - show additional debug information
     */
    verbose?: boolean;

    /**
     * Custom system prompt addendum
     */
    customPrompt?: string;

    /**
     * Working directory for file operations
     */
    workingDirectory?: string;

    /**
     * Session ID to resume a previous conversation
     */
    sessionId?: string;

    /**
     * Fork the session instead of continuing it
     */
    forkSession?: boolean;

    /**
     * Maximum budget in USD for the query
     */
    maxBudgetUsd?: number;

    /**
     * Maximum number of turns before stopping
     */
    maxTurns?: number;

    /**
     * Callback for handling streaming messages
     */
    onMessage?: (message: SDKMessage) => void;

    /**
     * Callback for handling tool calls (for UI updates)
     */
    onToolCall?: (toolName: string, input: Record<string, unknown>) => void;

    /**
     * Callback for handling tool results
     */
    onToolResult?: (toolName: string, result: string) => void;

    /**
     * Callback for permission requests on dangerous operations
     */
    onPermissionRequest?: (toolName: string, input: Record<string, unknown>) => Promise<boolean>;

    /**
     * Callback for session start with session ID
     */
    onSessionStart?: (sessionId: string) => void;

    /**
     * Callback for session end with result
     */
    onSessionEnd?: (result: SDKResultMessage) => void;
}

/**
 * Build the system prompt for the Kubernetes agent
 */
function buildSystemPrompt(options: AgentClientOptions = {}): string {
    const cluster = configManager.getCluster();

    const parts: string[] = [
        `You are Cluster Code, an expert AI assistant specialized in Kubernetes and OpenShift cluster management, troubleshooting, and operations.`,
        '',
        '## Your Capabilities',
        '- Execute kubectl/oc commands to inspect and manage cluster resources',
        '- Analyze pod logs, events, and resource configurations',
        '- Diagnose issues using K8sGPT analysis',
        '- Manage Helm releases and charts',
        '- Provide expert recommendations for cluster optimization and security',
        '- Create and edit YAML manifests for Kubernetes resources',
        '',
        '## Current Context',
    ];

    if (cluster) {
        parts.push(`- **Cluster Type**: ${cluster.type || 'kubernetes'}`);
        parts.push(`- **Context**: ${cluster.context || 'default'}`);
        parts.push(`- **Namespace**: ${cluster.namespace || 'default'}`);
        if (cluster.cloud) {
            parts.push(`- **Cloud Provider**: ${cluster.cloud}`);
        }
    } else {
        parts.push('- No cluster context configured. Use `cluster-code init` to configure.');
    }

    parts.push('');
    parts.push('## Available Tools');
    parts.push('You have access to Kubernetes-specific tools via MCP:');
    parts.push('- `kubectl`: Execute kubectl/oc commands');
    parts.push('- `describe_resource`: Get detailed resource information');
    parts.push('- `get_logs`: Get pod/container logs');
    parts.push('- `get_events`: Get cluster events');
    parts.push('- `cluster_health`: Get overall cluster health');
    parts.push('- `helm`: Execute Helm commands');
    parts.push('- `k8sgpt_analyze`: Run K8sGPT AI analysis');
    parts.push('- `scale_resource`: Scale deployments/statefulsets');
    parts.push('- `rollout_status`: Check rollout status');
    parts.push('- `get_resource_yaml`: Get resource YAML manifest');
    parts.push('- `port_forward`: Set up port forwarding');
    parts.push('');
    parts.push('## Specialized Subagents');
    parts.push('You can delegate tasks to specialized subagents using the Task tool:');
    parts.push('- `diagnostics`: For troubleshooting and root cause analysis');
    parts.push('- `scaling`: For capacity planning and scaling operations');
    parts.push('- `security`: For security analysis and hardening recommendations');
    parts.push('- `helm`: For Helm chart management');
    parts.push('- `yaml-generator`: For creating and editing Kubernetes manifests');
    parts.push('');
    parts.push('## Guidelines');
    parts.push('1. Always gather information before making changes');
    parts.push('2. Explain what you are doing and why');
    parts.push('3. For destructive operations (delete, scale to 0, drain), always warn the user first');
    parts.push('4. Provide clear, actionable recommendations');
    parts.push('5. Use the most specific tool for the task (e.g., get_logs for logs, describe_resource for details)');
    parts.push('6. When creating YAML manifests, follow Kubernetes best practices');
    parts.push('7. Always validate resource specifications before applying');

    if (options.planMode) {
        parts.push('');
        parts.push('## PLANNING MODE ACTIVE');
        parts.push('You are in planning mode. Do NOT execute any commands.');
        parts.push('Instead, describe what you WOULD do and create a plan for the user to review.');
    }

    if (options.customPrompt) {
        parts.push('');
        parts.push('## Additional Instructions');
        parts.push(options.customPrompt);
    }

    return parts.join('\n');
}

/**
 * Check if a command is considered dangerous
 */
function isDangerousCommand(command: string): boolean {
    const lowerCommand = command.toLowerCase();
    return DANGEROUS_COMMANDS.some(dangerous => lowerCommand.includes(dangerous));
}

/**
 * Check if a command is safe (read-only)
 */
function isSafeCommand(command: string): boolean {
    const lowerCommand = command.toLowerCase().trim();
    return SAFE_COMMANDS.some(safe => lowerCommand.startsWith(safe));
}

/**
 * Create audit hook for logging tool usage
 */
function createAuditHook(options: AgentClientOptions): HookCallback {
    return async (input, _toolUseId, _context) => {
        const hookInput = input as PostToolUseHookInput;
        if (hookInput.hook_event_name !== 'PostToolUse') {
            return {};
        }

        if (options.verbose) {
            console.log(`[AUDIT] Tool: ${hookInput.tool_name}`);
            console.log(`[AUDIT] Input: ${JSON.stringify(hookInput.tool_input)}`);
            console.log(`[AUDIT] Session: ${hookInput.session_id}`);
        }

        return {};
    };
}

/**
 * Create security hook to block or warn on dangerous operations
 */
function createSecurityHook(options: AgentClientOptions): HookCallback {
    return async (input, _toolUseId, _context) => {
        const hookInput = input as PreToolUseHookInput;
        if (hookInput.hook_event_name !== 'PreToolUse') {
            return {};
        }

        const toolName = hookInput.tool_name;
        const toolInput = hookInput.tool_input as Record<string, unknown>;

        // Check for kubectl commands
        if (toolName.includes('kubectl') || toolName === 'Bash') {
            const command = (toolInput.command as string) || '';

            // Always allow safe commands
            if (isSafeCommand(command)) {
                return {
                    hookSpecificOutput: {
                        hookEventName: hookInput.hook_event_name,
                        permissionDecision: 'allow' as const,
                        permissionDecisionReason: 'Read-only command auto-approved'
                    }
                };
            }

            // Block dangerous commands in plan mode
            if (options.planMode && isDangerousCommand(command)) {
                return {
                    hookSpecificOutput: {
                        hookEventName: hookInput.hook_event_name,
                        permissionDecision: 'deny' as const,
                        permissionDecisionReason: 'Dangerous command blocked in planning mode'
                    },
                    systemMessage: `This command (${command}) would be blocked in planning mode. The user must review and approve before execution.`
                };
            }
        }

        return {};
    };
}

/**
 * Agent SDK Client for agentic Kubernetes operations
 * Enhanced with session management, hooks, permissions, and streaming support
 * 
 * Supports two backends:
 * - Claude Agent SDK (for direct Anthropic API usage)
 * - Copilot Agent (for GitHub Copilot with any model)
 */
export class AgentClient {
    private options: AgentClientOptions;
    private abortController: AbortController | null = null;
    private currentSessionId: string | null = null;
    private copilotAgent: CopilotAgent | null = null;
    private usingCopilot: boolean = false;

    constructor(options: AgentClientOptions = {}) {
        this.options = options;
    }

    /**
     * Check if any agent backend is available
     * Checks both Claude SDK and Copilot configurations
     */
    isConfigured(): boolean {
        // Check for Claude SDK configuration
        const hasClaudeConfig = !!(
            process.env.ANTHROPIC_API_KEY ||
            process.env.CLAUDE_CODE_USE_BEDROCK ||
            process.env.CLAUDE_CODE_USE_VERTEX ||
            process.env.CLAUDE_CODE_USE_FOUNDRY
        );

        // Check for Copilot configuration
        const copilotConfig = getCopilotModelConfig();
        const hasCopilotConfig = copilotConfig !== null;

        return hasClaudeConfig || hasCopilotConfig;
    }

    /**
     * Check if Copilot should be used as the backend
     */
    private shouldUseCopilot(): boolean {
        // If Copilot is configured, prefer it
        const copilotConfig = getCopilotModelConfig();
        if (copilotConfig) {
            return true;
        }

        // Fall back to Claude SDK if Anthropic key is available
        return false;
    }

    /**
     * Check if Copilot is available (async version with auth check)
     */
    async isCopilotAvailable(): Promise<boolean> {
        const copilotConfig = getCopilotModelConfig();
        if (!copilotConfig) {
            return false;
        }
        return await isCopilotConfigured();
    }

    /**
     * Get the current session ID
     */
    getSessionId(): string | null {
        return this.currentSessionId;
    }

    /**
     * Get the permission mode based on options
     */
    private getPermissionMode(): 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' {
        if (this.options.planMode) {
            return 'plan';
        }
        if (this.options.autoExecute) {
            return 'bypassPermissions';
        }
        return 'acceptEdits'; // Default to acceptEdits for better UX
    }

    /**
     * Create custom permission handler for dangerous operations
     */
    private createPermissionHandler(): CanUseTool | undefined {
        if (!this.options.onPermissionRequest) {
            return undefined;
        }

        const onPermissionRequest = this.options.onPermissionRequest;

        return async (toolName, input, _options): Promise<PermissionResult> => {
            // Always allow read-only tools
            const readOnlyTools = ['Read', 'Glob', 'Grep', 'describe_resource', 'get_logs', 'get_events', 'cluster_health'];
            if (readOnlyTools.some(t => toolName.includes(t))) {
                return { behavior: 'allow', updatedInput: input };
            }

            // Check if this is a dangerous command
            const command = (input as Record<string, unknown>).command as string || '';
            if (isDangerousCommand(command)) {
                const allowed = await onPermissionRequest(toolName, input as Record<string, unknown>);
                if (!allowed) {
                    return {
                        behavior: 'deny',
                        message: 'User denied permission for this operation'
                    };
                }
            }

            return { behavior: 'allow', updatedInput: input };
        };
    }

    /**
     * Build hooks configuration
     */
    private buildHooks(): Partial<Record<string, HookCallbackMatcher[]>> {
        const hooks: Partial<Record<string, HookCallbackMatcher[]>> = {};

        // Add security hook for PreToolUse
        hooks['PreToolUse'] = [
            {
                hooks: [createSecurityHook(this.options)]
            }
        ];

        // Add audit hook for PostToolUse
        if (this.options.verbose) {
            hooks['PostToolUse'] = [
                {
                    hooks: [createAuditHook(this.options)]
                }
            ];
        }

        return hooks;
    }

    /**
     * Run an agentic query against the cluster
     * Automatically selects between Claude SDK and Copilot based on configuration
     */
    async runQuery(prompt: string): Promise<{ messages: SDKMessage[]; success: boolean; sessionId?: string }> {
        if (!this.isConfigured()) {
            throw new Error(
                'No LLM provider configured. Either:\n' +
                '  - Run: cluster-code github login (for GitHub Copilot)\n' +
                '  - Set: ANTHROPIC_API_KEY environment variable\n' +
                '  - Use: Bedrock/Vertex/Foundry configuration'
            );
        }

        // Check if we should use Copilot
        if (this.shouldUseCopilot()) {
            return this.runCopilotQuery(prompt);
        }

        // Use Claude SDK
        return this.runClaudeQuery(prompt);
    }

    /**
     * Run a query using the Copilot Agent
     */
    private async runCopilotQuery(prompt: string): Promise<{ messages: SDKMessage[]; success: boolean; sessionId?: string }> {
        // Initialize Copilot agent if needed
        if (!this.copilotAgent) {
            this.copilotAgent = new CopilotAgent({
                autoExecute: this.options.autoExecute,
                planMode: this.options.planMode,
                verbose: this.options.verbose,
                customPrompt: this.options.customPrompt,
                workingDirectory: this.options.workingDirectory,
                maxTurns: this.options.maxTurns,
                onMessage: (content) => {
                    // Convert string content to SDK-like message for callback
                    if (this.options.onMessage) {
                        const sdkMessage: SDKMessage = {
                            type: 'assistant',
                            message: {
                                content: [{ type: 'text', text: content }],
                            },
                        } as any;
                        this.options.onMessage(sdkMessage);
                    }
                },
                onSessionStart: this.options.onSessionStart,
                onSessionEnd: (result) => {
                    if (this.options.onSessionEnd) {
                        const sdkResult: SDKResultMessage = {
                            type: 'result',
                            subtype: result.success ? 'success' : 'error_during_execution',
                            num_turns: result.turns,
                        } as any;
                        this.options.onSessionEnd(sdkResult);
                    }
                },
            });
            await this.copilotAgent.initialize();
        }

        this.usingCopilot = true;
        const messages: SDKMessage[] = [];
        
        try {
            const result = await this.copilotAgent.runQuery(prompt);
            
            // Convert response to SDK-like message format
            if (result.response) {
                messages.push({
                    type: 'assistant',
                    message: {
                        content: [{ type: 'text', text: result.response }],
                    },
                } as any);
            }

            return {
                messages,
                success: result.success,
                sessionId: this.copilotAgent.getSessionId(),
            };
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Run a query using the Claude Agent SDK
     */
    private async runClaudeQuery(prompt: string): Promise<{ messages: SDKMessage[]; success: boolean; sessionId?: string }> {
        // Create Kubernetes MCP server
        const kubernetesServer = createKubernetesMcpServer();

        // Create abort controller for this query
        this.abortController = new AbortController();

        const messages: SDKMessage[] = [];
        let sessionId: string | undefined;

        try {
            const result = query({
                prompt,
                options: {
                    abortController: this.abortController,
                    systemPrompt: buildSystemPrompt(this.options),
                    mcpServers: {
                        'kubernetes-tools': kubernetesServer,
                    },
                    // Subagents for specialized Kubernetes operations
                    agents: KUBERNETES_SUBAGENTS,
                    // Allow built-in tools plus our Kubernetes MCP tools
                    allowedTools: [
                        'Bash',
                        'Read',
                        'Write',
                        'Edit',
                        'Grep',
                        'Glob',
                        'WebFetch',
                        'WebSearch',
                        'TodoWrite',
                        'Task', // Enable subagent invocation
                        ...getKubernetesToolNames(),
                    ],
                    permissionMode: this.getPermissionMode(),
                    canUseTool: this.createPermissionHandler(),
                    cwd: this.options.workingDirectory || process.cwd(),
                    
                    // Session management
                    resume: this.options.sessionId,
                    forkSession: this.options.forkSession,
                    
                    // Budget and turn limits
                    maxBudgetUsd: this.options.maxBudgetUsd,
                    maxTurns: this.options.maxTurns ?? 50,
                    
                    // Enable partial messages for better streaming UX
                    includePartialMessages: true,
                    
                    // Hooks for security and audit
                    hooks: this.buildHooks(),
                    
                    // Load project settings for CLAUDE.md support
                    settingSources: ['project'],
                },
            });

            // Stream messages
            for await (const message of result) {
                messages.push(message);

                // Handle system init message - extract session ID
                if (message.type === 'system' && 'subtype' in message) {
                    const systemMsg = message as SDKSystemMessage;
                    if (systemMsg.subtype === 'init') {
                        sessionId = systemMsg.session_id;
                        this.currentSessionId = sessionId;
                        if (this.options.onSessionStart) {
                            this.options.onSessionStart(sessionId);
                        }
                    }
                }

                // Call message callback if provided
                if (this.options.onMessage) {
                    this.options.onMessage(message);
                }

                // Handle tool-specific callbacks
                if (message.type === 'assistant' && 'message' in message) {
                    const assistantMessage = message as any;
                    if (assistantMessage.message?.content) {
                        for (const block of assistantMessage.message.content) {
                            if (block.type === 'tool_use') {
                                if (this.options.onToolCall) {
                                    this.options.onToolCall(block.name, block.input);
                                }
                            }
                        }
                    }
                }

                // Handle result message
                if (message.type === 'result') {
                    const resultMessage = message as SDKResultMessage;
                    if (this.options.onSessionEnd) {
                        this.options.onSessionEnd(resultMessage);
                    }
                    
                    // Also handle tool results within result messages
                    const resultMsg = message as any;
                    if (resultMsg.tool_name && this.options.onToolResult) {
                        this.options.onToolResult(
                            resultMsg.tool_name,
                            resultMsg.content || ''
                        );
                    }
                }
            }

            return { messages, success: true, sessionId };
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return { messages, success: false, sessionId };
            }
            throw error;
        } finally {
            this.abortController = null;
        }
    }

    /**
     * Resume a previous session
     */
    async resumeSession(sessionId: string, prompt: string): Promise<{ messages: SDKMessage[]; success: boolean }> {
        this.options.sessionId = sessionId;
        return this.runQuery(prompt);
    }

    /**
     * Fork a session and continue with a new branch
     */
    async forkSession(sessionId: string, prompt: string): Promise<{ messages: SDKMessage[]; success: boolean; sessionId?: string }> {
        this.options.sessionId = sessionId;
        this.options.forkSession = true;
        const result = await this.runQuery(prompt);
        this.options.forkSession = false;
        return result;
    }

    /**
     * Abort the current query
     */
    abort(): void {
        if (this.abortController) {
            this.abortController.abort();
        }
        if (this.copilotAgent) {
            this.copilotAgent.abort();
        }
    }

    /**
     * Check if currently using Copilot backend
     */
    isUsingCopilot(): boolean {
        return this.usingCopilot;
    }

    /**
     * Get the current backend name
     */
    getBackendName(): string {
        if (this.usingCopilot) {
            const config = getCopilotModelConfig();
            return `GitHub Copilot (${config?.model || 'gpt-4o'})`;
        }
        return 'Claude Agent SDK';
    }

    /**
     * Update options
     */
    setOptions(options: Partial<AgentClientOptions>): void {
        this.options = { ...this.options, ...options };
    }

    /**
     * Get current options
     */
    getOptions(): AgentClientOptions {
        return { ...this.options };
    }
}
