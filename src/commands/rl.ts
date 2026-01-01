/**
 * RL Commands for Cluster Code
 * 
 * Commands for setting up and using PufferLib RL environment
 */

import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { configManager } from '../config';
import { 
  setupPufferLib, 
  removePufferLib, 
  generatePufferLibConfig 
} from '../pufferlib/setup';
import { 
  getPufferLibStatus, 
  verifyRLRequirements,
  checkVirtualEnv 
} from '../pufferlib/checker';
import { 
  getDefaultEnvPath, 
  getDefaultModelPath,
} from '../pufferlib/config';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Show RL environment status
 */
export async function rlStatusCommand(): Promise<void> {
  logger.section('PufferLib RL Environment Status');
  
  const config = configManager.getConfig();
  const pufferConfig = config.pufferlib;
  
  if (!pufferConfig?.enabled) {
    logger.warning('RL environment is not configured');
    logger.info('Run: cluster-code rl setup');
    return;
  }
  
  logger.startSpinner('Checking PufferLib environment...');
  const status = await getPufferLibStatus(pufferConfig.envPath);
  logger.succeedSpinner('Status check complete');
  
  logger.newline();
  logger.info('Configuration:');
  logger.info(`  Enabled: ${pufferConfig.enabled ? 'Yes' : 'No'}`);
  logger.info(`  Environment Path: ${pufferConfig.envPath || 'Not set'}`);
  logger.info(`  Model Path: ${pufferConfig.modelPath || 'Not set'}`);
  
  logger.newline();
  logger.info('Environment Status:');
  logger.info(`  Python Version: ${status.pythonVersion || 'Not found'}`);
  logger.info(`  PufferLib Installed: ${status.installed ? 'Yes' : 'No'}`);
  logger.info(`  PufferLib Version: ${status.pufferVersion || 'N/A'}`);
  logger.info(`  PyTorch Version: ${status.torchVersion || 'Not installed'}`);
  logger.info(`  CUDA Available: ${status.cudaAvailable ? 'Yes' : 'No (CPU only)'}`);
  
  if (status.errors.length > 0) {
    logger.newline();
    logger.warning('Issues:');
    for (const error of status.errors) {
      logger.error(`  - ${error}`);
    }
  }
  
  // Check for trained models
  const modelPath = pufferConfig.modelPath || getDefaultModelPath();
  if (fs.existsSync(modelPath)) {
    const models = fs.readdirSync(modelPath).filter(f => f.endsWith('.pt') || f.endsWith('.pth'));
    if (models.length > 0) {
      logger.newline();
      logger.info('Trained Models:');
      for (const model of models) {
        logger.info(`  - ${model}`);
      }
    }
  }
}

/**
 * Setup RL environment
 */
export async function rlSetupCommand(options: { cuda?: boolean; force?: boolean } = {}): Promise<void> {
  logger.section('PufferLib RL Environment Setup');
  
  const envPath = getDefaultEnvPath();
  const existingEnv = checkVirtualEnv(envPath);
  
  if (existingEnv.exists && !options.force) {
    const { reinstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'reinstall',
        message: 'RL environment already exists. Reinstall?',
        default: false,
      },
    ]);
    
    if (!reinstall) {
      logger.info('Setup cancelled');
      return;
    }
    
    logger.info('Removing existing environment...');
    await removePufferLib(envPath);
  }
  
  // Determine CUDA support
  let withCuda = options.cuda;
  if (withCuda === undefined) {
    const { useCuda } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useCuda',
        message: 'Install with CUDA/GPU support? (Requires NVIDIA GPU and drivers)',
        default: false,
      },
    ]);
    withCuda = useCuda;
  }
  
  logger.newline();
  logger.info('Setting up PufferLib RL environment...');
  logger.info(`Environment path: ${envPath}`);
  logger.info(`CUDA support: ${withCuda ? 'Yes' : 'No'}`);
  logger.newline();
  
  const result = await setupPufferLib({
    envPath,
    withCuda,
    verbose: true,
  });
  
  if (result.success) {
    // Save configuration
    const pufferConfig = generatePufferLibConfig(envPath);
    configManager.set('pufferlib', pufferConfig);
    
    logger.newline();
    logger.success('PufferLib RL environment setup complete!');
    logger.info(`Python path: ${result.pythonPath}`);
    logger.newline();
    logger.info('Next steps:');
    logger.info('  1. Train an RL agent: cluster-code rl train');
    logger.info('  2. Run agent for diagnostics: cluster-code rl diagnose');
  } else {
    logger.newline();
    logger.error('Setup failed');
    for (const error of result.errors) {
      logger.error(`  - ${error}`);
    }
  }
}

/**
 * Remove RL environment
 */
export async function rlRemoveCommand(): Promise<void> {
  logger.section('Remove PufferLib RL Environment');
  
  const config = configManager.getConfig();
  const envPath = config.pufferlib?.envPath || getDefaultEnvPath();
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove RL environment at ${envPath}?`,
      default: false,
    },
  ]);
  
  if (!confirm) {
    logger.info('Removal cancelled');
    return;
  }
  
  const removed = await removePufferLib(envPath);
  
  if (removed) {
    // Update configuration
    configManager.set('pufferlib', { enabled: false });
    logger.success('RL environment removed');
  } else {
    logger.warning('RL environment not found');
  }
}

/**
 * Train RL agent
 */
export async function rlTrainCommand(options: {
  episodes?: number;
  steps?: number;
  simulation?: boolean;
  verbose?: boolean;
} = {}): Promise<void> {
  logger.section('Train RL Agent for Cluster Management');
  
  // Verify RL requirements
  const verification = await verifyRLRequirements();
  
  if (!verification.ready) {
    logger.error('RL environment not ready');
    for (const missing of verification.missing) {
      logger.error(`  Missing: ${missing}`);
    }
    logger.info('Run: cluster-code rl setup');
    return;
  }
  
  for (const warning of verification.warnings) {
    logger.warning(warning);
  }
  
  const config = configManager.getConfig();
  const pufferConfig = config.pufferlib;
  
  if (!pufferConfig?.pythonPath) {
    logger.error('PufferLib Python path not configured');
    return;
  }
  
  // Training parameters
  const episodes = options.episodes || 100;
  const stepsPerEpisode = options.steps || 100;
  const simulationMode = options.simulation !== false; // Default to simulation
  
  logger.newline();
  logger.info('Training Configuration:');
  logger.info(`  Episodes: ${episodes}`);
  logger.info(`  Steps per episode: ${stepsPerEpisode}`);
  logger.info(`  Mode: ${simulationMode ? 'Simulation' : 'Real Cluster'}`);
  logger.newline();
  
  // Create training script
  const trainingScript = createTrainingScript(
    episodes,
    stepsPerEpisode,
    simulationMode,
    pufferConfig.modelPath || getDefaultModelPath(),
  );
  
  const scriptPath = path.join(
    pufferConfig.envPath || getDefaultEnvPath(),
    'train_cluster_agent.py'
  );
  fs.writeFileSync(scriptPath, trainingScript);
  
  logger.info('Starting training...');
  logger.newline();
  
  // Run training
  return new Promise((resolve) => {
    const proc = spawn(pufferConfig.pythonPath!, [scriptPath], {
      stdio: 'inherit',
      cwd: path.dirname(scriptPath),
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        logger.newline();
        logger.success('Training complete!');
        logger.info(`Model saved to: ${pufferConfig.modelPath || getDefaultModelPath()}`);
      } else {
        logger.error(`Training failed with exit code ${code}`);
      }
      resolve();
    });
    
    proc.on('error', (err) => {
      logger.error(`Training error: ${err.message}`);
      resolve();
    });
  });
}

/**
 * Run RL agent for cluster diagnostics
 */
export async function rlDiagnoseCommand(options: {
  model?: string;
  simulation?: boolean;
  steps?: number;
} = {}): Promise<void> {
  logger.section('RL Agent Cluster Diagnostics');
  
  const config = configManager.getConfig();
  const pufferConfig = config.pufferlib;
  
  if (!pufferConfig?.enabled) {
    logger.error('RL environment not configured');
    logger.info('Run: cluster-code rl setup');
    return;
  }
  
  const modelPath = pufferConfig.modelPath || getDefaultModelPath();
  const modelFile = options.model || path.join(modelPath, 'cluster_agent.pt');
  
  if (!fs.existsSync(modelFile)) {
    logger.warning('No trained model found');
    logger.info('Run: cluster-code rl train');
    
    const { useRandom } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useRandom',
        message: 'Run with random policy for demonstration?',
        default: true,
      },
    ]);
    
    if (!useRandom) {
      return;
    }
  }
  
  const steps = options.steps || 20;
  const simulationMode = options.simulation !== false;
  
  logger.newline();
  logger.info('Running RL agent diagnostics...');
  logger.info(`  Mode: ${simulationMode ? 'Simulation' : 'Real Cluster'}`);
  logger.info(`  Max Steps: ${steps}`);
  logger.newline();
  
  // Create inference script
  const inferenceScript = createInferenceScript(
    modelFile,
    steps,
    simulationMode,
    config.cluster?.context,
  );
  
  const scriptPath = path.join(
    pufferConfig.envPath || getDefaultEnvPath(),
    'run_cluster_agent.py'
  );
  fs.writeFileSync(scriptPath, inferenceScript);
  
  // Run agent
  return new Promise((resolve) => {
    const proc = spawn(pufferConfig.pythonPath!, [scriptPath], {
      stdio: 'inherit',
      cwd: path.dirname(scriptPath),
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        logger.newline();
        logger.success('RL diagnostics complete');
      } else {
        logger.error(`Agent run failed with exit code ${code}`);
      }
      resolve();
    });
    
    proc.on('error', (err) => {
      logger.error(`Agent error: ${err.message}`);
      resolve();
    });
  });
}

/**
 * Create training script
 */
function createTrainingScript(
  episodes: number,
  stepsPerEpisode: number,
  simulationMode: boolean,
  modelPath: string,
): string {
  return `#!/usr/bin/env python3
"""
Cluster Code RL Training Script
Generated by cluster-code rl train
"""

import os
import sys

# Add the cluster_env module path
sys.path.insert(0, '${path.join(__dirname, '..', 'pufferlib', 'environments').replace(/\\/g, '/')}')

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from collections import deque

# Import the cluster environment
from cluster_env import ClusterEnv, ClusterAction

class PolicyNetwork(nn.Module):
    """Simple policy network for cluster management"""
    
    def __init__(self, obs_dim, action_dim, hidden_dim=128):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(obs_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
        )
        self.policy_head = nn.Linear(hidden_dim, action_dim)
        self.value_head = nn.Linear(hidden_dim, 1)
    
    def forward(self, x):
        features = self.network(x)
        policy = torch.softmax(self.policy_head(features), dim=-1)
        value = self.value_head(features)
        return policy, value
    
    def act(self, obs):
        with torch.no_grad():
            obs_tensor = torch.FloatTensor(obs).unsqueeze(0)
            policy, value = self(obs_tensor)
            action = torch.multinomial(policy, 1).item()
            return action, policy[0, action].item(), value.item()


def train():
    # Configuration
    episodes = ${episodes}
    max_steps = ${stepsPerEpisode}
    simulation_mode = ${simulationMode ? 'True' : 'False'}
    model_path = '${modelPath.replace(/\\/g, '/')}'
    
    # Create environment
    env = ClusterEnv(simulation_mode=simulation_mode, max_steps=max_steps)
    
    # Create model
    obs_dim = env.OBS_DIM
    action_dim = env.NUM_ACTIONS
    model = PolicyNetwork(obs_dim, action_dim)
    optimizer = optim.Adam(model.parameters(), lr=3e-4)
    
    # Training loop
    episode_rewards = deque(maxlen=100)
    
    print(f"Starting training for {episodes} episodes...")
    print(f"Observation dim: {obs_dim}, Action dim: {action_dim}")
    print()
    
    for episode in range(episodes):
        obs, info = env.reset()
        total_reward = 0
        
        observations = []
        actions = []
        rewards = []
        values = []
        log_probs = []
        
        for step in range(max_steps):
            action, prob, value = model.act(obs)
            
            next_obs, reward, terminated, truncated, info = env.step(action)
            
            observations.append(obs)
            actions.append(action)
            rewards.append(reward)
            values.append(value)
            log_probs.append(np.log(prob + 1e-8))
            
            total_reward += reward
            obs = next_obs
            
            if terminated or truncated:
                break
        
        episode_rewards.append(total_reward)
        
        # Simple policy gradient update
        if len(observations) > 0:
            returns = []
            R = 0
            for r in reversed(rewards):
                R = r + 0.99 * R
                returns.insert(0, R)
            
            returns = torch.FloatTensor(returns)
            returns = (returns - returns.mean()) / (returns.std() + 1e-8)
            
            log_probs_tensor = torch.FloatTensor(log_probs)
            loss = -(log_probs_tensor * returns).mean()
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
        
        if (episode + 1) % 10 == 0:
            avg_reward = np.mean(episode_rewards)
            print(f"Episode {episode + 1}/{episodes} | "
                  f"Reward: {total_reward:.2f} | "
                  f"Avg(100): {avg_reward:.2f} | "
                  f"Issues: {len(info.get('issues', []))}")
    
    # Save model
    os.makedirs(model_path, exist_ok=True)
    model_file = os.path.join(model_path, 'cluster_agent.pt')
    torch.save({
        'model_state_dict': model.state_dict(),
        'obs_dim': obs_dim,
        'action_dim': action_dim,
    }, model_file)
    
    print()
    print(f"Training complete! Model saved to: {model_file}")
    print(f"Final average reward (last 100 episodes): {np.mean(episode_rewards):.2f}")


if __name__ == "__main__":
    train()
`;
}

/**
 * Create inference script
 */
function createInferenceScript(
  modelFile: string,
  maxSteps: number,
  simulationMode: boolean,
  context?: string,
): string {
  return `#!/usr/bin/env python3
"""
Cluster Code RL Inference Script
Generated by cluster-code rl diagnose
"""

import os
import sys

# Add the cluster_env module path
sys.path.insert(0, '${path.join(__dirname, '..', 'pufferlib', 'environments').replace(/\\/g, '/')}')

import numpy as np
import torch
import torch.nn as nn

from cluster_env import ClusterEnv, ClusterAction

class PolicyNetwork(nn.Module):
    """Simple policy network for cluster management"""
    
    def __init__(self, obs_dim, action_dim, hidden_dim=128):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(obs_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
        )
        self.policy_head = nn.Linear(hidden_dim, action_dim)
        self.value_head = nn.Linear(hidden_dim, 1)
    
    def forward(self, x):
        features = self.network(x)
        policy = torch.softmax(self.policy_head(features), dim=-1)
        value = self.value_head(features)
        return policy, value
    
    def act(self, obs, greedy=False):
        with torch.no_grad():
            obs_tensor = torch.FloatTensor(obs).unsqueeze(0)
            policy, value = self(obs_tensor)
            if greedy:
                action = policy.argmax().item()
            else:
                action = torch.multinomial(policy, 1).item()
            return action, policy[0].numpy(), value.item()


def run_agent():
    model_file = '${modelFile.replace(/\\/g, '/')}'
    max_steps = ${maxSteps}
    simulation_mode = ${simulationMode ? 'True' : 'False'}
    context = ${context ? `'${context}'` : 'None'}
    
    # Create environment
    env = ClusterEnv(
        simulation_mode=simulation_mode,
        max_steps=max_steps,
        context=context,
    )
    
    # Load or create model
    use_random = not os.path.exists(model_file)
    
    if use_random:
        print("No trained model found, using random policy for demonstration")
        model = None
    else:
        print(f"Loading model from: {model_file}")
        checkpoint = torch.load(model_file, weights_only=True)
        model = PolicyNetwork(checkpoint['obs_dim'], checkpoint['action_dim'])
        model.load_state_dict(checkpoint['model_state_dict'])
        model.eval()
    
    print()
    print("=" * 60)
    print("RL Agent Cluster Diagnostics")
    print("=" * 60)
    print()
    
    obs, info = env.reset()
    
    print("Initial cluster state:")
    print(f"  Issues detected: {info.get('issues', [])}")
    print()
    
    for step in range(max_steps):
        if model is not None:
            action, probs, value = model.act(obs, greedy=True)
            confidence = probs[action] * 100
        else:
            action = env.action_space.sample()
            confidence = 100.0 / env.NUM_ACTIONS
        
        action_name = ClusterAction(action).name
        
        next_obs, reward, terminated, truncated, info = env.step(action)
        
        print(f"Step {step + 1}:")
        print(f"  Action: {action_name}")
        if model is not None:
            print(f"  Confidence: {confidence:.1f}%")
            print(f"  State Value: {value:.2f}")
        print(f"  Reward: {reward:.2f}")
        print(f"  Result: {info.get('action_result', {}).get('message', 'N/A')}")
        
        issues = info.get('issues', [])
        if issues:
            print(f"  Remaining Issues: {issues}")
        else:
            print("  Status: All issues resolved!")
        print()
        
        obs = next_obs
        
        if terminated:
            print("Episode terminated - cluster issues resolved or catastrophic failure")
            break
        
        if truncated:
            print("Episode truncated - max steps reached")
            break
    
    print("=" * 60)
    print(f"Diagnostics complete. Total reward: {info.get('total_reward', 0):.2f}")
    print("=" * 60)


if __name__ == "__main__":
    run_agent()
`;
}
