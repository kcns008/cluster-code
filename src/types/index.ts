/**
 * Core types for cluster-code CLI
 */

export interface ClusterConfig {
  context: string;
  namespace: string;
  kubeconfig?: string;
  type?: 'kubernetes' | 'openshift';
  cloud?: 'aws' | 'azure' | 'gcp' | 'on-prem';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface DiagnosticResult {
  resource: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: any;
  recommendations?: string[];
}

export interface CommandOptions {
  verbose?: boolean;
  output?: 'json' | 'yaml' | 'table';
  namespace?: string;
  context?: string;
}

export interface AgentConfig {
  name: string;
  description: string;
  enabled: boolean;
  settings?: Record<string, any>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  commands?: string[];
  agents?: string[];
  enabled: boolean;
}

/**
 * LLM Provider configuration types
 */
export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'ollama'
  | 'openai-compatible'
  | 'custom';

export interface ModelConfig {
  name: string;
  displayName?: string;
  maxTokens?: number;
  contextWindow?: number;
}

export interface ProviderConfig {
  type: ProviderType;
  name: string;
  apiKey?: string;
  baseURL?: string;
  models?: Record<string, ModelConfig>;
  options?: Record<string, any>;
}

export interface LLMConfig {
  provider: string; // provider identifier (e.g., 'anthropic', 'openai', 'custom-ollama')
  model: string; // model identifier (e.g., 'claude-3-5-sonnet-20241022', 'gpt-4')
  maxTokens?: number;
  temperature?: number;
}

/**
 * PufferLib RL Training Configuration
 */
export interface RLTrainingConfig {
  learningRate: number;
  batchSize: number;
  numEpochs: number;
  gamma: number;
  clipRange: number;
  valueCoefficient: number;
  entropyCoefficient: number;
  maxGradNorm: number;
  numEnvs: number;
  numSteps: number;
  hiddenSize: number;
  numLayers: number;
}

/**
 * PufferLib Configuration for RL-based cluster management
 */
export interface PufferLibConfig {
  enabled: boolean;
  pythonPath?: string;
  envPath?: string;
  modelPath?: string;
  trainingConfig?: RLTrainingConfig;
}

export interface ClusterCodeConfig {
  cluster?: ClusterConfig;
  agents?: AgentConfig[];
  plugins?: PluginManifest[];

  // LLM Configuration
  llm?: LLMConfig;
  providers?: Record<string, ProviderConfig>;

  // PufferLib RL Configuration
  pufferlib?: PufferLibConfig;

  // Legacy support (deprecated)
  anthropicApiKey?: string;

  defaultNamespace?: string;
  defaultContext?: string;
}
