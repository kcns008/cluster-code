#!/usr/bin/env node

/**
 * Cluster Code CLI - Main entry point
 *
 * AI-powered CLI tool for Kubernetes and OpenShift cluster management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  initCommand,
  diagnoseCommand,
  chatCommand,
  configGetCommand,
  configSetCommand,
  configPathCommand,
  configResetCommand,
  providerListCommand,
  providerAddCommand,
  providerRemoveCommand,
  providerSetCommand,
  providerShowCommand,
  infoCommand,
  infoHelpInstallCommand,
  rlStatusCommand,
  rlSetupCommand,
  rlRemoveCommand,
  rlTrainCommand,
  rlDiagnoseCommand,
} from './commands';
import { logger } from './utils/logger';
import { ConfigManager } from './config';
import { InteractiveSession } from './interactive';
import { AgentSession } from './agent';

import { startTui } from './tui';

const program = new Command();

// Package info
import packageJson from '../package.json';

program
  .name('cluster-code')
  .description('AI-powered CLI tool for Kubernetes and OpenShift cluster management')
  .version(packageJson.version);

// Init command
program
  .command('init')
  .description('Initialize cluster connection')
  .option('-c, --context <context>', 'Kubernetes context')
  .option('-n, --namespace <namespace>', 'Default namespace')
  .option('-k, --kubeconfig <path>', 'Path to kubeconfig file')
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// Diagnose command
program
  .command('diagnose')
  .description('Run comprehensive cluster diagnostics')
  .action(async () => {
    try {
      await diagnoseCommand();
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// Info command
program
  .command('info')
  .description('Show cluster and CLI tool information')
  .option('--help-install <tool>', 'Show installation instructions for a specific tool')
  .action(async (options) => {
    try {
      if (options.helpInstall) {
        await infoHelpInstallCommand(options.helpInstall);
      } else {
        await infoCommand();
      }
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// Chat command (legacy)
program
  .command('chat [message]')
  .description('Start interactive troubleshooting session (legacy mode)')
  .action(async (message) => {
    try {
      await chatCommand(message);
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// Interactive command (new default mode)
program
  .command('interactive')
  .alias('i')
  .description('Start interactive natural language interface (default)')
  .option('-a, --auto-execute', 'Automatically execute commands without confirmation')
  .option('-v, --verbose', 'Show verbose output including available tools')
  .action(async (options) => {
    try {
      await startInteractiveMode(options);
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// Agent command (Agent SDK mode - Claude only)
program
  .command('agent [message]')
  .alias('a')
  .description('Start agentic mode with Claude Agent SDK (Claude-only, autonomous execution)')
  .option('-a, --auto-execute', 'Automatically execute commands without confirmation')
  .option('-v, --verbose', 'Show verbose output including tool calls and results')
  .option('-p, --plan', 'Planning mode - generate plans without executing')
  .action(async (message, options) => {
    try {
      await startAgentMode(message, options);
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// UI Command
program
  .command('ui')
  .description('Start TUI mode')
  .action(async () => {
    try {
      await startTui();
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// Config commands
const configCmd = program
  .command('config')
  .description('Manage cluster-code configuration');

configCmd
  .command('get [key]')
  .description('Get configuration value')
  .action(async (key) => {
    try {
      await configGetCommand(key);
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

configCmd
  .command('set <key> <value>')
  .description('Set configuration value')
  .action(async (key, value) => {
    try {
      await configSetCommand(key, value);
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

configCmd
  .command('path')
  .description('Show configuration file path')
  .action(async () => {
    try {
      await configPathCommand();
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

configCmd
  .command('reset')
  .description('Reset configuration to defaults')
  .action(async () => {
    try {
      await configResetCommand();
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// Provider commands
const providerCmd = configCmd
  .command('provider')
  .description('Manage LLM providers');

providerCmd
  .command('list')
  .alias('ls')
  .description('List all configured providers')
  .action(async () => {
    try {
      await providerListCommand();
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

providerCmd
  .command('add [name]')
  .description('Add a new provider')
  .action(async (name) => {
    try {
      await providerAddCommand(name);
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

providerCmd
  .command('remove [name]')
  .alias('rm')
  .description('Remove a provider')
  .action(async (name) => {
    try {
      await providerRemoveCommand(name);
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

providerCmd
  .command('set [name]')
  .description('Set the active provider')
  .action(async (name) => {
    try {
      await providerSetCommand(name);
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

providerCmd
  .command('show')
  .description('Show current active provider')
  .action(async () => {
    try {
      await providerShowCommand();
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// RL (Reinforcement Learning) commands - PufferLib integration
const rlCmd = program
  .command('rl')
  .description('Manage PufferLib RL environment for intelligent cluster management');

rlCmd
  .command('status')
  .description('Show RL environment status')
  .action(async () => {
    try {
      await rlStatusCommand();
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

rlCmd
  .command('setup')
  .description('Set up PufferLib RL environment')
  .option('--cuda', 'Install with CUDA/GPU support')
  .option('--force', 'Force reinstall if environment exists')
  .action(async (options) => {
    try {
      await rlSetupCommand(options);
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

rlCmd
  .command('remove')
  .description('Remove PufferLib RL environment')
  .action(async () => {
    try {
      await rlRemoveCommand();
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

rlCmd
  .command('train')
  .description('Train an RL agent for cluster management')
  .option('-e, --episodes <number>', 'Number of training episodes', '100')
  .option('-s, --steps <number>', 'Steps per episode', '100')
  .option('--no-simulation', 'Use real cluster instead of simulation')
  .option('-v, --verbose', 'Show verbose training output')
  .action(async (options) => {
    try {
      await rlTrainCommand({
        episodes: parseInt(options.episodes),
        steps: parseInt(options.steps),
        simulation: options.simulation,
        verbose: options.verbose,
      });
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

rlCmd
  .command('diagnose')
  .description('Run RL agent for cluster diagnostics')
  .option('-m, --model <path>', 'Path to trained model file')
  .option('-s, --steps <number>', 'Maximum steps to run', '20')
  .option('--no-simulation', 'Use real cluster instead of simulation')
  .action(async (options) => {
    try {
      await rlDiagnoseCommand({
        model: options.model,
        steps: parseInt(options.steps),
        simulation: options.simulation,
      });
    } catch (error: any) {
      logger.error(error.message);
      process.exit(1);
    }
  });

// Version command (enhanced)
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(chalk.bold.cyan(`\nCluster Code v${packageJson.version}`));
    console.log(chalk.gray('AI-powered Kubernetes cluster management\n'));
  });

// Handle unknown commands
program.on('command:*', () => {
  logger.error('Invalid command. See --help for available commands.');
  process.exit(1);
});

// Function to start interactive mode
async function startInteractiveMode(options: { autoExecute?: boolean; verbose?: boolean } = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Check if LLM is configured
  if (!configManager.isLLMConfigured()) {
    logger.error('LLM provider not configured');
    logger.info('\nAvailable options:');
    logger.info('  1. Set Anthropic API key:');
    logger.info('     export ANTHROPIC_API_KEY=your-key-here');
    logger.info('  2. Set OpenAI API key:');
    logger.info('     export OPENAI_API_KEY=your-key-here');
    logger.info('  3. Configure a custom provider:');
    logger.info('     cluster-code config provider add <name>');
    logger.info('\nFor more information, see: https://github.com/kcns008/cluster-code#providers');
    process.exit(1);
  }

  // Check if cluster is configured
  if (!config.cluster || !config.cluster.context) {
    logger.warning('Cluster not configured. Please run initialization first.\n');
    logger.info('Run: ' + chalk.cyan('cluster-code init') + '\n');
    process.exit(1);
  }

  // Start interactive session
  const session = new InteractiveSession({
    autoExecute: options.autoExecute || false,
    verbose: options.verbose || false
  });

  await session.initialize();
  await session.start();
}

// Function to start agent mode (Agent SDK - Claude only)
async function startAgentMode(
  message?: string,
  options: { autoExecute?: boolean; verbose?: boolean; plan?: boolean } = {}
): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Check if cluster is configured
  if (!config.cluster || !config.cluster.context) {
    logger.warning('Cluster not configured. Please run initialization first.\n');
    logger.info('Run: ' + chalk.cyan('cluster-code init') + '\n');
    process.exit(1);
  }

  // Create agent session
  const session = new AgentSession({
    autoExecute: options.autoExecute || false,
    verbose: options.verbose || false,
    planMode: options.plan || false,
  });

  // Check if agent mode is available
  if (!session.isAvailable()) {
    logger.error('Agent mode requires Claude API key (ANTHROPIC_API_KEY).\n');
    logger.info('For agent mode, set: export ANTHROPIC_API_KEY=your-key');
    logger.info('Or use Bedrock: export CLAUDE_CODE_USE_BEDROCK=1');
    logger.info('Or use Vertex: export CLAUDE_CODE_USE_VERTEX=1\n');
    logger.info('For multi-provider mode, use: cluster-code interactive\n');
    process.exit(1);
  }

  // If a message was provided, run single query; otherwise start interactive session
  if (message) {
    await session.runSingle(message);
  } else {
    await session.start();
  }
}

// Check if running with no arguments - launch interactive mode
async function handleDefaultBehavior() {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const isLLMConfigured = configManager.isLLMConfigured();

  // Check if configured
  const isConfigured = config.cluster && config.cluster.context && isLLMConfigured;

  if (isConfigured) {
    // Launch interactive mode directly
    await startInteractiveMode();
  } else {
    // Show welcome message
    console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║            Welcome to Cluster Code                   ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════╝\n'));
    console.log(chalk.white('AI-powered CLI for Kubernetes cluster management\n'));

    if (!config.cluster || !config.cluster.context) {
      console.log(chalk.yellow('⚠ Cluster not configured\n'));
      console.log(chalk.bold('First Time Setup:'));
      console.log(chalk.gray('  1. Initialize cluster: ') + chalk.cyan('cluster-code init'));
      console.log(chalk.gray('  2. Set API key:        ') + chalk.cyan('export ANTHROPIC_API_KEY=your-key-here'));
      console.log(chalk.gray('  3. Start interactive:  ') + chalk.cyan('cluster-code\n'));
    } else if (!isLLMConfigured) {
      console.log(chalk.yellow('⚠ LLM provider not configured\n'));
      console.log(chalk.bold('Setup LLM Provider:'));
      console.log(chalk.gray('  Option 1 - Anthropic (Claude):'));
      console.log(chalk.cyan('    export ANTHROPIC_API_KEY=your-key-here\n'));
      console.log(chalk.gray('  Option 2 - OpenAI (GPT):'));
      console.log(chalk.cyan('    export OPENAI_API_KEY=your-key-here\n'));
      console.log(chalk.gray('  Option 3 - Custom provider:'));
      console.log(chalk.cyan('    cluster-code config provider add <name>\n'));
    }

    console.log(chalk.bold('Quick Start:'));
    console.log(chalk.gray('  1. Initialize: ') + chalk.cyan('cluster-code init'));
    console.log(chalk.gray('  2. Interactive:') + chalk.cyan('cluster-code') + chalk.gray(' (or ') + chalk.cyan('cluster-code interactive') + chalk.gray(')'));
    console.log(chalk.gray('  3. Diagnose:   ') + chalk.cyan('cluster-code diagnose'));
    console.log(chalk.gray('  4. Legacy chat:') + chalk.cyan('cluster-code chat\n'));

    console.log(chalk.bold('Available Commands:'));
    program.outputHelp();

    console.log(chalk.gray('\nFor more information, visit:'));
    console.log(chalk.cyan('  https://github.com/kcns008/cluster-code\n'));

    process.exit(0);
  }
}

// Handle default behavior when no command provided
if (process.argv.length === 2) {
  handleDefaultBehavior().catch(error => {
    logger.error(error.message);
    process.exit(1);
  });
} else {
  // Parse arguments for other commands
  program.parse(process.argv);
}
