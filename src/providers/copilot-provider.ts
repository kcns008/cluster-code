/**
 * GitHub Copilot Provider
 *
 * LLM provider implementation for GitHub Copilot API
 */

import chalk from 'chalk';
import ora from 'ora';
import { getStoredToken, getCopilotToken, testCopilotConnection } from '../auth';
import { logger } from '../utils/logger';

// GitHub Copilot API endpoints
const COPILOT_API_BASE = 'https://api.githubcopilot.com';
const COPILOT_MODELS_ENDPOINT = `${COPILOT_API_BASE}/models`;
const COPILOT_CHAT_COMPLETIONS_ENDPOINT = `${COPILOT_API_BASE}/chat/completions`;

export interface CopilotModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  contextWindow: number;
  recommended?: boolean;
  category?: 'chat' | 'reasoning' | 'code';
}

export interface CopilotModelListResponse {
  models: Array<{
    id: string;
    name: string;
    version?: string;
    capabilities?: {
      family?: string;
      limits?: {
        max_output_tokens?: number;
        max_context_window_tokens?: number;
      };
    };
  }>;
}

// Default model list (used when API is unavailable)
export const DEFAULT_COPILOT_MODELS: CopilotModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Recommended - Best quality for complex tasks',
    maxTokens: 4096,
    contextWindow: 128000,
    recommended: true,
    category: 'chat',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Faster, more cost-effective for simpler tasks',
    maxTokens: 4096,
    contextWindow: 128000,
    category: 'chat',
  },
  {
    id: 'o1-preview',
    name: 'o1 Preview',
    description: 'Advanced reasoning for complex problems',
    maxTokens: 32768,
    contextWindow: 128000,
    category: 'reasoning',
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    description: 'Fast reasoning model',
    maxTokens: 65536,
    contextWindow: 128000,
    category: 'reasoning',
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
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    description: 'Most capable Claude model',
    maxTokens: 4096,
    contextWindow: 200000,
    category: 'chat',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Google Gemini via GitHub Copilot',
    maxTokens: 8192,
    contextWindow: 1048576,
    category: 'chat',
  },
];

/**
 * Fetch available models from GitHub Copilot API
 */
export async function fetchCopilotModels(): Promise<CopilotModel[]> {
  const spinner = ora('Fetching available models...').start();

  try {
    const githubToken = await getStoredToken();

    if (!githubToken) {
      spinner.fail('Not authenticated');
      throw new Error('Not authenticated with GitHub. Please run --setup-github first.');
    }

    // Get Copilot token
    const copilotToken = await getCopilotToken(githubToken);

    // Fetch models from API
    const response = await fetch(COPILOT_MODELS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${copilotToken}`,
        'Accept': 'application/json',
        'User-Agent': 'ClusterCode-CLI',
        'Editor-Version': 'vscode/1.85.0',
        'Editor-Plugin-Version': 'copilot/1.0.0',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Copilot token expired or invalid. Please re-authenticate: cluster-code github login');
      }
      if (response.status === 403) {
        throw new Error('No access to GitHub Copilot. Ensure you have an active Copilot subscription.');
      }
      throw new Error(`Failed to fetch models (${response.status}): ${response.statusText}`);
    }

    const data = await response.json() as CopilotModelListResponse;
    spinner.succeed('Models fetched successfully');

    // Map API response to our model format
    const models: CopilotModel[] = data.models.map((model) => {
      // Find matching default model for additional metadata
      const defaultModel = DEFAULT_COPILOT_MODELS.find(m => m.id === model.id);

      return {
        id: model.id,
        name: model.name || model.id,
        description: defaultModel?.description || `${model.name || model.id} model`,
        maxTokens: model.capabilities?.limits?.max_output_tokens || defaultModel?.maxTokens || 4096,
        contextWindow: model.capabilities?.limits?.max_context_window_tokens || defaultModel?.contextWindow || 128000,
        recommended: defaultModel?.recommended || false,
        category: defaultModel?.category || 'chat',
      };
    });

    // If API returns empty, use defaults
    if (models.length === 0) {
      logger.debug('API returned no models, using defaults');
      return DEFAULT_COPILOT_MODELS;
    }

    return models;
  } catch (error: any) {
    spinner.fail('Failed to fetch models');
    logger.debug(`Error fetching models: ${error.message}`);

    // Return defaults on error
    console.log(chalk.yellow('Using cached model list'));
    return DEFAULT_COPILOT_MODELS;
  }
}

/**
 * Get model info by ID
 */
export function getModelInfo(modelId: string): CopilotModel | undefined {
  return DEFAULT_COPILOT_MODELS.find(m => m.id === modelId);
}

/**
 * GitHub Copilot Provider class for chat completions
 */
export class CopilotProvider {
  private githubToken: string;
  private copilotToken: string | null = null;
  private copilotTokenExpiry: number = 0;
  private modelId: string;

  constructor(githubToken: string, modelId: string = 'gpt-4o') {
    this.githubToken = githubToken;
    this.modelId = modelId;
  }

  /**
   * Get or refresh Copilot token
   */
  private async ensureCopilotToken(): Promise<string> {
    const now = Date.now();

    // Refresh token if expired or about to expire (5 min buffer)
    if (!this.copilotToken || now >= this.copilotTokenExpiry - 300000) {
      this.copilotToken = await getCopilotToken(this.githubToken);
      // Copilot tokens typically expire after 30 minutes
      this.copilotTokenExpiry = now + 25 * 60 * 1000;
    }

    return this.copilotToken;
  }

  /**
   * Make a chat completion request
   */
  async createChatCompletion(params: {
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
  }): Promise<AsyncGenerator<string> | string> {
    const token = await this.ensureCopilotToken();

    const response = await fetch(COPILOT_CHAT_COMPLETIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': params.stream ? 'text/event-stream' : 'application/json',
        'User-Agent': 'ClusterCode-CLI',
        'Editor-Version': 'vscode/1.85.0',
        'Editor-Plugin-Version': 'copilot/1.0.0',
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: params.messages,
        max_tokens: params.maxTokens || 4096,
        temperature: params.temperature || 0.7,
        stream: params.stream || false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
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
  const token = await getStoredToken();

  if (!token) {
    throw new Error('Not authenticated with GitHub. Please run --setup-github first.');
  }

  return new CopilotProvider(token, modelId || 'gpt-4o');
}

/**
 * Test if Copilot is available and working
 */
export async function isCopilotAvailable(): Promise<boolean> {
  try {
    const token = await getStoredToken();
    if (!token) return false;

    const result = await testCopilotConnection(token);
    return result.success;
  } catch {
    return false;
  }
}
