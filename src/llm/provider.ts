/**
 * LLM Provider Factory
 *
 * Creates and manages LLM providers for cluster-code.
 * Supports multiple providers via Vercel AI SDK.
 */

import { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ProviderConfig, LLMConfig } from '../types';
import { getCopilotAccessToken, testCopilotAuth } from '../auth';
import { loadModelConfig } from '../config/model-selector';

export interface ProviderFactory {
  createModel(modelId: string): LanguageModel;
}

/**
 * Create a provider factory for Anthropic
 */
function createAnthropicProvider(config: ProviderConfig): ProviderFactory {
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('Anthropic API key not found. Set ANTHROPIC_API_KEY or configure it in settings.');
  }

  const anthropic = createAnthropic({
    apiKey,
    ...config.options,
  });

  return {
    createModel: (modelId: string) => anthropic(modelId),
  };
}

/**
 * Create a provider factory for OpenAI
 */
function createOpenAIProvider(config: ProviderConfig): ProviderFactory {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not found. Set OPENAI_API_KEY or configure it in settings.');
  }

  const openai = createOpenAI({
    apiKey,
    ...config.options,
  });

  return {
    createModel: (modelId: string) => openai(modelId),
  };
}

/**
 * Create a provider factory for Google (Gemini)
 */
function createGoogleProvider(config: ProviderConfig): ProviderFactory {
  const apiKey = config.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('Google API key not found. Set GOOGLE_GENERATIVE_AI_API_KEY or configure it in settings.');
  }

  const google = createGoogleGenerativeAI({
    apiKey,
    ...config.options,
  });

  return {
    createModel: (modelId: string) => google(modelId),
  };
}

/**
 * Create a provider factory for OpenAI-compatible providers (Ollama, LM Studio, etc.)
 */
function createOpenAICompatibleProvider(config: ProviderConfig): ProviderFactory {
  if (!config.baseURL) {
    throw new Error('baseURL is required for OpenAI-compatible providers');
  }

  const provider = createOpenAI({
    apiKey: config.apiKey || 'not-needed', // Some local providers don't need API keys
    baseURL: config.baseURL,
    ...config.options,
  });

  return {
    createModel: (modelId: string) => provider(modelId),
  };
}

/**
 * Copilot Token Manager
 * Manages OAuth tokens for GitHub Copilot API
 */
class CopilotTokenManager {
  async ensureCopilotToken(): Promise<{ token: string; baseUrl: string }> {
    // Try to get a valid access token
    const tokenData = await getCopilotAccessToken();
    
    if (!tokenData) {
      throw new Error(
        'Not authenticated with GitHub Copilot.\n' +
        'Please authenticate first:\n' +
        '  - Run: cluster-code github login\n' +
        '\nThis will open a browser for GitHub authentication.'
      );
    }

    return tokenData;
  }
}

// Singleton token manager for Copilot
const copilotTokenManager = new CopilotTokenManager();

/**
 * Create a provider factory for GitHub Copilot
 * Uses OAuth device flow with the real Copilot API (api.githubcopilot.com)
 */
function createCopilotProviderFactory(config: ProviderConfig): ProviderFactory {
  return {
    createModel: (modelId: string) => {
      // Create a dynamic provider that uses Copilot OAuth tokens
      const provider = createOpenAI({
        apiKey: 'copilot-oauth-placeholder', // Replaced by custom fetch
        baseURL: 'https://api.githubcopilot.com', // Will be updated per-request
        // Custom fetch to inject the Copilot OAuth token
        fetch: async (url, init) => {
          const { token, baseUrl } = await copilotTokenManager.ensureCopilotToken();
          const headers = new Headers(init?.headers);
          
          // Set Copilot-specific headers (matching OpenCode's approach)
          headers.set('Authorization', `Bearer ${token}`);
          headers.set('User-Agent', 'ClusterCode-CLI');
          headers.set('Openai-Intent', 'conversation-edits');
          
          // Determine if this is an agent or user request
          let isAgent = false;
          if (init?.body) {
            try {
              const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
              if (body?.messages?.length > 0) {
                const lastMessage = body.messages[body.messages.length - 1];
                isAgent = lastMessage?.role !== 'user';
              }
            } catch {
              // Ignore parsing errors
            }
          }
          headers.set('X-Initiator', isAgent ? 'agent' : 'user');

          // Remove OpenAI-specific headers that might conflict
          headers.delete('x-api-key');

          // Update URL to use the correct Copilot API base
          let fixedUrl = url.toString();
          if (fixedUrl.includes('api.githubcopilot.com/v1/')) {
            fixedUrl = fixedUrl.replace('/v1/', '/');
          }
          // Also handle dynamic base URL (for enterprise)
          if (!fixedUrl.startsWith(baseUrl)) {
            const urlPath = new URL(fixedUrl).pathname;
            fixedUrl = `${baseUrl}${urlPath}`;
          }

          return fetch(fixedUrl, {
            ...init,
            headers,
          });
        },
        ...config.options,
      });

      // Use .chat() for the chat/completions API
      return provider.chat(modelId);
    },
  };
}

/**
 * Check if GitHub Copilot is configured and available
 */
export async function isCopilotConfigured(): Promise<boolean> {
  try {
    const result = await testCopilotAuth();
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Get the configured Copilot model from model-selector config
 */
export function getCopilotModelConfig(): { provider: string; model: string } | null {
  const modelConfig = loadModelConfig();
  if (modelConfig && modelConfig.provider === 'copilot') {
    return {
      provider: 'copilot',
      model: modelConfig.model,
    };
  }
  return null;
}

/**
 * Provider Manager
 *
 * Manages LLM providers and creates model instances
 */
export class ProviderManager {
  private providers: Map<string, ProviderFactory> = new Map();
  private providerConfigs: Record<string, ProviderConfig>;

  constructor(providerConfigs: Record<string, ProviderConfig> = {}) {
    this.providerConfigs = providerConfigs;
    this.initializeDefaultProviders();
  }

  /**
   * Initialize default provider configurations
   */
  private initializeDefaultProviders(): void {
    // Add default Anthropic provider if API key exists
    if (!this.providerConfigs['anthropic'] && process.env.ANTHROPIC_API_KEY) {
      this.providerConfigs['anthropic'] = {
        type: 'anthropic',
        name: 'Anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
      };
    }

    // Add default OpenAI provider if API key exists
    if (!this.providerConfigs['openai'] && process.env.OPENAI_API_KEY) {
      this.providerConfigs['openai'] = {
        type: 'openai',
        name: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY,
      };
    }

    // Add default Google provider if API key exists
    if (!this.providerConfigs['google'] && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      this.providerConfigs['google'] = {
        type: 'google',
        name: 'Google',
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      };
    }

    // Add default Copilot provider (will be validated on use)
    if (!this.providerConfigs['copilot']) {
      this.providerConfigs['copilot'] = {
        type: 'copilot',
        name: 'GitHub Copilot',
      };
    }
  }

  /**
   * Get or create a provider factory
   */
  private getProviderFactory(providerId: string): ProviderFactory {
    // Check if already cached
    if (this.providers.has(providerId)) {
      return this.providers.get(providerId)!;
    }

    // Get provider config
    const config = this.providerConfigs[providerId];
    if (!config) {
      throw new Error(`Provider '${providerId}' not configured. Available providers: ${Object.keys(this.providerConfigs).join(', ')}`);
    }

    // Create provider factory based on type
    let factory: ProviderFactory;

    switch (config.type) {
      case 'anthropic':
        factory = createAnthropicProvider(config);
        break;

      case 'openai':
        factory = createOpenAIProvider(config);
        break;

      case 'google':
        factory = createGoogleProvider(config);
        break;

      case 'copilot':
        factory = createCopilotProviderFactory(config);
        break;

      case 'ollama':
      case 'openai-compatible':
        factory = createOpenAICompatibleProvider(config);
        break;

      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }

    // Cache the factory
    this.providers.set(providerId, factory);
    return factory;
  }

  /**
   * Create a language model instance
   */
  createModel(llmConfig: LLMConfig): LanguageModel {
    const factory = this.getProviderFactory(llmConfig.provider);
    return factory.createModel(llmConfig.model);
  }

  /**
   * Get available provider IDs
   */
  getAvailableProviders(): string[] {
    return Object.keys(this.providerConfigs);
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(providerId: string): ProviderConfig | undefined {
    return this.providerConfigs[providerId];
  }

  /**
   * Add or update a provider configuration
   */
  setProviderConfig(providerId: string, config: ProviderConfig): void {
    this.providerConfigs[providerId] = config;
    // Clear cached factory so it gets recreated with new config
    this.providers.delete(providerId);
  }

  /**
   * Remove a provider configuration
   */
  removeProviderConfig(providerId: string): void {
    delete this.providerConfigs[providerId];
    this.providers.delete(providerId);
  }
}

/**
 * Get default LLM configuration
 * Priority: Copilot (if configured) > Anthropic > OpenAI > Google
 */
export function getDefaultLLMConfig(): LLMConfig {
  // Check if Copilot is configured via model-selector
  const copilotConfig = getCopilotModelConfig();
  if (copilotConfig) {
    return {
      provider: 'copilot',
      model: copilotConfig.model,
      maxTokens: 4096,
    };
  }

  // Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096,
    };
  }

  // Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      model: 'gpt-4',
      maxTokens: 4096,
    };
  }

  // Try Google
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      provider: 'google',
      model: 'gemini-1.5-pro',
      maxTokens: 4096,
    };
  }

  // Default to Copilot with gpt-4o (will require authentication)
  return {
    provider: 'copilot',
    model: 'gpt-4o',
    maxTokens: 4096,
  };
}

/**
 * Get LLM configuration with async Copilot check
 * Use this when you need to verify Copilot is actually available
 */
export async function getDefaultLLMConfigAsync(): Promise<LLMConfig> {
  // Check if Copilot is configured and authenticated
  const copilotConfig = getCopilotModelConfig();
  if (copilotConfig) {
    const isAvailable = await isCopilotConfigured();
    if (isAvailable) {
      return {
        provider: 'copilot',
        model: copilotConfig.model,
        maxTokens: 4096,
      };
    }
  }

  // Fall back to sync version
  return getDefaultLLMConfig();
}
