/**
 * Initialize cluster connection
 */

import inquirer from 'inquirer';
import { configManager } from '../config';
import { logger } from '../utils/logger';
import { getCurrentContext, getContexts, getNamespaces, isKubectlAvailable, isClusterReachable, resetCLICache } from '../utils/kubectl';
import { detectCluster, ClusterType, CloudProvider } from '../utils/cluster-detector';
import { getAllCLIVersions } from '../utils/cli-version-manager';
import { checkPython, getPufferLibStatus } from '../pufferlib/checker';
import { setupPufferLib, generatePufferLibConfig } from '../pufferlib/setup';
import { getDefaultEnvPath } from '../pufferlib/config';

interface InitOptions {
  context?: string;
  namespace?: string;
  kubeconfig?: string;
}

/**
 * Interactive setup for LLM provider
 */
async function setupLLMProvider(): Promise<void> {
  logger.newline();
  logger.section('LLM Provider Setup');

  // Prompt for provider type
  const { providerType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'providerType',
      message: 'Select LLM provider:',
      choices: [
        { name: 'Anthropic (Claude) - Recommended', value: 'anthropic' },
        { name: 'OpenAI (GPT)', value: 'openai' },
        { name: 'Google (Gemini)', value: 'google' },
        { name: 'Ollama (Local models)', value: 'ollama' },
        { name: 'OpenAI-compatible (Custom endpoint)', value: 'openai-compatible' },
      ],
    },
  ]);

  // Provider-specific configuration
  let apiKey: string | undefined;
  let baseURL: string | undefined;
  let model: string;

  switch (providerType) {
    case 'anthropic':
      logger.info('Get your API key from: https://console.anthropic.com/');
      const anthropicAnswers = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your Anthropic API key:',
          mask: '*',
          validate: (input) => input.trim() !== '' || 'API key is required',
        },
      ]);
      apiKey = anthropicAnswers.apiKey;
      model = 'claude-3-5-sonnet-20241022';
      break;

    case 'openai':
      logger.info('Get your API key from: https://platform.openai.com/');
      const openaiAnswers = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your OpenAI API key:',
          mask: '*',
          validate: (input) => input.trim() !== '' || 'API key is required',
        },
      ]);
      apiKey = openaiAnswers.apiKey;
      model = 'gpt-4';
      break;

    case 'google':
      logger.info('Get your API key from: https://makersuite.google.com/app/apikey');
      const googleAnswers = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your Google API key:',
          mask: '*',
          validate: (input) => input.trim() !== '' || 'API key is required',
        },
      ]);
      apiKey = googleAnswers.apiKey;
      model = 'gemini-1.5-pro';
      break;

    case 'ollama':
      logger.info('Make sure Ollama is running locally (ollama serve)');
      const ollamaAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'baseURL',
          message: 'Ollama base URL:',
          default: 'http://localhost:11434/v1',
        },
        {
          type: 'input',
          name: 'model',
          message: 'Model name (e.g., llama3:8b):',
          default: 'llama3:8b',
          validate: (input) => input.trim() !== '' || 'Model name is required',
        },
      ]);
      baseURL = ollamaAnswers.baseURL;
      model = ollamaAnswers.model;
      break;

    case 'openai-compatible':
      const customAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'baseURL',
          message: 'API base URL:',
          validate: (input) => input.trim() !== '' || 'Base URL is required',
        },
        {
          type: 'input',
          name: 'apiKey',
          message: 'API key (leave empty if not required):',
        },
        {
          type: 'input',
          name: 'model',
          message: 'Model name:',
          validate: (input) => input.trim() !== '' || 'Model name is required',
        },
      ]);
      baseURL = customAnswers.baseURL;
      apiKey = customAnswers.apiKey || undefined;
      model = customAnswers.model;
      break;

    default:
      logger.error('Invalid provider type');
      return;
  }

  // Save provider configuration
  const providerConfig: any = {
    type: providerType,
    name: getProviderDisplayName(providerType),
  };

  if (apiKey) {
    providerConfig.apiKey = apiKey;
  }

  if (baseURL) {
    providerConfig.baseURL = baseURL;
  }

  configManager.setProvider(providerType, providerConfig);

  // Set as active LLM configuration
  configManager.setLLMConfig({
    provider: providerType,
    model: model,
    maxTokens: 4096,
  });

  logger.newline();
  logger.success(`${getProviderDisplayName(providerType)} configured successfully!`);
  logger.info(`Active provider: ${providerType}/${model}`);
}

/**
 * Get display name for provider type
 */
function getProviderDisplayName(type: string): string {
  const names: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    ollama: 'Ollama',
    'openai-compatible': 'Custom Provider',
  };
  return names[type] || 'Unknown Provider';
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

    // Detect cluster type
    logger.newline();
    // Store detected info in config (will be saved later)
    let detectedType: ClusterType | undefined;
    let detectedCloud: CloudProvider | undefined;

    try {
      const clusterInfo = await detectCluster(true);
      logger.newline();
      logger.info(`Cluster Type: ${clusterInfo.type}`);
      if (clusterInfo.distribution) {
        logger.info(`Distribution: ${clusterInfo.distribution}`);
      }
      if (clusterInfo.cloud && clusterInfo.cloud !== 'unknown') {
        logger.info(`Cloud Provider: ${clusterInfo.cloud.toUpperCase()}`);
      }

      // Check CLI versions
      logger.newline();
      logger.startSpinner('Checking CLI tool versions...');
      const cliVersions = await getAllCLIVersions(false);
      logger.succeedSpinner('CLI version check complete');

      // Find relevant CLI for this cluster
      const relevantCLI = clusterInfo.type === 'openshift' ? 'oc' : 'kubectl';
      const cliInfo = cliVersions.find(cli => cli.name === relevantCLI);

      if (cliInfo && !cliInfo.versionMatch && cliInfo.serverVersion) {
        logger.newline();
        logger.warning(`Recommended: ${relevantCLI} client version should match server version ${cliInfo.serverVersion}`);
      }

      detectedType = clusterInfo.type;
      detectedCloud = clusterInfo.cloud !== 'unknown' ? clusterInfo.cloud : undefined;
    } catch (error: any) {
      logger.warning(`Cluster detection failed: ${error.message}`);
      logger.info('Continuing with initialization...');
      detectedType = undefined;
      detectedCloud = undefined;
    }
    logger.newline();

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
      type: detectedType,
      cloud: detectedCloud,
    });

    // Reset CLI cache to force re-detection with new config
    resetCLICache();

    logger.newline();
    logger.success('Cluster configuration saved successfully!');
    logger.info(`Context: ${context}`);
    logger.info(`Namespace: ${namespace}`);
    if (detectedType) {
      logger.info(`Type: ${detectedType}`);
    }
    if (detectedCloud) {
      logger.info(`Cloud: ${detectedCloud.toUpperCase()}`);
    }

    // Check for LLM provider configuration
    if (!configManager.isLLMConfigured()) {
      logger.newline();
      logger.warning('No LLM provider configured');
      logger.info('To use the interactive natural language interface, you need to configure an LLM provider.');

      const { setupProvider } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setupProvider',
          message: 'Would you like to configure an LLM provider now?',
          default: true,
        },
      ]);

      if (setupProvider) {
        await setupLLMProvider();
      } else {
        logger.newline();
        logger.info('You can configure a provider later using:');
        logger.info('  cluster-code config provider add <provider-name>');
        logger.info('');
        logger.info('Or use environment variables:');
        logger.info('  export ANTHROPIC_API_KEY=your-key     # For Anthropic Claude');
        logger.info('  export OPENAI_API_KEY=your-key        # For OpenAI GPT');
        logger.info('  export GOOGLE_GENERATIVE_AI_API_KEY=your-key  # For Google Gemini');
      }
    }

    logger.newline();
    logger.info('You can now use cluster-code commands:');
    logger.info('  cluster-code           - Start interactive mode (natural language)');
    logger.info('  cluster-code diagnose  - Run cluster diagnostics');
    logger.info('  cluster-code chat      - Start legacy chat mode');
    logger.info('  cluster-code --help    - Show all available commands');

    // Offer PufferLib RL environment setup
    await offerPufferLibSetup();
  } catch (error: any) {
    logger.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Offer optional PufferLib RL environment setup
 */
async function offerPufferLibSetup(): Promise<void> {
  // Check if already configured
  const existingConfig = configManager.getConfig().pufferlib;
  if (existingConfig?.enabled) {
    return;
  }

  // Check if Python is available
  const python = checkPython();
  if (!python.available) {
    return; // Silently skip if Python not available
  }

  logger.newline();
  logger.section('Advanced: Reinforcement Learning Environment');
  logger.info('cluster-code supports optional RL-based cluster management using PufferLib.');
  logger.info('This allows training AI agents to automatically diagnose and manage clusters.');
  logger.newline();

  const { setupRL } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'setupRL',
      message: 'Would you like to set up the PufferLib RL environment? (Optional)',
      default: false,
    },
  ]);

  if (!setupRL) {
    logger.info('You can set up RL environment later using: cluster-code rl setup');
    return;
  }

  // Ask about CUDA support
  const { useCuda } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useCuda',
      message: 'Install with CUDA/GPU support? (Requires NVIDIA GPU and drivers)',
      default: false,
    },
  ]);

  logger.newline();
  logger.info('Setting up PufferLib RL environment...');
  logger.info('This may take a few minutes to download and install dependencies.');
  logger.newline();

  const result = await setupPufferLib({
    withCuda: useCuda,
    verbose: true,
  });

  if (result.success) {
    const pufferConfig = generatePufferLibConfig(result.envPath);
    configManager.set('pufferlib', pufferConfig);

    logger.newline();
    logger.success('PufferLib RL environment setup complete!');
    logger.info('Use these commands to work with RL agents:');
    logger.info('  cluster-code rl status   - Check RL environment status');
    logger.info('  cluster-code rl train    - Train an RL agent');
    logger.info('  cluster-code rl diagnose - Run RL-based diagnostics');
  } else {
    logger.newline();
    logger.warning('RL environment setup failed, but cluster-code is still usable.');
    logger.info('You can try again later with: cluster-code rl setup');
    for (const error of result.errors) {
      logger.error(`  - ${error}`);
    }
  }
}
