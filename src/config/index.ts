/**
 * Configuration management for cluster-code
 */

import * as path from 'path';
import * as fs from 'fs';
import { ClusterCodeConfig, ClusterConfig, LLMConfig, ProviderConfig } from '../types';
import { getDefaultLLMConfig } from '../llm';
import { loadModelConfig } from './model-selector';

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.cluster-code');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CLAUDE_SETTINGS_FILE = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'settings.json');

export class ConfigManager {
  private config: ClusterCodeConfig;

  constructor() {
    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Load existing config or create new one
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        this.config = JSON.parse(data);
      } catch {
        this.config = {};
      }
    } else {
      this.config = {};
    }

    // Migrate legacy config if needed
    this.migrateLegacyConfig();

    // Load Claude Code settings if available
    this.loadClaudeCodeSettings();
  }

  /**
   * Migrate legacy Anthropic-only configuration
   */
  private migrateLegacyConfig(): void {
    if (this.config.anthropicApiKey && !this.config.llm) {
      // Migrate to new format
      if (!this.config.providers) {
        this.config.providers = {};
      }

      if (!this.config.providers['anthropic']) {
        this.config.providers['anthropic'] = {
          type: 'anthropic',
          name: 'Anthropic',
          apiKey: this.config.anthropicApiKey,
        };
      }

      if (!this.config.llm) {
        this.config.llm = {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
        };
      }

      this.save();
    }
  }

  /**
   * Load Claude Code settings if available and no LLM is configured
   */
  private loadClaudeCodeSettings(): void {
    // Only auto-load if no LLM provider is configured
    if (this.config.llm || (this.config.providers && Object.keys(this.config.providers).length > 0)) {
      return;
    }

    // Check if Claude Code settings file exists
    if (!fs.existsSync(CLAUDE_SETTINGS_FILE)) {
      return;
    }

    try {
      const data = fs.readFileSync(CLAUDE_SETTINGS_FILE, 'utf-8');
      const claudeSettings = JSON.parse(data);

      // Extract API key from Claude settings
      if (claudeSettings.apiKey && typeof claudeSettings.apiKey === 'string') {
        // Initialize providers if not present
        if (!this.config.providers) {
          this.config.providers = {};
        }

        // Set up Anthropic provider with Claude API key
        this.config.providers['anthropic'] = {
          type: 'anthropic',
          name: 'Anthropic',
          apiKey: claudeSettings.apiKey,
        };

        // Set default LLM configuration
        this.config.llm = {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
        };

        this.save();
      }
    } catch (error) {
      // Silently fail if Claude settings cannot be read or parsed
      // This is intentional - we don't want to break initialization
      // if Claude Code settings are corrupted or inaccessible
    }
  }

  /**
   * Save configuration to disk
   */
  private save(): void {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  /**
   * Get the current configuration
   */
  getConfig(): ClusterCodeConfig {
    return this.config;
  }

  /**
   * Set configuration value
   */
  set<K extends keyof ClusterCodeConfig>(key: K, value: ClusterCodeConfig[K]): void {
    this.config[key] = value;
    this.save();
  }

  /**
   * Get configuration value
   */
  get<K extends keyof ClusterCodeConfig>(key: K): ClusterCodeConfig[K] | undefined {
    return this.config[key];
  }

  /**
   * Set cluster configuration
   */
  setCluster(config: ClusterConfig): void {
    this.config.cluster = config;
    this.save();
  }

  /**
   * Get cluster configuration
   */
  getCluster(): ClusterConfig | undefined {
    return this.config.cluster;
  }

  /**
   * Get LLM configuration
   * Priority: Copilot (via model-selector) > Configured LLM > Default
   */
  getLLMConfig(): LLMConfig {
    // Check for Copilot configuration first
    const copilotConfig = loadModelConfig();
    if (copilotConfig && copilotConfig.provider === 'copilot') {
      return {
        provider: 'copilot',
        model: copilotConfig.model,
        maxTokens: copilotConfig.default_max_tokens || 4096,
        temperature: copilotConfig.temperature,
      };
    }

    // Fall back to configured LLM or default
    return this.config.llm || getDefaultLLMConfig();
  }

  /**
   * Set LLM configuration
   */
  setLLMConfig(config: LLMConfig): void {
    this.config.llm = config;
    this.save();
  }

  /**
   * Get provider configurations
   */
  getProviders(): Record<string, ProviderConfig> {
    return this.config.providers || {};
  }

  /**
   * Set provider configuration
   */
  setProvider(providerId: string, config: ProviderConfig): void {
    if (!this.config.providers) {
      this.config.providers = {};
    }
    this.config.providers[providerId] = config;
    this.save();
  }

  /**
   * Remove provider configuration
   */
  removeProvider(providerId: string): void {
    if (this.config.providers) {
      delete this.config.providers[providerId];
      this.save();
    }
  }

  /**
   * Get Anthropic API key (legacy support)
   */
  getApiKey(): string | undefined {
    // Check new provider config first
    if (this.config.providers?.['anthropic']?.apiKey) {
      return this.config.providers['anthropic'].apiKey;
    }
    // Fall back to legacy config or env var
    return this.config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Set Anthropic API key (legacy support)
   */
  setApiKey(key: string): void {
    // Set in new format
    this.setProvider('anthropic', {
      type: 'anthropic',
      name: 'Anthropic',
      apiKey: key,
    });

    // Also set in legacy location for backwards compatibility
    this.config.anthropicApiKey = key;
    this.save();
  }

  /**
   * Check if cluster is configured
   */
  isConfigured(): boolean {
    const cluster = this.getCluster();
    return !!cluster && !!cluster.context;
  }

  /**
   * Check if LLM is configured
   * Returns true if any LLM provider is available (including Copilot)
   */
  isLLMConfigured(): boolean {
    try {
      // Check for Copilot configuration
      const copilotConfig = loadModelConfig();
      if (copilotConfig && copilotConfig.provider === 'copilot') {
        return true;
      }

      const llmConfig = this.getLLMConfig();
      const providers = this.getProviders();
      const provider = providers[llmConfig.provider];

      if (!provider) {
        // Check environment variables
        if (llmConfig.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
          return true;
        }
        if (llmConfig.provider === 'openai' && process.env.OPENAI_API_KEY) {
          return true;
        }
        if (llmConfig.provider === 'google' && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
          return true;
        }
        if (llmConfig.provider === 'copilot') {
          // Copilot is configured via model-selector, not providers
          return true;
        }
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all configuration
   */
  clear(): void {
    this.config = {};
    this.save();
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return CONFIG_FILE;
  }
}

export const configManager = new ConfigManager();
