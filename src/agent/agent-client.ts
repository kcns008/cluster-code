/**
 * Agent SDK Client
 * 
 * Client for interacting with the Claude Agent SDK for agentic Kubernetes operations
 */

import { query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { createKubernetesMcpServer, getKubernetesToolNames } from './mcp-kubernetes';
import { configManager } from '../config';

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
    parts.push('');
    parts.push('## Guidelines');
    parts.push('1. Always gather information before making changes');
    parts.push('2. Explain what you are doing and why');
    parts.push('3. For destructive operations, confirm the impact first');
    parts.push('4. Provide clear, actionable recommendations');
    parts.push('5. Use the most specific tool for the task (e.g., get_logs for logs, describe_resource for details)');

    if (options.customPrompt) {
        parts.push('');
        parts.push('## Additional Instructions');
        parts.push(options.customPrompt);
    }

    return parts.join('\n');
}

/**
 * Agent SDK Client for agentic Kubernetes operations
 */
export class AgentClient {
    private options: AgentClientOptions;
    private abortController: AbortController | null = null;

    constructor(options: AgentClientOptions = {}) {
        this.options = options;
    }

    /**
     * Check if Claude API key is available
     */
    isConfigured(): boolean {
        return !!(
            process.env.ANTHROPIC_API_KEY ||
            process.env.CLAUDE_CODE_USE_BEDROCK ||
            process.env.CLAUDE_CODE_USE_VERTEX
        );
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
        return 'default';
    }

    /**
     * Run an agentic query against the cluster
     */
    async runQuery(prompt: string): Promise<{ messages: SDKMessage[]; success: boolean }> {
        if (!this.isConfigured()) {
            throw new Error(
                'Claude API key not configured. Set ANTHROPIC_API_KEY environment variable or use Bedrock/Vertex.'
            );
        }

        // Create Kubernetes MCP server
        const kubernetesServer = createKubernetesMcpServer();

        // Create abort controller for this query
        this.abortController = new AbortController();

        const messages: SDKMessage[] = [];

        try {
            const result = query({
                prompt,
                options: {
                    abortController: this.abortController,
                    // Use string type for custom system prompt
                    systemPrompt: buildSystemPrompt(this.options),
                    mcpServers: {
                        'kubernetes-tools': kubernetesServer,
                    },
                    // Allow built-in tools plus our Kubernetes MCP tools
                    allowedTools: [
                        'Bash',
                        'Read',
                        'Grep',
                        'Glob',
                        'WebFetch',
                        'WebSearch',
                        ...getKubernetesToolNames(),
                    ],
                    permissionMode: this.getPermissionMode(),
                    cwd: this.options.workingDirectory || process.cwd(),
                },
            });

            // Stream messages
            for await (const message of result) {
                messages.push(message);

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

                // Handle tool results
                if (message.type === 'result') {
                    const resultMessage = message as any;
                    if (resultMessage.tool_name && this.options.onToolResult) {
                        this.options.onToolResult(
                            resultMessage.tool_name,
                            resultMessage.content || ''
                        );
                    }
                }
            }

            return { messages, success: true };
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return { messages, success: false };
            }
            throw error;
        } finally {
            this.abortController = null;
        }
    }

    /**
     * Abort the current query
     */
    abort(): void {
        if (this.abortController) {
            this.abortController.abort();
        }
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
