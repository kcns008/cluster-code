---
name: node-cordon
description: Mark one or more nodes as unschedulable to prevent new pods
category: node-management
parameters:
  - name: node
    description: Node name or pattern to cordon (supports wildcards)
    required: true
  - name: selector
    description: Label selector to cordon multiple nodes (e.g., node-role.kubernetes.io/worker)
    required: false
tags:
  - nodes
  - maintenance
  - scheduling
---

# Node Cordon

Mark nodes as unschedulable to prevent new pods from being scheduled while allowing existing pods to continue running.

## Overview

Cordoning a node is typically the first step in node maintenance:

1. **Cordon** - Mark unschedulable (this command)
2. **Drain** - Safely evict existing pods
3. **Perform maintenance** - Upgrade, patch, or replace node
4. **Uncordon** - Mark schedulable again

**Use cases:**
- Preparing nodes for maintenance or upgrades
- Isolating problematic nodes
- Gradual node pool replacement
- Testing pod rescheduling

## Prerequisites

- `kubectl` configured with cluster access
- Appropriate RBAC permissions:
  - `nodes/get`
  - `nodes/update`

## Workflow

### Phase 1: Identify Nodes

#### 1.1 Parse Node Selection

```bash
NODE_INPUT="${NODE}"
LABEL_SELECTOR="${LABEL_SELECTOR}"

echo "🔍 Identifying nodes to cordon..."

if [[ -n "$LABEL_SELECTOR" ]]; then
    # Select nodes by label
    echo "   Using label selector: $LABEL_SELECTOR"

    NODES=$(kubectl get nodes -l "$LABEL_SELECTOR" -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$NODES" ]]; then
        echo "❌ No nodes found matching selector: $LABEL_SELECTOR"
        exit 1
    fi

    NODE_COUNT=$(echo "$NODES" | wc -w)
    echo "   Found $NODE_COUNT nodes:"
    echo "$NODES" | tr ' ' '\n' | sed 's/^/     - /'

elif [[ "$NODE_INPUT" == *"*"* ]]; then
    # Wildcard pattern matching
    PATTERN=$(echo "$NODE_INPUT" | sed 's/\*/.*/')
    echo "   Using pattern: $NODE_INPUT"

    NODES=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | grep -E "^${PATTERN}$")

    if [[ -z "$NODES" ]]; then
        echo "❌ No nodes found matching pattern: $NODE_INPUT"
        exit 1
    fi

    NODE_COUNT=$(echo "$NODES" | wc -l)
    echo "   Found $NODE_COUNT nodes:"
    echo "$NODES" | sed 's/^/     - /'

else
    # Single node name
    NODES="$NODE_INPUT"

    # Verify node exists
    if ! kubectl get node "$NODES" &>/dev/null; then
        echo "❌ Node not found: $NODES"
        echo ""
        echo "Available nodes:"
        kubectl get nodes -o custom-columns=NAME:.metadata.name,STATUS:.status.conditions[-1].type,ROLES:.metadata.labels.node-role\\.kubernetes\\.io/*
        exit 1
    fi

    NODE_COUNT=1
    echo "   Target node: $NODES"
fi

echo ""
```

### Phase 2: Pre-cordon Analysis

#### 2.1 Check Node Status

```bash
echo "📊 Analyzing nodes..."
echo ""

for NODE_NAME in $NODES; do
    echo "Node: $NODE_NAME"

    # Get node status
    NODE_INFO=$(kubectl get node "$NODE_NAME" -o json)

    READY_STATUS=$(echo "$NODE_INFO" | jq -r '.status.conditions[] | select(.type=="Ready") | .status')
    SCHEDULABLE=$(echo "$NODE_INFO" | jq -r '.spec.unschedulable // false')

    echo "  Ready: $READY_STATUS"
    echo "  Schedulable: $([ "$SCHEDULABLE" == "false" ] && echo "Yes" || echo "No (already cordoned)")"

    # Count pods
    POD_COUNT=$(kubectl get pods --all-namespaces --field-selector spec.nodeName="$NODE_NAME" --no-headers 2>/dev/null | wc -l)
    echo "  Running Pods: $POD_COUNT"

    # Get node role
    ROLE=$(echo "$NODE_INFO" | jq -r '.metadata.labels["node-role.kubernetes.io/control-plane"] // .metadata.labels["node-role.kubernetes.io/master"] // "worker"')
    if [[ "$ROLE" != "worker" ]]; then
        echo "  Role: control-plane/master"
    fi

    # Check for taints
    TAINTS=$(echo "$NODE_INFO" | jq -r '.spec.taints // [] | length')
    if [[ $TAINTS -gt 0 ]]; then
        echo "  Taints: $TAINTS"
    fi

    echo ""
done
```

### Phase 3: Cordon Nodes

#### 3.1 Execute Cordon

```bash
echo "🔒 Cordoning nodes..."
echo ""

SUCCESS_COUNT=0
ALREADY_CORDONED=0
FAILED_COUNT=0

for NODE_NAME in $NODES; do
    # Check if already cordoned
    SCHEDULABLE=$(kubectl get node "$NODE_NAME" -o jsonpath='{.spec.unschedulable}' 2>/dev/null)

    if [[ "$SCHEDULABLE" == "true" ]]; then
        echo "  ℹ️  $NODE_NAME - already cordoned"
        ALREADY_CORDONED=$((ALREADY_CORDONED + 1))
        continue
    fi

    # Cordon the node
    if kubectl cordon "$NODE_NAME" &>/dev/null; then
        echo "  ✅ $NODE_NAME - cordoned"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "  ❌ $NODE_NAME - failed to cordon"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
done

echo ""
echo "Results:"
echo "  Successfully cordoned: $SUCCESS_COUNT"
if [[ $ALREADY_CORDONED -gt 0 ]]; then
    echo "  Already cordoned: $ALREADY_CORDONED"
fi
if [[ $FAILED_COUNT -gt 0 ]]; then
    echo "  Failed: $FAILED_COUNT"
fi
```

### Phase 4: Verification

#### 4.1 Verify Cordon Status

```bash
echo ""
echo "🔍 Verifying cordon status..."
echo ""

kubectl get nodes $(echo $NODES | tr '\n' ' ') -o custom-columns=\
NAME:.metadata.name,\
STATUS:.status.conditions[-1].type,\
SCHEDULABLE:.spec.unschedulable,\
ROLES:.metadata.labels.node-role\\.kubernetes\\.io/*

# Check cluster capacity
echo ""
echo "📊 Cluster Scheduling Capacity:"

TOTAL_NODES=$(kubectl get nodes --no-headers | wc -l)
SCHEDULABLE_NODES=$(kubectl get nodes -o json | jq '[.items[] | select(.spec.unschedulable != true)] | length')
UNSCHEDULABLE_NODES=$((TOTAL_NODES - SCHEDULABLE_NODES))

echo "  Total nodes: $TOTAL_NODES"
echo "  Schedulable: $SCHEDULABLE_NODES"
echo "  Unschedulable (cordoned): $UNSCHEDULABLE_NODES"

if [[ $SCHEDULABLE_NODES -eq 0 ]]; then
    echo ""
    echo "⚠️  WARNING: No schedulable nodes remaining!"
    echo "   New pods cannot be scheduled until nodes are uncordoned"
fi

echo ""
echo "✅ CORDON COMPLETE"
echo "=================="
echo ""
echo "Cordoned $SUCCESS_COUNT node(s)"
echo ""
echo "Next steps:"
echo ""
echo "1. Review running pods on cordoned nodes:"
echo "   kubectl get pods --all-namespaces -o wide | grep -E '$(echo $NODES | tr ' ' '|')'"
echo ""
echo "2. Drain nodes to evict pods (optional):"
for NODE_NAME in $NODES; do
    echo "   cluster-code node-drain --node $NODE_NAME"
done
echo ""
echo "3. Perform maintenance on nodes"
echo ""
echo "4. Uncordon nodes when ready:"
for NODE_NAME in $NODES; do
    echo "   cluster-code node-uncordon --node $NODE_NAME"
done
echo ""
```

## Node States

| State | Schedulable | Pods Running | Use Case |
|-------|-------------|--------------|----------|
| **Normal** | Yes | Yes | Regular operation |
| **Cordoned** | No | Yes | Preventing new pods, prep for drain |
| **Drained** | No | No | Node empty, ready for maintenance |
| **Uncordoned** | Yes | Maybe | Back in rotation |

## Common Scenarios

### Scenario 1: Prepare single node for maintenance

```bash
# Cordon node
cluster-code node-cordon --node worker-01

# Verify
kubectl get node worker-01
# Shows: SchedulingDisabled

# Pods still running
kubectl get pods -A -o wide | grep worker-01
```

### Scenario 2: Cordon all worker nodes in a pool

```bash
# Cordon by label
cluster-code node-cordon --selector node-pool=workers-v1

# Cordon by pattern
cluster-code node-cordon --node "worker-*"
```

### Scenario 3: Isolate problematic node

```bash
# Cordon to prevent new pods
cluster-code node-cordon --node problematic-node-07

# Investigate issues
kubectl describe node problematic-node-07
kubectl logs -n kube-system <kubelet-pod>
```

## Examples

### Example 1: Cordon single node

```bash
cluster-code node-cordon --node ip-10-0-1-42.ec2.internal
```

### Example 2: Cordon multiple nodes by pattern

```bash
cluster-code node-cordon --node "gke-prod-cluster-pool-1-*"
```

### Example 3: Cordon all nodes in a specific pool

```bash
cluster-code node-cordon --selector eks.amazonaws.com/nodegroup=workers-spot
```

### Example 4: Cordon nodes with specific instance type

```bash
cluster-code node-cordon --selector node.kubernetes.io/instance-type=t3.medium
```

## Comparison: Cordon vs Drain vs Delete

| Action | Scheduling | Existing Pods | Node Exists | Reversible |
|--------|-----------|---------------|-------------|------------|
| **Cordon** | Disabled | Continue running | Yes | Yes (uncordon) |
| **Drain** | Disabled | Evicted | Yes | Yes (uncordon) |
| **Delete** | N/A | Terminated | No | No |

## Important Notes

1. **Cordoning is non-disruptive** - Existing pods continue running
2. **Not permanent** - Easily reversible with `uncordon`
3. **DaemonSets** - DaemonSet pods ignore cordon (will still schedule)
4. **StatefulSets** - Cordoning doesn't affect existing StatefulSet pods
5. **Cluster autoscaler** - May still scale cordoned node pools

## Related Commands

- `node-drain`: Safely evict pods from node
- `node-uncordon`: Mark node as schedulable again
- `cluster-diagnose`: Analyze node health
- `kubectl get nodes`: View all node statuses
