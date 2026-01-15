# Cluster Code

![](https://img.shields.io/badge/Kubernetes-1.28%2B-blue?style=flat-square) ![](https://img.shields.io/badge/OpenShift-4.15%2B-red?style=flat-square) [![Cluster Code]](https://github.com/kcns008/cluster-code)

[Cluster Code]: https://img.shields.io/badge/Cluster%20Code-v1.0.0-brightgreen.svg?style=flat-square

AI-powered CLI tool for Kubernetes and OpenShift cluster management with intelligent diagnostics, multi-cloud support, and GitOps workflows.

## 🎬 Demo

https://github.com/user-attachments/assets/cluster-code.mp4

<video src="docs/cluster-code.mp4" controls width="100%"></video>

## ⚡ Quick Start

### Install

```sh
npm install -g cluster-code
```

### Configure LLM Provider

```sh
# Option 1: Auto-detect from Claude Code (if ~/.claude/settings.json exists)
# cluster-code will automatically use your Claude API key

# Option 2: Set environment variables
export ANTHROPIC_API_KEY=your-api-key  # Anthropic (Claude)
export OPENAI_API_KEY=your-api-key     # Or OpenAI

# Option 3: Use local models (no API key needed)
ollama pull llama3
cluster-code config provider add ollama
```

### Connect & Go

```sh
cluster-code init
cluster-code
```

That's it! Start chatting with your cluster in plain English.

## ✨ Key Features

- 💬 **Natural Language Interface** - Control your cluster using plain English
- 🤖 **Agentic Mode** - Autonomous execution with Claude Agent SDK
- 🔍 **AI-Powered Diagnostics** - Intelligent troubleshooting with K8sGPT
- ☁️ **Multi-Cloud Support** - AWS EKS, Azure AKS/ARO, GCP GKE
- 🚀 **GitOps Ready** - Helm, Kustomize, ArgoCD, Flux integration
- 🔒 **Local LLM Support** - Use Ollama for complete data privacy
- 🎯 **OpenShift Native** - Routes, Operators, BuildConfigs support
- 🤖 **RL-Based Management** - Optional PufferLib integration for training AI agents
- 🔐 **GitHub Copilot Integration** - OAuth authentication and multi-model support
- 🖥️ **Multiple UI Modes** - Interactive, TUI, and legacy chat modes

## 📚 Documentation

**[View Full Documentation →](https://kcns008.github.io/cluster-code)**

- [Installation Guide](https://kcns008.github.io/cluster-code/guides/installation) - Detailed setup instructions
- [LLM Provider Setup](https://kcns008.github.io/cluster-code/guides/llm-providers) - Configure Anthropic, OpenAI, Google, or local models
- [Getting Started](https://kcns008.github.io/cluster-code/guides/getting-started) - First steps and tutorials
- [PufferLib RL Guide](./docs/guides/pufferlib-rl.md) - Reinforcement learning for cluster management
- [API Reference](https://kcns008.github.io/cluster-code/api/commands) - Complete command reference

## 💡 Usage Examples

### Interactive Mode (Default)

```bash
# Start interactive natural language interface
$ cluster-code
# or explicitly
$ cluster-code interactive

You: Show me all pods that are failing
You: Why is my deployment crashing?
You: Scale my app to 5 replicas
```

### Agentic Mode (Autonomous Execution)

```bash
# Start agentic mode with Claude Agent SDK (Claude-only)
$ cluster-code agent
# or with a specific task
$ cluster-code agent "Fix all failing pods in the cluster"
```

### TUI Mode

```bash
# Start terminal user interface
$ cluster-code ui
```

### Direct Commands

```bash
# Run cluster diagnostics
cluster-code diagnose

# Show cluster and CLI info
cluster-code info

# Initialize cluster connection
cluster-code init

# Run first-time setup wizard
cluster-code setup
```

### Model & Authentication Management

```bash
# Configure model interactively
cluster-code --configure-model

# List available models
cluster-code --list-models

# Use a specific model for this session
cluster-code --model gpt-4

# Set default model permanently
cluster-code --set-default-model claude-3-opus

# GitHub Copilot authentication
cluster-code --setup-github
cluster-code --show-auth
cluster-code --whoami
cluster-code --test-connection
cluster-code --logout-github
```

### Reinforcement Learning (Optional)

Train AI agents to automatically manage your cluster using PufferLib:

```bash
# Set up RL environment (optional during init)
cluster-code rl setup

# Train an agent
cluster-code rl train --episodes 500

# Run RL-based diagnostics
cluster-code rl diagnose
```

See the [PufferLib RL Guide](./docs/guides/pufferlib-rl.md) for details.

## � CLI Reference

### Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize cluster connection |
| `diagnose` | Run comprehensive cluster diagnostics |
| `info` | Show cluster and CLI tool information |
| `chat` | Start interactive troubleshooting session (legacy mode) |
| `interactive` / `i` | Start interactive natural language interface (default) |
| `agent` / `a` | Start agentic mode with Claude Agent SDK (autonomous execution) |
| `ui` | Start TUI mode |
| `config` | Manage cluster-code configuration |
| `rl` | Manage PufferLib RL environment |
| `github` | Manage GitHub Copilot authentication and settings |
| `model` | Manage AI model selection |
| `whoami` | Show GitHub user info and current model |
| `setup` | Run first-time setup wizard |
| `version` | Show version information |

### Global Options

| Option | Description |
|--------|-------------|
| `--setup-github` | Start GitHub OAuth authentication flow |
| `--github-token <token>` | Set GitHub token manually |
| `--configure-model` | Interactive model selection |
| `--show-auth` | Display current authentication status |
| `--list-models` | Show all available models |
| `--whoami` | Show GitHub user info and current model |
| `--logout-github` | Remove GitHub credentials |
| `--test-connection` | Test GitHub Copilot API access |
| `--model <model>` | Use a specific model for this session |
| `--set-default-model <model>` | Set the default model permanently |

## �🔌 Plugin Architecture

- **cluster-core** - Core Kubernetes operations
- **k8sgpt-analyzers** - AI-powered diagnostics
- **cluster-openshift** - OpenShift-specific features
- **cloud-providers** - Multi-cloud provisioning
- **gitops** - Deployment automation

[Learn more about plugins →](./plugins/README.md)

## 🤝 Contributing

We welcome contributions! Check out our [contributing guide](./CONTRIBUTING.md) to get started.

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details

## 🔗 Links

- [Documentation](https://kcns008.github.io/cluster-code)
- [GitHub Issues](https://github.com/kcns008/cluster-code/issues)
- [Changelog](./CHANGELOG.md)

---

**Ready to get started?** Install cluster-code and check out our [Quick Start Guide](https://kcns008.github.io/cluster-code/guides/getting-started) →
