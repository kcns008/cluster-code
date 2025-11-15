/**
 * Kubernetes/kubectl utility functions
 * Intelligently chooses between kubectl and oc based on cluster type
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { configManager } from '../config';
import { detectCluster, getRecommendedCLI } from './cluster-detector';
import { logger } from './logger';

const execAsync = promisify(exec);

export interface KubectlOptions {
  context?: string;
  namespace?: string;
  kubeconfig?: string;
  forceCLI?: 'kubectl' | 'oc'; // Force specific CLI tool
  verbose?: boolean; // Show commands being executed
}

let cachedCLI: string | null = null;
let cliDetectionAttempted: boolean = false;

/**
 * Check if a CLI is available
 */
async function isCLIAvailable(cli: string): Promise<boolean> {
  try {
    await execAsync(`which ${cli}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Determine which CLI to use (kubectl or oc)
 */
async function determineCLI(options: KubectlOptions = {}): Promise<string> {
  // If CLI is forced via options, use that
  if (options.forceCLI) {
    return options.forceCLI;
  }

  // Check if we have a cached CLI choice
  if (cachedCLI && cliDetectionAttempted) {
    return cachedCLI;
  }

  try {
    // Check if cluster type is already in config
    const clusterConfig = configManager.getCluster();
    if (clusterConfig?.type) {
      const ocAvailable = await isCLIAvailable('oc');
      const kubectlAvailable = await isCLIAvailable('kubectl');

      if (clusterConfig.type === 'openshift' && ocAvailable) {
        cachedCLI = 'oc';
        cliDetectionAttempted = true;
        return 'oc';
      }

      if (kubectlAvailable) {
        cachedCLI = 'kubectl';
        cliDetectionAttempted = true;
        return 'kubectl';
      }
    }

    // Auto-detect cluster type
    const ocAvailable = await isCLIAvailable('oc');
    const kubectlAvailable = await isCLIAvailable('kubectl');

    if (!ocAvailable && !kubectlAvailable) {
      throw new Error('Neither oc nor kubectl is available');
    }

    // Try to detect cluster type
    try {
      const clusterInfo = await detectCluster(false);
      const recommendedCLI = getRecommendedCLI(clusterInfo.type, ocAvailable);

      // Update config with detected cluster type
      if (clusterConfig) {
        clusterConfig.type = clusterInfo.type;
        // Only set cloud if it's not 'unknown'
        if (clusterInfo.cloud !== 'unknown') {
          clusterConfig.cloud = clusterInfo.cloud;
        }
        configManager.setCluster(clusterConfig);
      }

      cachedCLI = recommendedCLI;
      cliDetectionAttempted = true;
      return recommendedCLI;
    } catch {
      // If detection fails, prefer oc if available, otherwise kubectl
      cachedCLI = ocAvailable ? 'oc' : 'kubectl';
      cliDetectionAttempted = true;
      return cachedCLI;
    }
  } catch (error) {
    // Fallback to kubectl
    cachedCLI = 'kubectl';
    cliDetectionAttempted = true;
    return 'kubectl';
  }
}

/**
 * Reset cached CLI (useful when cluster context changes)
 */
export function resetCLICache(): void {
  cachedCLI = null;
  cliDetectionAttempted = false;
}

/**
 * Build kubectl/oc command with options
 */
async function buildKubectlCommand(command: string, options: KubectlOptions = {}): Promise<string> {
  const cli = await determineCLI(options);
  const parts = [cli];

  if (options.context) {
    parts.push(`--context=${options.context}`);
  }

  if (options.namespace) {
    parts.push(`--namespace=${options.namespace}`);
  }

  if (options.kubeconfig) {
    parts.push(`--kubeconfig=${options.kubeconfig}`);
  }

  parts.push(command);

  return parts.join(' ');
}

/**
 * Execute kubectl/oc command
 */
export async function kubectl(command: string, options: KubectlOptions = {}): Promise<string> {
  const fullCommand = await buildKubectlCommand(command, options);

  if (options.verbose) {
    logger.info(`Running: ${fullCommand}`);
  }

  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    if (stderr && !stderr.includes('Warning')) {
      throw new Error(stderr);
    }
    return stdout.trim();
  } catch (error: any) {
    const cli = await determineCLI(options);
    throw new Error(`${cli} command failed: ${error.message}`);
  }
}

/**
 * Get current kubectl context
 */
export async function getCurrentContext(): Promise<string> {
  return kubectl('config current-context');
}

/**
 * Get contexts
 */
export async function getContexts(): Promise<string[]> {
  const output = await kubectl('config get-contexts -o name');
  return output.split('\n').filter(Boolean);
}

/**
 * Get namespaces
 */
export async function getNamespaces(options: KubectlOptions = {}): Promise<string[]> {
  const output = await kubectl('get namespaces -o name', options);
  return output.split('\n').map(ns => ns.replace('namespace/', '')).filter(Boolean);
}

/**
 * Get pods in namespace
 */
export async function getPods(options: KubectlOptions = {}): Promise<any[]> {
  const output = await kubectl('get pods -o json', options);
  const data = JSON.parse(output);
  return data.items || [];
}

/**
 * Get cluster info
 */
export async function getClusterInfo(options: KubectlOptions = {}): Promise<string> {
  return kubectl('cluster-info', options);
}

/**
 * Check if kubectl is available
 */
export async function isKubectlAvailable(): Promise<boolean> {
  try {
    await execAsync('kubectl version --client');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if cluster is reachable
 */
export async function isClusterReachable(options: KubectlOptions = {}): Promise<boolean> {
  try {
    await kubectl('cluster-info', options);
    return true;
  } catch {
    return false;
  }
}
