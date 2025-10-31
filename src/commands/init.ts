/**
 * Initialize cluster connection
 */

import inquirer from 'inquirer';
import { configManager } from '../config';
import { logger } from '../utils/logger';
import { getCurrentContext, getContexts, getNamespaces, isKubectlAvailable, isClusterReachable } from '../utils/kubectl';

interface InitOptions {
  context?: string;
  namespace?: string;
  kubeconfig?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  logger.section('Cluster Code Initialization');

  // Check if kubectl is available
  logger.startSpinner('Checking kubectl availability...');
  const kubectlAvailable = await isKubectlAvailable();

  if (!kubectlAvailable) {
    logger.failSpinner();
    logger.error('kubectl is not installed or not in PATH');
    logger.info('Please install kubectl: https://kubernetes.io/docs/tasks/tools/');
    process.exit(1);
  }
  logger.succeedSpinner('kubectl is available');

  let context = options.context;
  let namespace = options.namespace;

  try {
    // Get current context if not provided
    if (!context) {
      const currentContext = await getCurrentContext();
      const contexts = await getContexts();

      logger.info(`Current context: ${currentContext}`);

      const { selectedContext } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedContext',
          message: 'Select Kubernetes context:',
          choices: contexts,
          default: currentContext,
        },
      ]);

      context = selectedContext;
    }

    // Check cluster connectivity
    logger.startSpinner(`Connecting to cluster (context: ${context})...`);
    const reachable = await isClusterReachable({ context });

    if (!reachable) {
      logger.failSpinner();
      logger.error(`Cannot reach cluster with context: ${context}`);
      logger.info('Please check your kubeconfig and cluster connection');
      process.exit(1);
    }
    logger.succeedSpinner('Connected to cluster');

    // Get namespace if not provided
    if (!namespace) {
      const namespaces = await getNamespaces({ context });

      const { selectedNamespace } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedNamespace',
          message: 'Select default namespace:',
          choices: ['default', ...namespaces.filter(ns => ns !== 'default')],
          default: 'default',
        },
      ]);

      namespace = selectedNamespace;
    }

    // Save configuration
    configManager.setCluster({
      context: context!,
      namespace: namespace!,
      kubeconfig: options.kubeconfig,
    });

    logger.newline();
    logger.success('Cluster configuration saved successfully!');
    logger.info(`Context: ${context}`);
    logger.info(`Namespace: ${namespace}`);

    // Check for API key
    const config = configManager.getConfig();
    const apiKey = process.env.ANTHROPIC_API_KEY || config.anthropicApiKey;

    if (!apiKey) {
      logger.newline();
      logger.warning('ANTHROPIC_API_KEY not configured');
      logger.info('To use the interactive natural language interface, you need an Anthropic API key.');
      logger.info('Get your API key from: https://console.anthropic.com/');

      const { setupApiKey } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setupApiKey',
          message: 'Would you like to configure your API key now?',
          default: true,
        },
      ]);

      if (setupApiKey) {
        const { apiKeyInput } = await inquirer.prompt([
          {
            type: 'password',
            name: 'apiKeyInput',
            message: 'Enter your Anthropic API key:',
            mask: '*',
          },
        ]);

        if (apiKeyInput) {
          configManager.set('anthropicApiKey', apiKeyInput);
          logger.success('API key saved successfully!');
        }
      } else {
        logger.info('You can configure it later:');
        logger.info('  export ANTHROPIC_API_KEY=your-key-here');
        logger.info('Or:');
        logger.info('  cluster-code config set anthropicApiKey your-key-here');
      }
    }

    logger.newline();
    logger.info('You can now use cluster-code commands:');
    logger.info('  cluster-code           - Start interactive mode (natural language)');
    logger.info('  cluster-code diagnose  - Run cluster diagnostics');
    logger.info('  cluster-code chat      - Start legacy chat mode');
    logger.info('  cluster-code --help    - Show all available commands');
  } catch (error: any) {
    logger.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}
