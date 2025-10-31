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
} from './commands';
import { logger } from './utils/logger';
import { ConfigManager } from './config';
import { InteractiveSession } from './interactive';

const program = new Command();

// Package info
const packageJson = require('../package.json');

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

  // Check if API key is configured
  const apiKey = process.env.ANTHROPIC_API_KEY || config.anthropicApiKey;

  if (!apiKey) {
    logger.error('ANTHROPIC_API_KEY environment variable or config setting is required');
    logger.info('Set it in your environment:');
    logger.info('  export ANTHROPIC_API_KEY=your-key-here');
    logger.info('Or configure it:');
    logger.info('  cluster-code config set anthropicApiKey your-key-here');
    process.exit(1);
  }

  // Check if cluster is configured
  if (!config.cluster || !config.cluster.context) {
    logger.warning('Cluster not configured. Please run initialization first.\n');
    logger.info('Run: ' + chalk.cyan('cluster-code init') + '\n');
    process.exit(1);
  }

  // Start interactive session
  const session = new InteractiveSession(apiKey, {
    autoExecute: options.autoExecute || false,
    verbose: options.verbose || false
  });

  await session.initialize();
  await session.start();
}

// Check if running with no arguments - launch interactive mode
async function handleDefaultBehavior() {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const apiKey = process.env.ANTHROPIC_API_KEY || config.anthropicApiKey;

  // Check if configured
  const isConfigured = config.cluster && config.cluster.context && apiKey;

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
    } else if (!apiKey) {
      console.log(chalk.yellow('⚠ ANTHROPIC_API_KEY not set\n'));
      console.log(chalk.bold('Setup API Key:'));
      console.log(chalk.gray('  export ANTHROPIC_API_KEY=your-key-here\n'));
      console.log(chalk.gray('Or configure it:'));
      console.log(chalk.cyan('  cluster-code config set anthropicApiKey your-key-here\n'));
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
