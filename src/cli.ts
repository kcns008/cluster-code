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

// Chat command
program
  .command('chat [message]')
  .description('Start interactive troubleshooting session')
  .action(async (message) => {
    try {
      await chatCommand(message);
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

// Display help if no command provided
if (process.argv.length === 2) {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║            Welcome to Cluster Code                   ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════╝\n'));
  console.log(chalk.white('AI-powered CLI for Kubernetes cluster management\n'));

  console.log(chalk.bold('Quick Start:'));
  console.log(chalk.gray('  1. Initialize: ') + chalk.cyan('cluster-code init'));
  console.log(chalk.gray('  2. Diagnose:   ') + chalk.cyan('cluster-code diagnose'));
  console.log(chalk.gray('  3. Chat:       ') + chalk.cyan('cluster-code chat\n'));

  console.log(chalk.bold('Available Commands:'));
  program.outputHelp();

  console.log(chalk.gray('\nFor more information, visit:'));
  console.log(chalk.cyan('  https://github.com/kcns008/cluster-code\n'));

  process.exit(0);
}

// Parse arguments
program.parse(process.argv);
