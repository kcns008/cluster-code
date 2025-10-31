---
name: multi-cluster-context
description: Manage and switch between multiple Kubernetes cluster contexts
category: cluster-management
parameters:
  - name: action
    description: Action to perform (list, switch, current, rename, delete)
    required: true
  - name: context
    description: Context name (for switch, rename, delete actions)
    required: false
  - name: new-name
    description: New context name (for rename action)
    required: false
tags:
  - contexts
  - multi-cluster
  - kubectl
  - cluster-management
---

# Multi-Cluster Context Management

Manage multiple Kubernetes cluster contexts with an enhanced interface for switching between clusters.

## Overview

This command provides an improved experience for managing kubectl contexts across multiple clusters:

- **List contexts** - View all configured contexts with cluster details
- **Switch contexts** - Quickly change active cluster
- **Show current** - Display active context information
- **Rename contexts** - Give contexts meaningful names
- **Delete contexts** - Remove unused contexts

## Prerequisites

- `kubectl` installed and configured
- At least one Kubernetes cluster context configured

## Workflow

### Phase 1: Parse Action

```bash
ACTION="${ACTION}"
CONTEXT_NAME="${CONTEXT}"
NEW_NAME="${NEW_NAME}"

case "$ACTION" in
    list|ls)
        ACTION_TYPE="list"
        ;;
    switch|use)
        ACTION_TYPE="switch"
        if [[ -z "$CONTEXT_NAME" ]]; then
            echo "❌ ERROR: Context name required for switch action"
            exit 1
        fi
        ;;
    current|show)
        ACTION_TYPE="current"
        ;;
    rename|mv)
        ACTION_TYPE="rename"
        if [[ -z "$CONTEXT_NAME" || -z "$NEW_NAME" ]]; then
            echo "❌ ERROR: Both context and new-name required for rename action"
            exit 1
        fi
        ;;
    delete|rm)
        ACTION_TYPE="delete"
        if [[ -z "$CONTEXT_NAME" ]]; then
            echo "❌ ERROR: Context name required for delete action"
            exit 1
        fi
        ;;
    *)
        echo "❌ ERROR: Unknown action: $ACTION"
        echo ""
        echo "Valid actions: list, switch, current, rename, delete"
        exit 1
        ;;
esac
```

### Phase 2: Execute Action

#### 2.1 List Contexts

```bash
if [[ "$ACTION_TYPE" == "list" ]]; then
    echo "📋 KUBERNETES CONTEXTS"
    echo "======================"
    echo ""

    # Get current context
    CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")

    # Get all contexts
    CONTEXTS=$(kubectl config get-contexts -o name 2>/dev/null)

    if [[ -z "$CONTEXTS" ]]; then
        echo "No contexts found"
        echo ""
        echo "Add a cluster context:"
        echo "  • AWS EKS: aws eks update-kubeconfig --name <cluster> --region <region>"
        echo "  • Azure AKS: az aks get-credentials --name <cluster> --resource-group <rg>"
        echo "  • GCP GKE: gcloud container clusters get-credentials <cluster> --zone <zone>"
        exit 0
    fi

    echo "Available contexts:"
    echo ""

    # Format: NAME | CLUSTER | USER | NAMESPACE | CURRENT
    printf "%-40s %-30s %-20s %-15s %s\n" "CONTEXT" "CLUSTER" "USER" "NAMESPACE" "CURRENT"
    printf "%-40s %-30s %-20s %-15s %s\n" "-------" "-------" "----" "---------" "-------"

    while IFS= read -r CTX; do
        # Get context details
        CLUSTER=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CTX\")].context.cluster}" 2>/dev/null)
        USER=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CTX\")].context.user}" 2>/dev/null)
        NAMESPACE=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CTX\")].context.namespace}" 2>/dev/null)

        # Truncate long names
        CTX_DISPLAY=$(echo "$CTX" | cut -c1-39)
        CLUSTER_DISPLAY=$(echo "$CLUSTER" | cut -c1-29)
        USER_DISPLAY=$(echo "$USER" | cut -c1-19)
        NAMESPACE_DISPLAY=${NAMESPACE:-default}

        # Mark current context
        if [[ "$CTX" == "$CURRENT_CONTEXT" ]]; then
            CURRENT_MARK="*"
        else
            CURRENT_MARK=""
        fi

        printf "%-40s %-30s %-20s %-15s %s\n" \
            "$CTX_DISPLAY" \
            "$CLUSTER_DISPLAY" \
            "$USER_DISPLAY" \
            "$NAMESPACE_DISPLAY" \
            "$CURRENT_MARK"
    done <<< "$CONTEXTS"

    echo ""
    echo "Current context: $CURRENT_CONTEXT"
    echo ""
    echo "Switch context:"
    echo "  cluster-code multi-cluster-context --action switch --context <name>"
    echo ""

    # Show cluster versions if possible
    echo "Cluster versions:"
    echo ""

    for CTX in $CONTEXTS; do
        CTX_SHORT=$(echo "$CTX" | cut -c1-30)
        # Try to get version (this may fail if cluster is unreachable)
        VERSION=$(kubectl --context="$CTX" version --short 2>/dev/null | grep "Server Version" | awk '{print $3}' || echo "unreachable")

        if [[ "$VERSION" != "unreachable" ]]; then
            printf "  %-30s %s\n" "$CTX_SHORT:" "$VERSION"
        fi
    done

    echo ""
fi
```

#### 2.2 Switch Context

```bash
if [[ "$ACTION_TYPE" == "switch" ]]; then
    echo "🔄 Switching context..."
    echo ""

    # Check if context exists
    if ! kubectl config get-contexts "$CONTEXT_NAME" &>/dev/null; then
        echo "❌ ERROR: Context not found: $CONTEXT_NAME"
        echo ""
        echo "Available contexts:"
        kubectl config get-contexts -o name
        exit 1
    fi

    # Get previous context
    PREVIOUS_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")

    # Switch context
    if kubectl config use-context "$CONTEXT_NAME" &>/dev/null; then
        echo "✅ Switched context"
        echo ""
        echo "Previous: $PREVIOUS_CONTEXT"
        echo "Current:  $CONTEXT_NAME"

        # Get cluster info
        CLUSTER=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CONTEXT_NAME\")].context.cluster}")
        NAMESPACE=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CONTEXT_NAME\")].context.namespace}" || echo "default")

        echo "Cluster:  $CLUSTER"
        echo "Namespace: $NAMESPACE"
        echo ""

        # Test connection
        echo "Testing connection..."
        if kubectl cluster-info --request-timeout=5s &>/dev/null; then
            echo "✅ Cluster reachable"

            # Show cluster version
            SERVER_VERSION=$(kubectl version --short 2>/dev/null | grep "Server Version" | awk '{print $3}')
            if [[ -n "$SERVER_VERSION" ]]; then
                echo "   Version: $SERVER_VERSION"
            fi

            # Show node count
            NODE_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | wc -l)
            if [[ $NODE_COUNT -gt 0 ]]; then
                echo "   Nodes: $NODE_COUNT"
            fi
        else
            echo "⚠️  WARNING: Cluster not reachable"
        fi

        echo ""
        echo "You are now connected to: $CONTEXT_NAME"
    else
        echo "❌ Failed to switch context"
        exit 1
    fi
fi
```

#### 2.3 Show Current Context

```bash
if [[ "$ACTION_TYPE" == "current" ]]; then
    echo "📍 CURRENT CONTEXT"
    echo "=================="
    echo ""

    CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null)

    if [[ -z "$CURRENT_CONTEXT" ]]; then
        echo "No current context set"
        exit 0
    fi

    echo "Context: $CURRENT_CONTEXT"
    echo ""

    # Get detailed information
    CLUSTER=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CURRENT_CONTEXT\")].context.cluster}")
    USER=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CURRENT_CONTEXT\")].context.user}")
    NAMESPACE=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CURRENT_CONTEXT\")].context.namespace}" || echo "default")

    echo "Details:"
    echo "  Cluster: $CLUSTER"
    echo "  User: $USER"
    echo "  Namespace: $NAMESPACE"
    echo ""

    # Get cluster endpoint
    ENDPOINT=$(kubectl config view -o jsonpath="{.clusters[?(@.name==\"$CLUSTER\")].cluster.server}")
    echo "  Endpoint: $ENDPOINT"
    echo ""

    # Test connection and get cluster info
    echo "Cluster Information:"
    if kubectl cluster-info --request-timeout=5s &>/dev/null; then
        # Version
        SERVER_VERSION=$(kubectl version --short 2>/dev/null | grep "Server Version" | awk '{print $3}')
        echo "  Kubernetes Version: $SERVER_VERSION"

        # Nodes
        NODE_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | wc -l)
        echo "  Nodes: $NODE_COUNT"

        # Namespaces
        NS_COUNT=$(kubectl get namespaces --no-headers 2>/dev/null | wc -l)
        echo "  Namespaces: $NS_COUNT"

        # Pods
        POD_COUNT=$(kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l)
        echo "  Total Pods: $POD_COUNT"

        echo ""
        echo "Recent cluster activity:"
        kubectl get events --all-namespaces --sort-by='.lastTimestamp' --field-selector type=Warning | tail -5
    else
        echo "  ⚠️  Cluster not reachable"
    fi

    echo ""
fi
```

#### 2.4 Rename Context

```bash
if [[ "$ACTION_TYPE" == "rename" ]]; then
    echo "✏️  Renaming context..."
    echo ""

    # Check if old context exists
    if ! kubectl config get-contexts "$CONTEXT_NAME" &>/dev/null; then
        echo "❌ ERROR: Context not found: $CONTEXT_NAME"
        exit 1
    fi

    # Check if new name already exists
    if kubectl config get-contexts "$NEW_NAME" &>/dev/null; then
        echo "❌ ERROR: Context already exists: $NEW_NAME"
        exit 1
    fi

    # Rename context
    if kubectl config rename-context "$CONTEXT_NAME" "$NEW_NAME" &>/dev/null; then
        echo "✅ Context renamed"
        echo "   Old name: $CONTEXT_NAME"
        echo "   New name: $NEW_NAME"
        echo ""

        # Check if this was the current context
        CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null)
        if [[ "$CURRENT_CONTEXT" == "$NEW_NAME" ]]; then
            echo "This is your current context"
        fi
    else
        echo "❌ Failed to rename context"
        exit 1
    fi

    echo ""
fi
```

#### 2.5 Delete Context

```bash
if [[ "$ACTION_TYPE" == "delete" ]]; then
    echo "🗑️  Deleting context..."
    echo ""

    # Check if context exists
    if ! kubectl config get-contexts "$CONTEXT_NAME" &>/dev/null; then
        echo "❌ ERROR: Context not found: $CONTEXT_NAME"
        exit 1
    fi

    # Check if this is the current context
    CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null)
    if [[ "$CURRENT_CONTEXT" == "$CONTEXT_NAME" ]]; then
        echo "⚠️  WARNING: This is your current context"
        echo ""
        echo "Are you sure you want to delete it? (yes/no)"
        read -r CONFIRM
        if [[ "$CONFIRM" != "yes" ]]; then
            echo "Deletion cancelled"
            exit 0
        fi
    fi

    # Get context details before deletion
    CLUSTER=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CONTEXT_NAME\")].context.cluster}")
    USER=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CONTEXT_NAME\")].context.user}")

    echo "Context details:"
    echo "  Name: $CONTEXT_NAME"
    echo "  Cluster: $CLUSTER"
    echo "  User: $USER"
    echo ""
    echo "This will delete the context entry only."
    echo "The cluster, user, and credentials will remain."
    echo ""
    echo "Proceed with deletion? (yes/no)"
    read -r FINAL_CONFIRM

    if [[ "$FINAL_CONFIRM" != "yes" ]]; then
        echo "Deletion cancelled"
        exit 0
    fi

    # Delete context
    if kubectl config delete-context "$CONTEXT_NAME" &>/dev/null; then
        echo "✅ Context deleted: $CONTEXT_NAME"

        # If this was current context, show available contexts
        if [[ "$CURRENT_CONTEXT" == "$CONTEXT_NAME" ]]; then
            echo ""
            echo "No current context set. Available contexts:"
            kubectl config get-contexts -o name
        fi
    else
        echo "❌ Failed to delete context"
        exit 1
    fi

    echo ""
fi
```

## Quick Reference

### List all contexts

```bash
cluster-code multi-cluster-context --action list
```

### Switch to a context

```bash
cluster-code multi-cluster-context --action switch --context my-cluster
```

### Show current context

```bash
cluster-code multi-cluster-context --action current
```

### Rename a context

```bash
cluster-code multi-cluster-context --action rename \
  --context old-name \
  --new-name new-name
```

### Delete a context

```bash
cluster-code multi-cluster-context --action delete --context old-cluster
```

## Examples

### Example 1: List contexts with details

```bash
cluster-code multi-cluster-context --action list
```

Output:
```
📋 KUBERNETES CONTEXTS
======================

CONTEXT                           CLUSTER                       USER                 NAMESPACE       CURRENT
-------                           -------                       ----                 ---------       -------
gke_proj_us-central1_prod        gke_proj_us-central1_prod     gke_user             default         *
eks-staging                      eks-staging.us-west-2         eks-user             staging
aks-dev                          aks-dev                       aks-user             dev

Current context: gke_proj_us-central1_prod
```

### Example 2: Switch between environments

```bash
# Switch to staging
cluster-code multi-cluster-context --action switch --context eks-staging

# Verify
cluster-code multi-cluster-context --action current
```

### Example 3: Organize contexts with meaningful names

```bash
# Rename cloud provider contexts
cluster-code multi-cluster-context --action rename \
  --context gke_myproject_us-central1-a_prod-cluster \
  --new-name prod-gke

cluster-code multi-cluster-context --action rename \
  --context arn:aws:eks:us-west-2:123456:cluster/staging \
  --new-name staging-eks
```

## Multi-Cluster Workflows

### Cross-Cluster Resource Management

```bash
# List pods across all clusters
for ctx in $(kubectl config get-contexts -o name); do
  echo "=== $ctx ==="
  kubectl --context=$ctx get pods --all-namespaces
done
```

### Backup Multiple Clusters

```bash
# Backup all production clusters
for ctx in $(kubectl config get-contexts -o name | grep prod); do
  cluster-code multi-cluster-context --action switch --context $ctx
  cluster-code backup-cluster --backup-name "${ctx}-backup-$(date +%Y%m%d)"
done
```

### Health Check All Clusters

```bash
# Check all cluster health
for ctx in $(kubectl config get-contexts -o name); do
  echo "Checking $ctx..."
  cluster-code multi-cluster-context --action switch --context $ctx
  cluster-code cluster-diagnose
done
```

## Tips and Best Practices

1. **Use descriptive names** - Rename contexts to be environment/region specific
   - Good: `prod-gke-us`, `staging-eks-eu`
   - Bad: `gke_project123_zone-a_cluster-xyz`

2. **Organize by purpose**
   - Prefix with environment: `prod-`, `staging-`, `dev-`
   - Include cloud provider: `-eks`, `-aks`, `-gke`
   - Add region: `-us-east`, `-eu-west`

3. **Set default namespaces** per context:
   ```bash
   kubectl config set-context prod-gke --namespace=production
   ```

4. **Use kubectx** for faster switching (optional companion tool):
   ```bash
   # Install kubectx
   brew install kubectx

   # Quick switch
   kubectx prod-gke
   ```

5. **Visual indicators** - Use shell prompt to show current context:
   ```bash
   # Add to .bashrc or .zshrc
   PROMPT='$(kubectl config current-context):$PROMPT'
   ```

## Context Configuration File

Contexts are stored in `~/.kube/config`:

```yaml
apiVersion: v1
kind: Config
contexts:
- context:
    cluster: my-cluster
    user: my-user
    namespace: default
  name: my-context
clusters:
- cluster:
    server: https://api.cluster.example.com
  name: my-cluster
users:
- name: my-user
  user:
    token: xxx
```

## Troubleshooting

### Issue: Context not found

**Solution**: List available contexts:
```bash
kubectl config get-contexts
```

### Issue: Unable to connect to cluster

**Solution**: Check cluster credentials and endpoint:
```bash
kubectl cluster-info
kubectl config view --minify
```

### Issue: Wrong namespace

**Solution**: Set default namespace for context:
```bash
kubectl config set-context --current --namespace=my-namespace
```

## Related Commands

- `kubectl config`: Direct kubectl configuration management
- `cluster-diagnose`: Verify cluster health
- `backup-cluster`: Backup current cluster
- Cloud-specific commands:
  - `aws-cluster-create`
  - `azure-cluster-create`
  - `gcp-cluster-create`
