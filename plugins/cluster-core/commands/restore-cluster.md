---
name: restore-cluster
description: Restore cluster from Velero backup
category: backup-restore
parameters:
  - name: backup-name
    description: Name of the backup to restore from
    required: true
  - name: restore-name
    description: Name for this restore operation (auto-generated if not provided)
    required: false
  - name: include-namespaces
    description: Comma-separated list of namespaces to restore
    required: false
  - name: exclude-namespaces
    description: Comma-separated list of namespaces to exclude
    required: false
  - name: include-resources
    description: Resources to restore (e.g., pods,deployments)
    required: false
  - name: exclude-resources
    description: Resources to exclude from restore
    required: false
  - name: namespace-mappings
    description: Map namespaces (format: old:new,old2:new2)
    required: false
  - name: restore-pvs
    description: Restore persistent volumes
    type: boolean
    default: true
  - name: wait
    description: Wait for restore to complete
    type: boolean
    default: true
tags:
  - restore
  - disaster-recovery
  - velero
  - data-protection
---

# Cluster Restore

Restore Kubernetes cluster resources and persistent volumes from a Velero backup.

## Overview

This command restores cluster state from backups with:

- **Full Cluster Restore**: Restore all resources and volumes
- **Selective Restore**: Choose specific namespaces or resources
- **Namespace Remapping**: Restore to different namespaces
- **Volume Restore**: Restore persistent volumes from snapshots
- **Validation**: Pre-restore checks and post-restore verification

## Prerequisites

- `velero` CLI installed
- Velero server installed and running
- Access to backup storage location
- Valid backup available
- `kubectl` cluster admin access

## Important Considerations

### When to Restore

- **Disaster Recovery**: Complete cluster failure
- **Data Recovery**: Accidental deletion
- **Migration**: Move workloads to new cluster
- **Testing**: Validate backup integrity

### Restore Behavior

- **Creates resources**: Does not update existing resources
- **Conflicts**: Existing resources may block restore
- **Order**: Resources restored in dependency order
- **Volumes**: Requires compatible storage class

## Workflow

### Phase 1: Pre-restore Validation

#### 1.1 Verify Velero and Backup

```bash
BACKUP_NAME="${BACKUP_NAME}"
RESTORE_NAME="${RESTORE_NAME:-restore-$BACKUP_NAME-$(date +%Y%m%d-%H%M%S)}"
RESTORE_PVS="${RESTORE_PVS:-true}"
WAIT="${WAIT:-true}"

echo "🔍 Validating restore prerequisites..."
echo ""

# Check Velero installation
if ! command -v velero &>/dev/null; then
    echo "❌ ERROR: Velero CLI not found"
    exit 1
fi

if ! kubectl get namespace velero &>/dev/null; then
    echo "❌ ERROR: Velero not installed in cluster"
    exit 1
fi

echo "✅ Velero installation verified"

# Check if backup exists
if ! velero backup get "$BACKUP_NAME" &>/dev/null; then
    echo "❌ ERROR: Backup not found: $BACKUP_NAME"
    echo ""
    echo "Available backups:"
    velero backup get
    exit 1
fi

# Get backup details
BACKUP_STATUS=$(velero backup get "$BACKUP_NAME" -o json | jq -r '.status.phase')
BACKUP_EXPIRATION=$(velero backup get "$BACKUP_NAME" -o json | jq -r '.status.expiration')

echo "✅ Backup found: $BACKUP_NAME"
echo "   Status: $BACKUP_STATUS"
echo "   Expires: $BACKUP_EXPIRATION"

if [[ "$BACKUP_STATUS" != "Completed" ]]; then
    echo "⚠️  WARNING: Backup status is $BACKUP_STATUS (not Completed)"
    echo ""
    echo "Continue anyway? (yes/no)"
    read -r CONFIRM
    if [[ "$CONFIRM" != "yes" ]]; then
        exit 0
    fi
fi

echo ""
```

#### 1.2 Analyze Backup Contents

```bash
echo "📊 Analyzing backup contents..."
echo ""

# Show backup details
velero backup describe "$BACKUP_NAME" --details | head -60

BACKUP_JSON=$(velero backup get "$BACKUP_NAME" -o json)

# Count resources in backup
TOTAL_ITEMS=$(echo "$BACKUP_JSON" | jq -r '.status.progress.totalItems // 0')
ITEMS_BACKED_UP=$(echo "$BACKUP_JSON" | jq -r '.status.progress.itemsBackedUp // 0')
VOLUME_SNAPSHOTS=$(echo "$BACKUP_JSON" | jq -r '.status.volumeSnapshotsCompleted // 0')

echo ""
echo "Backup contains:"
echo "  Total items: $TOTAL_ITEMS"
echo "  Items backed up: $ITEMS_BACKED_UP"
echo "  Volume snapshots: $VOLUME_SNAPSHOTS"

# Show namespaces in backup
echo ""
echo "Namespaces in backup:"
velero backup describe "$BACKUP_NAME" --details 2>/dev/null | \
    grep -A 100 "Namespaces:" | grep "^  " | head -20

echo ""
```

#### 1.3 Check Target Cluster

```bash
echo "🎯 Checking target cluster..."
echo ""

# Get current cluster context
CURRENT_CONTEXT=$(kubectl config current-context)
CURRENT_CLUSTER=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CURRENT_CONTEXT\")].context.cluster}")

echo "Target cluster: $CURRENT_CLUSTER"
echo "Context: $CURRENT_CONTEXT"
echo ""

# Check for existing resources that might conflict
if [[ -z "${INCLUDE_NAMESPACES}" ]]; then
    echo "Checking for potential conflicts..."

    # Check if key namespaces exist
    EXISTING_NS=$(kubectl get namespaces -o json | jq -r '.items[].metadata.name' | grep -v "^kube-" | grep -v "^velero$" | wc -l)

    if [[ $EXISTING_NS -gt 0 ]]; then
        echo "⚠️  WARNING: $EXISTING_NS existing namespaces found"
        echo ""
        echo "Existing namespaces:"
        kubectl get namespaces -o custom-columns=NAME:.metadata.name,STATUS:.status.phase --no-headers | grep -v "^kube-" | grep -v "^velero " | head -10
        echo ""
        echo "Restore may conflict with existing resources."
        echo "Consider using --include-namespaces or --namespace-mappings"
        echo ""
        echo "Continue with restore? (yes/no)"
        read -r CONFIRM
        if [[ "$CONFIRM" != "yes" ]]; then
            echo "Restore cancelled"
            exit 0
        fi
    fi
fi

echo ""
```

### Phase 2: Build Restore Command

#### 2.1 Construct Velero Restore Command

```bash
echo "🛠️  Building restore command..."
echo ""

RESTORE_CMD="velero restore create \"$RESTORE_NAME\" --from-backup=\"$BACKUP_NAME\""

# Namespace inclusion/exclusion
if [[ -n "${INCLUDE_NAMESPACES}" ]]; then
    RESTORE_CMD="$RESTORE_CMD --include-namespaces=\"${INCLUDE_NAMESPACES}\""
    echo "  Including namespaces: ${INCLUDE_NAMESPACES}"
elif [[ -n "${EXCLUDE_NAMESPACES}" ]]; then
    RESTORE_CMD="$RESTORE_CMD --exclude-namespaces=\"${EXCLUDE_NAMESPACES}\""
    echo "  Excluding namespaces: ${EXCLUDE_NAMESPACES}"
fi

# Resource inclusion/exclusion
if [[ -n "${INCLUDE_RESOURCES}" ]]; then
    RESTORE_CMD="$RESTORE_CMD --include-resources=\"${INCLUDE_RESOURCES}\""
    echo "  Including resources: ${INCLUDE_RESOURCES}"
fi

if [[ -n "${EXCLUDE_RESOURCES}" ]]; then
    RESTORE_CMD="$RESTORE_CMD --exclude-resources=\"${EXCLUDE_RESOURCES}\""
    echo "  Excluding resources: ${EXCLUDE_RESOURCES}"
fi

# Namespace mappings
if [[ -n "${NAMESPACE_MAPPINGS}" ]]; then
    RESTORE_CMD="$RESTORE_CMD --namespace-mappings=\"${NAMESPACE_MAPPINGS}\""
    echo "  Namespace mappings: ${NAMESPACE_MAPPINGS}"
fi

# Restore PVs
if [[ "$RESTORE_PVS" == "true" ]]; then
    RESTORE_CMD="$RESTORE_CMD --restore-volumes=true"
    echo "  Restore volumes: Enabled"
else
    RESTORE_CMD="$RESTORE_CMD --restore-volumes=false"
    echo "  Restore volumes: Disabled"
fi

# Wait for completion
if [[ "$WAIT" == "true" ]]; then
    RESTORE_CMD="$RESTORE_CMD --wait"
fi

echo ""
echo "Restore command:"
echo "  $RESTORE_CMD"
echo ""

echo "⚠️  FINAL CONFIRMATION"
echo "====================="
echo ""
echo "Ready to restore from backup: $BACKUP_NAME"
echo "Restore name: $RESTORE_NAME"
echo ""
echo "This will create resources in the cluster."
echo "Existing resources will NOT be modified."
echo ""
echo "Proceed with restore? (yes/no)"
read -r FINAL_CONFIRM

if [[ "$FINAL_CONFIRM" != "yes" ]]; then
    echo "Restore cancelled"
    exit 0
fi

echo ""
```

### Phase 3: Execute Restore

#### 3.1 Perform Restore

```bash
echo "♻️  Executing restore..."
echo ""

RESTORE_START=$(date +%s)

# Execute restore
if eval "$RESTORE_CMD"; then
    echo ""
    echo "✅ Restore initiated: $RESTORE_NAME"
else
    echo ""
    echo "❌ Restore failed to start"
    exit 1
fi

# Monitor progress
if [[ "$WAIT" == "true" ]]; then
    echo ""
    echo "⏳ Waiting for restore to complete..."
    echo ""
    sleep 2
fi
```

### Phase 4: Verification

#### 4.1 Check Restore Status

```bash
echo ""
echo "🔍 Verifying restore..."
echo ""

# Get restore status
RESTORE_STATUS=$(velero restore get "$RESTORE_NAME" -o json | jq -r '.status.phase')
RESTORE_ERRORS=$(velero restore get "$RESTORE_NAME" -o json | jq -r '.status.errors // 0')
RESTORE_WARNINGS=$(velero restore get "$RESTORE_NAME" -o json | jq -r '.status.warnings // 0')

echo "Restore Status: $RESTORE_STATUS"
echo "Errors: $RESTORE_ERRORS"
echo "Warnings: $RESTORE_WARNINGS"

if [[ "$RESTORE_STATUS" == "Completed" ]]; then
    echo "✅ Restore completed successfully"
elif [[ "$RESTORE_STATUS" == "PartiallyFailed" ]]; then
    echo "⚠️  Restore partially failed"
    echo ""
    echo "Check errors with:"
    echo "  velero restore logs $RESTORE_NAME"
elif [[ "$RESTORE_STATUS" == "Failed" ]]; then
    echo "❌ Restore failed"
    echo ""
    echo "Check errors with:"
    echo "  velero restore logs $RESTORE_NAME"
    exit 1
elif [[ "$RESTORE_STATUS" == "InProgress" ]]; then
    echo "⏳ Restore still in progress"
    echo ""
    echo "Monitor with:"
    echo "  velero restore describe $RESTORE_NAME"
fi

echo ""
```

#### 4.2 Verify Restored Resources

```bash
echo "📋 Verifying restored resources..."
echo ""

# Show restore details
velero restore describe "$RESTORE_NAME" | head -60

# Get restored resource counts
RESTORE_JSON=$(velero restore get "$RESTORE_NAME" -o json)

ITEMS_RESTORED=$(echo "$RESTORE_JSON" | jq -r '.status.progress.itemsRestored // 0')
TOTAL_ITEMS=$(echo "$RESTORE_JSON" | jq -r '.status.progress.totalItems // 0')

echo ""
echo "Restore progress:"
echo "  Items restored: $ITEMS_RESTORED"
echo "  Total items: $TOTAL_ITEMS"

# Check pod status
echo ""
echo "Checking pod status..."

RESTORED_NAMESPACES="${INCLUDE_NAMESPACES}"
if [[ -z "$RESTORED_NAMESPACES" ]]; then
    # Get namespaces from backup (excluding system namespaces)
    RESTORED_NAMESPACES=$(kubectl get namespaces -o json | \
        jq -r '.items[].metadata.name' | \
        grep -v "^kube-" | grep -v "^velero$" | \
        head -10 | tr '\n' ',' | sed 's/,$//')
fi

if [[ -n "$RESTORED_NAMESPACES" ]]; then
    for NS in $(echo "$RESTORED_NAMESPACES" | tr ',' ' '); do
        if kubectl get namespace "$NS" &>/dev/null; then
            POD_COUNT=$(kubectl get pods -n "$NS" --no-headers 2>/dev/null | wc -l)
            RUNNING_PODS=$(kubectl get pods -n "$NS" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)

            echo "  Namespace $NS: $RUNNING_PODS/$POD_COUNT pods running"
        fi
    done
fi

# Calculate restore duration
RESTORE_END=$(date +%s)
RESTORE_DURATION=$(( RESTORE_END - RESTORE_START ))

echo ""
echo "Restore duration: ${RESTORE_DURATION}s"
echo ""
```

### Phase 5: Post-Restore Checks

#### 5.1 Health Verification

```bash
echo "🏥 Running post-restore health checks..."
echo ""

# Check for pods not in Running state
PROBLEMATIC_PODS=$(kubectl get pods --all-namespaces \
    --field-selector=status.phase!=Running,status.phase!=Succeeded \
    --no-headers 2>/dev/null | wc -l)

if [[ $PROBLEMATIC_PODS -gt 0 ]]; then
    echo "⚠️  $PROBLEMATIC_PODS pods not in Running/Succeeded state"
    echo ""
    kubectl get pods --all-namespaces \
        --field-selector=status.phase!=Running,status.phase!=Succeeded \
        -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,STATUS:.status.phase,REASON:.status.reason \
        | head -20
    echo ""
else
    echo "✅ All pods healthy"
fi

# Check PVCs
if [[ "$RESTORE_PVS" == "true" ]]; then
    echo ""
    echo "Checking Persistent Volume Claims..."

    PVC_TOTAL=$(kubectl get pvc --all-namespaces --no-headers 2>/dev/null | wc -l)
    PVC_BOUND=$(kubectl get pvc --all-namespaces --field-selector=status.phase=Bound --no-headers 2>/dev/null | wc -l)

    if [[ $PVC_TOTAL -gt 0 ]]; then
        echo "  PVCs: $PVC_BOUND/$PVC_TOTAL bound"

        if [[ $PVC_BOUND -lt $PVC_TOTAL ]]; then
            echo ""
            echo "  Unbound PVCs:"
            kubectl get pvc --all-namespaces --field-selector=status.phase!=Bound \
                -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,STATUS:.status.phase \
                | head -10
        fi
    else
        echo "  No PVCs found"
    fi
fi

echo ""
```

### Phase 6: Summary

```bash
echo "✅ RESTORE COMPLETE"
echo "==================="
echo ""
echo "Restore name: $RESTORE_NAME"
echo "From backup: $BACKUP_NAME"
echo "Status: $RESTORE_STATUS"
echo ""
echo "Restored:"
echo "  Items: $ITEMS_RESTORED / $TOTAL_ITEMS"

if [[ $RESTORE_ERRORS -gt 0 ]]; then
    echo "  Errors: $RESTORE_ERRORS"
fi

if [[ $RESTORE_WARNINGS -gt 0 ]]; then
    echo "  Warnings: $RESTORE_WARNINGS"
fi

echo ""
echo "View restore details:"
echo "  velero restore describe $RESTORE_NAME"
echo ""
echo "View restore logs:"
echo "  velero restore logs $RESTORE_NAME"
echo ""
echo "List all restores:"
echo "  velero restore get"
echo ""
echo "Delete this restore record:"
echo "  velero restore delete $RESTORE_NAME"
echo ""

if [[ $RESTORE_ERRORS -gt 0 || $RESTORE_WARNINGS -gt 0 || $PROBLEMATIC_PODS -gt 0 ]]; then
    echo "⚠️  Post-restore actions needed:"
    echo ""

    if [[ $RESTORE_ERRORS -gt 0 || $RESTORE_WARNINGS -gt 0 ]]; then
        echo "1. Review restore errors and warnings:"
        echo "   velero restore logs $RESTORE_NAME | grep -E 'error|warning'"
        echo ""
    fi

    if [[ $PROBLEMATIC_PODS -gt 0 ]]; then
        echo "2. Investigate unhealthy pods:"
        echo "   kubectl get pods -A --field-selector=status.phase!=Running"
        echo ""
    fi

    echo "3. Verify application functionality"
    echo ""
fi

echo "Next steps:"
echo "  • Test critical application workflows"
echo "  • Verify data integrity"
echo "  • Check service endpoints and ingresses"
echo "  • Review logs for any errors"
echo "  • Update DNS/load balancer configurations if needed"
echo ""
```

## Restore Scenarios

### Full Cluster Restore

Restore everything from backup:

```bash
cluster-code restore-cluster --backup-name full-backup-20241031
```

### Selective Namespace Restore

Restore specific namespaces only:

```bash
cluster-code restore-cluster \
  --backup-name production-backup \
  --include-namespaces myapp,database
```

### Restore to Different Namespace

Restore with namespace remapping:

```bash
cluster-code restore-cluster \
  --backup-name prod-backup \
  --namespace-mappings production:staging
```

### Configuration-Only Restore

Restore without volumes:

```bash
cluster-code restore-cluster \
  --backup-name config-backup \
  --restore-pvs=false
```

## Examples

### Example 1: Complete restore

```bash
cluster-code restore-cluster --backup-name daily-backup-20241031
```

### Example 2: Restore specific application

```bash
cluster-code restore-cluster \
  --backup-name weekly-backup \
  --include-namespaces myapp \
  --restore-pvs=true
```

### Example 3: Test restore in dev environment

```bash
cluster-code restore-cluster \
  --backup-name prod-backup \
  --namespace-mappings production:dev-test \
  --restore-name test-restore
```

## Common Issues

### Issue: Resources already exist

**Error**: "the object already exists"

**Solution**: Resources aren't updated. Either delete existing resources or use different namespace:

```bash
kubectl delete namespace conflicting-namespace
# or
cluster-code restore-cluster --namespace-mappings old:new
```

### Issue: PVC not binding

**Solution**: Check storage class compatibility:

```bash
kubectl get pvc -A
kubectl get storageclass
```

### Issue: Pods stuck in Pending

**Solution**: Check events and node resources:

```bash
kubectl describe pod <pod-name>
kubectl get nodes
kubectl top nodes
```

## Best Practices

1. **Test restores regularly** - Validate backups work
2. **Restore to test cluster first** - Verify before production restore
3. **Document restore procedures** - Maintain runbooks
4. **Check compatibility** - Ensure Kubernetes versions match
5. **Plan for conflicts** - Use namespace mappings when needed
6. **Verify data integrity** - Test application functionality post-restore
7. **Monitor restoration** - Watch for errors during restore

## Related Commands

- `backup-cluster`: Create cluster backups
- `cluster-diagnose`: Verify cluster health post-restore
- `velero restore get`: List all restores
- `velero backup get`: List available backups
