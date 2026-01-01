/**
 * PufferLib Setup Utilities
 * 
 * Handles installation and configuration of PufferLib environment
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { getDefaultEnvPath, getDefaultModelPath, PufferLibConfig, DEFAULT_PUFFERLIB_CONFIG } from './config';
import { checkPython, checkVirtualEnv, getPufferLibStatus } from './checker';

export interface SetupResult {
  success: boolean;
  envPath: string;
  pythonPath: string;
  message: string;
  errors: string[];
}

export interface SetupOptions {
  envPath?: string;
  withCuda?: boolean;
  verbose?: boolean;
}

/**
 * Create Python virtual environment for PufferLib
 */
async function createVirtualEnv(envPath: string, verbose?: boolean): Promise<boolean> {
  const python = checkPython();
  if (!python.available) {
    throw new Error('Python 3 is required but not found. Please install Python 3.8+');
  }
  
  const pythonCmd = python.path || 'python3';
  
  // Create virtual environment
  return new Promise((resolve, reject) => {
    const process = spawn(pythonCmd, ['-m', 'venv', envPath], {
      stdio: verbose ? 'inherit' : 'pipe',
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Failed to create virtual environment (exit code: ${code})`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Install PufferLib and dependencies
 */
async function installPufferLib(
  pythonPath: string,
  withCuda: boolean = false,
  verbose: boolean = false
): Promise<boolean> {
  
  // Upgrade pip first
  await runCommand(pythonPath, ['-m', 'pip', 'install', '--upgrade', 'pip'], verbose);
  
  // Install PyTorch (with or without CUDA)
  const torchPackages = withCuda
    ? ['torch', 'torchvision', 'torchaudio', '--index-url', 'https://download.pytorch.org/whl/cu118']
    : ['torch', 'torchvision', 'torchaudio', '--index-url', 'https://download.pytorch.org/whl/cpu'];
  
  await runCommand(pythonPath, ['-m', 'pip', 'install', ...torchPackages], verbose);
  
  // Install PufferLib
  await runCommand(pythonPath, ['-m', 'pip', 'install', 'pufferlib'], verbose);
  
  // Install additional dependencies for cluster environment
  await runCommand(pythonPath, ['-m', 'pip', 'install', 
    'numpy',
    'gymnasium',
    'tensorboard',
  ], verbose);
  
  return true;
}

/**
 * Run a command and return promise
 */
function runCommand(command: string, args: string[], verbose: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: verbose ? 'inherit' : 'pipe',
    });
    
    let stderr = '';
    if (!verbose && proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Setup PufferLib environment
 */
export async function setupPufferLib(options: SetupOptions = {}): Promise<SetupResult> {
  const envPath = options.envPath || getDefaultEnvPath();
  const modelPath = getDefaultModelPath();
  const errors: string[] = [];
  
  // Create directories
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.mkdirSync(modelPath, { recursive: true });
  
  // Check if environment already exists
  const existingEnv = checkVirtualEnv(envPath);
  if (existingEnv.exists) {
    const status = await getPufferLibStatus(envPath);
    if (status.installed) {
      return {
        success: true,
        envPath,
        pythonPath: existingEnv.pythonPath!,
        message: 'PufferLib environment already exists and is configured',
        errors: [],
      };
    }
  }
  
  try {
    // Create virtual environment
    logger.info('Creating Python virtual environment...');
    await createVirtualEnv(envPath, options.verbose);
    
    const pythonPath = process.platform === 'win32'
      ? path.join(envPath, 'Scripts', 'python.exe')
      : path.join(envPath, 'bin', 'python');
    
    // Install PufferLib
    logger.info('Installing PufferLib and dependencies...');
    logger.info(options.withCuda ? 'Installing with CUDA support...' : 'Installing CPU-only version...');
    await installPufferLib(pythonPath, options.withCuda, options.verbose);
    
    // Verify installation
    const status = await getPufferLibStatus(envPath);
    if (!status.installed) {
      throw new Error('PufferLib installation verification failed');
    }
    
    return {
      success: true,
      envPath,
      pythonPath,
      message: `PufferLib environment successfully created at ${envPath}`,
      errors: [],
    };
    
  } catch (error: any) {
    errors.push(error.message);
    return {
      success: false,
      envPath,
      pythonPath: '',
      message: 'Failed to setup PufferLib environment',
      errors,
    };
  }
}

/**
 * Remove PufferLib environment
 */
export async function removePufferLib(envPath?: string): Promise<boolean> {
  const targetPath = envPath || getDefaultEnvPath();
  
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return true;
  }
  
  return false;
}

/**
 * Generate PufferLib configuration for cluster-code
 */
export function generatePufferLibConfig(envPath: string): PufferLibConfig {
  const pythonPath = process.platform === 'win32'
    ? path.join(envPath, 'Scripts', 'python.exe')
    : path.join(envPath, 'bin', 'python');
  
  return {
    ...DEFAULT_PUFFERLIB_CONFIG,
    enabled: true,
    pythonPath,
    envPath,
    modelPath: getDefaultModelPath(),
  };
}
