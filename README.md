# Cluster Code

![](https://img.shields.io/badge/Kubernetes-1.28%2B-blue?style=flat-square) ![](https://img.shields.io/badge/OpenShift-4.15%2B-red?style=flat-square) [![Cluster Code]](https://github.com/your-org/cluster-code)

[Cluster Code]: https://img.shields.io/badge/Cluster%20Code-v1.0.0-brightgreen.svg?style=flat-square

Cluster Code is a comprehensive CLI tool for building, maintaining, and troubleshooting Kubernetes and OpenShift clusters across on-premises, AWS, Azure, and GCP environments. Built on Cluster Code's agentic framework, it provides AI-powered cluster diagnostics, multi-cloud provisioning, and intelligent troubleshooting capabilities.

**Enhanced with [K8sGPT](https://k8sgpt.ai/) analyzers and powered by advanced AI diagnostics.**

<img src="./demo.gif" />

## Get started

1. Install Cluster Code:

```sh
npm install -g @cluster-code/cli
git clone https://github.com/your-org/cluster-code.git
cd cluster-code
```

2. Initialize cluster connection:

```sh
cluster-code init --context my-cluster --namespace production
```

3. Run cluster diagnostics:

```sh
cluster-code diagnose
```

4. Start interactive troubleshooting:

```sh
cluster-code chat
```

## Core Features

### 🚀 Cluster Management
- Connect to Kubernetes and OpenShift clusters
- Multi-cloud cluster provisioning (AWS EKS, Azure AKS/ARO, GCP GKE)
- Cluster health monitoring and status reporting
- Resource scaling and node management

### 🔍 AI-Powered Diagnostics
- Integrated K8sGPT analyzers for intelligent troubleshooting
- Parallel analysis agents for comprehensive cluster health
- Real-time log analysis and event correlation
- Interactive problem-solving with Claude AI

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

### Diagnose Cluster Issues
```bash
# Run comprehensive cluster diagnostics
cluster-code diagnose

# Troubleshoot specific pod
cluster-code troubleshoot pod my-app-pod-xyz

# Analyze service connectivity
cluster-code analyze service my-service

# Check node health and resource pressure
cluster-code check nodes
```

### Interactive Troubleshooting
```bash
# Start chat-based troubleshooting
cluster-code chat

# Get help with specific issues
cluster-code chat "Why are my pods crashing?"
cluster-code chat "Help me debug service connectivity"
```

### Resource Management
```bash
# Scale deployment
cluster-code scale deployment my-app --replicas 5

# View pod logs
cluster-code logs pod my-app-pod-xyz --follow

# Describe any resource
cluster-code describe deployment my-app
cluster-code describe service my-service
cluster-code describe pvc my-data-volume
```

## Documentation

- **[Getting Started Guide](docs/getting-started.md)** - Installation and first cluster connection
- **[Troubleshooting Playbook](docs/troubleshooting-playbook.md)** - Common issues and solutions
- **[Cluster Connection Guide](docs/cluster-connection.md)** - Multi-cluster configuration
- **[API Reference](docs/api-reference.md)** - Commands and agents documentation
- **[Plugin Development](docs/plugin-development.md)** - Creating custom analyzers

## Reporting Bugs

We welcome your feedback. Use the `/bug` command to report issues directly within Cluster Code, or file a [GitHub issue](https://github.com/your-org/cluster-code/issues).

## Community

Join the [Cluster Code Discord](https://discord.gg/cluster-code) to connect with other developers and SREs using Cluster Code. Get help, share troubleshooting tips, and discuss cluster management best practices.

## Data collection, usage, and retention

When you use Cluster Code, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the `/bug` command.

### How we use your data

See our [data usage policies](https://docs.cluster-code.io/data-usage).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information, restricted access to user session data, and clear policies against using feedback for model training.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
