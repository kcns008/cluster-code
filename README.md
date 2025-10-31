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

### 2. Set up your Anthropic API key:

```sh
export ANTHROPIC_API_KEY=your-api-key-here
```

Get your API key from [Anthropic Console](https://console.anthropic.com/)

### 3. Initialize cluster connection:

```sh
cluster-code init
```

This will prompt you to:
- Select your Kubernetes context
- Choose a default namespace
- Configure your API key (if not set via environment variable)

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
- **Local LLM Support**: Use self-hosted models for privacy and cost control

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

## Data collection, usage, and retention

When you use Cluster Code, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the `/bug` command.

### How we use your data

See our [data usage policies](https://docs.cluster-code.io/data-usage).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information, restricted access to user session data, and clear policies against using feedback for model training.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
