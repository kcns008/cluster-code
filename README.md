# Cluster Code

![](https://img.shields.io/badge/Kubernetes-1.28%2B-blue?style=flat-square) ![](https://img.shields.io/badge/OpenShift-4.15%2B-red?style=flat-square) [![Cluster Code]](https://github.com/your-org/cluster-code)

[Cluster Code]: https://img.shields.io/badge/Cluster%20Code-v1.0.0-brightgreen.svg?style=flat-square

Cluster Code is a comprehensive CLI tool for building, maintaining, and troubleshooting Kubernetes and OpenShift clusters across on-premises, AWS, Azure, and GCP environments. Built on Claude Code's agentic framework, it provides AI-powered cluster diagnostics, multi-cloud provisioning, and intelligent troubleshooting capabilities. Enhanced with [K8sGPT](https://k8sgpt.ai/) analyzers and powered by advanced AI diagnostics.


## Get started

### 1. Install Cluster Code:

```sh
npm install -g @cluster-code/cluster-code
```

Or install locally for development:

```sh
git clone https://github.com/kcns008/cluster-code.git
cd cluster-code
npm install
npm run build
npm link
```

### 2. Set up your LLM provider:

Cluster Code supports multiple LLM providers including Anthropic, OpenAI, Google, and local models via Ollama.

**Option 1: Anthropic (Claude)**
```sh
export ANTHROPIC_API_KEY=your-api-key-here
```
Get your API key from [Anthropic Console](https://console.anthropic.com/)

**Option 2: OpenAI (GPT)**
```sh
export OPENAI_API_KEY=your-api-key-here
```
Get your API key from [OpenAI Platform](https://platform.openai.com/)

**Option 3: Google (Gemini)**
```sh
export GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here
```
Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

**Option 4: Local Models (Ollama)**

No API key needed! Just install and run [Ollama](https://ollama.ai/), then configure:
```sh
cluster-code config provider add ollama
```

### 3. Initialize cluster connection:

```sh
cluster-code init
```

This will prompt you to:
- Select your Kubernetes context
- Choose a default namespace

### 4. Start using Cluster Code:

Simply run `cluster-code` to start the interactive natural language interface:

```sh
cluster-code
```

Now you can interact with your cluster using plain English! For example:
- "Show me all pods in the current namespace"
- "Why is my deployment failing?"
- "Scale my app to 5 replicas"
- "Check node resource usage"

## Core Features

### 💬 Natural Language Interface (NEW!)
- **Interact with your cluster using plain English** - no need to memorize kubectl commands
- AI-powered command generation from natural language requests
- Context-aware suggestions based on your cluster state
- Automatic command execution with safety confirmations
- Conversational troubleshooting with memory of previous interactions
- Support for kubectl, oc (OpenShift), AWS CLI, Azure CLI, and Google Cloud SDK

### 🚀 Cluster Management
- Connect to Kubernetes and OpenShift clusters
- Multi-cloud cluster provisioning (AWS EKS, Azure AKS/ARO, GCP GKE)
- Cluster health monitoring and status reporting
- Resource scaling and node management

### 🔍 AI-Powered Diagnostics
- Integrated K8sGPT analyzers for intelligent troubleshooting
- Parallel analysis agents for comprehensive cluster health
- Real-time log analysis and event correlation
- Interactive problem-solving with advanced AI diagnostics
- **Multi-Provider LLM Support**: Choose from Anthropic, OpenAI, Google, or local models
- **Local LLM Support**: Use self-hosted models (Ollama, LM Studio) for privacy and cost control

### 🛠️ Operations & Maintenance
- Automated cluster upgrades and patching
- Backup and restore workflows
- Certificate management and rotation
- Security vulnerability scanning

### 📁 GitOps Integration
- Helm chart deployment and management
- Kustomize overlay support
- ArgoCD/Flux synchronization
- CI/CD pipeline integration

## Plugin Architecture

This repository includes Cluster Code plugins that extend functionality with custom commands and agents:

- **cluster-core**: Core Kubernetes operations and resource management
- **k8sgpt-analyzers**: AI-powered cluster diagnostics and troubleshooting
- **cluster-openshift**: OpenShift-specific features and operators
- **gitops**: GitOps workflows and deployment automation
- **cloud-providers**: Multi-cloud cluster provisioning (coming soon)

See the [plugins directory](./plugins/README.md) for detailed documentation on available plugins.

## Quick Examples

### Natural Language Interface (Primary Mode)

Just run `cluster-code` and interact in plain English:

```bash
$ cluster-code

╔═══════════════════════════════════════════════════════╗
║            Cluster Code - Interactive Mode            ║
╚═══════════════════════════════════════════════════════╝

Connected to kubernetes cluster
Context: my-cluster
Namespace: production

You: Show me all pods in my namespace

## LLM Provider Configuration

Cluster Code is designed to work with any LLM provider. Similar to [opencode](https://opencode.ai), it uses the [Vercel AI SDK](https://ai-sdk.dev) to support 75+ LLM providers.

### Supported Providers

- **Anthropic (Claude)**: Claude 3.5 Sonnet, Claude 3 Opus, and more
- **OpenAI (GPT)**: GPT-4, GPT-3.5 Turbo, and more
- **Google (Gemini)**: Gemini 1.5 Pro, Gemini 1.5 Flash, and more
- **Ollama**: Run local models like Llama 3, Mistral, and more
- **OpenAI-Compatible**: LM Studio, LocalAI, and other compatible providers

### Quick Start

#### Using Environment Variables (Easiest)

```sh
# Anthropic
export ANTHROPIC_API_KEY=your-key-here

# OpenAI
export OPENAI_API_KEY=your-key-here

# Google
export GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

#### Using Configuration Commands

**List configured providers:**
```sh
cluster-code config provider list
```

**Add a new provider:**
```sh
cluster-code config provider add <provider-name>
```

**Set active provider:**
```sh
cluster-code config provider set <provider-name>
```

**Show current provider:**
```sh
cluster-code config provider show
```

**Remove a provider:**
```sh
cluster-code config provider remove <provider-name>
```

### Example Configurations

#### Anthropic (Claude)
```sh
cluster-code config provider add anthropic
# Provider type: Anthropic (Claude)
# API Key: sk-ant-...
```

Then set the model:
```sh
cluster-code config provider set anthropic
# Model: claude-3-5-sonnet-20241022
```

#### OpenAI (GPT)
```sh
cluster-code config provider add openai
# Provider type: OpenAI (GPT)
# API Key: sk-...
```

Then set the model:
```sh
cluster-code config provider set openai
# Model: gpt-4
```

#### Ollama (Local Models)
```sh
# Start Ollama first
ollama run llama3

# Add provider
cluster-code config provider add ollama
# Provider type: Ollama (Local)
# Base URL: http://localhost:11434/v1

# Set as active
cluster-code config provider set ollama
# Model: llama3
```

#### Custom OpenAI-Compatible Provider (e.g., LM Studio)
```sh
cluster-code config provider add lmstudio
# Provider type: OpenAI-compatible (Custom)
# Base URL: http://127.0.0.1:1234/v1
# API Key: (leave empty for local)

cluster-code config provider set lmstudio
# Model: your-model-name
```

### Configuration File

Configuration is stored in `~/.cluster-code/config.json`:

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "maxTokens": 4096
  },
  "providers": {
    "anthropic": {
      "type": "anthropic",
      "name": "Anthropic",
      "apiKey": "sk-ant-..."
    },
    "openai": {
      "type": "openai",
      "name": "OpenAI",
      "apiKey": "sk-..."
    },
    "ollama": {
      "type": "ollama",
      "name": "Ollama",
      "baseURL": "http://localhost:11434/v1"
    }
  }
}
```

## Data collection, usage, and retention

When you use Cluster Code, any data sent to LLM providers is subject to their respective privacy policies:

- **Anthropic**: [Privacy Policy](https://www.anthropic.com/legal/privacy)
- **OpenAI**: [Privacy Policy](https://openai.com/policies/privacy-policy)
- **Google**: [Privacy Policy](https://policies.google.com/privacy)
- **Local Models (Ollama)**: Data stays on your machine

### Privacy safeguards

- Use environment variables to avoid storing API keys in configuration files
- Use local models (Ollama) for complete data privacy
- All cluster data remains local unless explicitly sent to an LLM for analysis
