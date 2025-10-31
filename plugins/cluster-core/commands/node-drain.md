---
name: node-drain
description: Safely drain a node for maintenance with pod eviction and validation
category: node-management
tools:
  - Bash(kubectl:*)
parameters:
  - name: node
    description: Node name to drain
    required: true
    type: string
  - name: force
    description: Force drain even if pods not managed by controller
    required: false
    type: boolean
    default: false
  - name: ignore-daemonsets
    description: Ignore DaemonSet-managed pods
    required: false
    type: boolean
    default: true
  - name: delete-emptydir-data
    description: Delete pods using emptyDir
    required: false
    type: boolean
    default: false
  - name: grace-period
    description: Grace period for pod termination (seconds)
    required: false
    type: integer
    default: 30
  - name: timeout
    description: Drain timeout duration
    required: false
    type: string
    default: 5m
examples:
  - node-drain --node worker-node-1
  - node-drain --node worker-node-2 --force --delete-emptydir-data
---

# Node Drain

Safely evict all pods from a node for maintenance, upgrades, or decommissioning.

## Task Workflow

### Phase 1: Pre-Drain Validation

1. **Verify node exists**:
   ```bash
   kubectl get node $NODE_NAME || {
     echo "❌ Node not found: $NODE_NAME"
     exit 1
   }
   ```

2. **Get node information**:
   ```bash
   NODE_INFO=$(kubectl get node $NODE_NAME -o json)

   NODE_STATUS=$(echo $NODE_INFO | jq -r '.status.conditions[] | select(.type=="Ready") | .status')
   NODE_ROLE=$(echo $NODE_INFO | jq -r '.metadata.labels."node-role.kubernetes.io/control-plane" // "worker"')
   KUBELET_VERSION=$(echo $NODE_INFO | jq -r '.status.nodeInfo.kubeletVersion')

   echo "Node: $NODE_NAME"
   echo "Status: $NODE_STATUS"
   echo "Role: $NODE_ROLE"
   echo "Kubelet Version: $KUBELET_VERSION"
   echo ""
   ```

3. **Check pods on node**:
   ```bash
   PODS=$(kubectl get pods --all-namespaces --field-selector spec.nodeName=$NODE_NAME -o json)
   POD_COUNT=$(echo $PODS | jq '.items | length')

   echo "Pods on node: $POD_COUNT"
   echo ""

   if [[ $POD_COUNT -eq 0 ]]; then
     echo "ℹ️  No pods on node - drain not needed"
     exit 0
   fi

   # Show pod breakdown
   echo "Pod breakdown:"
   echo $PODS | jq -r '.items[] | "\(.metadata.namespace)/\(.metadata.name)"' | \
     awk -F/ '{ns[$1]++} END {for (n in ns) printf "  %s: %d pods\n", n, ns[n]}'
   echo ""

   # Check for DaemonSets
   DAEMONSET_PODS=$(echo $PODS | jq '[.items[] | select(.metadata.ownerReferences[]?.kind=="DaemonSet")] | length')
   if [[ $DAEMONSET_PODS -gt 0 ]]; then
     echo "ℹ️  $DAEMONSET_PODS DaemonSet pods (will be ignored with --ignore-daemonsets)"
   fi

   # Check for standalone pods
   STANDALONE_PODS=$(echo $PODS | jq '[.items[] | select(.metadata.ownerReferences | length == 0)] | length')
   if [[ $STANDALONE_PODS -gt 0 ]]; then
     echo "⚠️  $STANDALONE_PODS standalone pods (require --force to drain)"
     echo $PODS | jq -r '.items[] | select(.metadata.ownerReferences | length == 0) | "    - \(.metadata.namespace)/\(.metadata.name)"'
   fi
   echo ""
   ```

### Phase 2: Cordon Node

```bash
echo "🔒 Cordoning node..."
kubectl cordon $NODE_NAME

if [[ $? -eq 0 ]]; then
  echo "✅ Node cordoned (no new pods will be scheduled)"
else
  echo "❌ Failed to cordon node"
  exit 1
fi
echo ""
```

### Phase 3: Execute Drain

```bash
echo "🚰 Draining node..."
echo ""

# Build drain command
DRAIN_CMD="kubectl drain $NODE_NAME"
[[ "$IGNORE_DAEMONSETS" == "true" ]] && DRAIN_CMD="$DRAIN_CMD --ignore-daemonsets"
[[ "$FORCE" == "true" ]] && DRAIN_CMD="$DRAIN_CMD --force"
[[ "$DELETE_EMPTYDIR" == "true" ]] && DRAIN_CMD="$DRAIN_CMD --delete-emptydir-data"
DRAIN_CMD="$DRAIN_CMD --grace-period=$GRACE_PERIOD --timeout=$TIMEOUT"

# Execute drain
$DRAIN_CMD

DRAIN_EXIT=$?

if [[ $DRAIN_EXIT -eq 0 ]]; then
  echo ""
  echo "✅ Node drained successfully"
else
  echo ""
  echo "❌ Drain failed"
  echo ""
  echo "Common issues:"
  echo "- Standalone pods (use --force)"
  echo "- PodDisruptionBudgets preventing eviction"
  echo "- Pods using emptyDir (use --delete-emptydir-data)"
  exit 1
fi
```

### Phase 4: Verify Drain

```bash
echo ""
echo "Verifying drain..."

REMAINING_PODS=$(kubectl get pods --all-namespaces --field-selector spec.nodeName=$NODE_NAME --no-headers 2>/dev/null | grep -v DaemonSet | wc -l)

if [[ $REMAINING_PODS -eq 0 ]]; then
  echo "✅ All non-DaemonSet pods evicted"
else
  echo "⚠️  $REMAINING_PODS pods remaining"
  kubectl get pods --all-namespaces --field-selector spec.nodeName=$NODE_NAME
fi

echo ""
echo "Node is ready for maintenance"
echo ""
echo "To uncordon node when ready:"
echo "  kubectl uncordon $NODE_NAME"
```

## References

- https://kubernetes.io/docs/tasks/administer-cluster/safely-drain-node/
