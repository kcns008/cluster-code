/**
 * PufferLib Configuration for Cluster Code
 */

export interface PufferLibConfig {
  enabled: boolean;
  pythonPath?: string;
  envPath?: string;
  modelPath?: string;
  trainingConfig?: TrainingConfig;
}

export interface TrainingConfig {
  // Training hyperparameters
  learningRate: number;
  batchSize: number;
  numEpochs: number;
  gamma: number; // Discount factor
  clipRange: number;
  valueCoefficient: number;
  entropyCoefficient: number;
  maxGradNorm: number;
  
  // Environment settings
  numEnvs: number;
  numSteps: number;
  
  // Model settings
  hiddenSize: number;
  numLayers: number;
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  learningRate: 3e-4,
  batchSize: 64,
  numEpochs: 10,
  gamma: 0.99,
  clipRange: 0.2,
  valueCoefficient: 0.5,
  entropyCoefficient: 0.01,
  maxGradNorm: 0.5,
  numEnvs: 4,
  numSteps: 128,
  hiddenSize: 256,
  numLayers: 2,
};

export const DEFAULT_PUFFERLIB_CONFIG: PufferLibConfig = {
  enabled: false,
  pythonPath: undefined,
  envPath: undefined,
  modelPath: undefined,
  trainingConfig: DEFAULT_TRAINING_CONFIG,
};

/**
 * Get default PufferLib environment path
 */
export function getDefaultEnvPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return `${home}/.cluster-code/pufferlib-env`;
}

/**
 * Get default model storage path
 */
export function getDefaultModelPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return `${home}/.cluster-code/models`;
}
