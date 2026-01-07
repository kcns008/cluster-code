/**
 * GitHub Commands
 *
 * CLI commands for GitHub authentication and management
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import {
  setManualToken,
  getAuthStatus,
  logoutGitHub,
  testCopilotConnection,
  getStoredToken,
} from '../auth';
import {
  selectModel,
  listModels,
  setModel,
  loadModelConfig,
  getModelDisplayName,
} from '../config/model-selector';
import { quickSetupGitHub, runSetupWizard } from './setup-wizard';
import { credentialStore } from '../auth';
import { logger } from '../utils/logger';

/**
 * Setup GitHub authentication (--setup-github)
 */
export async function setupGitHubCommand(): Promise<void> {
  await quickSetupGitHub();
}

/**
 * Set GitHub token manually (--github-token <token>)
 */
export async function setGitHubTokenCommand(token: string): Promise<void> {
  console.log(chalk.cyan('\n🔐 Setting GitHub token...\n'));

  const result = await setManualToken(token);

  if (result.success) {
    console.log(chalk.green('\n✅ Token saved successfully!'));
    if (result.user) {
      console.log(chalk.gray(`   Authenticated as: @${result.user.login}`));
    }

    // Prompt for model selection
    const { selectNow } = await inquirer.prompt<{ selectNow: boolean }>([
      {
        type: 'confirm',
        name: 'selectNow',
        message: 'Would you like to select a model now?',
        default: true,
      },
    ]);

    if (selectNow) {
      await configureModelCommand();
    }
  } else {
    console.log(chalk.red('\n❌ Failed to set token'));
    if (result.error) {
      console.log(chalk.gray(`   Error: ${result.error}`));
    }
    process.exit(1);
  }
}

/**
 * Configure model selection (--configure-model)
 */
export async function configureModelCommand(): Promise<void> {
  // Check if authenticated
  const authStatus = await getAuthStatus();

  if (!authStatus.authenticated) {
    console.log(chalk.yellow('\n⚠️  Not authenticated with GitHub'));
    console.log(chalk.gray('Run: cluster-code --setup-github\n'));
    process.exit(1);
  }

  if (!authStatus.tokenValid) {
    console.log(chalk.yellow('\n⚠️  Your GitHub token has expired'));
    console.log(chalk.gray('Run: cluster-code --setup-github to re-authenticate\n'));
    process.exit(1);
  }

  const selectedModel = await selectModel({ showHeader: true });

  if (selectedModel) {
    setModel(selectedModel, true);
  }
}

/**
 * Show current auth status (--show-auth)
 */
export async function showAuthCommand(): Promise<void> {
  console.log(chalk.bold.cyan('\n📋 Authentication Status\n'));

  const authStatus = await getAuthStatus();

  if (!authStatus.authenticated) {
    console.log(chalk.yellow('Status: ') + chalk.red('Not authenticated'));
    console.log(chalk.gray('\nTo authenticate, run:'));
    console.log(chalk.cyan('  cluster-code --setup-github\n'));
    return;
  }

  console.log(chalk.yellow('Status: ') + (authStatus.tokenValid
    ? chalk.green('Authenticated')
    : chalk.red('Token expired')));

  if (authStatus.user) {
    console.log(chalk.yellow('User:   ') + chalk.white(`@${authStatus.user.login}`));
    if (authStatus.user.name) {
      console.log(chalk.yellow('Name:   ') + chalk.white(authStatus.user.name));
    }
    if (authStatus.user.email) {
      console.log(chalk.yellow('Email:  ') + chalk.white(authStatus.user.email));
    }
  }

  console.log(chalk.yellow('Provider: ') + chalk.white(authStatus.provider || 'N/A'));

  const modelConfig = loadModelConfig();
  if (modelConfig) {
    console.log(chalk.yellow('Model:  ') + chalk.white(modelConfig.model));
  }

  // Show credentials file location
  console.log(chalk.gray(`\nCredentials: ${credentialStore.getCredentialsPath()}`));

  if (!authStatus.tokenValid) {
    console.log(chalk.yellow('\n⚠️  Your token has expired. Re-authenticate with:'));
    console.log(chalk.cyan('  cluster-code --setup-github\n'));
  }

  console.log();
}

/**
 * List available models (--list-models)
 */
export async function listModelsCommand(): Promise<void> {
  const authStatus = await getAuthStatus();

  if (!authStatus.authenticated || !authStatus.tokenValid) {
    console.log(chalk.yellow('\n⚠️  Not authenticated. Showing default models.\n'));
  }

  await listModels();
}

/**
 * Show current user info (--whoami)
 */
export async function whoamiCommand(): Promise<void> {
  const authStatus = await getAuthStatus();

  if (!authStatus.authenticated) {
    console.log(chalk.yellow('\nNot logged in to GitHub'));
    console.log(chalk.gray('Run: cluster-code --setup-github\n'));
    return;
  }

  if (!authStatus.tokenValid) {
    console.log(chalk.yellow('\nGitHub token expired'));
    console.log(chalk.gray('Run: cluster-code --setup-github to re-authenticate\n'));
    return;
  }

  const modelConfig = loadModelConfig();
  const modelName = modelConfig?.model
    ? getModelDisplayName(modelConfig.model)
    : 'Not configured';

  console.log('\n' + chalk.bold(`@${authStatus.user?.login}`));

  if (authStatus.user?.name) {
    console.log(chalk.gray(authStatus.user.name));
  }

  console.log();
  console.log(chalk.gray('Provider: ') + chalk.cyan('GitHub Copilot'));
  console.log(chalk.gray('Model:    ') + chalk.cyan(modelName));
  console.log();
}

/**
 * Logout from GitHub (--logout-github)
 */
export async function logoutGitHubCommand(): Promise<void> {
  const authStatus = await getAuthStatus();

  if (!authStatus.authenticated) {
    console.log(chalk.yellow('\nNot logged in to GitHub\n'));
    return;
  }

  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to logout @${authStatus.user?.login}?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.gray('Logout cancelled\n'));
    return;
  }

  const spinner = ora('Logging out...').start();

  try {
    await logoutGitHub();
    spinner.succeed('Logged out successfully');
  } catch (error: any) {
    spinner.fail('Failed to logout');
    logger.error(error.message);
  }
}

/**
 * Test GitHub Copilot connection (--test-connection)
 */
export async function testConnectionCommand(): Promise<void> {
  console.log(chalk.cyan('\n🔌 Testing GitHub Copilot Connection...\n'));

  const authStatus = await getAuthStatus();

  if (!authStatus.authenticated) {
    console.log(chalk.red('❌ Not authenticated'));
    console.log(chalk.gray('Run: cluster-code --setup-github\n'));
    process.exit(1);
  }

  // Test GitHub API
  console.log(chalk.white('1. GitHub API:'));
  if (authStatus.tokenValid) {
    console.log(chalk.green('   ✅ Connected'));
    console.log(chalk.gray(`   User: @${authStatus.user?.login}`));
  } else {
    console.log(chalk.red('   ❌ Token expired'));
    process.exit(1);
  }

  // Test Copilot API
  console.log(chalk.white('\n2. Copilot API:'));
  const token = await getStoredToken();

  if (!token) {
    console.log(chalk.red('   ❌ No token found'));
    process.exit(1);
  }

  const spinner = ora('   Testing Copilot access...').start();
  const result = await testCopilotConnection(token);

  if (result.success) {
    spinner.succeed('   Copilot API: Connected');
  } else {
    spinner.fail('   Copilot API: Failed');
    console.log(chalk.gray(`   ${result.message}`));
    process.exit(1);
  }

  // Show current config
  const modelConfig = loadModelConfig();
  console.log(chalk.white('\n3. Configuration:'));
  console.log(chalk.green('   ✅ Ready'));
  console.log(chalk.gray(`   Model: ${modelConfig?.model || 'gpt-4o (default)'}`));

  console.log(chalk.green('\n✅ All systems operational!\n'));
}

/**
 * Switch model temporarily (--model <model>)
 */
export function switchModelCommand(modelId: string): void {
  setModel(modelId, false);
}

/**
 * Set default model permanently (--set-default-model <model>)
 */
export function setDefaultModelCommand(modelId: string): void {
  setModel(modelId, true);
}

/**
 * Run first-time setup wizard
 */
export async function runSetupCommand(): Promise<void> {
  await runSetupWizard();
}
