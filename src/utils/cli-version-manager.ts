/**
 * CLI Version Management
 * Checks CLI tool versions and provides upgrade recommendations
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { logger } from './logger';

const execAsync = promisify(exec);

export interface CLIVersionInfo {
  name: string;
  installed: boolean;
  clientVersion?: string;
  serverVersion?: string;
  versionMatch: boolean;
  recommendedVersion?: string;
  downloadURL?: string;
  upgradeAvailable: boolean;
}

/**
 * Parse version string (e.g., "v1.28.3" -> "1.28.3")
 */
function parseVersion(version: string): string {
  const match = version.match(/v?(\d+\.\d+\.\d+)/);
  return match ? match[1] : version;
}

/**
 * Compare versions (returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2)
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = parseVersion(v1).split('.').map(Number);
  const parts2 = parseVersion(v2).split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }

  return 0;
}

/**
 * Check if versions are compatible (within one minor version)
 */
function areVersionsCompatible(clientVersion: string, serverVersion: string): boolean {
  const client = parseVersion(clientVersion).split('.').map(Number);
  const server = parseVersion(serverVersion).split('.').map(Number);

  // Major version must match
  if (client[0] !== server[0]) {
    return false;
  }

  // Minor version difference should be at most 1
  const minorDiff = Math.abs(client[1] - server[1]);
  return minorDiff <= 1;
}

/**
 * Get download URL for CLI tool
 */
function getDownloadURL(tool: string, version?: string): string {
  const platform = os.platform();
  const arch = os.arch();

  // Map nodejs arch to CLI tool arch
  const archMap: Record<string, string> = {
    'x64': 'amd64',
    'arm64': 'arm64',
    'arm': 'arm',
  };
  const cliArch = archMap[arch] || arch;

  // Map nodejs platform to CLI tool platform
  const platformMap: Record<string, string> = {
    'darwin': 'darwin',
    'linux': 'linux',
    'win32': 'windows',
  };
  const cliPlatform = platformMap[platform] || platform;

  switch (tool) {
    case 'kubectl':
      if (version) {
        return `https://dl.k8s.io/release/v${version}/bin/${cliPlatform}/${cliArch}/kubectl`;
      }
      return `https://kubernetes.io/docs/tasks/tools/`;

    case 'oc':
      return `https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest/`;

    case 'aws':
      if (cliPlatform === 'linux') {
        return `https://awscli.amazonaws.com/awscli-exe-linux-${arch}.zip`;
      } else if (cliPlatform === 'darwin') {
        return `https://awscli.amazonaws.com/AWSCLIV2.pkg`;
      }
      return `https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html`;

    case 'az':
      return `https://docs.microsoft.com/en-us/cli/azure/install-azure-cli`;

    case 'gcloud':
      return `https://cloud.google.com/sdk/docs/install`;

    default:
      return '';
  }
}

/**
 * Get kubectl version information
 */
export async function getKubectlVersion(): Promise<CLIVersionInfo> {
  try {
    const { stdout } = await execAsync('kubectl version -o json 2>/dev/null', { timeout: 5000 });
    const versionData = JSON.parse(stdout);

    const clientVersion = parseVersion(versionData.clientVersion?.gitVersion || '');
    const serverVersion = parseVersion(versionData.serverVersion?.gitVersion || '');

    const versionMatch = areVersionsCompatible(clientVersion, serverVersion);
    const upgradeAvailable = compareVersions(clientVersion, serverVersion) < 0;

    return {
      name: 'kubectl',
      installed: true,
      clientVersion,
      serverVersion,
      versionMatch,
      recommendedVersion: serverVersion,
      downloadURL: getDownloadURL('kubectl', serverVersion),
      upgradeAvailable,
    };
  } catch (error) {
    // kubectl not installed or not reachable
    try {
      await execAsync('which kubectl');
      // kubectl exists but cluster not reachable
      const { stdout } = await execAsync('kubectl version --client -o json 2>/dev/null');
      const versionData = JSON.parse(stdout);
      const clientVersion = parseVersion(versionData.clientVersion?.gitVersion || '');

      return {
        name: 'kubectl',
        installed: true,
        clientVersion,
        versionMatch: false,
        upgradeAvailable: false,
      };
    } catch {
      return {
        name: 'kubectl',
        installed: false,
        versionMatch: false,
        downloadURL: getDownloadURL('kubectl'),
        upgradeAvailable: false,
      };
    }
  }
}

/**
 * Get oc version information
 */
export async function getOcVersion(): Promise<CLIVersionInfo> {
  try {
    const { stdout } = await execAsync('oc version -o json 2>/dev/null || oc version 2>/dev/null', { timeout: 5000 });

    try {
      // Try parsing as JSON
      const versionData = JSON.parse(stdout);
      const clientVersion = parseVersion(versionData.releaseClientVersion || versionData.clientVersion?.gitVersion || '');
      const serverVersion = parseVersion(versionData.openshiftVersion || versionData.serverVersion?.gitVersion || '');

      const versionMatch = areVersionsCompatible(clientVersion, serverVersion);
      const upgradeAvailable = compareVersions(clientVersion, serverVersion) < 0;

      return {
        name: 'oc',
        installed: true,
        clientVersion,
        serverVersion,
        versionMatch,
        recommendedVersion: serverVersion,
        downloadURL: getDownloadURL('oc'),
        upgradeAvailable,
      };
    } catch {
      // Parse as text
      const clientMatch = stdout.match(/Client Version:\s*v?(\d+\.\d+\.\d+)/i);
      const serverMatch = stdout.match(/Server Version:\s*v?(\d+\.\d+\.\d+)/i);

      const clientVersion = clientMatch ? clientMatch[1] : undefined;
      const serverVersion = serverMatch ? serverMatch[1] : undefined;

      const versionMatch = clientVersion && serverVersion ? areVersionsCompatible(clientVersion, serverVersion) : false;
      const upgradeAvailable = clientVersion && serverVersion ? compareVersions(clientVersion, serverVersion) < 0 : false;

      return {
        name: 'oc',
        installed: true,
        clientVersion,
        serverVersion,
        versionMatch,
        recommendedVersion: serverVersion,
        downloadURL: getDownloadURL('oc'),
        upgradeAvailable,
      };
    }
  } catch (error) {
    // oc not installed or not reachable
    try {
      await execAsync('which oc');
      // oc exists but cluster not reachable
      const { stdout } = await execAsync('oc version --client 2>/dev/null');
      const clientMatch = stdout.match(/Client Version:\s*v?(\d+\.\d+\.\d+)/i) || stdout.match(/v?(\d+\.\d+\.\d+)/);
      const clientVersion = clientMatch ? clientMatch[1] : undefined;

      return {
        name: 'oc',
        installed: true,
        clientVersion,
        versionMatch: false,
        upgradeAvailable: false,
      };
    } catch {
      return {
        name: 'oc',
        installed: false,
        versionMatch: false,
        downloadURL: getDownloadURL('oc'),
        upgradeAvailable: false,
      };
    }
  }
}

/**
 * Get AWS CLI version
 */
export async function getAwsCliVersion(): Promise<CLIVersionInfo> {
  try {
    const { stdout } = await execAsync('aws --version 2>&1', { timeout: 5000 });
    const versionMatch = stdout.match(/aws-cli\/(\d+\.\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : undefined;

    return {
      name: 'aws',
      installed: true,
      clientVersion: version,
      versionMatch: true,
      upgradeAvailable: false,
    };
  } catch {
    return {
      name: 'aws',
      installed: false,
      versionMatch: false,
      downloadURL: getDownloadURL('aws'),
      upgradeAvailable: false,
    };
  }
}

/**
 * Get Azure CLI version
 */
export async function getAzCliVersion(): Promise<CLIVersionInfo> {
  try {
    const { stdout } = await execAsync('az version -o json 2>/dev/null', { timeout: 5000 });
    const versionData = JSON.parse(stdout);
    const version = versionData['azure-cli'];

    return {
      name: 'az',
      installed: true,
      clientVersion: version,
      versionMatch: true,
      upgradeAvailable: false,
    };
  } catch {
    return {
      name: 'az',
      installed: false,
      versionMatch: false,
      downloadURL: getDownloadURL('az'),
      upgradeAvailable: false,
    };
  }
}

/**
 * Get Google Cloud CLI version
 */
export async function getGcloudVersion(): Promise<CLIVersionInfo> {
  try {
    const { stdout } = await execAsync('gcloud version --format=json 2>/dev/null', { timeout: 5000 });
    const versionData = JSON.parse(stdout);
    const version = versionData['Google Cloud SDK'];

    return {
      name: 'gcloud',
      installed: true,
      clientVersion: version,
      versionMatch: true,
      upgradeAvailable: false,
    };
  } catch {
    return {
      name: 'gcloud',
      installed: false,
      versionMatch: false,
      downloadURL: getDownloadURL('gcloud'),
      upgradeAvailable: false,
    };
  }
}

/**
 * Get version information for all CLI tools
 */
export async function getAllCLIVersions(verbose: boolean = false): Promise<CLIVersionInfo[]> {
  if (verbose) {
    logger.startSpinner('Checking CLI versions...');
  }

  const versions = await Promise.all([
    getKubectlVersion(),
    getOcVersion(),
    getAwsCliVersion(),
    getAzCliVersion(),
    getGcloudVersion(),
  ]);

  if (verbose) {
    logger.succeedSpinner('CLI version check complete');
  }

  return versions;
}

/**
 * Format CLI version info for display
 */
export function formatCLIVersionInfo(info: CLIVersionInfo): string {
  let output = '';

  if (!info.installed) {
    output += `  ✗ ${info.name} (not installed)\n`;
    if (info.downloadURL) {
      output += `    Download: ${info.downloadURL}\n`;
    }
    return output;
  }

  output += `  ✓ ${info.name}`;

  if (info.clientVersion) {
    output += ` (client: ${info.clientVersion}`;
    if (info.serverVersion) {
      output += `, server: ${info.serverVersion}`;
    }
    output += ')';
  }

  output += '\n';

  if (info.serverVersion && !info.versionMatch) {
    output += `    ⚠ Warning: Client and server versions may be incompatible\n`;
    if (info.recommendedVersion) {
      output += `    Recommended: ${info.recommendedVersion}\n`;
    }
  }

  if (info.upgradeAvailable && info.recommendedVersion) {
    output += `    ⬆ Upgrade available: ${info.recommendedVersion}\n`;
    if (info.downloadURL) {
      output += `    Download: ${info.downloadURL}\n`;
    }
  }

  return output;
}

/**
 * Check if CLI upgrade is recommended
 */
export function isUpgradeRecommended(info: CLIVersionInfo): boolean {
  return !info.versionMatch || info.upgradeAvailable;
}

/**
 * Print installation/upgrade instructions
 */
export function printInstallInstructions(info: CLIVersionInfo): void {
  if (!info.installed) {
    logger.newline();
    logger.warning(`${info.name} is not installed`);
    logger.info(`To install ${info.name}:`);

    if (info.downloadURL) {
      logger.info(`  Visit: ${info.downloadURL}`);
    }

    switch (info.name) {
      case 'kubectl':
        logger.info(`  Or use package manager:`);
        logger.info(`    # macOS`);
        logger.info(`    brew install kubectl`);
        logger.info(`    # Linux`);
        logger.info(`    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"`);
        break;

      case 'oc':
        logger.info(`  Or use package manager:`);
        logger.info(`    # macOS`);
        logger.info(`    brew install openshift-cli`);
        logger.info(`    # Linux`);
        logger.info(`    Download from: https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest/`);
        break;

      case 'aws':
        logger.info(`  Or use package manager:`);
        logger.info(`    # macOS`);
        logger.info(`    brew install awscli`);
        logger.info(`    # Linux`);
        logger.info(`    pip install awscli`);
        break;

      case 'az':
        logger.info(`  Or use package manager:`);
        logger.info(`    # macOS`);
        logger.info(`    brew install azure-cli`);
        logger.info(`    # Linux`);
        logger.info(`    curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash`);
        break;

      case 'gcloud':
        logger.info(`  Visit: https://cloud.google.com/sdk/docs/install`);
        break;
    }
  } else if (info.upgradeAvailable && info.recommendedVersion) {
    logger.newline();
    logger.warning(`${info.name} upgrade available: ${info.clientVersion} -> ${info.recommendedVersion}`);
    logger.info(`To upgrade ${info.name}:`);

    if (info.downloadURL) {
      logger.info(`  Visit: ${info.downloadURL}`);
    }

    switch (info.name) {
      case 'kubectl':
        logger.info(`  Or use package manager:`);
        logger.info(`    # macOS`);
        logger.info(`    brew upgrade kubectl`);
        logger.info(`    # Linux`);
        logger.info(`    curl -LO "https://dl.k8s.io/release/v${info.recommendedVersion}/bin/linux/amd64/kubectl"`);
        break;

      case 'oc':
        logger.info(`  Or download from: https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest/`);
        break;

      case 'aws':
        logger.info(`  pip install --upgrade awscli`);
        break;

      case 'az':
        logger.info(`  az upgrade`);
        break;

      case 'gcloud':
        logger.info(`  gcloud components update`);
        break;
    }
  }
}
