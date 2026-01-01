/**
 * PufferLib Environment Checker
 * 
 * Utilities to check if PufferLib and its dependencies are available
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { getDefaultEnvPath } from './config';

export interface PufferLibStatus {
  installed: boolean;
  pythonVersion?: string;
  pufferVersion?: string;
  cudaAvailable?: boolean;
  torchVersion?: string;
  envPath?: string;
  errors: string[];
}

/**
 * Check if Python is available
 */
export function checkPython(pythonPath?: string): { available: boolean; version?: string; path?: string } {
  const pythonCommands = pythonPath ? [pythonPath] : ['python3', 'python'];
  
  for (const cmd of pythonCommands) {
    try {
      const version = execSync(`${cmd} --version 2>&1`, { encoding: 'utf-8' }).trim();
      const fullPath = execSync(`which ${cmd} 2>/dev/null || where ${cmd} 2>nul`, { 
        encoding: 'utf-8' 
      }).trim().split('\n')[0];
      
      return {
        available: true,
        version: version.replace('Python ', ''),
        path: fullPath,
      };
    } catch {
      continue;
    }
  }
  
  return { available: false };
}

/**
 * Check if PufferLib is installed in a Python environment
 */
export function checkPufferLib(pythonPath?: string): PufferLibStatus {
  const status: PufferLibStatus = {
    installed: false,
    errors: [],
  };

  const python = checkPython(pythonPath);
  if (!python.available) {
    status.errors.push('Python is not installed or not in PATH');
    return status;
  }
  
  status.pythonVersion = python.version;
  
  const pythonCmd = python.path || 'python3';
  
  // Check PufferLib installation
  try {
    const pufferCheck = execSync(
      `${pythonCmd} -c "import pufferlib; print(pufferlib.__version__ if hasattr(pufferlib, '__version__') else 'installed')"`,
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();
    status.installed = true;
    status.pufferVersion = pufferCheck;
  } catch (error: any) {
    status.errors.push('PufferLib is not installed');
    return status;
  }
  
  // Check PyTorch
  try {
    const torchCheck = execSync(
      `${pythonCmd} -c "import torch; print(torch.__version__)"`,
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();
    status.torchVersion = torchCheck;
  } catch {
    status.errors.push('PyTorch is not installed (required for training)');
  }
  
  // Check CUDA availability
  try {
    const cudaCheck = execSync(
      `${pythonCmd} -c "import torch; print(torch.cuda.is_available())"`,
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();
    status.cudaAvailable = cudaCheck === 'True';
  } catch {
    status.cudaAvailable = false;
  }
  
  return status;
}

/**
 * Check if virtual environment exists
 */
export function checkVirtualEnv(envPath?: string): { exists: boolean; path: string; pythonPath?: string } {
  const defaultPath = envPath || getDefaultEnvPath();
  const pythonPath = process.platform === 'win32'
    ? path.join(defaultPath, 'Scripts', 'python.exe')
    : path.join(defaultPath, 'bin', 'python');
  
  return {
    exists: fs.existsSync(pythonPath),
    path: defaultPath,
    pythonPath: fs.existsSync(pythonPath) ? pythonPath : undefined,
  };
}

/**
 * Get comprehensive PufferLib environment status
 */
export async function getPufferLibStatus(envPath?: string): Promise<PufferLibStatus> {
  // First check if virtual environment exists
  const venv = checkVirtualEnv(envPath);
  
  if (venv.exists && venv.pythonPath) {
    const status = checkPufferLib(venv.pythonPath);
    status.envPath = venv.path;
    return status;
  }
  
  // Check system Python
  return checkPufferLib();
}

/**
 * Verify all requirements for RL training
 */
export async function verifyRLRequirements(): Promise<{
  ready: boolean;
  missing: string[];
  warnings: string[];
  status: PufferLibStatus;
}> {
  const status = await getPufferLibStatus();
  const missing: string[] = [];
  const warnings: string[] = [];
  
  if (!status.installed) {
    missing.push('PufferLib');
  }
  
  if (!status.torchVersion) {
    missing.push('PyTorch');
  }
  
  if (!status.cudaAvailable) {
    warnings.push('CUDA not available - training will use CPU (slower)');
  }
  
  return {
    ready: missing.length === 0,
    missing,
    warnings,
    status,
  };
}
