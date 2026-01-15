/**
 * Model Selector
 *
 * Interactive UI for selecting GitHub Copilot models
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { fetchCopilotModels, CopilotModel, COPILOT_MODELS } from '../providers';
import { logger } from '../utils/logger';

const CLAUDE_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude');
const CONFIG_FILE = path.join(CLAUDE_DIR, 'config.json');

export interface ModelConfig {
  provider: string;
  model: string;
  default_max_tokens: number;
  temperature: number;
  updated_at?: string;
}

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  }
}

/**
 * Load model configuration
 */
export function loadModelConfig(): ModelConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return null;
    }

    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.debug('Failed to load model config');
    return null;
  }
}

/**
 * Save model configuration
 */
export function saveModelConfig(config: ModelConfig): void {
  ensureConfigDir();
  config.updated_at = new Date().toISOString();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Get category icon
 */
function getCategoryIcon(category?: string): string {
  switch (category) {
    case 'reasoning':
      return '🧠';
    case 'code':
      return '💻';
    default:
      return '💬';
  }
}

/**
 * Format model choice for display
 */
function formatModelChoice(model: CopilotModel): string {
  const icon = getCategoryIcon(model.category);
  const recommended = model.recommended ? chalk.green(' ★ Recommended') : '';
  const name = model.recommended ? chalk.bold(model.name) : model.name;

  return `${icon} ${name}${recommended}\n     ${chalk.gray(model.description)}`;
}

/**
 * Display interactive model selection prompt
 */
export async function selectModel(options?: {
  showHeader?: boolean;
  currentModel?: string;
}): Promise<string | null> {
  const { showHeader = true, currentModel } = options || {};

  if (showHeader) {
    console.log('\n' + chalk.cyan('╭─────────────────────────────────────────────────────╮'));
    console.log(chalk.cyan('│') + chalk.bold('  Select your GitHub Copilot model:                  ') + chalk.cyan('│'));
    console.log(chalk.cyan('├─────────────────────────────────────────────────────┤'));
  }

  // Fetch available models
  let models: CopilotModel[];
  try {
    models = await fetchCopilotModels();
    // If empty (auth failed), fall back to static list
    if (models.length === 0) {
      models = COPILOT_MODELS;
    }
  } catch {
    models = COPILOT_MODELS;
  }

  // Safety check - ensure we have models
  if (models.length === 0) {
    console.log(chalk.red('No models available. Using default model.'));
    return 'gpt-4o';
  }

  // Group models by category
  const chatModels = models.filter(m => m.category === 'chat' || !m.category);
  const reasoningModels = models.filter(m => m.category === 'reasoning');

  // Create choices
  const choices = [
    new inquirer.Separator(chalk.bold.blue('\n── Chat Models ──')),
    ...chatModels.map(model => ({
      name: formatModelChoice(model),
      value: model.id,
      short: model.name,
    })),
  ];

  if (reasoningModels.length > 0) {
    choices.push(
      new inquirer.Separator(chalk.bold.magenta('\n── Reasoning Models ──')),
      ...reasoningModels.map(model => ({
        name: formatModelChoice(model),
        value: model.id,
        short: model.name,
      }))
    );
  }

  // Find default selection
  const defaultIndex = models.findIndex(m => 
    m.id === currentModel || (currentModel === undefined && m.recommended)
  );

  try {
    const { selectedModel } = await inquirer.prompt<{ selectedModel: string }>([
      {
        type: 'list',
        name: 'selectedModel',
        message: 'Select a model:',
        choices,
        default: defaultIndex >= 0 ? models[defaultIndex].id : undefined,
        pageSize: 15,
        loop: false,
      },
    ]);

    if (showHeader) {
      console.log(chalk.cyan('╰─────────────────────────────────────────────────────╯\n'));
    }

    return selectedModel;
  } catch (error) {
    // User cancelled
    return null;
  }
}

/**
 * Configure model and save to config
 */
export async function configureModel(): Promise<ModelConfig | null> {
  const currentConfig = loadModelConfig();
  const currentModel = currentConfig?.model;

  if (currentModel) {
    console.log(chalk.gray(`Current model: ${currentModel}\n`));
  }

  const selectedModel = await selectModel({ currentModel });

  if (!selectedModel) {
    console.log(chalk.yellow('Model selection cancelled'));
    return null;
  }

  // Get model info for defaults
  const modelInfo = COPILOT_MODELS.find(m => m.id === selectedModel);

  const config: ModelConfig = {
    provider: 'copilot',
    model: selectedModel,
    default_max_tokens: modelInfo?.maxTokens || 4096,
    temperature: 0.7,
  };

  saveModelConfig(config);

  console.log(chalk.green(`✅ Model set to: ${selectedModel}`));

  return config;
}

/**
 * Set model directly (for CLI flag)
 */
export function setModel(modelId: string, permanent: boolean = false): ModelConfig {
  const modelInfo = COPILOT_MODELS.find(m => m.id === modelId);

  if (!modelInfo) {
    console.log(chalk.yellow(`⚠️  Unknown model: ${modelId}`));
    console.log(chalk.gray('Available models: ' + COPILOT_MODELS.map(m => m.id).join(', ')));
  }

  const config: ModelConfig = {
    provider: 'copilot',
    model: modelId,
    default_max_tokens: modelInfo?.maxTokens || 4096,
    temperature: 0.7,
  };

  if (permanent) {
    saveModelConfig(config);
    console.log(chalk.green(`✅ Default model set to: ${modelId}`));
  } else {
    console.log(chalk.cyan(`Using model: ${modelId} (session only)`));
  }

  return config;
}

/**
 * List all available models
 */
export async function listModels(): Promise<void> {
  console.log('\n' + chalk.bold.cyan('Available GitHub Copilot Models\n'));

  const models = await fetchCopilotModels();
  const currentConfig = loadModelConfig();

  // Group by category
  const categories: { [key: string]: CopilotModel[] } = {};

  for (const model of models) {
    const category = model.category || 'other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(model);
  }

  // Display by category
  const categoryLabels: { [key: string]: string } = {
    chat: '💬 Chat Models',
    reasoning: '🧠 Reasoning Models',
    code: '💻 Code Models',
    other: '📦 Other Models',
  };

  for (const [category, categoryModels] of Object.entries(categories)) {
    console.log(chalk.bold(categoryLabels[category] || category));
    console.log(chalk.gray('─'.repeat(40)));

    for (const model of categoryModels) {
      const isCurrent = currentConfig?.model === model.id;
      const current = isCurrent ? chalk.green(' ← current') : '';
      const recommended = model.recommended ? chalk.yellow(' ★') : '';

      console.log(`  ${chalk.cyan(model.id)}${recommended}${current}`);
      console.log(`    ${chalk.gray(model.description)}`);
      console.log(`    ${chalk.gray(`Context: ${(model.contextWindow / 1000).toFixed(0)}K tokens, Max output: ${(model.maxTokens / 1000).toFixed(0)}K tokens`)}`);
      console.log();
    }
  }
}

/**
 * Get the current configured model
 */
export function getCurrentModel(): string | null {
  const config = loadModelConfig();
  return config?.model || null;
}

/**
 * Get model display name
 */
export function getModelDisplayName(modelId: string): string {
  const model = COPILOT_MODELS.find(m => m.id === modelId);
  return model?.name || modelId;
}
