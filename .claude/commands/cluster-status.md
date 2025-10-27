---
name: cluster-status
description: Show comprehensive cluster status and health overview
args:
  - name: namespace
    description: Namespace to check (default: all)
    required: false
    hint: --namespace
  - name: detailed
    description: Show detailed resource information
    required: false
    hint: --detailed
tools:
  - Bash
  - Grep
  - Read
permissions:
  allow:
    - Bash(kubectl:*)
    - Bash(oc:*)
model: sonnet
color: green
---

# Cluster Status Overview

I'll provide a comprehensive overview of your cluster's health, resources, and current state.

## Cluster Information

```bash
# Basic cluster info
kubectl cluster-info
kubectl version --short

# Node status
kubectl get nodes -o wide

# Namespace overview
kubectl get namespaces
```

## Resource Summary

```bash
# Pod status across all namespaces
kubectl get pods --all-namespaces --field-selector=status.phase!=Running --no-headers | wc -l
echo "Non-running pods: $(kubectl get pods --all-namespaces --field-selector=status.phase!=Running --no-headers | wc -l)"

# Resource quotas and limits
kubectl get resourcequotas --all-namespaces 2>/dev/null || echo "No resource quotas found"

# Storage classes
kubectl get storageclass
```

## Health Checks

```bash
# System pods status
kubectl get pods -n kube-system

# Recent events (last hour)
kubectl get events --all-namespaces --field-selector=type=Warning --sort-by='.lastTimestamp' | tail -20

# Persistent volume claims
kubectl get pvc --all-namespaces --field-selector=status.phase!=Bound
```

## Detailed Analysis (if --detailed)

```bash
# Node resource utilization
kubectl top nodes 2>/dev/null || echo "Metrics server not installed"

# Pod resource utilization
kubectl top pods --all-namespaces 2>/dev/null || echo "Pod metrics not available"

# Service endpoints
kubectl get endpoints --all-namespaces --field-selector=endpoints==[]

# Ingress status
kubectl get ingress --all-namespaces 2>/dev/null || echo "No ingress resources found"
```

## OpenShift Specific (if detected)

```bash
# Check if OpenShift
if command -v oc >/dev/null 2>&1; then
  echo "OpenShift cluster detected"
  oc get clusterversion
  oc get operators --all-namespaces
  oc get projects
fi
```

## Summary Report

I'll analyze the output and provide:
- ✅ Overall cluster health status
- ⚠️  Any detected issues or warnings
- 📊 Resource utilization summary
- 🔧 Recommended actions if needed