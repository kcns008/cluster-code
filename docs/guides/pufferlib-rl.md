# PufferLib Integration Guide

This guide explains how to use the optional PufferLib reinforcement learning (RL) integration in cluster-code for intelligent cluster management and troubleshooting.

## Overview

[PufferLib](https://github.com/PufferAI/PufferLib) is a high-performance reinforcement learning library. The integration with cluster-code allows you to train AI agents that can automatically diagnose and manage Kubernetes clusters.

**Key Features:**
- Train RL agents to identify and resolve cluster issues
- Simulate cluster problems for safe training
- Run trained agents on real clusters for diagnostics
- GPU acceleration support (optional)

## Prerequisites

- Python 3.8 or later
- pip (Python package manager)
- Optional: NVIDIA GPU with CUDA drivers for accelerated training

## Quick Start

### 1. Set up the RL Environment

During `cluster-code init`, you'll be asked if you want to set up the PufferLib environment. You can also set it up manually:

```bash
# Basic setup (CPU only)
cluster-code rl setup

# With GPU/CUDA support
cluster-code rl setup --cuda
```

### 2. Check Status

```bash
cluster-code rl status
```

This shows:
- Python and PufferLib versions
- CUDA availability
- Trained model locations
- Configuration details

### 3. Train an Agent

```bash
# Train with default settings (100 episodes, simulation mode)
cluster-code rl train

# Custom training
cluster-code rl train --episodes 500 --steps 200 --verbose

# Train on real cluster (be careful!)
cluster-code rl train --no-simulation
```

### 4. Run Diagnostics

```bash
# Run RL-based diagnostics
cluster-code rl diagnose

# Run with specific model
cluster-code rl diagnose --model ~/.cluster-code/models/cluster_agent.pt

# Run on real cluster
cluster-code rl diagnose --no-simulation
```

## How It Works

### Cluster Environment

The RL environment models your Kubernetes cluster as a Gymnasium environment:

**Observation Space (18 dimensions):**
- Node metrics (count, ready/not-ready status)
- Pod metrics (running, pending, failed, unknown)
- Deployment health
- Resource usage (CPU, memory)
- Event counts (warning vs normal)
- Issue flags (PVC, network, resource pressure)

**Action Space (15 actions):**
| Action | Description |
|--------|-------------|
| GET_NODES | Retrieve node information |
| GET_PODS | Retrieve pod information |
| GET_EVENTS | Get cluster events |
| GET_DEPLOYMENTS | Get deployment status |
| CHECK_LOGS | Check pod logs |
| DESCRIBE_UNHEALTHY | Describe unhealthy resources |
| RESTART_FAILED_PODS | Restart failed pods |
| SCALE_UP_DEPLOYMENT | Scale up deployment |
| SCALE_DOWN_DEPLOYMENT | Scale down deployment |
| DRAIN_NODE | Drain a node |
| UNCORDON_NODE | Uncordon a node |
| TOP_NODES | Get node resource usage |
| TOP_PODS | Get pod resource usage |
| GET_RESOURCE_QUOTAS | Check resource quotas |
| WAIT | No action |

**Reward Function:**
- Positive rewards for resolving issues
- Negative rewards for cluster degradation
- Bonus for maintaining healthy cluster state
- Small step penalty to encourage efficiency

### Training Modes

#### Simulation Mode (Default)
Trains on a simulated cluster with randomly generated issues. Safe for experimentation and doesn't affect your real cluster.

#### Real Cluster Mode
Connects to your configured Kubernetes cluster. **Use with caution!** By default, only read operations are executed.

## Configuration

PufferLib configuration is stored in `~/.cluster-code/config.json`:

```json
{
  "pufferlib": {
    "enabled": true,
    "pythonPath": "~/.cluster-code/pufferlib-env/bin/python",
    "envPath": "~/.cluster-code/pufferlib-env",
    "modelPath": "~/.cluster-code/models",
    "trainingConfig": {
      "learningRate": 0.0003,
      "batchSize": 64,
      "numEpochs": 10,
      "gamma": 0.99,
      "numEnvs": 4,
      "numSteps": 128
    }
  }
}
```

## Command Reference

### `cluster-code rl status`
Display the status of the RL environment.

### `cluster-code rl setup`
Set up the PufferLib RL environment.

**Options:**
- `--cuda` - Install with CUDA/GPU support
- `--force` - Force reinstall if environment exists

### `cluster-code rl remove`
Remove the PufferLib RL environment.

### `cluster-code rl train`
Train an RL agent for cluster management.

**Options:**
- `-e, --episodes <n>` - Number of training episodes (default: 100)
- `-s, --steps <n>` - Steps per episode (default: 100)
- `--no-simulation` - Train on real cluster
- `-v, --verbose` - Show verbose output

### `cluster-code rl diagnose`
Run RL-based cluster diagnostics.

**Options:**
- `-m, --model <path>` - Path to trained model
- `-s, --steps <n>` - Maximum steps (default: 20)
- `--no-simulation` - Run on real cluster

## Troubleshooting

### "Python is not installed"
Install Python 3.8+ from [python.org](https://python.org) or via your package manager.

### "PufferLib is not installed"
Run `cluster-code rl setup` to install PufferLib.

### "CUDA not available"
- Ensure NVIDIA drivers are installed
- Reinstall with `cluster-code rl setup --cuda --force`

### Training is slow
- Use GPU acceleration: `cluster-code rl setup --cuda`
- Reduce episodes or steps
- Use simulation mode for initial training

## Best Practices

1. **Start with simulation** - Always train initially in simulation mode
2. **Validate on simulation** - Test trained agents on simulation before real clusters
3. **Use read-only on real clusters** - The default mode only performs read operations
4. **Monitor training** - Use TensorBoard to track training progress
5. **Save checkpoints** - Trained models are saved to `~/.cluster-code/models/`

## Advanced: Custom Environments

You can extend the ClusterEnv class to add custom observations or actions:

```python
from cluster_env import ClusterEnv, ClusterAction

class CustomClusterEnv(ClusterEnv):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Add custom initialization
    
    def _calculate_reward(self, prev_state, curr_state, action, result):
        # Custom reward function
        return super()._calculate_reward(prev_state, curr_state, action, result)
```

## References

- [PufferLib Documentation](https://puffer.ai/)
- [PufferLib GitHub](https://github.com/PufferAI/PufferLib)
- [Gymnasium Documentation](https://gymnasium.farama.org/)
- [Kubernetes API](https://kubernetes.io/docs/reference/kubernetes-api/)
