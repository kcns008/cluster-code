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

export interface ClusterCodeConfig {
  cluster?: ClusterConfig;
  agents?: AgentConfig[];
  plugins?: PluginManifest[];
  anthropicApiKey?: string;
  defaultNamespace?: string;
  defaultContext?: string;
}
