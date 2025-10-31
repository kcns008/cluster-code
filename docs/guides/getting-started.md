---
layout: guide
title: Getting Started
nav_order: 2
description: "Get up and running with Cluster Code in minutes"
permalink: /guides/getting-started
---

# Getting Started with Cluster Code
{: .no_toc }

Get up and running with Cluster Code in minutes. This guide will walk you through installation, initial configuration, and your first cluster operations.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Prerequisites

Before installing Cluster Code, ensure you have:

### Required
- **Node.js** 18+ and npm 9+
- **kubectl** 1.28+ ([Install](https://kubernetes.io/docs/tasks/tools/))
- **Git** for repository operations

### Optional (based on your needs)
- **Azure CLI** (`az`) 2.50+ for Azure operations ([Install](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli))
- **AWS CLI** (`aws`) 2.13+ for AWS operations ([Install](https://aws.amazon.com/cli/))
- **gcloud CLI** 400.0+ for GCP operations ([Install](https://cloud.google.com/sdk/docs/install))
- **OpenShift CLI** (`oc`) 4.15+ for OpenShift features ([Install](https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/getting-started-cli.html))
- **Helm** 3.12+ for Helm deployments ([Install](https://helm.sh/docs/intro/install/))
- **ArgoCD CLI** 2.8+ for GitOps workflows ([Install](https://argo-cd.readthedocs.io/en/stable/cli_installation/))

---

## Installation

### Method 1: Install via npm (Recommended)

```bash
# Install globally
npm install -g @cluster-code/cli

# Verify installation
cluster-code --version
```

### Method 2: Install from Source

```bash
# Clone repository
git clone https://github.com/your-org/cluster-code.git
cd cluster-code

# Install dependencies
npm install

# Link for global use
npm link

# Verify installation
cluster-code --version
```

### Method 3: Use via npx (No Installation)

```bash
# Run without installing
npx @cluster-code/cli <command>

# Example
npx @cluster-code/cli diagnose
```

---

## Initial Configuration

### 1. Set Up Configuration File

Cluster Code uses a hierarchical configuration system:

```bash
# Initialize configuration (creates ~/.cluster-code/config.json)
cluster-code config init

# Or use project-specific configuration
cluster-code config init --project
```

### 2. Configure Cloud Providers

Based on which clouds you'll use, configure credentials:

#### Azure Configuration

```bash
# Login to Azure
az login

# Set default subscription
az account set --subscription <subscription-id>

# Configure Cluster Code
cluster-code config set cloud_providers.azure.enabled true
cluster-code config set cloud_providers.azure.subscription_id "<subscription-id>"
```

#### AWS Configuration

```bash
# Configure AWS credentials
aws configure

# Configure Cluster Code
cluster-code config set cloud_providers.aws.enabled true
cluster-code config set cloud_providers.aws.region "us-east-1"
```

#### GCP Configuration

```bash
# Login to GCP
gcloud auth login

# Set project
gcloud config set project <project-id>

# Configure Cluster Code
cluster-code config set cloud_providers.gcp.enabled true
cluster-code config set cloud_providers.gcp.project_id "<project-id>"
```

### 3. Enable Plugins

Enable the plugins you need:

```bash
# Enable core plugins (enabled by default)
cluster-code config set plugins.cluster-core.enabled true
cluster-code config set plugins.k8sgpt-analyzers.enabled true

# Enable cloud provider plugins
cluster-code config set plugins.cloud-azure.enabled true
cluster-code config set plugins.cloud-aws.enabled true
cluster-code config set plugins.cloud-gcp.enabled true

# Enable OpenShift features
cluster-code config set plugins.cluster-openshift.enabled true

# Enable GitOps workflows
cluster-code config set plugins.gitops.enabled true
```

---

## Connect to Your First Cluster

### Option A: Connect to Existing Cluster

If you already have a Kubernetes/OpenShift cluster:

```bash
# List available contexts
kubectl config get-contexts

# Initialize Cluster Code with specific context
cluster-code init --context my-cluster-context --namespace default

# Verify connection
cluster-code status
```

### Option B: Create a New Cluster

#### Azure AKS Cluster

```bash
# Create AKS cluster
cluster-code azure-cluster-create \
  --type aks \
  --name my-first-aks \
  --resource-group my-rg \
  --region eastus \
  --nodes 3

# Connect to cluster (automatic after creation)
cluster-code azure-cluster-connect \
  --name my-first-aks \
  --resource-group my-rg
```

#### AWS EKS Cluster

```bash
# Create EKS cluster
cluster-code aws-cluster-create \
  --type eks \
  --name my-first-eks \
  --region us-east-1 \
  --nodes 2

# Connect to cluster (automatic after creation)
cluster-code aws-cluster-connect \
  --name my-first-eks \
  --region us-east-1
```

---

## Your First Commands

### 1. Check Cluster Health

```bash
# Quick health check
cluster-code status

# Detailed cluster information
cluster-code status --detailed
```

**Expected Output:**
```
Cluster Health Summary:
✅ API Server: Healthy
✅ Nodes: All Ready (3/3)
✅ System Pods: All Running
✅ Resource Usage: Normal (CPU: 25%, Memory: 40%)

Connected to: my-first-aks
Kubernetes Version: 1.28.9
Nodes: 3
Namespaces: 12
```

### 2. Run Diagnostics

```bash
# Comprehensive cluster diagnostics
cluster-code diagnose

# Diagnose specific namespace
cluster-code diagnose --namespace production

# Analyze specific resource type
cluster-code diagnose --analyzer pod
```

**What it does:**
- Scans all resources for issues
- Identifies common problems (CrashLoopBackOff, ImagePullBackOff, etc.)
- Provides root cause analysis
- Suggests remediation steps

### 3. List Resources

```bash
# List nodes with health status
cluster-code node-status

# List pods with issues
cluster-code analyze pod --all-namespaces

# View service connectivity
cluster-code service-describe --all-namespaces
```

### 4. Interactive Troubleshooting

```bash
# Start interactive chat session
cluster-code chat

# Or ask specific questions
cluster-code chat "Why is my pod in CrashLoopBackOff?"
cluster-code chat "How do I scale my deployment?"
cluster-code chat "Show me pods with high memory usage"
```

---

## Deploy Your First Application

### Using Helm

```bash
# Add Helm repository
helm repo add bitnami https://charts.bitnami.com/bitnami

# Deploy nginx with Cluster Code
cluster-code helm-deploy \
  --chart bitnami/nginx \
  --release my-nginx \
  --namespace web \
  --create-namespace

# Check deployment status
kubectl get pods -n web
```

### Using Kustomize

```bash
# Create a simple kustomization
mkdir -p my-app/base
cat > my-app/base/kustomization.yaml <<EOF
resources:
  - deployment.yaml
  - service.yaml
EOF

# Apply with Cluster Code
cluster-code kustomize-apply --path ./my-app/base
```

---

## Common Workflows

### Workflow 1: Daily Cluster Health Check

```bash
#!/bin/bash
# Save as daily-health-check.sh

echo "🏥 Daily Cluster Health Check"
echo "=============================="
echo ""

# Check cluster status
cluster-code status --detailed

# Run diagnostics
cluster-code diagnose --severity-threshold warning

# Check node health
cluster-code node-status

# Check for expiring certificates (OpenShift)
if kubectl get routes &>/dev/null; then
  cluster-code routes-analyze --all-namespaces
fi

echo ""
echo "✅ Health check complete!"
```

### Workflow 2: Deploy Application Stack

```bash
#!/bin/bash
# Deploy complete application stack

# 1. Create namespace
kubectl create namespace myapp

# 2. Deploy database
cluster-code helm-deploy \
  --chart bitnami/postgresql \
  --release myapp-db \
  --namespace myapp \
  --set postgresqlPassword=secret123

# 3. Deploy application
cluster-code kustomize-apply \
  --path ./app/overlays/production \
  --namespace myapp \
  --wait

# 4. Verify deployment
cluster-code diagnose --namespace myapp
```

### Workflow 3: Troubleshoot Pod Issues

```bash
#!/bin/bash
# Troubleshoot failing pods

POD_NAME="my-app-xyz"
NAMESPACE="production"

echo "🔍 Troubleshooting pod: $POD_NAME"
echo ""

# 1. Analyze pod with AI
cluster-code analyze pod $POD_NAME --namespace $NAMESPACE

# 2. Get detailed resource description
cluster-code resource-describe pod $POD_NAME --namespace $NAMESPACE --analyze

# 3. View logs with pattern analysis
cluster-code pod-logs $POD_NAME --namespace $NAMESPACE --analyze --tail 100

# 4. Interactive troubleshooting
cluster-code chat "Help me fix pod $POD_NAME in $NAMESPACE namespace"
```

---

## Configuration Options

### Project-Specific Configuration

Create `.cluster-code.json` in your project root:

```json
{
  "cluster": {
    "default_context": "production-cluster",
    "default_namespace": "myapp"
  },
  "plugins": {
    "k8sgpt-analyzers": {
      "enabled": true,
      "analysis_depth": "deep"
    },
    "gitops": {
      "enabled": true,
      "default_tool": "helm"
    }
  },
  "diagnostics": {
    "severity_threshold": "warning",
    "exclude_namespaces": ["kube-system", "kube-public"]
  }
}
```

### Environment Variables

Override configuration with environment variables:

```bash
# Set default cluster context
export CLUSTER_CODE_CONTEXT="my-cluster"

# Set log level
export CLUSTER_CODE_LOG_LEVEL="debug"

# Use local LLM
export CLUSTER_CODE_LLM_PROVIDER="local"
export CLUSTER_CODE_LLM_ENDPOINT="http://localhost:8080"
```

---

## Local LLM Setup (Optional)

For privacy and cost control, use self-hosted LLMs:

### Using Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull deepseek-coder-v2:16b

# Configure Cluster Code
cluster-code config set ai.provider "local"
cluster-code config set ai.local_endpoint "http://localhost:11434"
cluster-code config set ai.model "deepseek-coder-v2:16b"
```

### Using LiteLLM Proxy

```bash
# Install LiteLLM
pip install litellm

# Start proxy
litellm --model ollama/deepseek-coder-v2

# Configure Cluster Code
cluster-code config set ai.provider "local"
cluster-code config set ai.local_endpoint "http://localhost:8000"
```

[Learn more about Local LLM Support](/guides/local-llm)

---

## Troubleshooting Installation

### Command Not Found

If `cluster-code` command is not found after installation:

```bash
# Check npm global bin directory
npm config get prefix

# Add to PATH (Linux/Mac)
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Or reinstall with sudo (not recommended)
sudo npm install -g @cluster-code/cli
```

### Permission Errors

```bash
# Fix npm permissions (Linux/Mac)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Reinstall
npm install -g @cluster-code/cli
```

### Plugin Not Loading

```bash
# List installed plugins
cluster-code plugin list

# Reinstall plugin
cluster-code plugin install cloud-azure

# Or manually enable in config
cluster-code config set plugins.cloud-azure.enabled true
```

---

## Next Steps

Now that you have Cluster Code installed and configured, explore:

- **[Cloud Provider Integration](/guides/cloud-providers)** - Set up AWS, Azure, GCP
- **[Diagnostics Guide](/guides/diagnostics)** - Master AI-powered troubleshooting
- **[GitOps Workflows](/guides/gitops)** - Automate deployments
- **[OpenShift Features](/guides/openshift)** - Use OpenShift-specific commands

### Tutorials
- [Create Your First Cluster](/tutorials/first-cluster)
- [Deploy Application with Helm](/tutorials/helm-deployment)
- [Troubleshoot Pod Issues](/tutorials/pod-troubleshooting)

### Reference
- [All Commands](/api/commands)
- [Configuration Reference](/api/configuration)
- [Plugin Development](/guides/plugin-development)

---

## Getting Help

If you run into issues:

1. **Check logs**: `cluster-code --log-level debug <command>`
2. **Verify configuration**: `cluster-code config show`
3. **Search documentation**: Use search bar above
4. **Ask community**: [Discord](https://discord.gg/cluster-code)
5. **Report bug**: [GitHub Issues](https://github.com/your-org/cluster-code/issues)

Welcome to Cluster Code! 🎉
