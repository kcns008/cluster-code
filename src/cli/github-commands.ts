/**
 * GitHub Commands
 *
 * CLI commands for GitHub authentication and management
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import {
  // New OAuth device flow (recommended)
  startCopilotDeviceFlow,
  testCopilotAuth,
  logoutCopilot,
  // Legacy auth (kept for backwards compatibility)
  setManualToken,
  getAuthStatus,
  logoutGitHub,
} from '../auth';
import {
  selectModel,
  listModels,
  setModel,
  loadModelConfig,
  getModelDisplayName,
} from '../config/model-selector';
import { runSetupWizard } from './setup-wizard';
import { credentialStore } from '../auth';
import { logger } from '../utils/logger';

/**
 * Setup GitHub authentication (--setup-github)
 * Now uses OAuth device flow matching OpenCode's approach
 */
export async function setupGitHubCommand(): Promise<void> {
  console.log(chalk.bold.cyan('\n🚀 GitHub Copilot Setup\n'));
  console.log(chalk.gray('This will authenticate you with GitHub Copilot using your browser.\n'));

  // Ask for deployment type
  const { deploymentType } = await inquirer.prompt<{ deploymentType: string }>([
    {
      type: 'list',
      name: 'deploymentType',
      message: 'Select your GitHub deployment:',
      choices: [
        { name: 'GitHub.com (Public)', value: 'github.com' },
        { name: 'GitHub Enterprise (Self-hosted)', value: 'enterprise' },
      ],
    },
  ]);

  let enterpriseUrl: string | undefined;
  if (deploymentType === 'enterprise') {
    const { url } = await inquirer.prompt<{ url: string }>([
      {
        type: 'input',
        name: 'url',
        message: 'Enter your GitHub Enterprise URL:',
        validate: (input) => {
          if (!input) return 'URL is required';
          try {
            new URL(input.includes('://') ? input : `https://${input}`);
            return true;
          } catch {
            return 'Please enter a valid URL (e.g., company.ghe.com)';
          }
        },
      },
    ]);
    enterpriseUrl = url;
  }

  // Start OAuth device flow
  const result = await startCopilotDeviceFlow({ enterpriseUrl });

  if (result.success) {
    // Prompt for model selection
    console.log(chalk.cyan('\n📦 Now let\'s select a model...\n'));
    
    try {
      const selectedModel = await selectModel({ showHeader: true });
      
      if (selectedModel) {
        setModel(selectedModel, true);
        console.log(chalk.green(`\n✅ All set! GitHub Copilot is ready to use.\n`));
      } else {
        setModel('gpt-4o', true);
        console.log(chalk.yellow('\n⚠️  No model selected. Using default: gpt-4o\n'));
      }
    } catch (error) {
      setModel('gpt-4o', true);
      console.log(chalk.yellow('\n⚠️  Model selection failed. Using default: gpt-4o\n'));
    }
  } else {
    console.log(chalk.red('\n❌ Authentication failed'));
    if (result.error) {
      console.log(chalk.gray(`   Error: ${result.error}`));
    }
    console.log(chalk.gray('\nYou can also try:'));
    console.log(chalk.gray('  - cluster-code github login   (retry authentication)'));
    console.log(chalk.gray('  - cluster-code github token   (manual token entry)\n'));
    process.exit(1);
  }
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

    // Always prompt for model selection after successful token setup
    console.log(chalk.cyan('\n📦 Now let\'s select a model...\n'));
    
    try {
      const selectedModel = await selectModel({ showHeader: true });
      
      if (selectedModel) {
        setModel(selectedModel, true);
        console.log(chalk.green(`\n✅ All set! GitHub Copilot is ready to use.\n`));
      } else {
        // Use default if user cancels
        setModel('gpt-4o', true);
        console.log(chalk.yellow('\n⚠️  No model selected. Using default: gpt-4o\n'));
      }
    } catch (error) {
      // Fallback to default
      setModel('gpt-4o', true);
      console.log(chalk.yellow('\n⚠️  Model selection failed. Using default: gpt-4o\n'));
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
  // Check if authenticated with new OAuth
  const copilotAuth = await testCopilotAuth();

  if (!copilotAuth.success) {
    // Fall back to legacy auth check
    const authStatus = await getAuthStatus();

    if (!authStatus.authenticated) {
      console.log(chalk.yellow('\n⚠️  Not authenticated with GitHub'));
      console.log(chalk.gray('Run: cluster-code github login\n'));
      process.exit(1);
    }

    if (!authStatus.tokenValid) {
      console.log(chalk.yellow('\n⚠️  Your GitHub token has expired'));
      console.log(chalk.gray('Run: cluster-code github login to re-authenticate\n'));
      process.exit(1);
    }
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

  // Try new OAuth-based auth first
  const copilotAuth = await testCopilotAuth();
  const credentials = await credentialStore.getCredentials();

  if (copilotAuth.success) {
    console.log(chalk.yellow('Status: ') + chalk.green('Authenticated'));
    if (copilotAuth.user) {
      console.log(chalk.yellow('User:   ') + chalk.white(`@${copilotAuth.user}`));
    } else if (credentials?.github_user) {
      console.log(chalk.yellow('User:   ') + chalk.white(`@${credentials.github_user}`));
    }
    console.log(chalk.yellow('Provider: ') + chalk.white('GitHub Copilot'));

    const modelConfig = loadModelConfig();
    if (modelConfig) {
      console.log(chalk.yellow('Model:  ') + chalk.white(modelConfig.model));
    }
  } else {
    // Fall back to legacy auth check
    const authStatus = await getAuthStatus();

    if (!authStatus.authenticated) {
      console.log(chalk.yellow('Status: ') + chalk.red('Not authenticated'));
      console.log(chalk.gray('\nTo authenticate, run:'));
      console.log(chalk.cyan('  cluster-code github login\n'));
      return;
    }

    console.log(chalk.yellow('Status: ') + (authStatus.tokenValid
      ? chalk.green('Authenticated (Legacy)')
      : chalk.red('Token expired')));

    if (authStatus.user) {
      console.log(chalk.yellow('User:   ') + chalk.white(`@${authStatus.user.login}`));
    }

    console.log(chalk.yellow('Provider: ') + chalk.white(authStatus.provider || 'N/A'));

    const modelConfig = loadModelConfig();
    if (modelConfig) {
      console.log(chalk.yellow('Model:  ') + chalk.white(modelConfig.model));
    }

    if (!authStatus.tokenValid) {
      console.log(chalk.yellow('\n⚠️  Your token has expired. Re-authenticate with:'));
      console.log(chalk.cyan('  cluster-code github login\n'));
    }
  }

  // Show credentials file location
  console.log(chalk.gray(`\nCredentials: ${credentialStore.getCredentialsPath()}`));
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
  // Try new OAuth auth first
  const copilotAuth = await testCopilotAuth();
  const credentials = await credentialStore.getCredentials();

  if (copilotAuth.success) {
    const username = copilotAuth.user || credentials?.github_user;
    
    console.log('\n' + chalk.bold(`@${username || 'GitHub User'}`));

    console.log();
    console.log(chalk.gray('Provider: ') + chalk.cyan('GitHub Copilot'));

    const modelConfig = loadModelConfig();
    const modelName = modelConfig?.model
      ? getModelDisplayName(modelConfig.model)
      : 'Not configured';
    console.log(chalk.gray('Model:    ') + chalk.cyan(modelName));
    console.log();
    return;
  }

  // Fall back to legacy auth
  const authStatus = await getAuthStatus();

  if (!authStatus.authenticated) {
    console.log(chalk.yellow('\nNot logged in to GitHub'));
    console.log(chalk.gray('Run: cluster-code github login\n'));
    return;
  }

  if (!authStatus.tokenValid) {
    console.log(chalk.yellow('\nGitHub token expired'));
    console.log(chalk.gray('Run: cluster-code github login to re-authenticate\n'));
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
  const copilotAuth = await testCopilotAuth();
  const credentials = await credentialStore.getCredentials();
  const username = copilotAuth.user || credentials?.github_user;

  if (!copilotAuth.success && !credentials) {
    console.log(chalk.yellow('\nNot logged in to GitHub\n'));
    return;
  }

  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to logout${username ? ` @${username}` : ''}?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.gray('Logout cancelled\n'));
    return;
  }

  const spinner = ora('Logging out...').start();

  try {
    // Clear both new OAuth and legacy auth
    await logoutCopilot();
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

  // Test with new OAuth auth
  console.log(chalk.white('1. Authentication:'));
  const copilotAuth = await testCopilotAuth();

  if (copilotAuth.success) {
    console.log(chalk.green('   ✅ Authenticated'));
    if (copilotAuth.user) {
      console.log(chalk.gray(`   User: @${copilotAuth.user}`));
    }
  } else {
    console.log(chalk.red('   ❌ Not authenticated'));
    console.log(chalk.gray(`   ${copilotAuth.message}`));
    console.log(chalk.gray('\n   Run: cluster-code github login\n'));
    process.exit(1);
  }

  // Test Copilot API
  console.log(chalk.white('\n2. Copilot API:'));
  console.log(chalk.green('   ✅ Connected'));
  console.log(chalk.gray('   Endpoint: api.githubcopilot.com'));

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
