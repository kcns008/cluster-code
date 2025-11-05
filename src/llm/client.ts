/**
 * LLM Client
 *
 * High-level client for interacting with LLMs via the AI SDK
 */

import { generateText, streamText, LanguageModel } from 'ai';
import { ProviderManager } from './provider';
import { LLMConfig } from '../types';

export interface GenerateOptions {
  system?: string;
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
}

export interface StreamOptions extends GenerateOptions {
  onChunk?: (text: string) => void;
}

/**
 * LLM Client for generating text using configured providers
 */
export class LLMClient {
  private llmConfig: LLMConfig;
  private model: LanguageModel;

  constructor(providerManager: ProviderManager, llmConfig: LLMConfig) {
    this.llmConfig = llmConfig;
    this.model = providerManager.createModel(llmConfig);
  }

  /**
   * Generate text (non-streaming)
   */
  async generate(options: GenerateOptions): Promise<string> {
    const { system, prompt, messages, temperature } = options;

    // Prepare messages
    const finalMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (messages) {
      finalMessages.push(...messages);
    }

    if (prompt) {
      finalMessages.push({ role: 'user', content: prompt });
    }

    if (finalMessages.length === 0) {
      throw new Error('Either messages or prompt must be provided');
    }

    // Generate text
    const result = await generateText({
      model: this.model,
      system,
      messages: finalMessages,
      temperature: temperature !== undefined ? temperature : this.llmConfig.temperature,
    });

    return result.text;
  }

  /**
   * Generate text with streaming
   */
  async *stream(options: StreamOptions): AsyncGenerator<string> {
    const { system, prompt, messages, temperature, onChunk } = options;

    // Prepare messages
    const finalMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (messages) {
      finalMessages.push(...messages);
    }

    if (prompt) {
      finalMessages.push({ role: 'user', content: prompt });
    }

    if (finalMessages.length === 0) {
      throw new Error('Either messages or prompt must be provided');
    }

    // Stream text
    const result = streamText({
      model: this.model,
      system,
      messages: finalMessages,
      temperature: temperature !== undefined ? temperature : this.llmConfig.temperature,
    });

    for await (const chunk of result.textStream) {
      if (onChunk) {
        onChunk(chunk);
      }
      yield chunk;
    }
  }

  /**
   * Get the current LLM configuration
   */
  getConfig(): LLMConfig {
    return { ...this.llmConfig };
  }

  /**
   * Get provider info
   */
  getProviderInfo(): { provider: string; model: string } {
    return {
      provider: this.llmConfig.provider,
      model: this.llmConfig.model,
    };
  }
}
