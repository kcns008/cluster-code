/**
 * Provider management commands
 */

import inquirer from 'inquirer';
import { ConfigManager } from '../config';
import { logger } from '../utils/logger';
import { ProviderConfig, ProviderType } from '../types';
import chalk from 'chalk';

const configManager = new ConfigManager();

/**
 * List all configured providers
 */
export async function providerListCommand(): Promise<void> {
  const providers = configManager.getProviders();
  const llmConfig = configManager.getLLMConfig();

  if (Object.keys(providers).length === 0) {
    logger.info('No providers configured.');
    logger.info('\nTo add a provider, run:');
    logger.info('  cluster-code config provider add <name>');
    logger.info('\nOr set environment variables:');
    logger.info('  export ANTHROPIC_API_KEY=your-key');
    logger.info('  export OPENAI_API_KEY=your-key');
    return;
  }

  logger.section('Configured Providers');

  Object.entries(providers).forEach(([id, provider]) => {
    const isActive = llmConfig.provider === id;
    const marker = isActive ? chalk.green('✓ (active)') : '';

    console.log(chalk.bold(`\n${id} ${marker}`));
    console.log(`  Type: ${provider.type}`);
    console.log(`  Name: ${provider.name}`);

    if (provider.baseURL) {
      console.log(`  Base URL: ${provider.baseURL}`);
    }

    if (provider.apiKey) {
      console.log(`  API Key: ${provider.apiKey.substring(0, 8)}...`);
    }

    if (provider.models && Object.keys(provider.models).length > 0) {
      console.log(`  Models: ${Object.keys(provider.models).join(', ')}`);
    }
  });

  console.log();
  logger.info(`\nActive LLM: ${llmConfig.provider}/${llmConfig.model}`);
}

/**
 * Add a new provider
 */
export async function providerAddCommand(providerId?: string): Promise<void> {
  // If no provider ID provided, prompt for it
  if (!providerId) {
    const { id } = await inquirer.prompt([
      {
        type: 'input',
        name: 'id',
        message: 'Provider ID (e.g., anthropic, openai, ollama):',
        validate: (input) => input.trim() !== '' || 'Provider ID is required',
      },
    ]);
    providerId = id;
  }

  // Check if provider already exists
  const existingProviders = configManager.getProviders();
  if (existingProviders[providerId!]) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Provider '${providerId}' already exists. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwrite) {
      logger.info('Cancelled.');
      return;
    }
  }

  // Prompt for provider details
  const answers: {
    type: ProviderType;
    name: string;
    apiKey?: string;
    baseURL?: string;
  } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Provider type:',
      choices: [
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'OpenAI (GPT)', value: 'openai' },
        { name: 'Google (Gemini)', value: 'google' },
        { name: 'Ollama (Local)', value: 'ollama' },
        { name: 'OpenAI-compatible (Custom)', value: 'openai-compatible' },
      ],
    },
    {
      type: 'input',
      name: 'name',
      message: 'Display name:',
      default: (answers: any) => {
        const typeMap: Record<string, string> = {
          anthropic: 'Anthropic',
          openai: 'OpenAI',
          google: 'Google',
          ollama: 'Ollama',
          'openai-compatible': 'Custom Provider',
        };
        return typeMap[answers.type] || 'Custom Provider';
      },
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (leave empty if not needed):',
      when: (answers: any) => answers.type !== 'ollama',
    },
    {
      type: 'input',
      name: 'baseURL',
      message: 'Base URL:',
      when: (answers: any) => answers.type === 'ollama' || answers.type === 'openai-compatible',
      default: (answers: any) => {
        if (answers.type === 'ollama') {
          return 'http://localhost:11434/v1';
        }
        return '';
      },
    },
  ]);

  const providerConfig: ProviderConfig = {
    type: answers.type,
    name: answers.name,
  };

  if (answers.apiKey) {
    providerConfig.apiKey = answers.apiKey;
  }

  if (answers.baseURL) {
    providerConfig.baseURL = answers.baseURL;
  }

  // Save provider
  configManager.setProvider(providerId!, providerConfig);
  logger.success(`Provider '${providerId}' added successfully!`);

  // Ask if user wants to set as active provider
  const { setActive } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'setActive',
      message: 'Set this as the active provider?',
      default: true,
    },
  ]);

  if (setActive) {
    // Prompt for model
    const { model } = await inquirer.prompt([
      {
        type: 'input',
        name: 'model',
        message: 'Model ID:',
        default: getDefaultModel(answers.type),
      },
    ]);

    configManager.setLLMConfig({
      provider: providerId!,
      model,
      maxTokens: 4096,
    });

    logger.success(`Active provider set to '${providerId}/${model}'`);
  }
}

/**
 * Remove a provider
 */
export async function providerRemoveCommand(providerId?: string): Promise<void> {
  const providers = configManager.getProviders();

  if (Object.keys(providers).length === 0) {
    logger.warning('No providers configured.');
    return;
  }

  // If no provider ID provided, prompt for it
  if (!providerId) {
    const { id } = await inquirer.prompt([
      {
        type: 'list',
        name: 'id',
        message: 'Select provider to remove:',
        choices: Object.keys(providers),
      },
    ]);
    providerId = id;
  }

  // Confirm removal
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove provider '${providerId}'?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled.');
    return;
  }

  configManager.removeProvider(providerId!);
  logger.success(`Provider '${providerId}' removed.`);

  // Check if removed provider was active
  const llmConfig = configManager.getLLMConfig();
  if (llmConfig.provider === providerId!) {
    logger.warning('The removed provider was active. Please configure a new active provider.');
    logger.info('Run: cluster-code config provider set <provider-id>');
  }
}

/**
 * Set active provider
 */
export async function providerSetCommand(providerId?: string): Promise<void> {
  const providers = configManager.getProviders();

  if (Object.keys(providers).length === 0) {
    logger.warning('No providers configured. Please add a provider first.');
    logger.info('Run: cluster-code config provider add');
    return;
  }

  // If no provider ID provided, prompt for it
  if (!providerId) {
    const { id } = await inquirer.prompt([
      {
        type: 'list',
        name: 'id',
        message: 'Select active provider:',
        choices: Object.keys(providers),
      },
    ]);
    providerId = id;
  }

  // Check if provider exists
  if (!providers[providerId!]) {
    logger.error(`Provider '${providerId}' not found.`);
    logger.info('Available providers: ' + Object.keys(providers).join(', '));
    return;
  }

  // Prompt for model
  const { model } = await inquirer.prompt([
    {
      type: 'input',
      name: 'model',
      message: 'Model ID:',
      default: getDefaultModel(providers[providerId!].type),
    },
  ]);

  configManager.setLLMConfig({
    provider: providerId!,
    model,
    maxTokens: 4096,
  });

  logger.success(`Active provider set to '${providerId}/${model}'`);
}

/**
 * Show current active provider
 */
export async function providerShowCommand(): Promise<void> {
  const llmConfig = configManager.getLLMConfig();
  const providers = configManager.getProviders();
  const provider = providers[llmConfig.provider];

  logger.section('Active LLM Configuration');

  console.log(chalk.bold('\nProvider:'), llmConfig.provider);
  console.log(chalk.bold('Model:'), llmConfig.model);
  console.log(chalk.bold('Max Tokens:'), llmConfig.maxTokens || 4096);

  if (provider) {
    console.log(chalk.bold('\nProvider Details:'));
    console.log('  Type:', provider.type);
    console.log('  Name:', provider.name);

    if (provider.baseURL) {
      console.log('  Base URL:', provider.baseURL);
    }

    if (provider.apiKey) {
      console.log('  API Key:', provider.apiKey.substring(0, 8) + '...');
    }
  } else {
    console.log(chalk.yellow('\nNote: Provider configuration not found. Using environment variables.'));
  }

  console.log();
}

/**
 * Get default model for a provider type
 */
function getDefaultModel(type: ProviderType): string {
  const defaults: Record<ProviderType, string> = {
    anthropic: 'claude-3-5-sonnet-20241022',
    openai: 'gpt-4',
    google: 'gemini-1.5-pro',
    ollama: 'llama3',
    'openai-compatible': 'model-name',
    custom: 'model-name',
  };

  return defaults[type] || 'model-name';
}
