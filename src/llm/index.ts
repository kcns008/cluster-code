/**
 * LLM Module
 *
 * Provides abstraction for working with multiple LLM providers
 */

export { 
  ProviderManager, 
  getDefaultLLMConfig, 
  getDefaultLLMConfigAsync,
  isCopilotConfigured,
  getCopilotModelConfig,
} from './provider';
export { LLMClient } from './client';
