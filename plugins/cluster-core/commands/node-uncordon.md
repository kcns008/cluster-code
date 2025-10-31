---
name: node-uncordon
description: Mark one or more nodes as schedulable to allow new pods
category: node-management
parameters:
  - name: node
    description: Node name or pattern to uncordon (supports wildcards)
    required: true
  - name: selector
    description: Label selector to uncordon multiple nodes (e.g., node-pool=workers)
    required: false
  - name: verify-health
    description: Verify node health before uncordoning
    type: boolean
    default: true
tags:
  - nodes
  - maintenance
  - scheduling
---

# Node Uncordon

Mark nodes as schedulable to allow new pods to be scheduled after maintenance or troubleshooting.

## Overview

Uncordoning returns nodes to normal scheduling operation:

**Typical maintenance workflow:**
1. Cordon - Mark unschedulable
2. Drain - Evict existing pods
3. Maintain - Perform upgrades or fixes
4. **Uncordon** - Return to service (this command)

**What uncordoning does:**
- Removes `unschedulable` flag from node
- Allows Kubernetes scheduler to place new pods
- Does NOT automatically reschedule pods that were evicted

**What uncordoning does NOT do:**
- Does not move pods back to the node
- Does not guarantee immediate pod placement
- Does not affect existing pod placement

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
VERIFY_HEALTH="${VERIFY_HEALTH:-true}"

echo "🔍 Identifying nodes to uncordon..."

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
        kubectl get nodes -o custom-columns=NAME:.metadata.name,STATUS:.status.conditions[-1].type,SCHEDULABLE:.spec.unschedulable
        exit 1
    fi

    NODE_COUNT=1
    echo "   Target node: $NODES"
fi

echo ""
```

### Phase 2: Pre-uncordon Health Check

#### 2.1 Verify Node Health

```bash
if [[ "$VERIFY_HEALTH" == "true" ]]; then
    echo "🏥 Verifying node health..."
    echo ""

    UNHEALTHY_NODES=""
    WARNINGS=0

    for NODE_NAME in $NODES; do
        echo "Checking: $NODE_NAME"

        NODE_INFO=$(kubectl get node "$NODE_NAME" -o json)

        # Check Ready status
        READY_STATUS=$(echo "$NODE_INFO" | jq -r '.status.conditions[] | select(.type=="Ready") | .status')
        READY_REASON=$(echo "$NODE_INFO" | jq -r '.status.conditions[] | select(.type=="Ready") | .reason')

        if [[ "$READY_STATUS" != "True" ]]; then
            echo "  ⚠️  Node not Ready (Status: $READY_STATUS, Reason: $READY_REASON)"
            UNHEALTHY_NODES="$UNHEALTHY_NODES $NODE_NAME"
            WARNINGS=$((WARNINGS + 1))
        else
            echo "  ✅ Node is Ready"
        fi

        # Check for pressure conditions
        MEMORY_PRESSURE=$(echo "$NODE_INFO" | jq -r '.status.conditions[] | select(.type=="MemoryPressure") | .status')
        DISK_PRESSURE=$(echo "$NODE_INFO" | jq -r '.status.conditions[] | select(.type=="DiskPressure") | .status')
        PID_PRESSURE=$(echo "$NODE_INFO" | jq -r '.status.conditions[] | select(.type=="PIDPressure") | .status')

        if [[ "$MEMORY_PRESSURE" == "True" ]]; then
            echo "  ⚠️  Memory Pressure detected"
            WARNINGS=$((WARNINGS + 1))
        fi

        if [[ "$DISK_PRESSURE" == "True" ]]; then
            echo "  ⚠️  Disk Pressure detected"
            WARNINGS=$((WARNINGS + 1))
        fi

        if [[ "$PID_PRESSURE" == "True" ]]; then
            echo "  ⚠️  PID Pressure detected"
            WARNINGS=$((WARNINGS + 1))
        fi

        # Check kubelet version
        KUBELET_VERSION=$(echo "$NODE_INFO" | jq -r '.status.nodeInfo.kubeletVersion')
        echo "  Kubelet: $KUBELET_VERSION"

        # Check if already schedulable
        SCHEDULABLE=$(echo "$NODE_INFO" | jq -r '.spec.unschedulable // false')
        if [[ "$SCHEDULABLE" == "false" ]]; then
            echo "  ℹ️  Node is already schedulable"
        else
            echo "  Status: Cordoned (will be uncordoned)"
        fi

        echo ""
    done

    if [[ $WARNINGS -gt 0 ]]; then
        echo "⚠️  Found $WARNINGS health warnings"
        echo ""

        if [[ -n "$UNHEALTHY_NODES" ]]; then
            echo "Nodes not in Ready state:$UNHEALTHY_NODES"
            echo ""
            echo "Continue with uncordon anyway? (yes/no)"
            read -r CONFIRM

            if [[ "$CONFIRM" != "yes" ]]; then
                echo "❌ Uncordon cancelled"
                exit 1
            fi
        fi
    else
        echo "✅ All nodes are healthy"
    fi
else
    echo "⚠️  Health check skipped (--verify-health=false)"
fi

echo ""
```

### Phase 3: Uncordon Nodes

#### 3.1 Execute Uncordon

```bash
echo "🔓 Uncordoning nodes..."
echo ""

SUCCESS_COUNT=0
ALREADY_SCHEDULABLE=0
FAILED_COUNT=0

for NODE_NAME in $NODES; do
    # Check if already schedulable
    SCHEDULABLE=$(kubectl get node "$NODE_NAME" -o jsonpath='{.spec.unschedulable}' 2>/dev/null)

    if [[ "$SCHEDULABLE" != "true" ]]; then
        echo "  ℹ️  $NODE_NAME - already schedulable"
        ALREADY_SCHEDULABLE=$((ALREADY_SCHEDULABLE + 1))
        continue
    fi

    # Uncordon the node
    if kubectl uncordon "$NODE_NAME" &>/dev/null; then
        echo "  ✅ $NODE_NAME - uncordoned"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "  ❌ $NODE_NAME - failed to uncordon"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
done

echo ""
echo "Results:"
echo "  Successfully uncordoned: $SUCCESS_COUNT"
if [[ $ALREADY_SCHEDULABLE -gt 0 ]]; then
    echo "  Already schedulable: $ALREADY_SCHEDULABLE"
fi
if [[ $FAILED_COUNT -gt 0 ]]; then
    echo "  Failed: $FAILED_COUNT"
fi
```

### Phase 4: Verification and Monitoring

#### 4.1 Verify Uncordon Status

```bash
echo ""
echo "🔍 Verifying uncordon status..."
echo ""

kubectl get nodes $(echo $NODES | tr '\n' ' ') -o custom-columns=\
NAME:.metadata.name,\
STATUS:.status.conditions[-1].type,\
SCHEDULABLE:.spec.unschedulable,\
PODS:.status.allocatable.pods,\
ROLES:.metadata.labels.node-role\\.kubernetes\\.io/*

echo ""
```

#### 4.2 Check Cluster Capacity

```bash
echo "📊 Cluster Scheduling Capacity:"
echo ""

TOTAL_NODES=$(kubectl get nodes --no-headers | wc -l)
SCHEDULABLE_NODES=$(kubectl get nodes -o json | jq '[.items[] | select(.spec.unschedulable != true)] | length')
UNSCHEDULABLE_NODES=$((TOTAL_NODES - SCHEDULABLE_NODES))

echo "  Total nodes: $TOTAL_NODES"
echo "  Schedulable: $SCHEDULABLE_NODES"
echo "  Unschedulable (cordoned): $UNSCHEDULABLE_NODES"

# Calculate percentage
SCHEDULABLE_PCT=$(( SCHEDULABLE_NODES * 100 / TOTAL_NODES ))
echo "  Schedulable capacity: ${SCHEDULABLE_PCT}%"

if [[ $SCHEDULABLE_PCT -eq 100 ]]; then
    echo "  ✅ All nodes are schedulable"
fi

echo ""
```

#### 4.3 Monitor Pod Scheduling

```bash
echo "🔄 Monitoring new pod placement..."
echo ""

# Check for pending pods that might now be scheduled
PENDING_PODS=$(kubectl get pods --all-namespaces --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l)

if [[ $PENDING_PODS -gt 0 ]]; then
    echo "ℹ️  $PENDING_PODS pods are currently Pending"
    echo ""
    echo "Pending pods may now be scheduled to uncordoned nodes:"
    kubectl get pods --all-namespaces --field-selector status.phase=Pending -o custom-columns=\
NAMESPACE:.metadata.namespace,\
NAME:.metadata.name,\
AGE:.metadata.creationTimestamp | head -10

    echo ""
    echo "Monitor scheduling with:"
    echo "  kubectl get pods --all-namespaces -w"
else
    echo "✅ No pending pods"
fi

echo ""
```

### Phase 5: Summary and Next Steps

```bash
echo "✅ UNCORDON COMPLETE"
echo "===================="
echo ""
echo "Uncordoned $SUCCESS_COUNT node(s)"
echo ""
echo "Node(s) are now available for scheduling new pods."
echo ""
echo "Next steps:"
echo ""
echo "1. Monitor pod distribution across nodes:"
echo "   kubectl get pods --all-namespaces -o wide | grep '$(echo $NODES | tr ' ' '\\|')'"
echo ""
echo "2. Check node resource utilization:"
echo "   kubectl top nodes $(echo $NODES | tr '\n' ' ')"
echo ""
echo "3. Verify cluster autoscaler behavior (if enabled):"
echo "   kubectl get pods -n kube-system -l app=cluster-autoscaler"
echo ""
echo "4. Monitor node events:"
for NODE_NAME in $NODES; do
    echo "   kubectl get events --field-selector involvedObject.name=$NODE_NAME"
done
echo ""
echo "Note: Pods that were evicted during drain will NOT automatically"
echo "return to these nodes. New pods or rescheduled pods will use the"
echo "uncordoned nodes based on scheduler decisions."
echo ""
```

## Scheduling Behavior After Uncordon

### Immediate Effects
- Node becomes available for new pod placement
- Scheduler can assign pending pods to the node
- Cluster autoscaler may scale down other nodes

### What Does NOT Happen
- Existing pods do not move to uncordoned node
- Evicted pods are not automatically recreated there
- Pod distribution is not automatically rebalanced

### To Trigger Pod Rescheduling

If you want to force pod redistribution:

```bash
# Option 1: Scale deployment to trigger new pod placement
kubectl scale deployment <name> --replicas=0
kubectl scale deployment <name> --replicas=<original-count>

# Option 2: Restart deployment (rolling restart)
kubectl rollout restart deployment <name>

# Option 3: Use descheduler (if installed)
kubectl create job --from=cronjob/descheduler manual-deschedule
```

## Common Scenarios

### Scenario 1: Return node to service after maintenance

```bash
# Node maintenance completed
cluster-code node-uncordon --node worker-01

# Verify ready for workloads
kubectl get node worker-01
kubectl top node worker-01
```

### Scenario 2: Uncordon entire node pool after upgrade

```bash
# Uncordon all nodes in pool
cluster-code node-uncordon --selector node-pool=workers-v2

# Monitor pod distribution
watch kubectl get pods -o wide
```

### Scenario 3: Restore cluster capacity during incident

```bash
# Quickly uncordon all nodes
cluster-code node-uncordon --node "*"

# Check for pending pods
kubectl get pods -A --field-selector status.phase=Pending
```

## Examples

### Example 1: Uncordon single node

```bash
cluster-code node-uncordon --node ip-10-0-1-42.ec2.internal
```

### Example 2: Uncordon multiple nodes by pattern

```bash
cluster-code node-uncordon --node "gke-prod-cluster-pool-1-*"
```

### Example 3: Uncordon all nodes in a specific pool

```bash
cluster-code node-uncordon --selector eks.amazonaws.com/nodegroup=workers-spot
```

### Example 4: Uncordon without health check (emergency)

```bash
cluster-code node-uncordon --node worker-05 --verify-health=false
```

### Example 5: Uncordon all cordoned nodes

```bash
# Find all cordoned nodes
CORDONED=$(kubectl get nodes -o json | jq -r '.items[] | select(.spec.unschedulable==true) | .metadata.name')

# Uncordon them
for node in $CORDONED; do
  cluster-code node-uncordon --node $node
done
```

## Important Considerations

### Pod Affinity/Anti-Affinity
Uncordoning a node doesn't override pod affinity rules. Pods will only schedule if:
- Node labels match pod affinity requirements
- Anti-affinity rules allow placement

### Taints and Tolerations
If node has taints, only pods with matching tolerations can schedule, even after uncordon.

### Resource Availability
Scheduler only places pods if node has sufficient:
- CPU
- Memory
- Ephemeral storage
- Custom resources (GPUs, etc.)

### Cluster Autoscaler
If cluster autoscaler is enabled:
- May scale down uncordoned nodes if underutilized
- May prefer newly uncordoned nodes over scaling up
- Respects PodDisruptionBudgets

## Troubleshooting

### Pods not scheduling to uncordoned node

**Check node conditions:**
```bash
kubectl describe node <node-name>
```

**Check node resources:**
```bash
kubectl top node <node-name>
```

**Check pod requirements:**
```bash
kubectl describe pod <pod-name>
# Look for nodeSelector, affinity, tolerations
```

### Node shows as Ready but pods failing

**Check kubelet logs:**
```bash
# For systemd-based systems
journalctl -u kubelet -f

# For containerized kubelet
kubectl logs -n kube-system <kubelet-pod>
```

**Check node events:**
```bash
kubectl get events --field-selector involvedObject.name=<node-name>
```

## Related Commands

- `node-cordon`: Mark node as unschedulable
- `node-drain`: Safely evict pods from node
- `cluster-diagnose`: Analyze cluster health
- `kubectl describe node`: View detailed node status
- `kubectl top nodes`: View node resource usage
