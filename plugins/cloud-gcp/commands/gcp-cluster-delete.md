---
name: gcp-cluster-delete
description: Safely delete a GKE cluster with validation and backup
category: cloud-provisioning
parameters:
  - name: cluster-name
    description: Name of the cluster to delete
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
  - name: skip-backup
    description: Skip automatic backup before deletion
    type: boolean
    default: false
  - name: force
    description: Skip all confirmation prompts (dangerous)
    type: boolean
    default: false
  - name: delete-network
    description: Delete associated VPC network and subnetwork
    type: boolean
    default: false
tags:
  - gcp
  - gke
  - cluster-lifecycle
  - deletion
  - safety
---

# GCP Cluster Delete

Safely delete a GKE cluster with comprehensive validation, automatic backup, and resource cleanup.

## Overview

This command provides a safe way to delete GKE clusters (both Standard and Autopilot modes) with:

- **Production Detection**: Warns if cluster has production labels
- **Resource Analysis**: Lists all resources that will be deleted
- **Automatic Backup**: Creates backup before deletion (unless skipped)
- **Confirmation Prompts**: Requires explicit confirmation
- **Complete Cleanup**: Removes cluster and optionally networking resources

**⚠️ WARNING: This is a destructive operation that cannot be undone. All cluster data will be permanently deleted.**

## Prerequisites

- Google Cloud SDK installed (`gcloud --version`)
- `kubectl` configured with cluster access
- Authenticated to GCP (`gcloud auth list`)
- IAM permissions:
  - `container.clusters.delete`
  - `container.clusters.get`
  - `compute.networks.delete` (if deleting network)
  - `compute.subnetworks.delete` (if deleting network)

## Safety Features

1. **Production Detection**: Warns if cluster has production labels
2. **Resource Counting**: Shows number of workloads, PVs, services
3. **Persistent Volume Warning**: Alerts about data loss
4. **LoadBalancer Detection**: Warns about external load balancers
5. **Automatic Backup**: Creates pre-deletion backup
6. **Dual Confirmation**: Requires cluster name + yes/no confirmation
7. **Grace Period**: 10-second cancellation window

## Workflow

### Phase 1: Pre-deletion Validation

#### 1.1 Verify Cluster Exists

```bash
CLUSTER_NAME="${CLUSTER_NAME}"
GCP_PROJECT="${GCP_PROJECT}"
GCP_REGION="${GCP_REGION}"
GCP_ZONE="${GCP_ZONE}"

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

echo "🔍 Verifying cluster: $CLUSTER_NAME in $LOCATION"

# Set project
gcloud config set project "$GCP_PROJECT"

# Check if cluster exists
if ! gcloud container clusters describe "$CLUSTER_NAME" --$LOCATION_TYPE="$LOCATION" &>/dev/null; then
    echo "❌ ERROR: Cluster '$CLUSTER_NAME' not found in $LOCATION"
    echo ""
    echo "Available clusters:"
    gcloud container clusters list --format="table(name,location,status)"
    exit 1
fi

# Get cluster details
CLUSTER_INFO=$(gcloud container clusters describe "$CLUSTER_NAME" --$LOCATION_TYPE="$LOCATION" --format=json)
CLUSTER_STATUS=$(echo "$CLUSTER_INFO" | jq -r '.status')
CLUSTER_VERSION=$(echo "$CLUSTER_INFO" | jq -r '.currentMasterVersion')
CLUSTER_MODE=$(echo "$CLUSTER_INFO" | jq -r '.autopilot.enabled // false')
NODE_COUNT=$(echo "$CLUSTER_INFO" | jq -r '.currentNodeCount // 0')
NETWORK=$(echo "$CLUSTER_INFO" | jq -r '.network')
SUBNETWORK=$(echo "$CLUSTER_INFO" | jq -r '.subnetwork')

if [[ "$CLUSTER_MODE" == "true" ]]; then
    MODE="Autopilot"
else
    MODE="Standard"
fi

echo "✅ Cluster found: $CLUSTER_NAME"
echo "   Mode: $MODE"
echo "   Status: $CLUSTER_STATUS"
echo "   Version: $CLUSTER_VERSION"
echo "   Nodes: $NODE_COUNT"
echo "   Network: $NETWORK"
echo "   Subnetwork: $SUBNETWORK"
```

#### 1.2 Analyze Cluster Resources

```bash
echo ""
echo "📊 Analyzing cluster resources..."

# Get kubeconfig
gcloud container clusters get-credentials "$CLUSTER_NAME" \
    --$LOCATION_TYPE="$LOCATION" \
    --project="$GCP_PROJECT"

# Count resources
NAMESPACE_COUNT=$(kubectl get namespaces --no-headers 2>/dev/null | wc -l)
POD_COUNT=$(kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l)
SERVICE_COUNT=$(kubectl get services --all-namespaces --no-headers 2>/dev/null | wc -l)
PV_COUNT=$(kubectl get pv --no-headers 2>/dev/null | wc -l)
PVC_COUNT=$(kubectl get pvc --all-namespaces --no-headers 2>/dev/null | wc -l)
DEPLOYMENT_COUNT=$(kubectl get deployments --all-namespaces --no-headers 2>/dev/null | wc -l)
INGRESS_COUNT=$(kubectl get ingress --all-namespaces --no-headers 2>/dev/null | wc -l)

echo "   Namespaces: $NAMESPACE_COUNT"
echo "   Pods: $POD_COUNT"
echo "   Services: $SERVICE_COUNT"
echo "   Deployments: $DEPLOYMENT_COUNT"
echo "   Ingresses: $INGRESS_COUNT"
echo "   Persistent Volumes: $PV_COUNT"
echo "   Persistent Volume Claims: $PVC_COUNT"

# Get GCP-specific resources
LB_COUNT=$(kubectl get services --all-namespaces -o json 2>/dev/null | jq '[.items[] | select(.spec.type=="LoadBalancer")] | length')
echo "   LoadBalancer Services: $LB_COUNT"
```

#### 1.3 Safety Checks and Warnings

```bash
echo ""
echo "⚠️  SAFETY CHECKS"
echo "================="

WARNINGS=0

# Check for production labels
LABELS=$(echo "$CLUSTER_INFO" | jq -r '.resourceLabels // {}')
ENV_LABEL=$(echo "$LABELS" | jq -r '.environment // .env // ""')

if [[ "$ENV_LABEL" =~ ^(prod|production|prd)$ ]]; then
    echo "⚠️  WARNING: Cluster is labeled as PRODUCTION"
    echo "   Label: environment=$ENV_LABEL"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for GKE release channel
RELEASE_CHANNEL=$(echo "$CLUSTER_INFO" | jq -r '.releaseChannel.channel // "UNSPECIFIED"')
if [[ "$RELEASE_CHANNEL" == "STABLE" ]]; then
    echo "⚠️  WARNING: Cluster uses STABLE release channel (typical for production)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for persistent volumes
if [[ $PV_COUNT -gt 0 ]]; then
    echo "⚠️  WARNING: $PV_COUNT Persistent Volumes will be deleted"
    echo "   This may result in DATA LOSS if volumes contain important data"
    WARNINGS=$((WARNINGS + 1))

    # List PV types
    echo ""
    echo "   Persistent Volume Types:"
    kubectl get pv -o custom-columns=NAME:.metadata.name,TYPE:.spec.gcePersistentDisk.pdName,SIZE:.spec.capacity.storage 2>/dev/null | head -10
fi

# Check for LoadBalancer services (creates GCP load balancers)
if [[ $LB_COUNT -gt 0 ]]; then
    echo "⚠️  WARNING: $LB_COUNT LoadBalancer services found"
    echo "   Associated GCP Load Balancers will be deleted"
    WARNINGS=$((WARNINGS + 1))

    # List LoadBalancer services
    echo ""
    echo "   LoadBalancer Services:"
    kubectl get services --all-namespaces -o json 2>/dev/null | \
        jq -r '.items[] | select(.spec.type=="LoadBalancer") | "   - \(.metadata.namespace)/\(.metadata.name)"' | head -10
fi

# Check for Ingress resources (creates GCP L7 load balancers)
if [[ $INGRESS_COUNT -gt 0 ]]; then
    echo "⚠️  WARNING: $INGRESS_COUNT Ingress resources found"
    echo "   Associated GCP HTTP(S) Load Balancers will be deleted"
    WARNINGS=$((WARNINGS + 1))
fi

# Check cluster age
CREATED_AT=$(echo "$CLUSTER_INFO" | jq -r '.createTime')
if [[ "$CREATED_AT" != "null" ]]; then
    CREATED_TIMESTAMP=$(date -d "$CREATED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$CREATED_AT" +%s 2>/dev/null || echo "0")
    if [[ $CREATED_TIMESTAMP -gt 0 ]]; then
        DAYS_OLD=$(( ($(date +%s) - CREATED_TIMESTAMP) / 86400 ))
        if [[ $DAYS_OLD -gt 30 ]]; then
            echo "ℹ️  INFO: Cluster is $DAYS_OLD days old"
        fi
    fi
fi

# Check for GKE managed services
MANAGED_ADDONS=$(echo "$CLUSTER_INFO" | jq -r '.addonsConfig | to_entries[] | select(.value.disabled == false) | .key' 2>/dev/null)
if [[ -n "$MANAGED_ADDONS" ]]; then
    echo "ℹ️  INFO: Cluster has managed add-ons enabled"
fi

echo ""
echo "Total warnings: $WARNINGS"
```

### Phase 2: Backup (Optional)

```bash
if [[ "${SKIP_BACKUP}" != "true" ]]; then
    echo ""
    echo "💾 Creating backup before deletion..."

    BACKUP_DIR="./cluster-backup-$CLUSTER_NAME-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    echo "   Backup directory: $BACKUP_DIR"

    # Backup all Kubernetes resources
    echo "   Backing up Kubernetes resources..."
    kubectl get all --all-namespaces -o yaml > "$BACKUP_DIR/all-resources.yaml" 2>/dev/null

    # Backup persistent volumes and claims
    echo "   Backing up PV/PVC definitions..."
    kubectl get pv -o yaml > "$BACKUP_DIR/persistent-volumes.yaml" 2>/dev/null
    kubectl get pvc --all-namespaces -o yaml > "$BACKUP_DIR/persistent-volume-claims.yaml" 2>/dev/null

    # Backup ConfigMaps and Secrets
    echo "   Backing up ConfigMaps and Secrets..."
    kubectl get configmaps --all-namespaces -o yaml > "$BACKUP_DIR/configmaps.yaml" 2>/dev/null
    kubectl get secrets --all-namespaces -o yaml > "$BACKUP_DIR/secrets.yaml" 2>/dev/null

    # Backup CRDs and custom resources
    echo "   Backing up CRDs..."
    kubectl get crds -o yaml > "$BACKUP_DIR/crds.yaml" 2>/dev/null

    # Backup Ingress and Services
    echo "   Backing up Ingress and Services..."
    kubectl get ingress --all-namespaces -o yaml > "$BACKUP_DIR/ingress.yaml" 2>/dev/null
    kubectl get services --all-namespaces -o yaml > "$BACKUP_DIR/services.yaml" 2>/dev/null

    # Backup GKE cluster configuration
    echo "   Backing up cluster configuration..."
    gcloud container clusters describe "$CLUSTER_NAME" \
        --$LOCATION_TYPE="$LOCATION" \
        --format=json > "$BACKUP_DIR/cluster-config.json"

    # Export node pool configurations (Standard mode only)
    if [[ "$MODE" == "Standard" ]]; then
        gcloud container node-pools list \
            --cluster="$CLUSTER_NAME" \
            --$LOCATION_TYPE="$LOCATION" \
            --format=json > "$BACKUP_DIR/node-pools.json" 2>/dev/null
    fi

    # Create README with restore instructions
    cat > "$BACKUP_DIR/README.md" <<EOF
# Cluster Backup: $CLUSTER_NAME

**Backup Date**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Cluster**: $CLUSTER_NAME
**Project**: $GCP_PROJECT
**Location**: $LOCATION ($LOCATION_TYPE)
**Mode**: $MODE
**Version**: $CLUSTER_VERSION

## Contents

- \`cluster-config.json\`: GKE cluster configuration
- \`all-resources.yaml\`: All Kubernetes resources
- \`persistent-volumes.yaml\`: PV definitions
- \`persistent-volume-claims.yaml\`: PVC definitions
- \`configmaps.yaml\`: ConfigMaps
- \`secrets.yaml\`: Secrets (base64 encoded)
- \`crds.yaml\`: Custom Resource Definitions
- \`ingress.yaml\`: Ingress resources
- \`services.yaml\`: Service definitions
- \`node-pools.json\`: Node pool configurations (Standard mode)

## Restore Instructions

1. Create new cluster with similar configuration:
   \`\`\`bash
   # Review cluster-config.json for settings
   cluster-code gcp-cluster-create \\
     --cluster-name $CLUSTER_NAME-restored \\
     --project $GCP_PROJECT \\
     --region/zone $LOCATION
   \`\`\`

2. Restore CRDs first:
   \`\`\`bash
   kubectl apply -f crds.yaml
   \`\`\`

3. Restore ConfigMaps and Secrets:
   \`\`\`bash
   kubectl apply -f configmaps.yaml
   kubectl apply -f secrets.yaml
   \`\`\`

4. Restore PVCs (will create new volumes):
   \`\`\`bash
   kubectl apply -f persistent-volume-claims.yaml
   \`\`\`

5. Restore workloads:
   \`\`\`bash
   kubectl apply -f all-resources.yaml
   \`\`\`

## Notes

- PersistentVolume data is NOT backed up, only definitions
- For data backup, use Velero or GCP snapshots
- LoadBalancer services will get new external IPs
- Ingress resources will get new GCP load balancers

EOF

    echo "✅ Backup completed: $BACKUP_DIR"
else
    echo "⚠️  Skipping backup (--skip-backup flag set)"
fi
```

### Phase 3: Confirmation

```bash
echo ""
echo "🚨 FINAL CONFIRMATION REQUIRED"
echo "=============================="
echo ""
echo "You are about to DELETE the following cluster:"
echo ""
echo "  Cluster Name: $CLUSTER_NAME"
echo "  Mode: $MODE"
echo "  Project: $GCP_PROJECT"
echo "  Location: $LOCATION"
echo "  Resources: $NAMESPACE_COUNT namespaces, $POD_COUNT pods, $PV_COUNT PVs"
echo ""
echo "This action will:"
echo "  ❌ Delete the entire GKE cluster"
echo "  ❌ Delete all workloads and configurations"
echo "  ❌ Delete all persistent volumes and data"
echo "  ❌ Delete all GCP load balancers created by the cluster"
if [[ "${DELETE_NETWORK}" == "true" ]]; then
    echo "  ❌ Delete the VPC network and subnetwork"
fi
echo ""
echo "⚠️  THIS CANNOT BE UNDONE!"
echo ""

if [[ "${FORCE}" != "true" ]]; then
    # First confirmation: type cluster name
    echo "To confirm, please type the cluster name: $CLUSTER_NAME"
    read -r CONFIRM_NAME

    if [[ "$CONFIRM_NAME" != "$CLUSTER_NAME" ]]; then
        echo "❌ Cluster name does not match. Aborting."
        exit 1
    fi

    # Second confirmation: yes/no
    echo ""
    echo "Are you absolutely sure you want to delete this cluster? (yes/no)"
    read -r CONFIRM_DELETE

    if [[ "$CONFIRM_DELETE" != "yes" ]]; then
        echo "❌ Deletion cancelled."
        exit 0
    fi

    # Grace period
    echo ""
    echo "⏳ Starting deletion in 10 seconds... (Ctrl+C to cancel)"
    sleep 10
else
    echo "⚠️  FORCE mode enabled - skipping confirmations"
fi
```

### Phase 4: Deletion

```bash
echo ""
echo "🗑️  Deleting cluster..."
echo ""

# Delete the cluster
echo "⏳ Deleting GKE cluster (this may take 5-10 minutes)..."

DELETE_START=$(date +%s)

if gcloud container clusters delete "$CLUSTER_NAME" \
    --$LOCATION_TYPE="$LOCATION" \
    --quiet; then

    DELETE_END=$(date +%s)
    DELETE_TIME=$(( (DELETE_END - DELETE_START) / 60 ))

    echo "✅ GKE cluster deleted successfully (took $DELETE_TIME minutes)"
else
    echo "❌ Cluster deletion failed"
    exit 1
fi
```

### Phase 5: Network Cleanup (Optional)

```bash
if [[ "${DELETE_NETWORK}" == "true" ]]; then
    echo ""
    echo "🌐 Cleaning up network resources..."

    # Extract network and subnet names from full paths
    NETWORK_NAME=$(basename "$NETWORK")
    SUBNET_NAME=$(basename "$SUBNETWORK")

    # Determine region for subnet
    if [[ "$LOCATION_TYPE" == "zone" ]]; then
        SUBNET_REGION=$(echo "$LOCATION" | sed 's/-[a-z]$//')
    else
        SUBNET_REGION="$LOCATION"
    fi

    # Check if network is used by other resources
    echo "   Checking if network is in use..."
    INSTANCES_IN_NETWORK=$(gcloud compute instances list \
        --filter="networkInterfaces.network:$NETWORK_NAME" \
        --format="value(name)" 2>/dev/null | wc -l)

    OTHER_CLUSTERS=$(gcloud container clusters list \
        --filter="network:$NETWORK_NAME AND name!=$CLUSTER_NAME" \
        --format="value(name)" 2>/dev/null | wc -l)

    if [[ $INSTANCES_IN_NETWORK -gt 0 || $OTHER_CLUSTERS -gt 0 ]]; then
        echo "⚠️  WARNING: Network '$NETWORK_NAME' is still in use"
        echo "   Instances: $INSTANCES_IN_NETWORK"
        echo "   Other clusters: $OTHER_CLUSTERS"
        echo "   Skipping network deletion for safety"
    else
        # Delete firewall rules first
        echo "   Deleting firewall rules..."
        FIREWALL_RULES=$(gcloud compute firewall-rules list \
            --filter="network:$NETWORK_NAME" \
            --format="value(name)" 2>/dev/null)

        for RULE in $FIREWALL_RULES; do
            echo "   - Deleting firewall rule: $RULE"
            gcloud compute firewall-rules delete "$RULE" --quiet 2>/dev/null || true
        done

        # Delete subnet
        if [[ -n "$SUBNET_NAME" ]]; then
            echo "   Deleting subnet: $SUBNET_NAME"
            gcloud compute networks subnets delete "$SUBNET_NAME" \
                --region="$SUBNET_REGION" \
                --quiet 2>/dev/null || echo "   Failed to delete subnet (may not exist or in use)"
        fi

        # Delete network
        echo "   Deleting network: $NETWORK_NAME"
        if gcloud compute networks delete "$NETWORK_NAME" --quiet 2>/dev/null; then
            echo "✅ Network resources deleted"
        else
            echo "⚠️  Failed to delete network (may have remaining dependencies)"
        fi
    fi
else
    echo ""
    echo "ℹ️  Network resources retained (use --delete-network to remove)"
fi
```

### Phase 6: Post-Deletion Cleanup

```bash
echo ""
echo "🧹 Cleaning up local resources..."

# Remove kubectl context
CONTEXT_NAME="gke_${GCP_PROJECT}_${LOCATION}_${CLUSTER_NAME}"
kubectl config delete-context "$CONTEXT_NAME" 2>/dev/null || true
kubectl config delete-cluster "$CONTEXT_NAME" 2>/dev/null || true
kubectl config unset users."$CONTEXT_NAME" 2>/dev/null || true

echo "✅ Local cleanup completed"
```

### Phase 7: Verification and Summary

```bash
echo ""
echo "🔍 Verifying deletion..."

# Verify cluster is gone
if gcloud container clusters describe "$CLUSTER_NAME" --$LOCATION_TYPE="$LOCATION" &>/dev/null; then
    echo "⚠️  WARNING: Cluster still exists (deletion may be in progress)"
else
    echo "✅ Cluster deletion verified"
fi

# Check for orphaned resources
echo ""
echo "Checking for potential orphaned resources..."

# Check for disks that may have been from PVs
ORPHANED_DISKS=$(gcloud compute disks list \
    --filter="name~gke-$CLUSTER_NAME" \
    --format="value(name)" 2>/dev/null | wc -l)

if [[ $ORPHANED_DISKS -gt 0 ]]; then
    echo "⚠️  Found $ORPHANED_DISKS potentially orphaned disks:"
    gcloud compute disks list --filter="name~gke-$CLUSTER_NAME" --format="table(name,zone,sizeGb,status)"
    echo ""
    echo "To delete orphaned disks:"
    echo "  gcloud compute disks list --filter='name~gke-$CLUSTER_NAME' --format='value(name,zone)' | while read name zone; do"
    echo "    gcloud compute disks delete \$name --zone=\$zone --quiet"
    echo "  done"
fi

echo ""
echo "✅ CLUSTER DELETION COMPLETE"
echo "============================"
echo ""
echo "Cluster '$CLUSTER_NAME' has been successfully deleted."
echo ""

if [[ "${SKIP_BACKUP}" != "true" ]]; then
    echo "Backup saved to: $BACKUP_DIR"
    echo ""
fi

echo "Next steps:"
echo "  • Verify GCP resources are fully cleaned up in Cloud Console"
echo "  • Check for orphaned disks, load balancers, and static IPs"
echo "  • Review firewall rules if custom rules were created"
echo "  • Update documentation and inventory"
if [[ "${DELETE_NETWORK}" != "true" ]]; then
    echo "  • Optionally clean up VPC network: $NETWORK"
fi
echo ""
echo "GCP Console: https://console.cloud.google.com/kubernetes/list?project=$GCP_PROJECT"
echo ""
```

## Common Issues

### Issue: Cluster deletion stuck

**Solution**: Check for resources blocking deletion:

```bash
# Check cluster status
gcloud container clusters describe $CLUSTER_NAME --zone=$ZONE

# Check for lingering node pools
gcloud container node-pools list --cluster=$CLUSTER_NAME --zone=$ZONE

# Force delete if necessary (use with caution)
gcloud container clusters delete $CLUSTER_NAME --zone=$ZONE --async
```

### Issue: Load balancers not deleted

**Solution**: Manually clean up GCP load balancers:

```bash
# List forwarding rules
gcloud compute forwarding-rules list --filter="description~$CLUSTER_NAME"

# Delete forwarding rules
gcloud compute forwarding-rules delete <NAME> --region=$REGION
```

### Issue: Orphaned persistent disks

**Solution**: Identify and delete orphaned disks:

```bash
# List disks created by GKE
gcloud compute disks list --filter="name~gke-$CLUSTER_NAME"

# Delete specific disk
gcloud compute disks delete <DISK_NAME> --zone=$ZONE
```

## Examples

### Example 1: Safe deletion with backup (recommended)

```bash
cluster-code gcp-cluster-delete \
  --cluster-name my-prod-cluster \
  --project my-project \
  --region us-central1
```

### Example 2: Quick deletion for dev cluster

```bash
cluster-code gcp-cluster-delete \
  --cluster-name dev-test-123 \
  --project my-dev-project \
  --zone us-central1-a \
  --skip-backup
```

### Example 3: Complete cleanup including network

```bash
cluster-code gcp-cluster-delete \
  --cluster-name old-cluster \
  --project my-project \
  --region europe-west1 \
  --delete-network
```

### Example 4: Zonal cluster deletion

```bash
cluster-code gcp-cluster-delete \
  --cluster-name staging-cluster \
  --project my-project \
  --zone asia-southeast1-a
```

## Related Commands

- `gcp-cluster-create`: Create new GKE clusters
- `gcp-cluster-upgrade`: Upgrade cluster version
- `backup-cluster`: Create comprehensive cluster backup
- `cluster-diagnose`: Run diagnostics before deletion
