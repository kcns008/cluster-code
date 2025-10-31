/**
 * Logging utilities for cluster-code
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';

export class Logger {
  private spinner: Ora | null = null;

  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  warning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  error(message: string): void {
    console.log(chalk.red('✗'), message);
  }

  debug(message: string): void {
    if (process.env.DEBUG || process.env.VERBOSE) {
      console.log(chalk.gray('🐛'), message);
    }
  }

  startSpinner(text: string): void {
    this.spinner = ora(text).start();
  }

  updateSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  succeedSpinner(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }

  failSpinner(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }

  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  section(title: string): void {
    console.log('\n' + chalk.bold.cyan('━'.repeat(50)));
    console.log(chalk.bold.cyan(`  ${title}`));
    console.log(chalk.bold.cyan('━'.repeat(50)) + '\n');
  }

  table(data: any[]): void {
    console.table(data);
  }

  json(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  }

  newline(): void {
    console.log();
  }
}

export const logger = new Logger();
