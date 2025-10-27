---
name: node-status
description: Show detailed node status and resource utilization
args:
  - name: node
    description: Specific node name (optional, shows all if not specified)
    required: false
    hint: node-name
  - name: detailed
    description: Show detailed node information including pods and conditions
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
color: green
---

# Node Status Analysis

I'll provide comprehensive information about cluster node health, resource utilization, and pod distribution.

## Node Overview

```bash
# Basic node information
kubectl get nodes -o wide
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.capacity.cpu}{"\t"}{.status.capacity.memory}{"\t"}{.status.capacity.ephemeral-storage}{"\t"}{.status.allocatable.cpu}{"\t"}{.status.allocatable.memory}{"\n"}{end}'
```

## Node Health Conditions

```bash
# Node conditions analysis
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{range .status.conditions[*]}{.type}{"="}{.status}{" - "}{.reason}{": "}{.message}{"\n"}{end}{"\n"}'

# Find unhealthy nodes
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{range .status.conditions[*]}{.type}{"="}{.status}{"\n"}{end}{"\n"}' | grep -A 5 "False"
```

{{#if detailed}}
## Detailed Node Analysis

```bash
# Resource utilization
kubectl top nodes 2>/dev/null || echo "Metrics server not installed"

# Pod distribution per node
kubectl get pods --all-namespaces -o wide --sort-by=.spec.nodeName

# Taints and tolerations
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\nTaints: "}{range .spec.taints[*]}{.key}{"="}{.value}{":"}{.effect}{" "}{end}{"\n\n"}{end}'

# Node labels
kubectl get nodes --show-labels
```

## Specific Node Details

{{#if node}}
**Analysis for node: {{node}}**

```bash
# Detailed node description
kubectl describe node {{node}}

# Pods running on this node
kubectl get pods --all-namespaces --field-selector=spec.nodeName={{node}} -o wide

# Resource usage for this node's pods
kubectl top pods --all-namespaces --field-selector=spec.nodeName={{node}} 2>/dev/null || echo "Pod metrics not available"
```
{{/if}}
{{/if}}

## Node Capacity Analysis

```bash
# Cluster resource summary
kubectl describe nodes | grep -A 5 "Allocated resources"

# Resource pressure detection
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{range .status.conditions[*]}{.type}{"="}{.status}{"\n"}{end}{"\n"}' | grep -A 1 "MemoryPressure\|DiskPressure\|PIDPressure"
```

## Troubleshooting Information

I'll help identify:

### 🚨 Critical Issues
- **NotReady Nodes**: Nodes that are not responding
- **Resource Pressure**: CPU, memory, disk, or PID pressure
- **Network Issues**: Connectivity problems between nodes
- **Storage Issues**: Disk space or storage class problems

### 📊 Performance Metrics
- **CPU Utilization**: Current usage vs. capacity
- **Memory Usage**: Memory consumption and available space
- **Disk Usage**: Storage consumption on nodes
- **Pod Density**: Number of pods per node vs. limits

### 🔧 Optimization Opportunities
- **Resource Balancing**: Distribute workloads more evenly
- **Node Scaling**: Add or remove nodes based on demand
- **Taint Management**: Optimize node taints and tolerations
- **Pod Scheduling**: Improve pod placement strategies

## Quick Actions

Based on the analysis, I can help you:
- **Drain a node**: `kubectl drain <node-name> --ignore-daemonsets`
- **Uncordon a node**: `kubectl uncordon <node-name>`
- **Label nodes**: `kubectl label nodes <node-name> <key>=<value>`
- **Add taints**: `kubectl taint nodes <node-name> <key>=<value>:<effect>`

## Node Maintenance

### Pre-maintenance Checklist
- Drain workloads safely
- Check for critical applications
- Verify backup status
- Plan maintenance window

### Post-maintenance Verification
- Confirm node is Ready
- Verify pod health
- Check resource utilization
- Monitor application performance

Would you like me to proceed with the node status analysis?