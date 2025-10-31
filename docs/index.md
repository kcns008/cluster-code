---
layout: default
title: Home
nav_order: 1
description: "Cluster Code - AI-Powered Kubernetes and OpenShift Cluster Management"
permalink: /
---

# Cluster Code
{: .fs-9 }

AI-Powered Kubernetes & OpenShift Cluster Management across Multi-Cloud Environments
{: .fs-6 .fw-300 }

[Get Started](/guides/getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/your-org/cluster-code){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## What is Cluster Code?

Cluster Code is a comprehensive CLI tool that revolutionizes how you build, maintain, and troubleshoot Kubernetes and OpenShift clusters. Built on Claude's agentic framework and enhanced with [K8sGPT](https://k8sgpt.ai/) analyzers, it provides:

- **🤖 AI-Powered Diagnostics** - Intelligent troubleshooting with root cause analysis
- **☁️ Multi-Cloud Support** - Seamless cluster management across AWS, Azure, GCP, and on-premises
- **🔧 GitOps Integration** - Automated deployments with Helm, Kustomize, ArgoCD, and Flux
- **🚀 Cluster Lifecycle** - Create, upgrade, scale, backup, and delete clusters
- **🔍 Deep Inspection** - Advanced diagnostics for pods, services, routes, operators, and more
- **📊 Local LLM Support** - Use self-hosted models for privacy and cost control

---

## Key Features

### AI-Powered Cluster Diagnostics

Cluster Code integrates advanced AI capabilities to automatically detect and diagnose cluster issues:

```bash
# Run comprehensive cluster diagnostics
cluster-code diagnose

# Analyze specific pod issues
cluster-code analyze pod my-app-pod-xyz

# Troubleshoot OpenShift Routes
cluster-code routes-analyze --namespace production
```

**What it does:**
- Identifies common Kubernetes/OpenShift issues (CrashLoopBackOff, ImagePullBackOff, etc.)
- Analyzes resource constraints, networking problems, and configuration errors
- Provides step-by-step remediation instructions
- Correlates events across resources for root cause analysis

---

### Multi-Cloud Cluster Provisioning

Create production-ready clusters on any cloud platform with best practices built-in:

<div class="code-example" markdown="1">

#### Azure (AKS & ARO)
```bash
# Create Azure Kubernetes Service cluster
cluster-code azure-cluster-create \
  --type aks \
  --name prod-aks \
  --resource-group production-rg \
  --region eastus \
  --nodes 5

# Create Azure Red Hat OpenShift cluster
cluster-code azure-cluster-create \
  --type aro \
  --name prod-aro \
  --resource-group production-rg \
  --region eastus2
```

#### AWS (EKS & ROSA)
```bash
# Create Elastic Kubernetes Service cluster
cluster-code aws-cluster-create \
  --type eks \
  --name prod-eks \
  --region us-east-1 \
  --nodes 3

# Create Red Hat OpenShift Service on AWS
cluster-code aws-cluster-create \
  --type rosa \
  --name prod-rosa \
  --region us-west-2 \
  --multi-az
```

#### GCP (GKE)
```bash
# Create Google Kubernetes Engine cluster
cluster-code gcp-cluster-create \
  --name prod-gke \
  --region us-central1 \
  --nodes 4
```

</div>

---

### OpenShift-Specific Features

Enhanced support for OpenShift with specialized commands:

```bash
# Analyze Routes for TLS and connectivity issues
cluster-code routes-analyze --namespace production

# Install and manage Operators
cluster-code operator-install --operator openshift-gitops-operator

# Troubleshoot BuildConfigs (coming soon)
cluster-code buildconfig-analyze --namespace ci-cd
```

**OpenShift Features:**
- Routes analysis with certificate expiration checking
- Operator lifecycle management (install, upgrade, list)
- BuildConfig and DeploymentConfig support
- Project management and RBAC configuration

---

### GitOps Workflows

Automate deployments with popular GitOps tools:

<div class="code-example" markdown="1">

#### Helm Charts
```bash
# Deploy with Helm
cluster-code helm-deploy \
  --chart ./my-app-chart \
  --release my-app \
  --namespace production \
  --values prod-values.yaml
```

#### Kustomize Overlays
```bash
# Apply Kustomize configuration
cluster-code kustomize-apply \
  --path ./overlays/production \
  --wait
```

#### ArgoCD Sync
```bash
# Synchronize ArgoCD application
cluster-code argocd-sync \
  --app my-production-app \
  --prune
```

#### Flux (coming soon)
```bash
# Reconcile Flux kustomization
cluster-code flux-reconcile \
  --kustomization my-app-stack
```

</div>

---

## Quick Start

### 1. Install Cluster Code

```bash
# Using npm
npm install -g @cluster-code/cli

# Or clone repository
git clone https://github.com/your-org/cluster-code.git
cd cluster-code
npm install
```

### 2. Connect to Your Cluster

```bash
# Initialize connection to existing cluster
cluster-code init --context my-cluster --namespace default

# Or create a new cluster
cluster-code azure-cluster-create --type aks --name my-cluster --resource-group my-rg
```

### 3. Run Diagnostics

```bash
# Check cluster health
cluster-code status

# Run full diagnostics
cluster-code diagnose

# Start interactive troubleshooting
cluster-code chat "Why are my pods crashing?"
```

---

## Architecture

Cluster Code is built on a modular plugin architecture:

```
cluster-code/
├── plugins/
│   ├── cluster-core/          # Core Kubernetes operations
│   ├── k8sgpt-analyzers/      # AI-powered diagnostics
│   ├── cloud-azure/           # Azure (AKS/ARO) integration
│   ├── cloud-aws/             # AWS (EKS/ROSA) integration
│   ├── cloud-gcp/             # GCP (GKE) integration
│   ├── cluster-openshift/     # OpenShift-specific features
│   └── gitops/                # GitOps workflows
├── .claude/
│   ├── commands/              # Slash commands
│   ├── agents/                # Specialized AI agents
│   └── cluster-config.json    # Configuration
└── examples/
    └── cluster-templates/     # Production cluster templates
```

**Key Components:**
- **Commands** - Markdown-based command definitions with frontmatter
- **Agents** - Specialized AI agents for complex operations
- **MCP Servers** - Standardized cloud provider integrations
- **Plugins** - Modular extensions for different capabilities

---

## Supported Platforms

### Kubernetes Distributions
- ✅ Kubernetes 1.28+ (all distributions)
- ✅ Azure Kubernetes Service (AKS)
- ✅ Amazon Elastic Kubernetes Service (EKS)
- ✅ Google Kubernetes Engine (GKE)
- ✅ kind, minikube, k3s (local development)

### OpenShift
- ✅ OpenShift 4.15+
- ✅ Azure Red Hat OpenShift (ARO)
- ✅ Red Hat OpenShift Service on AWS (ROSA)
- ✅ OpenShift Local (formerly CodeReady Containers)

### Cloud Providers
- ✅ **Azure** - Full AKS and ARO support
- ✅ **AWS** - Full EKS and ROSA support
- ✅ **GCP** - Full GKE support
- 🚧 **On-Premises** - Bare metal, VMware, KVM (planned)

---

## Use Cases

### For DevOps Engineers
- Quickly diagnose and fix cluster issues
- Automate cluster provisioning across clouds
- Streamline GitOps deployments
- Monitor cluster health proactively

### For SREs (Site Reliability Engineers)
- Reduce MTTR (Mean Time To Resolution) by 70%
- Intelligent troubleshooting with AI assistance
- Comprehensive cluster observability
- Automated backup and disaster recovery

### For Platform Engineers
- Standardize cluster configurations
- Multi-cloud cluster management
- Self-service cluster provisioning
- Policy enforcement and compliance

### For Developers
- Easy cluster access and context switching
- Deploy applications with Helm/Kustomize
- Interactive troubleshooting assistant
- Local LLM support for privacy

---

## What's New

### Version 1.2.0 (Phase 3) - Latest

**New Cloud Providers:**
- ✨ AWS integration (EKS and ROSA)
- ✨ GCP integration (GKE)

**Enhanced GitOps:**
- ✨ ArgoCD synchronization
- ✨ Flux reconciliation (coming soon)

**Cluster Lifecycle:**
- ✨ Cluster deletion with safety checks
- ✨ Cluster upgrades with validation
- ✨ Node pool management
- ✨ Backup and restore workflows

**Documentation:**
- 📚 Complete GitHub Pages site
- 📚 Comprehensive user guides
- 📚 API reference documentation
- 📚 Step-by-step tutorials

[View Full Changelog](https://github.com/your-org/cluster-code/blob/main/CHANGELOG.md)

---

## Community & Support

### Get Help
- 📖 [Documentation](/guides/getting-started)
- 💬 [Discord Community](https://discord.gg/cluster-code)
- 🐛 [GitHub Issues](https://github.com/your-org/cluster-code/issues)
- 📧 Email: support@cluster-code.io

### Contributing
We welcome contributions! See our [Contributing Guide](https://github.com/your-org/cluster-code/blob/main/CONTRIBUTING.md).

### Stay Updated
- ⭐ [Star us on GitHub](https://github.com/your-org/cluster-code)
- 🐦 [Follow on Twitter](https://twitter.com/cluster_code)
- 📬 [Subscribe to Newsletter](https://cluster-code.io/newsletter)

---

## License

Cluster Code is open source software licensed under the [MIT License](https://github.com/your-org/cluster-code/blob/main/LICENSE).

---

## Next Steps

Ready to get started? Check out our guides:

- [Installation Guide](/guides/installation) - Set up Cluster Code
- [First Cluster Tutorial](/tutorials/first-cluster) - Create your first cluster
- [Configuration Guide](/guides/configuration) - Configure plugins and cloud providers
- [Diagnostics Guide](/guides/diagnostics) - Learn AI-powered troubleshooting

Or explore specific features:
- [Azure Integration](/plugins/cloud-azure)
- [AWS Integration](/plugins/cloud-aws)
- [OpenShift Features](/plugins/cluster-openshift)
- [GitOps Workflows](/plugins/gitops)
