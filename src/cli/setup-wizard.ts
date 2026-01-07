/**
 * Setup Wizard
 *
 * Interactive first-time setup flow for configuring AI providers
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { startOAuthFlow, setManualToken, getAuthStatus, GitHubUser } from '../auth';
import { selectModel, saveModelConfig } from '../config/model-selector';

export type ProviderChoice = 'anthropic' | 'copilot' | 'both';

export interface SetupResult {
  success: boolean;
  provider?: ProviderChoice;
  model?: string;
  user?: GitHubUser;
  error?: string;
}

/**
 * Display welcome banner
 */
function displayWelcomeBanner(): void {
  console.log('\n');
  console.log(chalk.cyan('┌─────────────────────────────────────────┐'));
  console.log(chalk.cyan('│') + chalk.bold.white('  Welcome to Cluster Code!              ') + chalk.cyan('│'));
  console.log(chalk.cyan('├─────────────────────────────────────────┤'));
  console.log(chalk.cyan('│') + chalk.white('  AI-powered Kubernetes management      ') + chalk.cyan('│'));
  console.log(chalk.cyan('└─────────────────────────────────────────┘'));
  console.log();
}

/**
 * Prompt for provider selection
 */
async function selectProvider(): Promise<ProviderChoice | null> {
  console.log(chalk.bold('  Choose your AI provider:\n'));

  const { provider } = await inquirer.prompt<{ provider: ProviderChoice }>([
    {
      type: 'list',
      name: 'provider',
      message: 'Select provider:',
      choices: [
        {
          name: `${chalk.green('1.')} Anthropic Claude ${chalk.gray('(Default - Direct API)')}`,
          value: 'anthropic',
        },
        {
          name: `${chalk.blue('2.')} GitHub Copilot ${chalk.gray('(Multiple models via GitHub)')}`,
          value: 'copilot',
        },
        {
          name: `${chalk.magenta('3.')} Configure both ${chalk.gray('(Switch anytime)')}`,
          value: 'both',
        },
      ],
      default: 'copilot',
    },
  ]);

  return provider;
}

/**
 * Setup GitHub Copilot provider
 */
async function setupCopilot(): Promise<{ success: boolean; user?: GitHubUser; model?: string }> {
  console.log(chalk.cyan('\n🔐 Setting up GitHub Copilot...\n'));

  // Try OAuth first
  const oauthResult = await startOAuthFlow();

  if (!oauthResult.success) {
    console.log(chalk.yellow('\n⚠️  OAuth authentication failed.'));
    console.log(chalk.gray('You can try entering your token manually.\n'));

    // Prompt for manual token
    const { useManual } = await inquirer.prompt<{ useManual: boolean }>([
      {
        type: 'confirm',
        name: 'useManual',
        message: 'Would you like to enter a GitHub token manually?',
        default: true,
      },
    ]);

    if (useManual) {
      const { token } = await inquirer.prompt<{ token: string }>([
        {
          type: 'password',
          name: 'token',
          message: 'Enter your GitHub personal access token:',
          mask: '*',
          validate: (input) => {
            if (!input || input.length < 10) {
              return 'Please enter a valid token';
            }
            return true;
          },
        },
      ]);

      const manualResult = await setManualToken(token);

      if (!manualResult.success) {
        return { success: false };
      }

      // Continue with model selection
      console.log(chalk.cyan('\n📦 Fetching available models...\n'));

      const selectedModel = await selectModel();

      if (!selectedModel) {
        // Use default model
        saveModelConfig({
          provider: 'copilot',
          model: 'gpt-4o',
          default_max_tokens: 4096,
          temperature: 0.7,
        });

        return {
          success: true,
          user: manualResult.user,
          model: 'gpt-4o',
        };
      }

      return {
        success: true,
        user: manualResult.user,
        model: selectedModel,
      };
    }

    return { success: false };
  }

  // OAuth successful, proceed with model selection
  console.log(chalk.cyan('\n📦 Fetching available models...\n'));

  const selectedModel = await selectModel();

  if (!selectedModel) {
    // Use default model
    saveModelConfig({
      provider: 'copilot',
      model: 'gpt-4o',
      default_max_tokens: 4096,
      temperature: 0.7,
    });

    return {
      success: true,
      user: oauthResult.user,
      model: 'gpt-4o',
    };
  }

  // Save model config
  saveModelConfig({
    provider: 'copilot',
    model: selectedModel,
    default_max_tokens: 4096,
    temperature: 0.7,
  });

  return {
    success: true,
    user: oauthResult.user,
    model: selectedModel,
  };
}

/**
 * Setup Anthropic provider
 */
async function setupAnthropic(): Promise<{ success: boolean }> {
  console.log(chalk.cyan('\n🔐 Setting up Anthropic Claude...\n'));

  // Check for existing API key
  const existingKey = process.env.ANTHROPIC_API_KEY;

  if (existingKey) {
    console.log(chalk.green('✅ Anthropic API key found in environment\n'));
    return { success: true };
  }

  console.log(chalk.gray('To use Anthropic Claude, you need an API key from:'));
  console.log(chalk.cyan('  https://console.anthropic.com/\n'));

  const { hasKey } = await inquirer.prompt<{ hasKey: boolean }>([
    {
      type: 'confirm',
      name: 'hasKey',
      message: 'Do you have an Anthropic API key?',
      default: false,
    },
  ]);

  if (!hasKey) {
    console.log(chalk.yellow('\n⚠️  Please set your API key as an environment variable:'));
    console.log(chalk.cyan('  export ANTHROPIC_API_KEY=your-key-here\n'));
    return { success: false };
  }

  const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your Anthropic API key:',
      mask: '*',
      validate: (input) => {
        if (!input || !input.startsWith('sk-ant-')) {
          return 'Please enter a valid Anthropic API key (starts with sk-ant-)';
        }
        return true;
      },
    },
  ]);

  // Validate the key by making a test request
  const spinner = ora('Validating API key...').start();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (response.ok) {
      spinner.succeed('API key validated');
      console.log(chalk.yellow('\nTo persist this key, add to your shell profile:'));
      console.log(chalk.cyan(`  export ANTHROPIC_API_KEY="${apiKey}"\n`));
      return { success: true };
    } else {
      spinner.fail('Invalid API key');
      return { success: false };
    }
  } catch (error) {
    spinner.fail('Failed to validate API key');
    return { success: false };
  }
}

/**
 * Run the full setup wizard
 */
export async function runSetupWizard(): Promise<SetupResult> {
  displayWelcomeBanner();

  // Check if already configured
  const authStatus = await getAuthStatus();

  if (authStatus.authenticated && authStatus.tokenValid) {
    console.log(chalk.green(`Already authenticated as @${authStatus.user?.login}\n`));

    const { reconfigure } = await inquirer.prompt<{ reconfigure: boolean }>([
      {
        type: 'confirm',
        name: 'reconfigure',
        message: 'Would you like to reconfigure?',
        default: false,
      },
    ]);

    if (!reconfigure) {
      return {
        success: true,
        provider: 'copilot',
        user: authStatus.user,
      };
    }
  }

  // Select provider
  const provider = await selectProvider();

  if (!provider) {
    return { success: false, error: 'Setup cancelled' };
  }

  let result: SetupResult = { success: false };

  switch (provider) {
    case 'copilot': {
      const copilotResult = await setupCopilot();
      if (copilotResult.success) {
        result = {
          success: true,
          provider: 'copilot',
          user: copilotResult.user,
          model: copilotResult.model,
        };
      }
      break;
    }

    case 'anthropic': {
      const anthropicResult = await setupAnthropic();
      if (anthropicResult.success) {
        result = {
          success: true,
          provider: 'anthropic',
        };
      }
      break;
    }

    case 'both': {
      // Setup Copilot first
      const copilotResult = await setupCopilot();

      if (copilotResult.success) {
        console.log(chalk.gray('\nNow setting up Anthropic as backup...\n'));
        await setupAnthropic();

        result = {
          success: true,
          provider: 'both',
          user: copilotResult.user,
          model: copilotResult.model,
        };
      }
      break;
    }
  }

  if (result.success) {
    displaySetupComplete(result);
  }

  return result;
}

/**
 * Display setup complete message
 */
function displaySetupComplete(result: SetupResult): void {
  console.log('\n' + chalk.green('╭─────────────────────────────────────────╮'));
  console.log(chalk.green('│') + chalk.bold.white('  ✅ Setup Complete!                     ') + chalk.green('│'));
  console.log(chalk.green('╰─────────────────────────────────────────╯'));
  console.log();

  if (result.provider === 'copilot' || result.provider === 'both') {
    if (result.user) {
      console.log(chalk.white('  GitHub:  ') + chalk.cyan(`@${result.user.login}`));
    }
    if (result.model) {
      console.log(chalk.white('  Model:   ') + chalk.cyan(result.model));
    }
    console.log(chalk.white('  Provider:') + chalk.cyan(' GitHub Copilot'));
  } else if (result.provider === 'anthropic') {
    console.log(chalk.white('  Provider:') + chalk.cyan(' Anthropic Claude'));
  }

  console.log();
  console.log(chalk.gray('Ready to code! Type your request or /help for commands.\n'));
}

/**
 * Quick setup for GitHub only (used by --setup-github)
 */
export async function quickSetupGitHub(): Promise<SetupResult> {
  console.log(chalk.cyan('\n🔐 GitHub Copilot Setup\n'));

  const result = await setupCopilot();

  if (result.success) {
    console.log(chalk.green('\n✅ GitHub Copilot configured successfully!'));
    if (result.user) {
      console.log(chalk.gray(`   Authenticated as: @${result.user.login}`));
    }
    if (result.model) {
      console.log(chalk.gray(`   Default model: ${result.model}`));
    }
    console.log();

    return {
      success: true,
      provider: 'copilot',
      user: result.user,
      model: result.model,
    };
  }

  return { success: false, error: 'GitHub setup failed' };
}
