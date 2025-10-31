---
name: backup-cluster
description: Create comprehensive cluster backup using Velero
category: backup-restore
parameters:
  - name: backup-name
    description: Name for this backup (auto-generated if not provided)
    required: false
  - name: include-namespaces
    description: Comma-separated list of namespaces to backup
    required: false
  - name: exclude-namespaces
    description: Comma-separated list of namespaces to exclude
    required: false
  - name: include-resources
    description: Resources to include (e.g., pods,deployments)
    required: false
  - name: exclude-resources
    description: Resources to exclude
    required: false
  - name: selector
    description: Label selector to filter resources
    required: false
  - name: snapshot-volumes
    description: Create volume snapshots (requires CSI support)
    type: boolean
    default: true
  - name: ttl
    description: Backup retention time (e.g., 720h for 30 days)
    default: 720h
  - name: wait
    description: Wait for backup to complete
    type: boolean
    default: true
tags:
  - backup
  - disaster-recovery
  - velero
  - data-protection
---

# Cluster Backup

Create comprehensive Kubernetes cluster backups using Velero, including resources, configurations, and persistent volumes.

## Overview

This command creates full cluster backups with:

- **Resource Backup**: All Kubernetes resources (pods, deployments, configmaps, etc.)
- **Persistent Volume Snapshots**: Volume data using CSI or cloud-native snapshots
- **Selective Backup**: Namespace, resource type, and label filtering
- **Automated Retention**: Configurable backup expiration
- **Cloud Integration**: Works with AWS, Azure, GCP, and S3-compatible storage

## Prerequisites

- `velero` CLI installed (`velero version` >= 1.12.0)
- Velero server installed in cluster
- Cloud storage bucket configured (S3, GCS, Azure Blob)
- Volume snapshot provider configured (for PV snapshots)
- `kubectl` access to cluster

## Initial Velero Setup

If Velero is not yet installed, set it up first:

### AWS (S3 + EBS Snapshots)

```bash
# Create S3 bucket
aws s3 mb s3://my-velero-backups --region us-west-2

# Create IAM user with permissions
cat > velero-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["s3:*", "ec2:DescribeVolumes", "ec2:DescribeSnapshots",
                       "ec2:CreateTags", "ec2:CreateVolume", "ec2:CreateSnapshot"],
            "Resource": "*"
        }
    ]
}
EOF

aws iam create-policy --policy-name VeleroPolicy --policy-document file://velero-policy.json

# Install Velero
velero install \
    --provider aws \
    --plugins velero/velero-plugin-for-aws:v1.8.0 \
    --bucket my-velero-backups \
    --backup-location-config region=us-west-2 \
    --snapshot-location-config region=us-west-2 \
    --secret-file ./credentials-velero
```

### Azure (Blob Storage + Disk Snapshots)

```bash
# Create resource group and storage account
az storage account create \
    --name velerostorage \
    --resource-group velero-rg \
    --sku Standard_GRS \
    --encryption-services blob

# Install Velero
velero install \
    --provider azure \
    --plugins velero/velero-plugin-for-microsoft-azure:v1.8.0 \
    --bucket velero-backups \
    --secret-file ./credentials-velero \
    --backup-location-config resourceGroup=velero-rg,storageAccount=velerostorage \
    --snapshot-location-config resourceGroup=velero-rg
```

### GCP (GCS + Disk Snapshots)

```bash
# Create GCS bucket
gsutil mb gs://my-velero-backups/

# Install Velero
velero install \
    --provider gcp \
    --plugins velero/velero-plugin-for-gcp:v1.8.0 \
    --bucket my-velero-backups \
    --secret-file ./credentials-velero
```

## Workflow

### Phase 1: Pre-backup Validation

#### 1.1 Verify Velero Installation

```bash
BACKUP_NAME="${BACKUP_NAME:-cluster-backup-$(date +%Y%m%d-%H%M%S)}"
SNAPSHOT_VOLUMES="${SNAPSHOT_VOLUMES:-true}"
TTL="${TTL:-720h}"
WAIT="${WAIT:-true}"

echo "🔍 Validating Velero installation..."
echo ""

# Check if Velero CLI is installed
if ! command -v velero &>/dev/null; then
    echo "❌ ERROR: Velero CLI not found"
    echo ""
    echo "Install Velero CLI:"
    echo "  # macOS"
    echo "  brew install velero"
    echo ""
    echo "  # Linux"
    echo "  wget https://github.com/vmware-tanzu/velero/releases/latest/download/velero-linux-amd64.tar.gz"
    echo "  tar -xvf velero-linux-amd64.tar.gz"
    echo "  sudo mv velero-linux-amd64/velero /usr/local/bin/"
    exit 1
fi

VELERO_VERSION=$(velero version --client-only 2>/dev/null | grep "Client" | awk '{print $2}')
echo "✅ Velero CLI: $VELERO_VERSION"

# Check if Velero is deployed in cluster
if ! kubectl get namespace velero &>/dev/null; then
    echo "❌ ERROR: Velero not installed in cluster"
    echo ""
    echo "Install Velero in your cluster first. See examples in this command."
    exit 1
fi

# Check Velero server status
VELERO_POD=$(kubectl get pods -n velero -l app.kubernetes.io/name=velero -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [[ -z "$VELERO_POD" ]]; then
    echo "❌ ERROR: Velero pod not found"
    exit 1
fi

VELERO_STATUS=$(kubectl get pod -n velero "$VELERO_POD" -o jsonpath='{.status.phase}')
if [[ "$VELERO_STATUS" != "Running" ]]; then
    echo "❌ ERROR: Velero pod not running (status: $VELERO_STATUS)"
    exit 1
fi

echo "✅ Velero server: Running"

# Check backup locations
BACKUP_LOCATIONS=$(velero backup-location get -o json 2>/dev/null | jq -r '.items[] | select(.status.phase=="Available") | .metadata.name' | wc -l)

if [[ $BACKUP_LOCATIONS -eq 0 ]]; then
    echo "⚠️  WARNING: No backup locations available"
    echo ""
    velero backup-location get
    echo ""
    echo "Configure a backup location before continuing"
    exit 1
fi

echo "✅ Backup locations: $BACKUP_LOCATIONS available"

# Check snapshot locations (if snapshots enabled)
if [[ "$SNAPSHOT_VOLUMES" == "true" ]]; then
    SNAPSHOT_LOCATIONS=$(velero snapshot-location get -o json 2>/dev/null | jq -r '.items[] | select(.status.phase=="Available") | .metadata.name' | wc -l)

    if [[ $SNAPSHOT_LOCATIONS -eq 0 ]]; then
        echo "⚠️  WARNING: No snapshot locations available"
        echo "   Volume snapshots will be skipped"
        SNAPSHOT_VOLUMES="false"
    else
        echo "✅ Snapshot locations: $SNAPSHOT_LOCATIONS available"
    fi
fi

echo ""
```

#### 1.2 Analyze Cluster Resources

```bash
echo "📊 Analyzing cluster resources..."
echo ""

# Count resources
NAMESPACE_COUNT=$(kubectl get namespaces --no-headers | wc -l)
POD_COUNT=$(kubectl get pods --all-namespaces --no-headers | wc -l)
PV_COUNT=$(kubectl get pv --no-headers | wc -l)
PVC_COUNT=$(kubectl get pvc --all-namespaces --no-headers | wc -l)
DEPLOYMENT_COUNT=$(kubectl get deployments --all-namespaces --no-headers | wc -l)
SERVICE_COUNT=$(kubectl get services --all-namespaces --no-headers | wc -l)
CONFIGMAP_COUNT=$(kubectl get configmaps --all-namespaces --no-headers | wc -l)
SECRET_COUNT=$(kubectl get secrets --all-namespaces --no-headers | wc -l)

echo "Cluster resources:"
echo "  Namespaces: $NAMESPACE_COUNT"
echo "  Pods: $POD_COUNT"
echo "  Deployments: $DEPLOYMENT_COUNT"
echo "  Services: $SERVICE_COUNT"
echo "  ConfigMaps: $CONFIGMAP_COUNT"
echo "  Secrets: $SECRET_COUNT"
echo "  Persistent Volumes: $PV_COUNT"
echo "  Persistent Volume Claims: $PVC_COUNT"

# Estimate backup size
if [[ $PV_COUNT -gt 0 ]]; then
    echo ""
    echo "Persistent Volume sizes:"
    kubectl get pv -o custom-columns=NAME:.metadata.name,SIZE:.spec.capacity.storage,STORAGECLASS:.spec.storageClassName --no-headers | head -10

    TOTAL_PV_SIZE=$(kubectl get pv -o json | jq -r '[.items[].spec.capacity.storage] | map(gsub("Gi";"") | tonumber) | add')
    if [[ -n "$TOTAL_PV_SIZE" && "$TOTAL_PV_SIZE" != "null" ]]; then
        echo ""
        echo "  Total PV capacity: ~${TOTAL_PV_SIZE}Gi"
    fi
fi

echo ""
```

### Phase 2: Build Backup Command

#### 2.1 Construct Velero Backup Command

```bash
echo "🛠️  Building backup command..."
echo ""

BACKUP_CMD="velero backup create \"$BACKUP_NAME\""

# Namespace inclusion/exclusion
if [[ -n "${INCLUDE_NAMESPACES}" ]]; then
    BACKUP_CMD="$BACKUP_CMD --include-namespaces=\"${INCLUDE_NAMESPACES}\""
    echo "  Including namespaces: ${INCLUDE_NAMESPACES}"
elif [[ -n "${EXCLUDE_NAMESPACES}" ]]; then
    BACKUP_CMD="$BACKUP_CMD --exclude-namespaces=\"${EXCLUDE_NAMESPACES}\""
    echo "  Excluding namespaces: ${EXCLUDE_NAMESPACES}"
else
    # Exclude Velero namespace by default
    BACKUP_CMD="$BACKUP_CMD --exclude-namespaces=velero"
    echo "  Backing up: All namespaces (except velero)"
fi

# Resource inclusion/exclusion
if [[ -n "${INCLUDE_RESOURCES}" ]]; then
    BACKUP_CMD="$BACKUP_CMD --include-resources=\"${INCLUDE_RESOURCES}\""
    echo "  Including resources: ${INCLUDE_RESOURCES}"
fi

if [[ -n "${EXCLUDE_RESOURCES}" ]]; then
    BACKUP_CMD="$BACKUP_CMD --exclude-resources=\"${EXCLUDE_RESOURCES}\""
    echo "  Excluding resources: ${EXCLUDE_RESOURCES}"
fi

# Label selector
if [[ -n "${SELECTOR}" ]]; then
    BACKUP_CMD="$BACKUP_CMD --selector=\"${SELECTOR}\""
    echo "  Label selector: ${SELECTOR}"
fi

# Snapshot volumes
if [[ "$SNAPSHOT_VOLUMES" == "true" ]]; then
    BACKUP_CMD="$BACKUP_CMD --snapshot-volumes=true"
    echo "  Volume snapshots: Enabled"
else
    BACKUP_CMD="$BACKUP_CMD --snapshot-volumes=false"
    echo "  Volume snapshots: Disabled"
fi

# TTL
BACKUP_CMD="$BACKUP_CMD --ttl=\"$TTL\""
echo "  Retention (TTL): $TTL"

# Wait for completion
if [[ "$WAIT" == "true" ]]; then
    BACKUP_CMD="$BACKUP_CMD --wait"
fi

echo ""
echo "Backup command:"
echo "  $BACKUP_CMD"
echo ""
```

### Phase 3: Create Backup

#### 3.1 Execute Backup

```bash
echo "💾 Creating backup..."
echo ""

BACKUP_START=$(date +%s)

# Execute backup
if eval "$BACKUP_CMD"; then
    echo ""
    echo "✅ Backup creation initiated: $BACKUP_NAME"
else
    echo ""
    echo "❌ Backup creation failed"
    exit 1
fi

# Monitor backup progress
if [[ "$WAIT" == "true" ]]; then
    echo ""
    echo "⏳ Waiting for backup to complete..."
    echo ""

    # Backup is already complete due to --wait flag
    # Just show the final status
    sleep 2
fi
```

### Phase 4: Verification

#### 4.1 Check Backup Status

```bash
echo ""
echo "🔍 Verifying backup..."
echo ""

# Get backup details
BACKUP_INFO=$(velero backup describe "$BACKUP_NAME" --details 2>/dev/null)

if [[ -z "$BACKUP_INFO" ]]; then
    echo "❌ Could not retrieve backup details"
    exit 1
fi

# Extract key information
BACKUP_STATUS=$(velero backup get "$BACKUP_NAME" -o json 2>/dev/null | jq -r '.status.phase')
BACKUP_ERRORS=$(velero backup get "$BACKUP_NAME" -o json 2>/dev/null | jq -r '.status.errors // 0')
BACKUP_WARNINGS=$(velero backup get "$BACKUP_NAME" -o json 2>/dev/null | jq -r '.status.warnings // 0')

echo "Backup Status: $BACKUP_STATUS"
echo "Errors: $BACKUP_ERRORS"
echo "Warnings: $BACKUP_WARNINGS"

if [[ "$BACKUP_STATUS" == "Completed" ]]; then
    echo "✅ Backup completed successfully"
elif [[ "$BACKUP_STATUS" == "PartiallyFailed" ]]; then
    echo "⚠️  Backup partially failed"
    echo ""
    echo "Check errors with:"
    echo "  velero backup logs $BACKUP_NAME"
elif [[ "$BACKUP_STATUS" == "Failed" ]]; then
    echo "❌ Backup failed"
    echo ""
    echo "Check errors with:"
    echo "  velero backup logs $BACKUP_NAME"
    exit 1
elif [[ "$BACKUP_STATUS" == "InProgress" ]]; then
    echo "⏳ Backup still in progress"
else
    echo "❓ Unknown backup status: $BACKUP_STATUS"
fi

echo ""
```

#### 4.2 Display Backup Details

```bash
echo "📋 Backup Details:"
echo ""

velero backup describe "$BACKUP_NAME" | head -50

echo ""
echo "Resource summary:"
BACKUP_JSON=$(velero backup get "$BACKUP_NAME" -o json 2>/dev/null)

# Show backed up resources
echo "$BACKUP_JSON" | jq -r '.status.progress.itemsBackedUp // 0' | \
    xargs -I {} echo "  Items backed up: {}"

echo "$BACKUP_JSON" | jq -r '.status.progress.totalItems // 0' | \
    xargs -I {} echo "  Total items: {}"

# Show volume snapshots
if [[ "$SNAPSHOT_VOLUMES" == "true" ]]; then
    SNAPSHOT_COUNT=$(echo "$BACKUP_JSON" | jq -r '.status.volumeSnapshotsCompleted // 0')
    echo "  Volume snapshots: $SNAPSHOT_COUNT"
fi

# Calculate backup duration
BACKUP_END=$(date +%s)
BACKUP_DURATION=$(( BACKUP_END - BACKUP_START ))
echo ""
echo "Backup duration: ${BACKUP_DURATION}s"

# Show backup location
BACKUP_LOCATION=$(echo "$BACKUP_JSON" | jq -r '.spec.storageLocation')
echo "Storage location: $BACKUP_LOCATION"

# Show backup size (if available)
BACKUP_SIZE=$(velero backup describe "$BACKUP_NAME" --details 2>/dev/null | grep "Resource List" -A 100 | grep "Total" | awk '{print $2}' || echo "Unknown")
echo "Backup size: $BACKUP_SIZE"

echo ""
```

### Phase 5: Summary and Next Steps

```bash
echo "✅ BACKUP COMPLETE"
echo "=================="
echo ""
echo "Backup name: $BACKUP_NAME"
echo "Status: $BACKUP_STATUS"
echo "Retention: $TTL"
echo ""
echo "Backup includes:"
if [[ -n "${INCLUDE_NAMESPACES}" ]]; then
    echo "  • Namespaces: ${INCLUDE_NAMESPACES}"
else
    echo "  • All namespaces (except velero)"
fi

if [[ "$SNAPSHOT_VOLUMES" == "true" ]]; then
    echo "  • Persistent volume snapshots"
fi

echo ""
echo "View backup details:"
echo "  velero backup describe $BACKUP_NAME"
echo ""
echo "View backup logs:"
echo "  velero backup logs $BACKUP_NAME"
echo ""
echo "Download backup:"
echo "  velero backup download $BACKUP_NAME"
echo ""
echo "Restore from this backup:"
echo "  cluster-code restore-cluster --backup-name $BACKUP_NAME"
echo "  # or"
echo "  velero restore create --from-backup $BACKUP_NAME"
echo ""
echo "List all backups:"
echo "  velero backup get"
echo ""
echo "Delete this backup:"
echo "  velero backup delete $BACKUP_NAME"
echo ""

if [[ $BACKUP_ERRORS -gt 0 || $BACKUP_WARNINGS -gt 0 ]]; then
    echo "⚠️  Review errors and warnings:"
    echo "  velero backup logs $BACKUP_NAME | grep -E 'error|warning'"
    echo ""
fi
```

## Backup Strategies

### Full Cluster Backup (default)

Backs up all resources and volumes:

```bash
cluster-code backup-cluster --backup-name full-backup-$(date +%Y%m%d)
```

### Namespace-Specific Backup

Backup specific namespaces:

```bash
cluster-code backup-cluster \
  --backup-name prod-backup \
  --include-namespaces production,staging
```

### Application-Specific Backup

Backup by label selector:

```bash
cluster-code backup-cluster \
  --backup-name app-backup \
  --selector app=myapp,tier=frontend
```

### Configuration-Only Backup

Exclude volumes for faster backup:

```bash
cluster-code backup-cluster \
  --backup-name config-backup \
  --snapshot-volumes=false
```

### Scheduled Backups

Create a Velero schedule for automated backups:

```bash
# Daily backups at 3 AM, retain for 30 days
velero schedule create daily-backup \
  --schedule="0 3 * * *" \
  --ttl 720h

# Weekly full backups on Sundays
velero schedule create weekly-backup \
  --schedule="0 2 * * 0" \
  --ttl 2160h
```

## Examples

### Example 1: Full cluster backup

```bash
cluster-code backup-cluster --backup-name production-full-backup
```

### Example 2: Backup specific namespaces

```bash
cluster-code backup-cluster \
  --backup-name app-backup \
  --include-namespaces default,myapp,monitoring
```

### Example 3: Backup without volume snapshots

```bash
cluster-code backup-cluster \
  --backup-name config-only \
  --snapshot-volumes=false
```

### Example 4: Backup with custom retention

```bash
cluster-code backup-cluster \
  --backup-name quarterly-backup \
  --ttl 2160h
```

### Example 5: Backup specific resources

```bash
cluster-code backup-cluster \
  --backup-name deployments-backup \
  --include-resources deployments,services,configmaps
```

## Common Issues

### Issue: "BackupStorageLocation is unavailable"

**Solution**: Check backup location configuration:

```bash
velero backup-location get
kubectl describe backupstoragelocation -n velero
```

### Issue: Volume snapshots failing

**Solution**: Verify snapshot configuration:

```bash
velero snapshot-location get
kubectl get volumesnapshotclass
```

### Issue: Backup stuck in "InProgress"

**Solution**: Check Velero logs:

```bash
kubectl logs -n velero -l app.kubernetes.io/name=velero
```

## Best Practices

1. **Regular backups** - Schedule daily backups for production
2. **Test restores** - Regularly test restore procedures
3. **Offsite storage** - Use cloud storage in different region
4. **Retention policy** - Balance storage costs with recovery needs
5. **Monitor backups** - Set up alerts for backup failures
6. **Namespace organization** - Group related resources for selective backups
7. **Document procedures** - Maintain runbooks for disaster recovery

## Related Commands

- `restore-cluster`: Restore from backup
- `cluster-diagnose`: Check cluster health before backup
- `aws-cluster-delete`: Delete cluster (after backup)
- `velero backup get`: List all backups
- `velero schedule create`: Schedule automated backups
