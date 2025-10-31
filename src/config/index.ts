/**
 * Configuration management for cluster-code
 */

import * as path from 'path';
import * as fs from 'fs';
import { ClusterCodeConfig, ClusterConfig } from '../types';

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.cluster-code');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

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
   * Get Anthropic API key
   */
  getApiKey(): string | undefined {
    return this.config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Set Anthropic API key
   */
  setApiKey(key: string): void {
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
