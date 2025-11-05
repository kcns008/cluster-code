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
 */
export function getDefaultLLMConfig(): LLMConfig {
  // Try Anthropic first
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

  // Default to Anthropic (will fail later if no API key)
  return {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
  };
}
