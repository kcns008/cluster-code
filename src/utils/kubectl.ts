/**
 * Kubernetes/kubectl utility functions
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface KubectlOptions {
  context?: string;
  namespace?: string;
  kubeconfig?: string;
}

/**
 * Build kubectl command with options
 */
function buildKubectlCommand(command: string, options: KubectlOptions = {}): string {
  const parts = ['kubectl'];

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
 * Execute kubectl command
 */
export async function kubectl(command: string, options: KubectlOptions = {}): Promise<string> {
  const fullCommand = buildKubectlCommand(command, options);

  try {
    const { stdout, stderr } = await execAsync(fullCommand);
    if (stderr && !stderr.includes('Warning')) {
      throw new Error(stderr);
    }
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`kubectl command failed: ${error.message}`);
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
