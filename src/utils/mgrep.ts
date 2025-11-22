/**
 * mgrep utility functions for semantic code search integration
 * https://github.com/mixedbread-ai/mgrep
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import inquirer from 'inquirer';

const execAsync = promisify(exec);

/**
 * Check if mgrep CLI is installed
 */
export async function isMgrepInstalled(): Promise<boolean> {
  try {
    await execAsync('which mgrep');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if mgrep is authenticated
 */
export async function isMgrepAuthenticated(): Promise<boolean> {
  try {
    // Check for MXBAI_API_KEY environment variable
    if (process.env.MXBAI_API_KEY) {
      return true;
    }

    // Try to run a mgrep command that requires auth
    // This will fail if not authenticated
    const { stdout } = await execAsync('mgrep --version 2>&1');
    return !stdout.includes('not authenticated') && !stdout.includes('login required');
  } catch {
    return false;
  }
}

/**
 * Install mgrep CLI globally
 */
export async function installMgrep(): Promise<boolean> {
  try {
    logger.startSpinner('Installing @mixedbread/mgrep globally...');
    await execAsync('npm install -g @mixedbread/mgrep', { timeout: 120000 });
    logger.succeedSpinner('@mixedbread/mgrep installed successfully');
    return true;
  } catch (error: any) {
    logger.failSpinner();
    logger.error(`Failed to install mgrep: ${error.message}`);
    return false;
  }
}

/**
 * Authenticate with mgrep
 */
export async function authenticateMgrep(): Promise<boolean> {
  try {
    logger.newline();
    logger.section('mgrep Authentication');

    const { authMethod } = await inquirer.prompt([
      {
        type: 'list',
        name: 'authMethod',
        message: 'How would you like to authenticate with Mixedbread?',
        choices: [
          { name: 'Browser login (recommended)', value: 'browser' },
          { name: 'API key (for CI/CD)', value: 'apikey' },
        ],
      },
    ]);

    if (authMethod === 'browser') {
      logger.newline();
      logger.info('Opening browser for authentication...');
      logger.info('Please complete the login process in your browser.');

      try {
        await execAsync('mgrep login', { timeout: 300000 }); // 5 minute timeout for user to complete auth
        logger.success('Successfully authenticated with Mixedbread!');
        return true;
      } catch (error: any) {
        logger.error(`Authentication failed: ${error.message}`);
        return false;
      }
    } else {
      logger.newline();
      logger.info('Get your API key from: https://www.mixedbread.ai/');

      const { apiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your Mixedbread API key:',
          mask: '*',
          validate: (input) => input.trim() !== '' || 'API key is required',
        },
      ]);

      // Set the API key as an environment variable for this session
      process.env.MXBAI_API_KEY = apiKey;

      logger.newline();
      logger.success('API key set successfully!');
      logger.info('To persist this for future sessions, add to your shell profile:');
      logger.info('  export MXBAI_API_KEY=your-api-key');

      return true;
    }
  } catch (error: any) {
    logger.error(`Authentication setup failed: ${error.message}`);
    return false;
  }
}

/**
 * Install mgrep plugin for Claude Code
 */
export async function installMgrepClaudeCodePlugin(): Promise<boolean> {
  try {
    logger.startSpinner('Installing mgrep Claude Code plugin...');
    logger.info('This will add the Mixedbread mgrep plugin to your Claude Code marketplace.');

    // Run mgrep install-claude-code
    // This command signs in (if needed), adds the plugin to marketplace, and installs it
    await execAsync('mgrep install-claude-code', { timeout: 120000 });

    logger.succeedSpinner('mgrep plugin installed successfully!');
    return true;
  } catch (error: any) {
    logger.failSpinner();
    logger.error(`Failed to install mgrep plugin: ${error.message}`);
    return false;
  }
}

/**
 * Start mgrep watch to index the current repository
 */
export async function startMgrepWatch(background: boolean = true): Promise<boolean> {
  try {
    const cwd = process.cwd();

    if (background) {
      logger.info('Starting mgrep watch in background...');
      logger.info(`Indexing repository: ${cwd}`);
      logger.info('This will keep your code index synchronized with Mixedbread.');

      // Start mgrep watch in background
      // Note: This will continue running even after init completes
      exec('mgrep watch', (error) => {
        if (error) {
          logger.warning(`mgrep watch process ended: ${error.message}`);
        }
      });

      logger.success('mgrep watch started in background');
      logger.info('Your repository is being indexed and will stay in sync.');
    } else {
      logger.info('To index this repository, run: mgrep watch');
      logger.info('This will keep your code synchronized with Mixedbread for semantic search.');
    }

    return true;
  } catch (error: any) {
    logger.error(`Failed to start mgrep watch: ${error.message}`);
    return false;
  }
}

/**
 * Complete mgrep setup workflow
 */
export async function setupMgrep(): Promise<boolean> {
  try {
    logger.newline();
    logger.section('mgrep Setup - Semantic Code Search');
    logger.info('mgrep enables AI-powered semantic search across your codebase.');
    logger.info('It uses 2x fewer tokens than grep-based workflows with better quality.');
    logger.newline();

    // Check if mgrep is already installed
    const installed = await isMgrepInstalled();

    if (!installed) {
      logger.info('mgrep is not currently installed.');

      const { shouldInstall } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldInstall',
          message: 'Would you like to install mgrep now?',
          default: true,
        },
      ]);

      if (!shouldInstall) {
        logger.newline();
        logger.info('Skipping mgrep installation.');
        logger.info('You can install it later with: npm install -g @mixedbread/mgrep');
        return false;
      }

      // Install mgrep
      const installSuccess = await installMgrep();
      if (!installSuccess) {
        return false;
      }
    } else {
      logger.success('mgrep is already installed');
    }

    // Check authentication
    const authenticated = await isMgrepAuthenticated();

    if (!authenticated) {
      logger.newline();
      logger.info('mgrep requires authentication with Mixedbread.');

      const authSuccess = await authenticateMgrep();
      if (!authSuccess) {
        return false;
      }
    } else {
      logger.success('mgrep is authenticated');
    }

    // Install Claude Code plugin
    logger.newline();
    const { installPlugin } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'installPlugin',
        message: 'Install mgrep plugin for Claude Code?',
        default: true,
      },
    ]);

    if (installPlugin) {
      const pluginSuccess = await installMgrepClaudeCodePlugin();
      if (!pluginSuccess) {
        logger.warning('Plugin installation failed, but you can try again later.');
        logger.info('Run: mgrep install-claude-code');
      }
    }

    // Ask about starting mgrep watch
    logger.newline();
    const { startWatch } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'startWatch',
        message: 'Start indexing this repository with mgrep watch?',
        default: false,
      },
    ]);

    if (startWatch) {
      await startMgrepWatch(false);
    } else {
      logger.info('You can start indexing later with: mgrep watch');
    }

    logger.newline();
    logger.success('mgrep setup completed!');
    logger.info('Your Claude Code agent can now use semantic search to find relevant code.');

    return true;
  } catch (error: any) {
    logger.error(`mgrep setup failed: ${error.message}`);
    return false;
  }
}
