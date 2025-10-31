/**
 * Configuration management commands
 */

import { configManager } from '../config';
import { logger } from '../utils/logger';

export async function configGetCommand(key?: string): Promise<void> {
  if (key) {
    const value = configManager.get(key as any);
    if (value !== undefined) {
      logger.info(`${key}: ${JSON.stringify(value, null, 2)}`);
    } else {
      logger.warning(`Configuration key "${key}" not found`);
    }
  } else {
    const config = configManager.getConfig();
    logger.section('Current Configuration');
    console.log(JSON.stringify(config, null, 2));
  }
}

export async function configSetCommand(key: string, value: string): Promise<void> {
  try {
    // Try to parse value as JSON, otherwise use as string
    let parsedValue: any = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Use as string if not valid JSON
    }

    configManager.set(key as any, parsedValue);
    logger.success(`Configuration updated: ${key} = ${JSON.stringify(parsedValue)}`);
  } catch (error: any) {
    logger.error(`Failed to set configuration: ${error.message}`);
    process.exit(1);
  }
}

export async function configPathCommand(): Promise<void> {
  const path = configManager.getConfigPath();
  logger.info(`Configuration file: ${path}`);
}

export async function configResetCommand(): Promise<void> {
  configManager.clear();
  logger.success('Configuration reset successfully');
}
