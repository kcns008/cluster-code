/**
 * Show CLI tools and cluster information
 */

import { logger } from '../utils/logger';
import { configManager } from '../config';
import { detectCluster, formatClusterInfo } from '../utils/cluster-detector';
import { getAllCLIVersions, formatCLIVersionInfo, isUpgradeRecommended, printInstallInstructions } from '../utils/cli-version-manager';

export async function infoCommand(): Promise<void> {
  logger.section('Cluster Code - System Information');

  try {
    // Get cluster configuration
    const clusterConfig = configManager.getCluster();

    if (clusterConfig) {
      logger.subsection('Cluster Configuration');
      logger.info(`Context: ${clusterConfig.context}`);
      logger.info(`Namespace: ${clusterConfig.namespace}`);

      if (clusterConfig.type) {
        logger.info(`Type: ${clusterConfig.type}`);
      }

      if (clusterConfig.cloud) {
        logger.info(`Cloud: ${clusterConfig.cloud.toUpperCase()}`);
      }

      if (clusterConfig.kubeconfig) {
        logger.info(`Kubeconfig: ${clusterConfig.kubeconfig}`);
      }

      logger.newline();

      // Try to detect current cluster info
      logger.subsection('Cluster Detection');
      try {
        const clusterInfo = await detectCluster(true);
        logger.newline();
        logger.info(formatClusterInfo(clusterInfo));
      } catch (error: any) {
        logger.error(`Failed to detect cluster: ${error.message}`);
      }
    } else {
      logger.warning('Cluster not configured');
      logger.info('Run `cluster-code init` to configure cluster connection');
      logger.newline();
    }

    // Get CLI versions
    logger.subsection('CLI Tools');
    const cliVersions = await getAllCLIVersions(true);

    logger.newline();
    cliVersions.forEach(info => {
      logger.info(formatCLIVersionInfo(info));
    });

    // Check for recommended upgrades
    const upgradesAvailable = cliVersions.filter(info => isUpgradeRecommended(info));

    if (upgradesAvailable.length > 0) {
      logger.newline();
      logger.subsection('Recommendations');

      upgradesAvailable.forEach(info => {
        if (!info.installed) {
          logger.warning(`Install ${info.name} for enhanced functionality`);
        } else if (info.upgradeAvailable) {
          logger.warning(`Upgrade ${info.name} to ${info.recommendedVersion || 'latest version'}`);
        } else if (!info.versionMatch) {
          logger.warning(`${info.name} client/server version mismatch`);
        }
      });

      logger.newline();
      logger.info('Run `cluster-code info --help-install <tool>` for installation instructions');
    }

    // LLM Configuration
    logger.newline();
    logger.subsection('LLM Configuration');
    const llmConfig = configManager.getLLMConfig();
    logger.info(`Provider: ${llmConfig.provider}`);
    logger.info(`Model: ${llmConfig.model}`);
    if (llmConfig.maxTokens) {
      logger.info(`Max Tokens: ${llmConfig.maxTokens}`);
    }

    // Config file location
    logger.newline();
    logger.subsection('Configuration');
    logger.info(`Config file: ${configManager.getConfigPath()}`);

  } catch (error: any) {
    logger.error(`Failed to retrieve information: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Show installation instructions for a specific tool
 */
export async function infoHelpInstallCommand(tool: string): Promise<void> {
  logger.section(`Installation Instructions - ${tool}`);

  const cliVersions = await getAllCLIVersions(false);
  const toolInfo = cliVersions.find(info => info.name === tool);

  if (!toolInfo) {
    logger.error(`Unknown tool: ${tool}`);
    logger.info('Available tools: kubectl, oc, aws, az, gcloud');
    process.exit(1);
    return; // TypeScript doesn't always recognize process.exit as terminating
  }

  printInstallInstructions(toolInfo);
}
