---
layout: default
title: Installation
parent: Guides
nav_order: 1
description: "Complete installation guide for Cluster Code"
permalink: /guides/installation
---

# Installation Guide
{: .no_toc }

Complete guide to installing and setting up Cluster Code on your system.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Prerequisites

Before installing Cluster Code, ensure you have the following installed:

### Required

- **Node.js** 18.0 or higher
- **npm** 9.0 or higher
- **kubectl** 1.28 or higher
- **Git** (for repository operations)

Check your versions:

```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
kubectl version --client  # Should be v1.28.0 or higher
```

### Optional (Based on Your Needs)

Install these tools based on which features you plan to use:

| Tool | Version | Purpose | Install Link |
|------|---------|---------|--------------|
| **Azure CLI** (`az`) | 2.50+ | Azure AKS/ARO management | [Install](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) |
| **AWS CLI** (`aws`) | 2.13+ | AWS EKS management | [Install](https://aws.amazon.com/cli/) |
| **gcloud CLI** | 400.0+ | GCP GKE management | [Install](https://cloud.google.com/sdk/docs/install) |
| **OpenShift CLI** (`oc`) | 4.15+ | OpenShift features | [Install](https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/getting-started-cli.html) |
| **Helm** | 3.12+ | Helm deployments | [Install](https://helm.sh/docs/intro/install/) |
| **ArgoCD CLI** | 2.8+ | GitOps workflows | [Install](https://argo-cd.readthedocs.io/en/stable/cli_installation/) |
| **Ollama** | latest | Local LLM support | [Install](https://ollama.ai/) |

---

## Installation Methods

### Method 1: NPM Global Install (Recommended)

The easiest way to install Cluster Code is via npm:

```bash
# Install the package globally
npm install -g cluster-code

# Verify installation
cluster-code --version
```

**Scoped package option:**
```bash
# Install using scoped package name
npm install -g @cluster-code/cluster-code
```

{: .note }
Both `cluster-code` and `@cluster-code/cluster-code` install the same package. The unscoped version is an alias for convenience.

### Method 2: Install from Source

For development or contributing:

```bash
# Clone the repository
git clone https://github.com/kcns008/cluster-code.git
cd cluster-code

# Install dependencies
npm install

# Build the project
npm run build

# Link for global use
npm link

# Verify installation
cluster-code --version
```

### Method 3: Run with npx (No Installation)

Use Cluster Code without installing it globally:

```bash
# Run commands directly with npx
npx cluster-code diagnose

# Or using scoped package
npx @cluster-code/cluster-code diagnose
```

{: .important }
Using `npx` will download the package each time you run it. For regular use, we recommend global installation.

### Method 4: Local Project Dependency

Add Cluster Code as a dependency in your Node.js project:

```bash
# Install as project dependency
npm install cluster-code

# Add to package.json scripts
```

**package.json:**
```json
{
  "scripts": {
    "cluster:diagnose": "cluster-code diagnose",
    "cluster:status": "cluster-code status"
  },
  "dependencies": {
    "cluster-code": "^1.0.0"
  }
}
```

---

## Post-Installation Setup

### 1. Verify Installation

```bash
# Check version
cluster-code --version

# Check help
cluster-code --help

# List available commands
cluster-code list-commands
```

Expected output:
```
cluster-code version 1.0.0
✓ Node.js v20.10.0
✓ kubectl v1.28.0
✓ Configuration: ~/.cluster-code/config.json
```

### 2. Initialize Configuration

Create the default configuration file:

```bash
# Initialize with defaults
cluster-code config init

# Or use custom config location
cluster-code config init --config ~/.custom-cluster-code.json
```

This creates `~/.cluster-code/config.json` with default settings.

### 3. Verify kubectl Access

Ensure you have access to a Kubernetes cluster:

```bash
# List available contexts
kubectl config get-contexts

# Set current context
kubectl config use-context <context-name>

# Verify cluster access
kubectl cluster-info
```

---

## Troubleshooting Installation Issues

### Command Not Found

If `cluster-code` command is not recognized after installation:

**Linux/macOS:**
```bash
# Check npm global bin directory
npm config get prefix

# Add to PATH
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# For zsh users
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Windows:**
```powershell
# Check npm global bin directory
npm config get prefix

# Add to PATH via Environment Variables
# Windows: System Properties > Environment Variables > Path > Add npm prefix\bin
```

### Permission Errors (Linux/macOS)

If you get `EACCES` errors during installation:

```bash
# Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Reinstall
npm install -g cluster-code
```

{: .warning }
Avoid using `sudo npm install -g` as it can cause permission issues. Use the method above instead.

### Node.js Version Issues

If you have an older Node.js version:

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 20 LTS
nvm install 20
nvm use 20

# Reinstall cluster-code
npm install -g cluster-code
```

### kubectl Not Found

If kubectl is not installed:

**Linux:**
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

**macOS:**
```bash
brew install kubectl
```

**Windows:**
```powershell
choco install kubernetes-cli
```

### Installation Behind Corporate Proxy

Configure npm to use your proxy:

```bash
# Set proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Set registry (if using internal mirror)
npm config set registry https://registry.company.com/

# Install with proxy settings
npm install -g cluster-code
```

### Offline Installation

For air-gapped environments:

```bash
# On a machine with internet access:
# Download the package
npm pack cluster-code

# This creates: cluster-code-1.0.0.tgz

# Transfer the .tgz file to your offline machine

# On offline machine:
npm install -g cluster-code-1.0.0.tgz
```

---

## Platform-Specific Notes

### macOS

```bash
# Install via Homebrew (if available)
brew tap kcns008/cluster-code
brew install cluster-code

# Or use npm
npm install -g cluster-code
```

### Linux (Ubuntu/Debian)

```bash
# Install Node.js from NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install cluster-code
npm install -g cluster-code
```

### Linux (RHEL/CentOS/Fedora)

```bash
# Install Node.js from NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install cluster-code
npm install -g cluster-code
```

### Windows

```powershell
# Install via Chocolatey (recommended)
choco install nodejs
choco install kubernetes-cli

# Install cluster-code
npm install -g cluster-code

# Or use Windows Terminal with WSL2
wsl --install
# Then follow Linux instructions
```

### Docker Container

Run Cluster Code in a container:

```bash
# Create Dockerfile
cat > Dockerfile <<EOF
FROM node:20-alpine

# Install kubectl
RUN apk add --no-cache curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl

# Install cluster-code
RUN npm install -g cluster-code

# Set working directory
WORKDIR /workspace

# Entry point
ENTRYPOINT ["cluster-code"]
EOF

# Build image
docker build -t cluster-code:latest .

# Run with kubectl config mounted
docker run -it --rm \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.cluster-code:/root/.cluster-code \
  cluster-code:latest diagnose
```

---

## Verifying Your Setup

Run this verification script to check your installation:

```bash
#!/bin/bash
echo "🔍 Verifying Cluster Code Installation"
echo "======================================="
echo ""

# Check Node.js
echo -n "✓ Node.js: "
node --version

# Check npm
echo -n "✓ npm: "
npm --version

# Check cluster-code
echo -n "✓ Cluster Code: "
cluster-code --version

# Check kubectl
echo -n "✓ kubectl: "
kubectl version --client --short 2>/dev/null || echo "⚠️  Not installed"

# Check optional tools
echo -n "✓ Azure CLI: "
az version --query '\"azure-cli\"' -o tsv 2>/dev/null || echo "⚠️  Not installed (optional)"

echo -n "✓ AWS CLI: "
aws --version 2>/dev/null | cut -d' ' -f1 || echo "⚠️  Not installed (optional)"

echo -n "✓ Helm: "
helm version --short 2>/dev/null || echo "⚠️  Not installed (optional)"

echo ""
echo "✅ Verification complete!"
```

---

## Upgrading Cluster Code

### Check for Updates

```bash
# Check current version
cluster-code --version

# Check latest available version
npm view cluster-code version

# Or
npm outdated -g cluster-code
```

### Upgrade to Latest Version

```bash
# Upgrade via npm
npm update -g cluster-code

# Or reinstall
npm install -g cluster-code@latest

# Verify new version
cluster-code --version
```

### Downgrade to Specific Version

```bash
# Install specific version
npm install -g cluster-code@1.0.0

# Verify version
cluster-code --version
```

---

## Uninstalling Cluster Code

### Remove Global Installation

```bash
# Uninstall via npm
npm uninstall -g cluster-code

# Remove configuration (optional)
rm -rf ~/.cluster-code

# Verify removal
cluster-code --version  # Should show command not found
```

### Clean Uninstall

```bash
# Remove everything
npm uninstall -g cluster-code
rm -rf ~/.cluster-code
rm -rf ~/.npm/_cacache/cluster-code

# Verify
which cluster-code  # Should return nothing
```

---

## Next Steps

Now that Cluster Code is installed, continue with:

1. **[LLM Provider Setup](/guides/llm-providers)** - Configure your AI provider
2. **[Getting Started](/guides/getting-started)** - First steps with Cluster Code
3. **[Configuration Guide](/guides/configuration)** - Customize your setup

Or jump straight to:
- [Quick Start Tutorial](/tutorials/first-cluster)
- [Command Reference](/api/commands)

---

## Getting Help

If you encounter issues during installation:

- 📖 Check our [Troubleshooting Guide](/guides/troubleshooting)
- 💬 Ask on [GitHub Discussions](https://github.com/kcns008/cluster-code/discussions)
- 🐛 Report bugs on [GitHub Issues](https://github.com/kcns008/cluster-code/issues)
