---
name: azure-cluster-upgrade
description: Upgrade AKS cluster to a new Kubernetes version
category: cloud-lifecycle
tools:
  - Bash(az:*)
  - Bash(kubectl:*)
parameters:
  - name: name
    description: Cluster name
    required: true
    type: string
  - name: resource-group
    description: Resource group name
    required: true
    type: string
  - name: version
    description: Target Kubernetes version
    required: true
    type: string
  - name: control-plane-only
    description: Upgrade control plane only (not node pools)
    required: false
    type: boolean
    default: false
  - name: node-image-only
    description: Upgrade node images only
    required: false
    type: boolean
    default: false
examples:
  - azure-cluster-upgrade --name my-aks --resource-group my-rg --version 1.29.0
  - azure-cluster-upgrade --name my-aks --resource-group my-rg --version 1.29.0 --control-plane-only
  - azure-cluster-upgrade --name my-aks --resource-group my-rg --node-image-only
---

# Azure AKS Cluster Upgrade

Safely upgrade AKS clusters to new Kubernetes versions with comprehensive validation and rollback capabilities.

## Your Role

Guide users through safe cluster upgrades with:
- Pre-upgrade validation
- Compatibility checking
- Staged upgrade approach
- Health monitoring
- Rollback procedures

## Task Workflow

### Phase 1: Pre-Upgrade Validation

1. **Get current cluster information**:
   ```bash
   CLUSTER_INFO=$(az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP -o json)

   CURRENT_VERSION=$(echo $CLUSTER_INFO | jq -r '.kubernetesVersion')
   LOCATION=$(echo $CLUSTER_INFO | jq -r '.location')
   echo "Current Kubernetes Version: $CURRENT_VERSION"
   echo "Target Version: $TARGET_VERSION"
   echo "Location: $LOCATION"
   echo ""
   ```

2. **Check available versions**:
   ```bash
   echo "Checking available versions..."
   AVAILABLE_VERSIONS=$(az aks get-versions --location $LOCATION -o json)

   # Check if target version is available
   IS_AVAILABLE=$(echo $AVAILABLE_VERSIONS | jq -r --arg ver "$TARGET_VERSION" \
     '.orchestrators[] | select(.orchestratorVersion==$ver) | .orchestratorVersion')

   if [[ -z "$IS_AVAILABLE" ]]; then
     echo "❌ Version $TARGET_VERSION is not available in $LOCATION"
     echo ""
     echo "Available versions:"
     echo $AVAILABLE_VERSIONS | jq -r '.orchestrators[].orchestratorVersion' | sort -V
     exit 1
   fi

   echo "✅ Version $TARGET_VERSION is available"
   echo ""
   ```

3. **Validate upgrade path**:
   ```bash
   # Check if version upgrade is supported
   CURRENT_MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
   CURRENT_MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
   TARGET_MAJOR=$(echo $TARGET_VERSION | cut -d. -f1)
   TARGET_MINOR=$(echo $TARGET_VERSION | cut -d. -f2)

   MINOR_DIFF=$((TARGET_MINOR - CURRENT_MINOR))

   if [[ $MINOR_DIFF -gt 1 ]]; then
     echo "⚠️  WARNING: Skipping minor versions is not supported"
     echo "Current: $CURRENT_VERSION, Target: $TARGET_VERSION"
     echo "You must upgrade one minor version at a time"
     echo ""
     exit 1
   fi

   if [[ $MINOR_DIFF -lt 0 ]]; then
     echo "❌ Downgrade not supported"
     echo "Current: $CURRENT_VERSION, Target: $TARGET_VERSION"
     exit 1
   fi

   echo "✅ Upgrade path validated"
   echo ""
   ```

4. **Pre-upgrade cluster health check**:
   ```bash
   echo "Running pre-upgrade health checks..."
   echo ""

   # Check node status
   NODES_NOT_READY=$(kubectl get nodes --no-headers | grep -v " Ready " | wc -l)
   if [[ $NODES_NOT_READY -gt 0 ]]; then
     echo "⚠️  WARNING: $NODES_NOT_READY nodes are not Ready"
     kubectl get nodes
     echo ""
   fi

   # Check pod health
   PODS_NOT_RUNNING=$(kubectl get pods --all-namespaces --no-headers | \
     grep -v "Running\|Completed" | wc -l)
   if [[ $PODS_NOT_RUNNING -gt 0 ]]; then
     echo "⚠️  WARNING: $PODS_NOT_RUNNING pods are not in Running state"
     echo ""
   fi

   # Check for pod disruption budgets
   PDB_COUNT=$(kubectl get pdb --all-namespaces --no-headers 2>/dev/null | wc -l)
   if [[ $PDB_COUNT -gt 0 ]]; then
     echo "ℹ️  Found $PDB_COUNT Pod Disruption Budgets (will be respected during upgrade)"
     echo ""
   fi

   echo "✅ Pre-upgrade checks complete"
   echo ""
   ```

### Phase 2: Backup and Preparation

1. **Backup cluster configuration**:
   ```bash
   echo "💾 Backing up cluster configuration..."
   BACKUP_DIR="./cluster-upgrade-backup-$CLUSTER_NAME-$(date +%Y%m%d-%H%M%S)"
   mkdir -p "$BACKUP_DIR"

   # Save cluster info
   echo $CLUSTER_INFO > "$BACKUP_DIR/cluster-info.json"

   # Backup critical resources
   kubectl get all,cm,secret,pvc,ing --all-namespaces -o yaml > "$BACKUP_DIR/all-resources.yaml"

   # Backup cluster-scoped resources
   kubectl get clusterrole,clusterrolebinding,sc,pv -o yaml > "$BACKUP_DIR/cluster-resources.yaml"

   echo "✅ Backup saved to $BACKUP_DIR"
   echo ""
   ```

2. **Check for deprecated APIs**:
   ```bash
   echo "Checking for deprecated APIs in target version..."

   # Common deprecations (this is simplified - use pluto or kubectl-convert for real checks)
   if [[ "$TARGET_MINOR" -ge 25 ]]; then
     echo "  Checking for PodSecurityPolicy (removed in 1.25+)"
     PSP_COUNT=$(kubectl get psp --no-headers 2>/dev/null | wc -l)
     if [[ $PSP_COUNT -gt 0 ]]; then
       echo "  ⚠️  WARNING: $PSP_COUNT PodSecurityPolicies found (deprecated)"
       echo "     Migrate to Pod Security Standards before upgrading"
     fi
   fi

   echo "✅ API compatibility check complete"
   echo ""
   ```

### Phase 3: Upgrade Execution

1. **Show upgrade plan**:
   ```bash
   echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
   echo "UPGRADE PLAN"
   echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
   echo ""
   echo "Cluster: $CLUSTER_NAME"
   echo "Current Version: $CURRENT_VERSION"
   echo "Target Version: $TARGET_VERSION"
   echo ""

   if [[ "$NODE_IMAGE_ONLY" == "true" ]]; then
     echo "Upgrade Type: Node images only"
   elif [[ "$CONTROL_PLANE_ONLY" == "true" ]]; then
     echo "Upgrade Type: Control plane only"
   else
     echo "Upgrade Type: Full upgrade (control plane + all node pools)"
   fi
   echo ""

   # Get node pools
   NODE_POOLS=$(az aks nodepool list --cluster-name $CLUSTER_NAME \
     --resource-group $RESOURCE_GROUP -o json)
   NODE_POOL_COUNT=$(echo $NODE_POOLS | jq 'length')

   echo "Node Pools: $NODE_POOL_COUNT"
   echo $NODE_POOLS | jq -r '.[] | "  - \(.name): \(.count) nodes (K8s \(.orchestratorVersion))"'
   echo ""
   echo "Estimated Time:"
   if [[ "$CONTROL_PLANE_ONLY" == "true" ]]; then
     echo "  Control plane: 10-15 minutes"
   else
     TOTAL_NODES=$(echo $NODE_POOLS | jq '[.[].count] | add')
     UPGRADE_TIME=$((15 + TOTAL_NODES * 5))
     echo "  Total: ~${UPGRADE_TIME} minutes"
   fi
   echo ""
   echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
   echo ""

   read -p "Proceed with upgrade? [y/N]: " CONFIRM
   if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
     echo "Upgrade cancelled"
     exit 0
   fi
   ```

2. **Upgrade control plane**:
   ```bash
   if [[ "$NODE_IMAGE_ONLY" != "true" ]]; then
     echo ""
     echo "🔄 Upgrading control plane to $TARGET_VERSION..."
     echo ""

     START_TIME=$(date +%s)

     az aks upgrade \
       --name $CLUSTER_NAME \
       --resource-group $RESOURCE_GROUP \
       --kubernetes-version $TARGET_VERSION \
       --control-plane-only \
       --yes

     if [[ $? -eq 0 ]]; then
       ELAPSED=$(($(date +%s) - START_TIME))
       echo ""
       echo "✅ Control plane upgraded successfully (${ELAPSED}s)"
       echo ""

       # Verify control plane version
       NEW_CP_VERSION=$(az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP \
         --query kubernetesVersion -o tsv)
       echo "Control plane version: $NEW_CP_VERSION"
       echo ""
     else
       echo ""
       echo "❌ Control plane upgrade failed"
       exit 1
     fi
   fi
   ```

3. **Upgrade node pools** (if not control-plane-only):
   ```bash
   if [[ "$CONTROL_PLANE_ONLY" != "true" ]]; then
     echo "🔄 Upgrading node pools..."
     echo ""

     # Upgrade each node pool
     echo $NODE_POOLS | jq -r '.[].name' | while read POOL_NAME; do
       echo "  Upgrading node pool: $POOL_NAME"

       if [[ "$NODE_IMAGE_ONLY" == "true" ]]; then
         # Node image upgrade only
         az aks nodepool upgrade \
           --cluster-name $CLUSTER_NAME \
           --resource-group $RESOURCE_GROUP \
           --name $POOL_NAME \
           --node-image-only \
           --yes
       else
         # Full Kubernetes version upgrade
         az aks nodepool upgrade \
           --cluster-name $CLUSTER_NAME \
           --resource-group $RESOURCE_GROUP \
           --name $POOL_NAME \
           --kubernetes-version $TARGET_VERSION \
           --yes
       fi

       if [[ $? -eq 0 ]]; then
         echo "  ✅ Node pool $POOL_NAME upgraded"
       else
         echo "  ❌ Node pool $POOL_NAME upgrade failed"
       fi
       echo ""
     done
   fi
   ```

### Phase 4: Post-Upgrade Verification

1. **Verify cluster version**:
   ```bash
   echo "Verifying upgrade..."
   echo ""

   FINAL_VERSION=$(az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP \
     --query kubernetesVersion -o tsv)

   echo "Final Cluster Version: $FINAL_VERSION"

   if [[ "$FINAL_VERSION" == "$TARGET_VERSION" ]]; then
     echo "✅ Cluster version verified"
   else
     echo "⚠️  Cluster version mismatch (expected: $TARGET_VERSION, got: $FINAL_VERSION)"
   fi
   echo ""
   ```

2. **Check node status**:
   ```bash
   echo "Node Status:"
   kubectl get nodes -o wide

   NODES_NOT_READY=$(kubectl get nodes --no-headers | grep -v " Ready " | wc -l)
   if [[ $NODES_NOT_READY -gt 0 ]]; then
     echo ""
     echo "⚠️  WARNING: $NODES_NOT_READY nodes are not Ready"
   else
     echo ""
     echo "✅ All nodes are Ready"
   fi
   echo ""
   ```

3. **Verify pod health**:
   ```bash
   echo "Checking pod health..."
   PODS_NOT_RUNNING=$(kubectl get pods --all-namespaces --no-headers | \
     grep -v "Running\|Completed" | wc -l)

   if [[ $PODS_NOT_RUNNING -gt 0 ]]; then
     echo "⚠️  WARNING: $PODS_NOT_RUNNING pods are not Running"
     echo ""
     kubectl get pods --all-namespaces | grep -v "Running\|Completed"
   else
     echo "✅ All pods are healthy"
   fi
   echo ""
   ```

4. **Run cluster diagnostics**:
   ```bash
   echo "Running post-upgrade diagnostics..."
   cluster-code diagnose --severity-threshold warning
   ```

### Phase 5: Upgrade Report

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "UPGRADE COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Cluster: $CLUSTER_NAME"
echo "Previous Version: $CURRENT_VERSION"
echo "New Version: $FINAL_VERSION"
echo ""
echo "Backup Location: $BACKUP_DIR"
echo ""
echo "Next Steps:"
echo "1. Monitor application performance"
echo "2. Check application logs for deprecation warnings"
echo "3. Update CI/CD pipelines if needed"
echo "4. Update documentation with new version"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

## Rollback Procedure

If upgrade fails or causes issues:

```bash
# For control plane issues
az aks update \
  --name $CLUSTER_NAME \
  --resource-group $RESOURCE_GROUP \
  --kubernetes-version $CURRENT_VERSION

# For node pool issues
az aks nodepool upgrade \
  --cluster-name $CLUSTER_NAME \
  --resource-group $RESOURCE_GROUP \
  --name $POOL_NAME \
  --kubernetes-version $CURRENT_VERSION

# Restore from backup if needed
kubectl apply -f $BACKUP_DIR/all-resources.yaml
```

## Best Practices

1. **Test in non-production first**
2. **Upgrade during maintenance window**
3. **One minor version at a time**
4. **Upgrade control plane before node pools**
5. **Monitor application health during upgrade**
6. **Keep backups for 30 days**
7. **Review Kubernetes changelog**

## References

- **AKS Upgrade**: https://learn.microsoft.com/en-us/azure/aks/upgrade-cluster
- **Kubernetes Release Notes**: https://kubernetes.io/releases/
