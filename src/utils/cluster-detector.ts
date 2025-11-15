/**
 * Cluster Type Detection
 * Detects whether the cluster is OpenShift, ARO, ROSA, or standard Kubernetes
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

export type ClusterType = 'kubernetes' | 'openshift';
export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'on-prem' | 'unknown';

export interface ClusterDetectionResult {
  type: ClusterType;
  cloud: CloudProvider;
  distribution?: string; // e.g., 'ROSA', 'ARO', 'OKD', 'EKS', 'GKE', 'AKS'
  version?: string;
  platformVersion?: string;
}

/**
 * Execute kubectl/oc command with timeout
 */
async function execCommand(command: string, timeoutMs: number = 5000): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: timeoutMs });
    if (stderr && !stderr.includes('Warning')) {
      throw new Error(stderr);
    }
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Command failed: ${error.message}`);
  }
}

/**
 * Check if oc CLI is available
 */
async function isOcAvailable(): Promise<boolean> {
  try {
    await execAsync('which oc');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if kubectl CLI is available
 */
async function isKubectlAvailable(): Promise<boolean> {
  try {
    await execAsync('which kubectl');
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect OpenShift by checking for OpenShift-specific API resources
 */
async function detectOpenShiftAPIs(cli: string = 'kubectl'): Promise<boolean> {
  try {
    // Check for OpenShift-specific API groups
    const output = await execCommand(`${cli} api-resources 2>/dev/null | grep -E 'route.openshift.io|project.openshift.io|image.openshift.io|apps.openshift.io|build.openshift.io' || true`);
    return output.length > 0;
  } catch {
    return false;
  }
}

/**
 * Detect OpenShift version using oc
 */
async function detectOpenShiftVersion(): Promise<{ version: string; distribution?: string } | null> {
  try {
    const ocAvailable = await isOcAvailable();
    if (!ocAvailable) {
      return null;
    }

    const versionOutput = await execCommand('oc version -o json 2>/dev/null || oc version 2>/dev/null');

    try {
      // Try parsing as JSON (newer oc versions)
      const versionData = JSON.parse(versionOutput);
      const serverVersion = versionData.openshiftVersion || versionData.serverVersion?.gitVersion;

      // Detect ROSA
      if (versionOutput.includes('rosa') || versionOutput.includes('ROSA')) {
        return { version: serverVersion, distribution: 'ROSA' };
      }

      // Detect ARO
      if (versionOutput.includes('aro') || versionOutput.includes('ARO') || versionOutput.includes('azure')) {
        return { version: serverVersion, distribution: 'ARO' };
      }

      // Check cluster infrastructure for cloud provider
      try {
        const infraOutput = await execCommand('oc get infrastructure cluster -o json 2>/dev/null');
        const infraData = JSON.parse(infraOutput);
        const platform = infraData.status?.platform || infraData.status?.platformStatus?.type;

        if (platform === 'AWS') {
          return { version: serverVersion, distribution: 'ROSA' };
        } else if (platform === 'Azure') {
          return { version: serverVersion, distribution: 'ARO' };
        }
      } catch {
        // Infrastructure check failed, continue with basic detection
      }

      return { version: serverVersion, distribution: 'OpenShift' };
    } catch {
      // Parse as text (older oc versions)
      const versionMatch = versionOutput.match(/Server Version:\s*v?(\d+\.\d+\.\d+)/i);
      if (versionMatch) {
        return { version: versionMatch[1], distribution: 'OpenShift' };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect cloud provider from node labels
 */
async function detectCloudProvider(cli: string = 'kubectl'): Promise<CloudProvider> {
  try {
    const nodes = await execCommand(`${cli} get nodes -o json 2>/dev/null`);
    const nodesData = JSON.parse(nodes);

    if (nodesData.items && nodesData.items.length > 0) {
      const firstNode = nodesData.items[0];
      const labels = firstNode.metadata?.labels || {};
      const providerID = firstNode.spec?.providerID || '';

      // Check provider ID
      if (providerID.startsWith('aws://')) {
        return 'aws';
      } else if (providerID.startsWith('azure://')) {
        return 'azure';
      } else if (providerID.startsWith('gce://')) {
        return 'gcp';
      }

      // Check labels
      if (labels['node.kubernetes.io/instance-type']?.startsWith('m') ||
          labels['beta.kubernetes.io/instance-type']?.startsWith('m') ||
          labels['topology.kubernetes.io/region']?.startsWith('us-east-')) {
        return 'aws';
      }

      if (labels['kubernetes.azure.com/cluster']) {
        return 'azure';
      }

      if (labels['cloud.google.com/gke-nodepool']) {
        return 'gcp';
      }
    }

    return 'on-prem';
  } catch {
    return 'unknown';
  }
}

/**
 * Detect Kubernetes distribution
 */
async function detectKubernetesDistribution(cloud: CloudProvider, cli: string = 'kubectl'): Promise<string | undefined> {
  try {
    const versionOutput = await execCommand(`${cli} version -o json 2>/dev/null`);
    const versionData = JSON.parse(versionOutput);
    const serverVersion = versionData.serverVersion?.gitVersion || '';

    if (cloud === 'aws') {
      return 'EKS';
    } else if (cloud === 'azure') {
      return 'AKS';
    } else if (cloud === 'gcp') {
      return 'GKE';
    } else if (serverVersion.includes('gke')) {
      return 'GKE';
    } else if (serverVersion.includes('eks')) {
      return 'EKS';
    }

    return 'Kubernetes';
  } catch {
    return 'Kubernetes';
  }
}

/**
 * Get cluster version
 */
async function getClusterVersion(cli: string = 'kubectl'): Promise<string | undefined> {
  try {
    const versionOutput = await execCommand(`${cli} version -o json 2>/dev/null`);
    const versionData = JSON.parse(versionOutput);
    const gitVersion = versionData.serverVersion?.gitVersion || '';
    const match = gitVersion.match(/v?(\d+\.\d+\.\d+)/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detect cluster type and cloud provider
 */
export async function detectCluster(verbose: boolean = false): Promise<ClusterDetectionResult> {
  if (verbose) {
    logger.startSpinner('Detecting cluster type...');
  }

  try {
    // Check if oc is available and try OpenShift detection first
    const ocAvailable = await isOcAvailable();
    const kubectlAvailable = await isKubectlAvailable();

    if (!ocAvailable && !kubectlAvailable) {
      if (verbose) {
        logger.failSpinner();
      }
      throw new Error('Neither oc nor kubectl is available');
    }

    // Try OpenShift detection first if oc is available
    if (ocAvailable) {
      const osVersion = await detectOpenShiftVersion();
      if (osVersion) {
        const cloud = await detectCloudProvider('oc');
        if (verbose) {
          logger.succeedSpinner(`Detected ${osVersion.distribution || 'OpenShift'} cluster`);
        }
        return {
          type: 'openshift',
          cloud,
          distribution: osVersion.distribution,
          version: osVersion.version,
        };
      }
    }

    // Check for OpenShift APIs even if oc is not available
    const cli = ocAvailable ? 'oc' : 'kubectl';
    const hasOpenshiftAPIs = await detectOpenShiftAPIs(cli);

    if (hasOpenshiftAPIs) {
      const cloud = await detectCloudProvider(cli);
      if (verbose) {
        logger.succeedSpinner('Detected OpenShift cluster (via API resources)');
      }
      return {
        type: 'openshift',
        cloud,
        distribution: 'OpenShift',
      };
    }

    // Standard Kubernetes cluster
    const cloud = await detectCloudProvider('kubectl');
    const distribution = await detectKubernetesDistribution(cloud, 'kubectl');
    const version = await getClusterVersion('kubectl');

    if (verbose) {
      logger.succeedSpinner(`Detected ${distribution || 'Kubernetes'} cluster`);
    }

    return {
      type: 'kubernetes',
      cloud,
      distribution,
      version,
    };
  } catch (error: any) {
    if (verbose) {
      logger.failSpinner();
    }
    throw new Error(`Cluster detection failed: ${error.message}`);
  }
}

/**
 * Get recommended CLI tool for the cluster
 */
export function getRecommendedCLI(clusterType: ClusterType, ocAvailable: boolean = false): string {
  if (clusterType === 'openshift' && ocAvailable) {
    return 'oc';
  }
  return 'kubectl';
}

/**
 * Format cluster detection result for display
 */
export function formatClusterInfo(result: ClusterDetectionResult): string {
  let output = '';
  output += `Cluster Type: ${result.type === 'openshift' ? 'OpenShift' : 'Kubernetes'}\n`;

  if (result.distribution) {
    output += `Distribution: ${result.distribution}\n`;
  }

  if (result.version) {
    output += `Version: ${result.version}\n`;
  }

  if (result.cloud && result.cloud !== 'unknown') {
    output += `Cloud Provider: ${result.cloud.toUpperCase()}\n`;
  }

  return output;
}
