---
layout: api
title: Commands Reference
nav_order: 1
parent: API Reference
description: "Complete reference for all Cluster Code commands"
permalink: /api/commands
---

# Commands Reference
{: .no_toc }

Complete reference documentation for all Cluster Code commands organized by category.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Core Commands

Core commands available in the base Cluster Code installation.

### cluster-init

Initialize cluster connection and configuration.

**Usage:**
```bash
cluster-code init [options]
```

**Options:**
- `--context <name>` - Kubernetes context name
- `--namespace <name>` - Default namespace (default: default)
- `--auto-detect` - Auto-detect cluster type
- `--config <path>` - Configuration file path

**Examples:**
```bash
# Initialize with specific context
cluster-code init --context my-cluster --namespace production

# Auto-detect OpenShift
cluster-code init --auto-detect
```

**What it does:**
1. Validates cluster connectivity
2. Checks Kubernetes/OpenShift version
3. Verifies RBAC permissions
4. Creates/updates configuration file
5. Enables appropriate plugins

---

### cluster-status

Show comprehensive cluster health and status.

**Usage:**
```bash
cluster-code status [options]
```

**Options:**
- `--detailed` - Show detailed information
- `--namespace <name>` - Filter by namespace
- `--json` - Output as JSON

**Examples:**
```bash
# Quick status
cluster-code status

# Detailed status with all metrics
cluster-code status --detailed

# Status for specific namespace
cluster-code status --namespace production
```

**Output includes:**
- API server health
- Node status and count
- Pod health summary
- Resource utilization
- Recent events
- Cluster version info

---

### cluster-diagnose

Run comprehensive AI-powered cluster diagnostics.

**Usage:**
```bash
cluster-code diagnose [options]
```

**Options:**
- `--namespace <name>` - Target namespace
- `--all-namespaces` - Scan all namespaces
- `--analyzer <type>` - Specific analyzer (pod, service, pvc, node, deployment, event)
- `--parallel` - Run analyzers in parallel
- `--severity <level>` - Minimum severity (info, warning, error, critical)

**Examples:**
```bash
# Diagnose entire cluster
cluster-code diagnose

# Diagnose production namespace only
cluster-code diagnose --namespace production

# Run specific analyzer
cluster-code diagnose --analyzer pod --all-namespaces

# Parallel execution for faster results
cluster-code diagnose --parallel
```

**Analyzers:**
- **pod** - Pod issues (CrashLoopBackOff, ImagePullBackOff, OOMKilled)
- **service** - Service and endpoint problems
- **pvc** - Storage and PVC issues
- **node** - Node health and resource pressure
- **deployment** - Deployment configuration issues
- **event** - Recent cluster events

---

### pod-logs

View and analyze pod logs with AI pattern recognition.

**Usage:**
```bash
cluster-code pod-logs <pod-name> [options]
```

**Options:**
- `--namespace <name>` - Pod namespace
- `--container <name>` - Specific container
- `--follow` - Stream logs
- `--tail <lines>` - Number of lines (default: 100)
- `--analyze` - Enable AI log analysis
- `--previous` - Show previous container logs

**Examples:**
```bash
# View recent logs
cluster-code pod-logs my-app-pod-xyz --namespace production

# Follow logs with analysis
cluster-code pod-logs my-app-pod-xyz --follow --analyze

# Previous container logs (after crash)
cluster-code pod-logs my-app-pod-xyz --previous
```

**AI Analysis detects:**
- Error patterns
- Stack traces
- Performance issues
- Configuration problems
- Common failure signatures

---

### resource-describe

Describe any Kubernetes resource with AI-powered analysis.

**Usage:**
```bash
cluster-code resource-describe <type> <name> [options]
```

**Options:**
- `--namespace <name>` - Resource namespace
- `--events` - Include related events
- `--analyze` - Enable AI analysis

**Examples:**
```bash
# Describe pod
cluster-code resource-describe pod my-app-pod --namespace production --analyze

# Describe service with events
cluster-code resource-describe service api-service --events

# Describe deployment
cluster-code resource-describe deployment web-app --analyze
```

**Supported resource types:**
pod, deployment, service, ingress, pvc, configmap, secret, node, namespace, and more

---

## Azure Commands (cloud-azure plugin)

Commands for managing Azure AKS and ARO clusters.

### azure-cluster-create

Create a new AKS or ARO cluster on Azure.

**Usage:**
```bash
cluster-code azure-cluster-create [options]
```

**Options:**
- `--type <aks|aro>` - Cluster type (required)
- `--name <name>` - Cluster name (required)
- `--resource-group <name>` - Resource group (required)
- `--region <region>` - Azure region (default: eastus)
- `--version <version>` - Kubernetes/OpenShift version
- `--nodes <count>` - Number of worker nodes (default: 3)
- `--vm-size <type>` - VM size for nodes
- `--output <format>` - Output format (json, yaml, terraform)

**Examples:**
```bash
# Create AKS cluster
cluster-code azure-cluster-create \
  --type aks \
  --name prod-aks \
  --resource-group production-rg \
  --region eastus \
  --nodes 5

# Create ARO cluster
cluster-code azure-cluster-create \
  --type aro \
  --name prod-aro \
  --resource-group production-rg \
  --region eastus2

# Generate Terraform code
cluster-code azure-cluster-create \
  --type aks \
  --name my-aks \
  --resource-group my-rg \
  --output terraform
```

[Full Documentation](/plugins/cloud-azure#azure-cluster-create)

---

### azure-cluster-list

List all AKS and ARO clusters in subscription.

**Usage:**
```bash
cluster-code azure-cluster-list [options]
```

**Options:**
- `--resource-group <name>` - Filter by resource group
- `--type <aks|aro|all>` - Filter by cluster type (default: all)
- `--format <format>` - Output format (table, json, yaml)

**Examples:**
```bash
# List all clusters
cluster-code azure-cluster-list

# List only AKS clusters
cluster-code azure-cluster-list --type aks

# List in specific resource group
cluster-code azure-cluster-list --resource-group production-rg
```

---

### azure-cluster-connect

Connect to an AKS or ARO cluster.

**Usage:**
```bash
cluster-code azure-cluster-connect [options]
```

**Options:**
- `--name <name>` - Cluster name (required)
- `--resource-group <name>` - Resource group (required)
- `--type <aks|aro>` - Cluster type (auto-detected)
- `--admin` - Get admin credentials (AKS only)

**Examples:**
```bash
# Connect to AKS
cluster-code azure-cluster-connect \
  --name my-aks \
  --resource-group my-rg

# Connect to ARO
cluster-code azure-cluster-connect \
  --name my-aro \
  --resource-group my-rg \
  --type aro
```

---

## AWS Commands (cloud-aws plugin)

Commands for managing AWS EKS and ROSA clusters.

### aws-cluster-create

Create a new EKS or ROSA cluster on AWS.

**Usage:**
```bash
cluster-code aws-cluster-create [options]
```

**Options:**
- `--type <eks|rosa>` - Cluster type (required)
- `--name <name>` - Cluster name (required)
- `--region <region>` - AWS region (default: us-east-1)
- `--version <version>` - Kubernetes/OpenShift version
- `--nodes <count>` - Number of worker nodes (default: 2)
- `--instance-type <type>` - EC2 instance type
- `--multi-az` - Deploy across multiple AZs
- `--private` - Create private cluster

**Examples:**
```bash
# Create EKS cluster
cluster-code aws-cluster-create \
  --type eks \
  --name prod-eks \
  --region us-east-1 \
  --nodes 3

# Create ROSA cluster with hosted control plane
cluster-code aws-cluster-create \
  --type rosa \
  --name prod-rosa \
  --region us-west-2 \
  --multi-az
```

[Full Documentation](/plugins/cloud-aws#aws-cluster-create)

---

### aws-cluster-list

List all EKS and ROSA clusters.

**Usage:**
```bash
cluster-code aws-cluster-list [options]
```

**Options:**
- `--region <region>` - Filter by region
- `--type <eks|rosa|all>` - Filter by type (default: all)
- `--format <format>` - Output format (table, json, yaml)

---

### aws-cluster-connect

Connect to an EKS or ROSA cluster.

**Usage:**
```bash
cluster-code aws-cluster-connect [options]
```

**Options:**
- `--name <name>` - Cluster name (required)
- `--region <region>` - AWS region (required)
- `--type <eks|rosa>` - Cluster type
- `--role-arn <arn>` - IAM role ARN to assume (EKS)

---

## OpenShift Commands (cluster-openshift plugin)

Commands for OpenShift-specific features.

### routes-analyze

Analyze OpenShift Routes for connectivity and TLS issues.

**Usage:**
```bash
cluster-code routes-analyze [options]
```

**Options:**
- `--namespace <name>` - Target namespace
- `--route <name>` - Specific route
- `--all-namespaces` - Analyze all routes

**Examples:**
```bash
# Analyze routes in production
cluster-code routes-analyze --namespace production

# Analyze specific route
cluster-code routes-analyze --route my-app --namespace production

# Analyze all routes
cluster-code routes-analyze --all-namespaces
```

**Analysis includes:**
- Backend service validation
- TLS/SSL configuration
- Certificate expiration
- Routing rule conflicts
- External connectivity testing

[Full Documentation](/plugins/cluster-openshift#routes-analyze)

---

### operator-install

Install OpenShift Operators from OperatorHub.

**Usage:**
```bash
cluster-code operator-install [options]
```

**Options:**
- `--operator <name>` - Operator name (required)
- `--namespace <name>` - Target namespace (default: openshift-operators)
- `--channel <name>` - Update channel (stable, fast, candidate)
- `--approval <mode>` - Install plan approval (Automatic, Manual)
- `--source <catalog>` - Catalog source (default: redhat-operators)

**Examples:**
```bash
# Install GitOps operator
cluster-code operator-install \
  --operator openshift-gitops-operator

# Install with manual approval
cluster-code operator-install \
  --operator elasticsearch-operator \
  --approval Manual

# Install in specific namespace
cluster-code operator-install \
  --operator my-operator \
  --namespace my-namespace
```

[Full Documentation](/plugins/cluster-openshift#operator-install)

---

## GitOps Commands (gitops plugin)

Commands for GitOps workflows and deployments.

### helm-deploy

Deploy applications using Helm charts.

**Usage:**
```bash
cluster-code helm-deploy [options]
```

**Options:**
- `--chart <name|path>` - Chart name or path (required)
- `--release <name>` - Release name (required)
- `--namespace <name>` - Target namespace (default: default)
- `--values <path>` - Values file path
- `--set <key=value>` - Override values
- `--create-namespace` - Create namespace if not exists
- `--dry-run` - Preview without applying
- `--wait` - Wait for resources to be ready
- `--timeout <duration>` - Timeout for wait (default: 5m)

**Examples:**
```bash
# Deploy nginx
cluster-code helm-deploy \
  --chart bitnami/nginx \
  --release my-nginx \
  --namespace web

# Deploy with values file
cluster-code helm-deploy \
  --chart ./my-chart \
  --release my-app \
  --values production-values.yaml

# Dry-run to preview
cluster-code helm-deploy \
  --chart nginx \
  --release test \
  --dry-run
```

[Full Documentation](/plugins/gitops#helm-deploy)

---

### kustomize-apply

Apply Kustomize overlays.

**Usage:**
```bash
cluster-code kustomize-apply [options]
```

**Options:**
- `--path <directory>` - Kustomization directory (required)
- `--namespace <name>` - Override namespace
- `--dry-run` - Preview without applying
- `--prune` - Delete orphaned resources
- `--wait` - Wait for resources to be ready

**Examples:**
```bash
# Apply production overlay
cluster-code kustomize-apply --path ./overlays/production

# Dry-run to preview changes
cluster-code kustomize-apply --path ./base --dry-run

# Apply with pruning
cluster-code kustomize-apply --path ./overlays/dev --prune
```

[Full Documentation](/plugins/gitops#kustomize-apply)

---

### argocd-sync

Synchronize ArgoCD applications.

**Usage:**
```bash
cluster-code argocd-sync [options]
```

**Options:**
- `--app <name>` - Application name (required)
- `--namespace <name>` - ArgoCD namespace (default: argocd)
- `--prune` - Delete resources not in Git
- `--force` - Force sync
- `--dry-run` - Preview sync
- `--timeout <duration>` - Sync timeout (default: 5m)

**Examples:**
```bash
# Sync application
cluster-code argocd-sync --app my-app

# Sync with pruning
cluster-code argocd-sync --app prod-app --prune --force

# Preview sync
cluster-code argocd-sync --app staging-app --dry-run
```

[Full Documentation](/plugins/gitops#argocd-sync)

---

## Node Management Commands

### node-status

Show node health and resource utilization.

**Usage:**
```bash
cluster-code node-status [options]
```

**Options:**
- `--detailed` - Show detailed information
- `--format <format>` - Output format (table, json, yaml)

**Examples:**
```bash
# List nodes
cluster-code node-status

# Detailed node information
cluster-code node-status --detailed
```

**Output includes:**
- Node conditions (Ready, MemoryPressure, DiskPressure)
- Resource capacity and allocatable
- Pod distribution
- Resource usage

---

## Service Management Commands

### service-describe

Describe service with connectivity analysis.

**Usage:**
```bash
cluster-code service-describe <service-name> [options]
```

**Options:**
- `--namespace <name>` - Service namespace
- `--test` - Test connectivity
- `--all-namespaces` - List all services

**Examples:**
```bash
# Describe service
cluster-code service-describe api-service --namespace production

# Test connectivity
cluster-code service-describe web-service --test
```

---

## Storage Commands

### pvc-status

Show PVC status and storage utilization.

**Usage:**
```bash
cluster-code pvc-status [options]
```

**Options:**
- `--namespace <name>` - Filter by namespace
- `--detailed` - Show detailed information
- `--all-namespaces` - Show all PVCs

**Examples:**
```bash
# List PVCs
cluster-code pvc-status --namespace production

# Detailed view
cluster-code pvc-status --detailed --all-namespaces
```

---

## Configuration Commands

### config-view

View cluster configuration.

**Usage:**
```bash
cluster-code config-view [options]
```

**Options:**
- `--format <format>` - Output format (yaml, json)

---

## Utility Commands

### resource-top

Show resource utilization.

**Usage:**
```bash
cluster-code resource-top [options]
```

**Options:**
- `--type <pod|node>` - Resource type
- `--namespace <name>` - Filter by namespace
- `--sort <field>` - Sort by field (cpu, memory)

**Examples:**
```bash
# Top pods by CPU
cluster-code resource-top --type pod --sort cpu

# Top nodes by memory
cluster-code resource-top --type node --sort memory
```

---

### namespace-switch

Switch default namespace.

**Usage:**
```bash
cluster-code namespace-switch <namespace>
```

**Example:**
```bash
cluster-code namespace-switch production
```

---

## Global Options

Available for all commands:

- `--help` - Show command help
- `--version` - Show version
- `--log-level <level>` - Set log level (debug, info, warn, error)
- `--config <path>` - Use specific config file
- `--context <name>` - Use specific cluster context
- `--no-color` - Disable colored output
- `--json` - Output as JSON
- `--yaml` - Output as YAML

---

## Exit Codes

Cluster Code uses standard exit codes:

- `0` - Success
- `1` - General error
- `2` - Misuse of command (invalid arguments)
- `126` - Command cannot execute
- `127` - Command not found
- `130` - Terminated by Ctrl+C

---

## Command Aliases

Some commands have shorter aliases:

| Full Command | Alias |
|--------------|-------|
| cluster-code diagnose | cluster-code diag |
| cluster-code resource-describe | cluster-code describe |
| cluster-code pod-logs | cluster-code logs |
| cluster-code status | cluster-code st |

---

## See Also

- [Configuration Reference](/api/configuration)
- [Plugin Documentation](/plugins/)
- [Troubleshooting Guide](/guides/troubleshooting)
- [Best Practices](/guides/best-practices)
