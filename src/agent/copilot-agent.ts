/**
 * Copilot Agent Client
 * 
 * Agent implementation using GitHub Copilot API via the LLM provider system.
 * This provides agent-like functionality when using non-Anthropic providers.
 */

import { ProviderManager, getCopilotModelConfig, isCopilotConfigured } from '../llm';
import { LLMClient } from '../llm/client';
import { configManager } from '../config';
import { LLMConfig } from '../types';

export interface CopilotAgentOptions {
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
   * Maximum number of turns before stopping
   */
  maxTurns?: number;

  /**
   * Callback for handling streaming messages
   */
  onMessage?: (content: string) => void;

  /**
   * Callback for session start
   */
  onSessionStart?: (sessionId: string) => void;

  /**
   * Callback for session end
   */
  onSessionEnd?: (result: { success: boolean; turns: number }) => void;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Build the system prompt for the Kubernetes agent
 */
function buildSystemPrompt(options: CopilotAgentOptions = {}): string {
  const cluster = configManager.getCluster();

  const parts: string[] = [
    `You are Cluster Code, an expert AI assistant specialized in Kubernetes and OpenShift cluster management, troubleshooting, and operations.`,
    '',
    '## Your Capabilities',
    '- Provide kubectl/oc commands to inspect and manage cluster resources',
    '- Help analyze pod logs, events, and resource configurations',
    '- Diagnose issues and suggest remediation steps',
    '- Provide expert recommendations for cluster optimization and security',
    '- Help create and edit YAML manifests for Kubernetes resources',
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
  parts.push('## Guidelines');
  parts.push('1. Provide clear, actionable kubectl commands in code blocks');
  parts.push('2. Explain what each command does and why');
  parts.push('3. For destructive operations (delete, scale to 0, drain), always warn the user first');
  parts.push('4. Provide step-by-step troubleshooting approaches');
  parts.push('5. When creating YAML manifests, follow Kubernetes best practices');
  parts.push('6. Always validate resource specifications before suggesting they be applied');
  parts.push('');
  parts.push('## Response Format');
  parts.push('- Use markdown formatting for clarity');
  parts.push('- Put commands in ```bash code blocks');
  parts.push('- Put YAML in ```yaml code blocks');
  parts.push('- Explain each step clearly');

  if (options.planMode) {
    parts.push('');
    parts.push('## PLANNING MODE ACTIVE');
    parts.push('You are in planning mode. Do NOT suggest executing any commands.');
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
 * Copilot Agent for agentic Kubernetes operations
 * Uses the LLM provider system for multi-model support
 */
export class CopilotAgent {
  private options: CopilotAgentOptions;
  private llmClient: LLMClient | null = null;
  private messages: AgentMessage[] = [];
  private turns: number = 0;
  private sessionId: string;
  private aborted: boolean = false;

  constructor(options: CopilotAgentOptions = {}) {
    this.options = options;
    this.sessionId = `copilot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize the agent with the configured LLM provider
   */
  async initialize(): Promise<void> {
    const copilotConfig = getCopilotModelConfig();
    
    if (!copilotConfig) {
      throw new Error('GitHub Copilot not configured. Run: cluster-code github login');
    }

    const isAvailable = await isCopilotConfigured();
    if (!isAvailable) {
      throw new Error('GitHub Copilot authentication required. Run: cluster-code github login');
    }

    // Create LLM config for Copilot
    const llmConfig: LLMConfig = {
      provider: 'copilot',
      model: copilotConfig.model,
      maxTokens: 4096,
    };

    // Create provider manager with copilot config
    const providerManager = new ProviderManager({
      copilot: {
        type: 'copilot',
        name: 'GitHub Copilot',
      },
    });

    this.llmClient = new LLMClient(providerManager, llmConfig);
  }

  /**
   * Check if the agent is configured
   */
  async isConfigured(): Promise<boolean> {
    return await isCopilotConfigured();
  }

  /**
   * Run a query and get a response
   */
  async runQuery(prompt: string): Promise<{ success: boolean; response: string }> {
    if (!this.llmClient) {
      await this.initialize();
    }

    if (this.aborted) {
      return { success: false, response: 'Query aborted' };
    }

    // Notify session start on first query
    if (this.turns === 0 && this.options.onSessionStart) {
      this.options.onSessionStart(this.sessionId);
    }

    // Add user message
    this.messages.push({ role: 'user', content: prompt });
    this.turns++;

    try {
      // Check turn limit
      if (this.options.maxTurns && this.turns > this.options.maxTurns) {
        return { success: false, response: 'Maximum turns reached' };
      }

      // Generate response using streaming
      const systemPrompt = buildSystemPrompt(this.options);
      let response = '';

      // Filter out system messages before sending to LLM
      const chatMessages = this.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      for await (const chunk of this.llmClient!.stream({
        system: systemPrompt,
        messages: chatMessages,
      })) {
        if (this.aborted) {
          return { success: false, response };
        }

        response += chunk;
        
        if (this.options.onMessage) {
          this.options.onMessage(chunk);
        }
      }

      // Add assistant response to history
      this.messages.push({ role: 'assistant', content: response });

      return { success: true, response };

    } catch (error: any) {
      const errorMsg = `Error: ${error.message}`;
      if (this.options.onMessage) {
        this.options.onMessage(errorMsg);
      }
      return { success: false, response: errorMsg };
    }
  }

  /**
   * Abort the current query
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Reset abort flag for new queries
   */
  reset(): void {
    this.aborted = false;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.messages = [];
    this.turns = 0;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get turn count
   */
  getTurns(): number {
    return this.turns;
  }

  /**
   * End the session
   */
  endSession(): void {
    if (this.options.onSessionEnd) {
      this.options.onSessionEnd({
        success: true,
        turns: this.turns,
      });
    }
  }
}

/**
 * Create a Copilot agent instance
 */
export async function createCopilotAgent(options?: CopilotAgentOptions): Promise<CopilotAgent> {
  const agent = new CopilotAgent(options);
  await agent.initialize();
  return agent;
}
