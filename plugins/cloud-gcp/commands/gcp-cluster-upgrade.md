---
name: gcp-cluster-upgrade
description: Upgrade a GKE cluster to a new Kubernetes version
category: cloud-provisioning
parameters:
  - name: cluster-name
    description: Name of the cluster to upgrade
    required: true
  - name: project
    description: GCP project ID
    required: true
  - name: region
    description: GCP region where cluster is located
    required: false
  - name: zone
    description: GCP zone where cluster is located
    required: false
  - name: version
    description: Target Kubernetes version (e.g., 1.29.1-gke.1000)
    required: false
  - name: upgrade-nodes
    description: Automatically upgrade node pools after control plane
    type: boolean
    default: true
  - name: skip-backup
    description: Skip pre-upgrade backup
    type: boolean
    default: false
  - name: dry-run
    description: Show what would be upgraded without making changes
    type: boolean
    default: false
tags:
  - gcp
  - gke
  - cluster-lifecycle
  - upgrade
  - maintenance
---

# GCP Cluster Upgrade

Safely upgrade a GKE cluster (Standard or Autopilot) to a new Kubernetes version with automated validation and monitoring.

## Overview

This command provides a comprehensive GKE cluster upgrade workflow with:

- **Automatic Version Selection**: Uses release channel default if no version specified
- **Pre-upgrade Validation**: Checks upgrade path and cluster health
- **Backup**: Optional pre-upgrade backup
- **Staged Upgrade**: Control plane first, then node pools
- **Health Monitoring**: Continuous health checks throughout upgrade
- **Rollback Guidance**: Instructions for rollback if issues occur

## Prerequisites

- Google Cloud SDK installed (`gcloud --version` >= 450.0.0)
- `kubectl` configured with cluster admin access
- Authenticated to GCP (`gcloud auth list`)
- IAM permissions:
  - `container.clusters.update`
  - `container.clusters.get`
  - `container.operations.get`

## GKE Upgrade Features

### Release Channels

GKE offers three release channels that automatically manage upgrades:

- **Rapid**: Latest features, weekly updates
- **Regular**: Balanced updates, 2-3 months behind Rapid
- **Stable**: Production-ready, 2-3 months behind Regular

Clusters in release channels auto-upgrade during maintenance windows.

### Manual Version Selection

Clusters not enrolled in a release channel can specify exact versions but require manual upgrade management.

## Workflow

### Phase 1: Pre-upgrade Validation

#### 1.1 Verify Cluster and Current Version

```bash
CLUSTER_NAME="${CLUSTER_NAME}"
GCP_PROJECT="${GCP_PROJECT}"
GCP_REGION="${GCP_REGION}"
GCP_ZONE="${GCP_ZONE}"
TARGET_VERSION="${TARGET_VERSION}"

# Determine location type
if [[ -n "$GCP_REGION" ]]; then
    LOCATION="$GCP_REGION"
    LOCATION_TYPE="region"
elif [[ -n "$GCP_ZONE" ]]; then
    LOCATION="$GCP_ZONE"
    LOCATION_TYPE="zone"
else
    echo "❌ ERROR: Either --region or --zone must be specified"
    exit 1
fi

echo "🔍 Validating cluster upgrade: $CLUSTER_NAME"
echo ""

# Set project
gcloud config set project "$GCP_PROJECT"

# Check if cluster exists
if ! gcloud container clusters describe "$CLUSTER_NAME" --$LOCATION_TYPE="$LOCATION" &>/dev/null; then
    echo "❌ ERROR: Cluster '$CLUSTER_NAME' not found in $LOCATION"
    exit 1
fi

# Get cluster details
CLUSTER_INFO=$(gcloud container clusters describe "$CLUSTER_NAME" --$LOCATION_TYPE="$LOCATION" --format=json)
CURRENT_VERSION=$(echo "$CLUSTER_INFO" | jq -r '.currentMasterVersion')
CLUSTER_STATUS=$(echo "$CLUSTER_INFO" | jq -r '.status')
CLUSTER_MODE=$(echo "$CLUSTER_INFO" | jq -r '.autopilot.enabled // false')
RELEASE_CHANNEL=$(echo "$CLUSTER_INFO" | jq -r '.releaseChannel.channel // "UNSPECIFIED"')
NODE_COUNT=$(echo "$CLUSTER_INFO" | jq -r '.currentNodeCount // 0')

if [[ "$CLUSTER_MODE" == "true" ]]; then
    MODE="Autopilot"
else
    MODE="Standard"
fi

echo "Cluster: $CLUSTER_NAME"
echo "Mode: $MODE"
echo "Current version: $CURRENT_VERSION"
echo "Status: $CLUSTER_STATUS"
echo "Release channel: $RELEASE_CHANNEL"
echo "Nodes: $NODE_COUNT"

# Verify cluster is in RUNNING state
if [[ "$CLUSTER_STATUS" != "RUNNING" ]]; then
    echo "❌ ERROR: Cluster must be in RUNNING state for upgrade"
    echo "   Current state: $CLUSTER_STATUS"
    exit 1
fi

echo "✅ Cluster is ready for upgrade"
```

#### 1.2 Determine Target Version

```bash
echo ""
echo "📋 Determining target version..."

# Get available versions and upgrade information
SERVER_CONFIG=$(gcloud container get-server-config --$LOCATION_TYPE="$LOCATION" --format=json)

if [[ -z "$TARGET_VERSION" ]]; then
    # Auto-select target version based on release channel or current version
    if [[ "$RELEASE_CHANNEL" == "UNSPECIFIED" || "$RELEASE_CHANNEL" == "null" ]]; then
        # No release channel - get next available version
        VALID_VERSIONS=$(echo "$SERVER_CONFIG" | jq -r '.validMasterVersions[]')

        # Find next minor version
        CURRENT_MINOR=$(echo "$CURRENT_VERSION" | grep -oP '^\d+\.\d+' || echo "$CURRENT_VERSION" | cut -d. -f1-2)
        TARGET_VERSION=$(echo "$VALID_VERSIONS" | grep "^$CURRENT_MINOR" | head -1)

        if [[ -z "$TARGET_VERSION" ]]; then
            # Try next minor version
            NEXT_MINOR=$(echo "$CURRENT_MINOR" | awk -F. '{print $1"."$2+1}')
            TARGET_VERSION=$(echo "$VALID_VERSIONS" | grep "^$NEXT_MINOR" | head -1)
        fi

        if [[ -z "$TARGET_VERSION" ]]; then
            echo "❌ ERROR: Could not determine target version"
            echo "   Available versions:"
            echo "$VALID_VERSIONS" | sed 's/^/   - /'
            exit 1
        fi

        echo "Auto-selected version: $TARGET_VERSION (latest compatible)"
    else
        # Use release channel default
        TARGET_VERSION=$(echo "$SERVER_CONFIG" | jq -r ".channels.${RELEASE_CHANNEL}.defaultVersion")

        if [[ "$TARGET_VERSION" == "null" || -z "$TARGET_VERSION" ]]; then
            echo "❌ ERROR: Could not determine default version for $RELEASE_CHANNEL channel"
            exit 1
        fi

        echo "Release channel ($RELEASE_CHANNEL) version: $TARGET_VERSION"
    fi
else
    echo "Using specified version: $TARGET_VERSION"

    # Verify version is available
    VALID_VERSIONS=$(echo "$SERVER_CONFIG" | jq -r '.validMasterVersions[]')
    if ! echo "$VALID_VERSIONS" | grep -q "^$TARGET_VERSION$"; then
        echo "❌ ERROR: Version $TARGET_VERSION is not available in $LOCATION"
        echo ""
        echo "Available versions:"
        echo "$VALID_VERSIONS" | sed 's/^/  - /'
        exit 1
    fi
fi

echo "Target version: $TARGET_VERSION"
```

#### 1.3 Validate Upgrade Path

```bash
echo ""
echo "✅ Validating upgrade path..."

# Parse version components
CURRENT_MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
CURRENT_MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
CURRENT_PATCH=$(echo "$CURRENT_VERSION" | cut -d. -f3 | cut -d- -f1)

TARGET_MAJOR=$(echo "$TARGET_VERSION" | cut -d. -f1)
TARGET_MINOR=$(echo "$TARGET_VERSION" | cut -d. -f2)
TARGET_PATCH=$(echo "$TARGET_VERSION" | cut -d. -f3 | cut -d- -f1)

# Check for downgrades
if [[ "$TARGET_MAJOR" -lt "$CURRENT_MAJOR" ]] || \
   [[ "$TARGET_MAJOR" -eq "$CURRENT_MAJOR" && "$TARGET_MINOR" -lt "$CURRENT_MINOR" ]]; then
    echo "❌ ERROR: Downgrading is not supported"
    echo "   Current: $CURRENT_VERSION"
    echo "   Target: $TARGET_VERSION"
    exit 1
fi

# Check for same version
if [[ "$CURRENT_VERSION" == "$TARGET_VERSION" ]]; then
    echo "ℹ️  Cluster is already at version $TARGET_VERSION"
    echo "   No upgrade needed"
    exit 0
fi

# Check minor version skip
MINOR_DIFF=$((TARGET_MINOR - CURRENT_MINOR))
if [[ $MINOR_DIFF -gt 1 ]]; then
    echo "⚠️  WARNING: Skipping minor versions (from $CURRENT_MINOR to $TARGET_MINOR)"
    echo "   GKE allows this, but it's recommended to upgrade one minor version at a time"
fi

echo "✅ Valid upgrade path: $CURRENT_VERSION → $TARGET_VERSION"
```

#### 1.4 Pre-upgrade Health Check

```bash
echo ""
echo "🏥 Running pre-upgrade health check..."

# Get kubectl credentials
gcloud container clusters get-credentials "$CLUSTER_NAME" \
    --$LOCATION_TYPE="$LOCATION" \
    --project="$GCP_PROJECT"

# Check node health
echo "   Checking node health..."
UNHEALTHY_NODES=$(kubectl get nodes --no-headers | grep -v " Ready" | wc -l)
TOTAL_NODES=$(kubectl get nodes --no-headers | wc -l)

if [[ $UNHEALTHY_NODES -gt 0 ]]; then
    echo "⚠️  WARNING: $UNHEALTHY_NODES of $TOTAL_NODES nodes are not Ready"
    kubectl get nodes | grep -v " Ready"
else
    echo "✅ All $TOTAL_NODES nodes are Ready"
fi

# Check pod health
echo "   Checking pod health..."
FAILING_PODS=$(kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded --no-headers 2>/dev/null | wc -l)

if [[ $FAILING_PODS -gt 0 ]]; then
    echo "⚠️  WARNING: $FAILING_PODS pods are not Running/Succeeded"
    echo "   Review: kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded"
else
    echo "✅ All pods are healthy"
fi

# Check for deprecated APIs
echo "   Checking for deprecated APIs..."
if command -v pluto &>/dev/null; then
    pluto detect-all-in-cluster --target-versions k8s=v$TARGET_MAJOR.$TARGET_MINOR.0
else
    echo "ℹ️  Install 'pluto' for deprecated API detection:"
    echo "   brew install FairwindsOps/tap/pluto"
fi

# Check PodDisruptionBudgets
PDB_COUNT=$(kubectl get pdb --all-namespaces --no-headers 2>/dev/null | wc -l)
if [[ $PDB_COUNT -gt 0 ]]; then
    echo "ℹ️  Found $PDB_COUNT PodDisruptionBudgets (may affect node upgrade timing)"
fi

echo "✅ Pre-upgrade health check completed"
```

### Phase 2: Backup (Optional)

```bash
if [[ "${SKIP_BACKUP}" != "true" && "${DRY_RUN}" != "true" ]]; then
    echo ""
    echo "💾 Creating pre-upgrade backup..."

    BACKUP_DIR="./cluster-backup-upgrade-$CLUSTER_NAME-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # Backup cluster configuration
    gcloud container clusters describe "$CLUSTER_NAME" \
        --$LOCATION_TYPE="$LOCATION" \
        --format=json > "$BACKUP_DIR/cluster-config.json"

    # Backup node pool configurations (Standard mode only)
    if [[ "$MODE" == "Standard" ]]; then
        gcloud container node-pools list \
            --cluster="$CLUSTER_NAME" \
            --$LOCATION_TYPE="$LOCATION" \
            --format=json > "$BACKUP_DIR/node-pools.json" 2>/dev/null
    fi

    # Backup Kubernetes resources
    kubectl get all --all-namespaces -o yaml > "$BACKUP_DIR/all-resources.yaml"
    kubectl get pv,pvc --all-namespaces -o yaml > "$BACKUP_DIR/volumes.yaml"
    kubectl get configmap,secret --all-namespaces -o yaml > "$BACKUP_DIR/configs-secrets.yaml"
    kubectl get crds -o yaml > "$BACKUP_DIR/crds.yaml" 2>/dev/null

    echo "✅ Backup saved to: $BACKUP_DIR"
fi
```

### Phase 3: Upgrade Execution

#### 3.1 Upgrade Summary and Confirmation

```bash
echo ""
echo "🚀 UPGRADE EXECUTION"
echo "===================="

if [[ "${DRY_RUN}" == "true" ]]; then
    echo ""
    echo "🧪 DRY RUN MODE - No changes will be made"
    echo ""
    echo "Would upgrade:"
    echo "  Cluster: $CLUSTER_NAME"
    echo "  Mode: $MODE"
    echo "  From: $CURRENT_VERSION"
    echo "  To: $TARGET_VERSION"
    echo "  Location: $LOCATION"
    echo "  Node pools: ${UPGRADE_NODES}"
    exit 0
fi

echo ""
echo "📝 Upgrade Summary:"
echo "  Cluster: $CLUSTER_NAME"
echo "  Mode: $MODE"
echo "  Current Version: $CURRENT_VERSION"
echo "  Target Version: $TARGET_VERSION"
echo "  Location: $LOCATION"
echo "  Release Channel: $RELEASE_CHANNEL"
echo ""
echo "Upgrade phases:"
echo "  1. Control plane upgrade (~5-10 minutes)"
if [[ "${UPGRADE_NODES}" == "true" && "$MODE" == "Standard" ]]; then
    echo "  2. Node pool upgrades (~10-20 minutes per pool)"
elif [[ "$MODE" == "Autopilot" ]]; then
    echo "  2. Node upgrade (automatic, managed by GKE)"
fi
echo ""
echo "Impact:"
echo "  • Control plane: Brief API unavailability during upgrade"
echo "  • Workloads: Continue running during control plane upgrade"
if [[ "${UPGRADE_NODES}" == "true" ]]; then
    echo "  • Nodes: Rolling replacement (pods will be rescheduled)"
fi
echo ""

read -p "Continue with upgrade? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    echo "❌ Upgrade cancelled"
    exit 0
fi
```

#### 3.2 Upgrade Control Plane

```bash
echo ""
echo "Step 1: Upgrading control plane to $TARGET_VERSION..."
echo "⏳ This may take 5-10 minutes..."
echo ""

UPGRADE_START=$(date +%s)

# Initiate control plane upgrade
gcloud container clusters upgrade "$CLUSTER_NAME" \
    --master \
    --cluster-version="$TARGET_VERSION" \
    --$LOCATION_TYPE="$LOCATION" \
    --quiet

if [[ $? -eq 0 ]]; then
    echo "✅ Control plane upgraded successfully"
else
    echo "❌ Control plane upgrade failed"
    exit 1
fi

# Verify control plane version
echo ""
echo "Verifying control plane version..."
NEW_MASTER_VERSION=$(gcloud container clusters describe "$CLUSTER_NAME" \
    --$LOCATION_TYPE="$LOCATION" \
    --format="value(currentMasterVersion)")

if [[ "$NEW_MASTER_VERSION" == "$TARGET_VERSION" ]]; then
    echo "✅ Control plane verified at version $NEW_MASTER_VERSION"
else
    echo "⚠️  Control plane version mismatch"
    echo "   Expected: $TARGET_VERSION"
    echo "   Actual: $NEW_MASTER_VERSION"
fi
```

#### 3.3 Upgrade Node Pools (Standard mode)

```bash
if [[ "${UPGRADE_NODES}" == "true" ]]; then
    if [[ "$MODE" == "Standard" ]]; then
        echo ""
        echo "Step 2: Upgrading node pools..."

        # Get all node pools
        NODE_POOLS=$(gcloud container node-pools list \
            --cluster="$CLUSTER_NAME" \
            --$LOCATION_TYPE="$LOCATION" \
            --format="value(name)")

        if [[ -z "$NODE_POOLS" ]]; then
            echo "ℹ️  No node pools found"
        else
            for POOL in $NODE_POOLS; do
                echo ""
                echo "   Upgrading node pool: $POOL"

                # Get current pool version
                POOL_VERSION=$(gcloud container node-pools describe "$POOL" \
                    --cluster="$CLUSTER_NAME" \
                    --$LOCATION_TYPE="$LOCATION" \
                    --format="value(version)")

                echo "   Current version: $POOL_VERSION"
                echo "   Target version: $TARGET_VERSION"

                if [[ "$POOL_VERSION" == "$TARGET_VERSION" ]]; then
                    echo "   ✅ Already at target version"
                    continue
                fi

                echo "   ⏳ Upgrading (rolling node replacement)..."

                # Upgrade node pool
                gcloud container clusters upgrade "$CLUSTER_NAME" \
                    --node-pool="$POOL" \
                    --cluster-version="$TARGET_VERSION" \
                    --$LOCATION_TYPE="$LOCATION" \
                    --quiet

                if [[ $? -eq 0 ]]; then
                    echo "   ✅ Node pool $POOL upgraded successfully"
                else
                    echo "   ❌ Node pool $POOL upgrade failed"
                    exit 1
                fi

                # Brief pause between node pool upgrades
                sleep 5
            done

            echo ""
            echo "✅ All node pools upgraded"
        fi

    elif [[ "$MODE" == "Autopilot" ]]; then
        echo ""
        echo "Step 2: Node upgrade (Autopilot mode)"
        echo "   Autopilot clusters automatically upgrade nodes"
        echo "   Node upgrade will happen gradually over the next few hours"
        echo "   Monitor progress: gcloud container operations list --filter='type=UPGRADE_NODES'"
    fi
else
    echo ""
    echo "⚠️  Skipping node upgrade (--upgrade-nodes=false)"
    echo "   Nodes are still running version $CURRENT_VERSION"
    echo ""
    echo "To upgrade nodes manually:"
    if [[ "$MODE" == "Standard" ]]; then
        echo "  gcloud container clusters upgrade $CLUSTER_NAME \\"
        echo "    --node-pool=<POOL_NAME> \\"
        echo "    --cluster-version=$TARGET_VERSION \\"
        echo "    --$LOCATION_TYPE=$LOCATION"
    else
        echo "  Autopilot nodes will auto-upgrade during maintenance window"
    fi
fi
```

### Phase 4: Post-Upgrade Verification

```bash
echo ""
echo "🔍 POST-UPGRADE VERIFICATION"
echo "============================"

# Verify control plane version
echo ""
echo "Control Plane Version:"
FINAL_MASTER_VERSION=$(gcloud container clusters describe "$CLUSTER_NAME" \
    --$LOCATION_TYPE="$LOCATION" \
    --format="value(currentMasterVersion)")

if [[ "$FINAL_MASTER_VERSION" == "$TARGET_VERSION" ]]; then
    echo "✅ $FINAL_MASTER_VERSION"
else
    echo "⚠️  $FINAL_MASTER_VERSION (expected: $TARGET_VERSION)"
fi

# Check node versions
echo ""
echo "Node Versions:"
kubectl get nodes -o custom-columns=\
NAME:.metadata.name,\
VERSION:.status.nodeInfo.kubeletVersion,\
STATUS:.status.conditions[-1].type

# Count nodes by version
echo ""
echo "Node Version Distribution:"
kubectl get nodes -o jsonpath='{range .items[*]}{.status.nodeInfo.kubeletVersion}{"\n"}{end}' | \
    sort | uniq -c | sed 's/^/  /'

# Check node health
echo ""
echo "Node Health:"
READY_NODES=$(kubectl get nodes --no-headers | grep " Ready" | wc -l)
TOTAL_NODES=$(kubectl get nodes --no-headers | wc -l)

if [[ $READY_NODES -eq $TOTAL_NODES ]]; then
    echo "✅ All $TOTAL_NODES nodes are Ready"
else
    echo "⚠️  Only $READY_NODES of $TOTAL_NODES nodes are Ready"
fi

# Check pod health
echo ""
echo "Pod Health:"
RUNNING_PODS=$(kubectl get pods --all-namespaces --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
TOTAL_PODS=$(kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l)

echo "Running Pods: $RUNNING_PODS / $TOTAL_PODS"

FAILING_PODS=$(kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded --no-headers 2>/dev/null | wc -l)
if [[ $FAILING_PODS -gt 0 ]]; then
    echo "⚠️  $FAILING_PODS pods not in Running/Succeeded state"
    echo ""
    echo "Review failing pods:"
    kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded
else
    echo "✅ All pods healthy"
fi

# Run cluster diagnostics
echo ""
echo "Running cluster diagnostics..."
if command -v k8sgpt &>/dev/null; then
    k8sgpt analyze --explain --filter=Node,Pod | head -20
else
    echo "ℹ️  Install k8sgpt for AI-powered diagnostics"
fi

# Calculate upgrade time
UPGRADE_END=$(date +%s)
TOTAL_TIME=$(( (UPGRADE_END - UPGRADE_START) / 60 ))

echo ""
echo "✅ UPGRADE COMPLETED SUCCESSFULLY"
echo "=================================="
echo ""
echo "Cluster: $CLUSTER_NAME"
echo "Mode: $MODE"
echo "Old version: $CURRENT_VERSION"
echo "New version: $FINAL_MASTER_VERSION"
echo "Total time: $TOTAL_TIME minutes"
echo ""
echo "Next steps:"
echo "  1. Monitor workloads for any compatibility issues"
echo "  2. Test critical application flows"
echo "  3. Review Kubernetes $TARGET_VERSION release notes"
echo "  4. Update documentation and runbooks"
if [[ "${UPGRADE_NODES}" != "true" ]]; then
    echo "  5. Schedule node pool upgrades"
fi
if [[ "$MODE" == "Autopilot" ]]; then
    echo "  5. Monitor automatic node upgrades over next few hours"
fi
echo ""
echo "GKE Console: https://console.cloud.google.com/kubernetes/clusters/$LOCATION_TYPE/$LOCATION/$CLUSTER_NAME?project=$GCP_PROJECT"
echo ""
```

## Rollback Procedures

GKE does not support direct rollback. If upgrade causes issues:

### Option 1: Restore from Backup

1. Create new cluster with old version
2. Restore workloads from backup
3. Redirect traffic to new cluster

### Option 2: Fix Forward

1. Identify compatibility issues
2. Update workloads to be compatible
3. Deploy fixes to upgraded cluster

### Option 3: Contact Support

For critical issues, contact Google Cloud Support with:
- Cluster name and project
- Upgrade operation ID
- Error messages and logs

## Best Practices

1. **Test in non-production** - Always upgrade dev/staging first
2. **Review release notes** - Check Kubernetes and GKE release notes for breaking changes
3. **Use release channels** - Simplifies upgrade management for most clusters
4. **Schedule maintenance** - Upgrade during low-traffic periods
5. **Monitor during upgrade** - Watch for pod evictions and failures
6. **Gradual rollout** - Upgrade one cluster at a time in production
7. **Keep workloads updated** - Ensure apps are compatible with new K8s versions

## Autopilot vs Standard Upgrades

| Aspect | Autopilot | Standard |
|--------|-----------|----------|
| **Control Plane** | Auto-upgrades in channel | Auto or manual |
| **Nodes** | Auto-upgrades gradually | Manual or auto |
| **Timing** | Maintenance window | On-demand or scheduled |
| **Control** | Limited (channel-based) | Full control |
| **Disruption** | Minimized by GKE | Depends on configuration |

## Common Issues

### Issue: API server timeout during upgrade

**Solution**: This is expected. Wait 5-10 minutes for upgrade to complete.

### Issue: Nodes stuck in NotReady after upgrade

**Solution**: Check node logs and events:
```bash
kubectl describe node <NODE_NAME>
gcloud logging read "resource.type=k8s_node AND resource.labels.node_name=<NODE_NAME>"
```

### Issue: Workload compatibility errors

**Solution**: Check for deprecated API usage:
```bash
kubectl api-resources --verbs=list --namespaced -o name | \
  xargs -n 1 kubectl get --show-kind --ignore-not-found -A
```

## Related Commands

- `gcp-cluster-delete`: Delete clusters
- `gcp-cluster-create`: Create new clusters
- `cluster-diagnose`: Run comprehensive diagnostics
- `backup-cluster`: Create cluster backup
- `node-drain`: Manually drain nodes
