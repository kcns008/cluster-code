/**
 * GitHub Copilot Provider
 *
 * LLM provider implementation for GitHub Copilot API.
 * Uses OAuth device flow for authentication (matching OpenCode's approach).
 */

import ora from 'ora';
import { getCopilotAccessToken, testCopilotAuth } from '../auth/copilot-oauth';
import { logger } from '../utils/logger';

export interface CopilotModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  contextWindow: number;
  recommended?: boolean;
  category?: 'chat' | 'reasoning' | 'code';
}

// Available models on GitHub Copilot API
export const COPILOT_MODELS: CopilotModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Recommended - Best quality for complex tasks',
    maxTokens: 16384,
    contextWindow: 128000,
    recommended: true,
    category: 'chat',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Faster, more cost-effective for simpler tasks',
    maxTokens: 16384,
    contextWindow: 128000,
    category: 'chat',
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'Latest GPT-4 model with improvements',
    maxTokens: 32768,
    contextWindow: 128000,
    category: 'chat',
  },
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Anthropic Claude via GitHub Copilot',
    maxTokens: 8192,
    contextWindow: 200000,
    category: 'chat',
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Latest Anthropic Claude via GitHub Copilot',
    maxTokens: 16384,
    contextWindow: 200000,
    category: 'chat',
  },
  {
    id: 'o1-preview',
    name: 'o1 Preview',
    description: 'OpenAI reasoning model (preview)',
    maxTokens: 32768,
    contextWindow: 128000,
    category: 'reasoning',
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    description: 'Faster OpenAI reasoning model',
    maxTokens: 65536,
    contextWindow: 128000,
    category: 'reasoning',
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini',
    description: 'Latest OpenAI reasoning model',
    maxTokens: 100000,
    contextWindow: 200000,
    category: 'reasoning',
  },
];

/**
 * Get model info by ID
 */
export function getModelInfo(modelId: string): CopilotModel | undefined {
  return COPILOT_MODELS.find(m => m.id === modelId);
}

/**
 * Fetch available models (returns known models, validates access)
 */
export async function fetchCopilotModels(): Promise<CopilotModel[]> {
  const spinner = ora('Checking Copilot access...').start();

  try {
    const authResult = await testCopilotAuth();

    if (!authResult.success) {
      spinner.fail(authResult.message);
      return [];
    }

    spinner.succeed('GitHub Copilot models available');
    return COPILOT_MODELS;
  } catch (error: any) {
    spinner.fail('Failed to check Copilot access');
    logger.debug(`Error: ${error.message}`);
    return [];
  }
}

/**
 * GitHub Copilot Provider class for chat completions
 * Uses the real Copilot API at api.githubcopilot.com
 */
export class CopilotProvider {
  private modelId: string;

  constructor(modelId: string = 'gpt-4o') {
    this.modelId = modelId;
  }

  /**
   * Get valid access token for API calls
   */
  private async getToken(): Promise<{ token: string; baseUrl: string }> {
    const tokenData = await getCopilotAccessToken();

    if (!tokenData) {
      throw new Error(
        'Not authenticated with GitHub Copilot.\n' +
        'Please run: cluster-code github login'
      );
    }

    return tokenData;
  }

  /**
   * Make a chat completion request using Copilot API
   */
  async createChatCompletion(params: {
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
  }): Promise<AsyncGenerator<string> | string> {
    const { token, baseUrl } = await this.getToken();

    // Determine if this is an agent request (last message not from user)
    const lastMessage = params.messages[params.messages.length - 1];
    const isAgent = lastMessage?.role !== 'user';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': params.stream ? 'text/event-stream' : 'application/json',
        'User-Agent': 'ClusterCode-CLI',
        'Openai-Intent': 'conversation-edits',
        'X-Initiator': isAgent ? 'agent' : 'user',
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: params.messages,
        max_tokens: params.maxTokens || 4096,
        temperature: params.temperature ?? 0.7,
        stream: params.stream || false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Copilot authentication failed.\n' +
          'Please re-authenticate: cluster-code github login'
        );
      }

      throw new Error(`Copilot API error: ${response.status} - ${error}`);
    }

    if (params.stream) {
      return this.handleStreamResponse(response);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content || '';
  }

  /**
   * Handle streaming response
   */
  private async *handleStreamResponse(response: Response): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data) as {
                choices: Array<{ delta: { content?: string } }>;
              };
              const content = parsed.choices[0]?.delta?.content;

              if (content) {
                yield content;
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Set the model to use
   */
  setModel(modelId: string): void {
    this.modelId = modelId;
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.modelId;
  }
}

/**
 * Create a Copilot provider instance
 */
export async function createCopilotProvider(modelId?: string): Promise<CopilotProvider> {
  // Verify authentication first
  const authResult = await testCopilotAuth();

  if (!authResult.success) {
    throw new Error(authResult.message);
  }

  return new CopilotProvider(modelId || 'gpt-4o');
}

/**
 * Test if Copilot is available and working
 */
export async function isCopilotAvailable(): Promise<boolean> {
  const result = await testCopilotAuth();
  return result.success;
}

// Re-export for backwards compatibility
export { getCopilotAccessToken, testCopilotAuth } from '../auth/copilot-oauth';

// Legacy exports - kept for backwards compatibility
export const DEFAULT_COPILOT_MODELS = COPILOT_MODELS;
