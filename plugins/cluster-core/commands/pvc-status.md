---
name: pvc-status
description: Analyze Persistent Volume Claims and storage resources
args:
  - name: pvc
    description: Specific PVC name (optional, shows all if not specified)
    required: false
    hint: pvc-name
  - name: namespace
    description: Namespace (default: all)
    required: false
    hint: --namespace
  - name: detailed
    description: Show detailed storage analysis including capacity and utilization
    required: false
    hint: --detailed
tools:
  - Bash
  - Grep
permissions:
  allow:
    - Bash(kubectl:*)
    - Bash(oc:*)
model: sonnet
color: yellow
---

# Persistent Volume Claim Analysis

I'll provide comprehensive analysis of your PVCs, persistent volumes, and storage resources.

## PVC Overview

```bash
# PVC status summary
kubectl get pvc {{#if namespace}}-n {{namespace}}{{/if}} -o wide

# Detailed PVC information
kubectl get pvc {{#if namespace}}-n {{namespace}}{{/if}} -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{.status.phase}{"\n"}{.spec.storageClassName}{"\n"}{.status.capacity.storage}{"\n"}{.spec.accessModes}{"\n\n"}{end}'

# Find PVCs with issues
kubectl get pvc {{#if namespace}}-n {{namespace}}{{/if}} --field-selector=status.phase!=Bound
```

## Storage Class Analysis

```bash
# Available storage classes
kubectl get storageclass

# Default storage class
kubectl get storageclass -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{.metadata.annotations.storageclass\.kubernetes\.io/is-default-class}{"\n"}{end}' | grep "true"

# Storage class details
kubectl get storageclass -o yaml | grep -A 10 -E "(provisioner|parameters|reclaimPolicy)"
```

## Persistent Volume Analysis

```bash
# Persistent volume status
kubectl get pv -o wide

# Volume usage by PVC
kubectl get pv -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.claimRef.namespace}{"\t"}{.spec.claimRef.name}{"\t"}{.status.phase}{"\n"}{end}'

# Unbound volumes and available capacity
kubectl get pv --field-selector=status.phase!=Bound -o wide
```

{{#if detailed}}
## Detailed Storage Analysis

### Capacity and Utilization

```bash
# Storage capacity summary
kubectl get pv -o jsonpath='{range .items[*]}{.spec.capacity.storage}{"\n"}{end}' | awk '{sum += $1} END {print "Total Storage Capacity: " sum "Gi"}'

# Used vs. Available storage
used_storage=$(kubectl get pvc --all-namespaces -o jsonpath='{range .items[*]}{.status.capacity.storage}{"\n"}{end}' | sed 's/Gi//' | awk '{sum += $1} END {print sum}')
total_storage=$(kubectl get pv -o jsonpath='{range .items[*]}{.spec.capacity.storage}{"\n"}{end}' | sed 's/Gi//' | awk '{sum += $1} END {print sum}')
echo "Storage Utilization: $used_storage Gi used / $total_storage Gi total"

# Storage class usage distribution
kubectl get pvc --all-namespaces -o jsonpath='{range .items[*]}{.spec.storageClassName}{"\n"}{end}' | sort | uniq -c
```

### Access Mode Analysis

```bash
# Access mode distribution
kubectl get pvc --all-namespaces -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.accessModes}{"\n"}{end}'

# ReadWriteOnce vs ReadWriteMany usage
rwo_count=$(kubectl get pvc --all-namespaces -o jsonpath='{range .items[*]}{.spec.accessModes[?(@=="ReadWriteOnce")]}{"\n"}{end}' | wc -l)
rwx_count=$(kubectl get pvc --all-namespaces -o jsonpath='{range .items[*]}{.spec.accessModes[?(@=="ReadWriteMany")]}{"\n"}{end}' | wc -l)
rox_count=$(kubectl get pvc --all-namespaces -o jsonpath='{range .items[*]}{.spec.accessModes[?(@=="ReadOnlyMany")]}{"\n"}{end}' | wc -l)

echo "Access Mode Usage:"
echo "  ReadWriteOnce: $rwo_count PVCs"
echo "  ReadWriteMany: $rwx_count PVCs"
echo "  ReadOnlyMany: $rox_count PVCs"
```
{{/if}}

{{#if pvc}}
## Specific PVC Analysis

**Analyzing PVC: {{pvc}} in namespace: {{namespace}}**

```bash
# PVC details
kubectl get pvc {{pvc}} -n {{namespace}} -o yaml

# Associated persistent volume
pv_name=$(kubectl get pvc {{pvc}} -n {{namespace}} -o jsonpath='{.spec.volumeName}')
if [ ! -z "$pv_name" ]; then
  echo "Persistent Volume: $pv_name"
  kubectl describe pv $pv_name
fi

# Pods using this PVC
kubectl get pods -n {{namespace}} -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{range .spec.volumes[*]}{.persistentVolumeClaim.claimName}{"\n"}{end}' | grep -B 1 {{pvc}}

# Recent events for this PVC
kubectl get events -n {{namespace}} --field-selector=involvedObject.name={{pvc}},involvedObject.kind=PersistentVolumeClaim --sort-by='.lastTimestamp'
```
{{/if}}

## Storage Issues Detection

### Common Problems

```bash
# PVCs stuck in Pending state
kubectl get pvc --all-namespaces --field-selector=status.phase=Pending -o wide

# PVCs with storage class issues
kubectl get pvc --all-namespaces -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.storageClassName}{"\t"}{.status.phase}{"\n"}{end}' | while read pvc sc phase; do
  if [ "$phase" != "Bound" ]; then
    echo "PVC $pvc with storage class $sc is $phase"
    # Check if storage class exists
    if ! kubectl get storageclass $sc >/dev/null 2>&1; then
      echo "  ❌ Storage class $sc does not exist"
    fi
  fi
done

# Volumes with issues
kubectl get pv --field-selector=status.phase!=Bound -o wide
```

### Capacity Issues

```bash
# Approaching capacity limits
kubectl get pv -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.capacity.storage}{"\t"}{.status.phase}{"\n"}{end}' | while read pv capacity phase; do
  if [ "$phase" = "Bound" ]; then
    echo "Volume $pv: $capacity ($phase)"
  else
    echo "Volume $pv: $capacity ($phase) - AVAILABLE"
  fi
done

# Storage class provisioning issues
kubectl get storageclass -o yaml | grep -A 5 -E "(provisioner|reclaimPolicy|volumeBindingMode)"
```

## Storage Optimization Recommendations

### 📊 Capacity Planning
- **Growth Monitoring**: Track storage usage trends
- **Capacity Alerts**: Set alerts for storage utilization
- **Class Selection**: Choose appropriate storage classes
- **Size Planning**: Right-size PVCs based on actual usage

### 🚀 Performance Optimization
- **Storage Tiers**: Use appropriate storage classes for performance needs
- **Access Patterns**: Choose access modes based on application requirements
- **IOPS Configuration**: Configure IOPS limits for performance-sensitive workloads
- **Volume Expansion**: Enable volume expansion for growing workloads

### 🔒 Security and Reliability
- **Backup Strategy**: Implement backup for persistent data
- **Replication**: Use replicated storage for critical data
- **Encryption**: Enable storage encryption for sensitive data
- **Access Control**: Implement proper RBAC for storage resources

### 💰 Cost Optimization
- **Storage Classes**: Use cost-effective storage classes for non-critical data
- **Lifecycle Management**: Implement automatic cleanup of unused volumes
- **Size Optimization**: Right-size volumes to avoid over-provisioning
- **Tiered Storage**: Move infrequently accessed data to cheaper storage

## Troubleshooting Guide

### PVC Stuck in Pending
1. **Check storage class**: Verify storage class exists and is functional
2. **Check resource quotas**: Ensure quotas allow storage provisioning
3. **Check provisioner**: Verify storage provisioner is running
4. **Check permissions**: Ensure proper RBAC permissions

### Volume Mount Issues
1. **Check volume binding**: Ensure PV is bound to PVC
2. **Check mount path**: Verify mount path exists in container
3. **Check permissions**: Ensure proper permissions for mount path
4. **Check storage class**: Verify storage class supports required features

### Performance Issues
1. **Monitor IOPS**: Check I/O operations per second
2. **Check latency**: Monitor storage latency metrics
3. **Review access modes**: Ensure appropriate access modes
4. **Optimize applications**: Review application I/O patterns

## Interactive Analysis

I can help you:

1. **Diagnose Issues**: Identify and resolve PVC and storage problems
2. **Plan Capacity**: Analyze usage patterns and plan for growth
3. **Optimize Performance**: Recommend storage configuration improvements
4. **Implement Best Practices**: Apply Kubernetes storage best practices

Would you like me to proceed with the comprehensive PVC analysis?