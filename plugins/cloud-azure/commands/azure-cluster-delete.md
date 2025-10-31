---
name: azure-cluster-delete
description: Delete AKS or ARO clusters on Azure with safety checks
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
  - name: type
    description: Cluster type (aks or aro) - auto-detected if not specified
    required: false
    type: string
  - name: delete-resource-group
    description: Also delete the resource group
    required: false
    type: boolean
    default: false
  - name: backup
    description: Backup resources before deletion
    required: false
    type: boolean
    default: true
  - name: yes
    description: Skip confirmation prompts
    required: false
    type: boolean
    default: false
examples:
  - azure-cluster-delete --name my-aks --resource-group my-rg
  - azure-cluster-delete --name my-aro --resource-group my-rg --type aro
  - azure-cluster-delete --name dev-aks --resource-group dev-rg --yes --no-backup
---

# Azure Cluster Deletion

Safely delete AKS or ARO clusters with comprehensive backup and safety checks.

## Your Role

You are responsible for safely decommissioning Azure Kubernetes clusters while:
- Preventing accidental data loss
- Backing up critical resources
- Cleaning up associated resources
- Validating deletion safety
- Providing rollback options

## Task Workflow

### Phase 1: Pre-Deletion Validation

1. **Verify Azure authentication**:
   ```bash
   az account show || {
     echo "❌ Not authenticated to Azure"
     echo "Run: az login"
     exit 1
   }
   ```

2. **Auto-detect cluster type** (if not specified):
   ```bash
   if [[ -z "$CLUSTER_TYPE" ]]; then
     # Try AKS
     if az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
       CLUSTER_TYPE="aks"
     # Try ARO
     elif az aro show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
       CLUSTER_TYPE="aro"
     else
       echo "❌ Cluster not found: $CLUSTER_NAME"
       exit 1
     fi
   fi
   ```

3. **Get cluster information**:
   ```bash
   echo "📋 Cluster Information:"
   echo ""

   if [[ "$CLUSTER_TYPE" == "aks" ]]; then
     CLUSTER_INFO=$(az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP -o json)

     LOCATION=$(echo $CLUSTER_INFO | jq -r '.location')
     K8S_VERSION=$(echo $CLUSTER_INFO | jq -r '.kubernetesVersion')
     NODE_COUNT=$(echo $CLUSTER_INFO | jq -r '.agentPoolProfiles[].count' | awk '{sum+=$1} END {print sum}')
     PROVISIONING_STATE=$(echo $CLUSTER_INFO | jq -r '.provisioningState')

     echo "  Type: AKS"
     echo "  Name: $CLUSTER_NAME"
     echo "  Resource Group: $RESOURCE_GROUP"
     echo "  Location: $LOCATION"
     echo "  Kubernetes Version: $K8S_VERSION"
     echo "  Total Nodes: $NODE_COUNT"
     echo "  State: $PROVISIONING_STATE"
   else
     CLUSTER_INFO=$(az aro show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP -o json)

     LOCATION=$(echo $CLUSTER_INFO | jq -r '.location')
     OPENSHIFT_VERSION=$(echo $CLUSTER_INFO | jq -r '.clusterProfile.version')
     PROVISIONING_STATE=$(echo $CLUSTER_INFO | jq -r '.provisioningState')
     CONSOLE_URL=$(echo $CLUSTER_INFO | jq -r '.consoleProfile.url')

     echo "  Type: ARO"
     echo "  Name: $CLUSTER_NAME"
     echo "  Resource Group: $RESOURCE_GROUP"
     echo "  Location: $LOCATION"
     echo "  OpenShift Version: $OPENSHIFT_VERSION"
     echo "  State: $PROVISIONING_STATE"
     echo "  Console: $CONSOLE_URL"
   fi
   echo ""
   ```

### Phase 2: Safety Checks

1. **Check for production indicators**:
   ```bash
   echo "🔍 Running safety checks..."
   echo ""

   WARNINGS=0

   # Check cluster tags
   TAGS=$(echo $CLUSTER_INFO | jq -r '.tags // {}')
   ENV_TAG=$(echo $TAGS | jq -r '.Environment // .environment // ""')

   if [[ "$ENV_TAG" =~ ^(prod|production|prd)$ ]]; then
     echo "⚠️  WARNING: Cluster is tagged as PRODUCTION"
     WARNINGS=$((WARNINGS + 1))
   fi

   # Check node count
   if [[ "$CLUSTER_TYPE" == "aks" && $NODE_COUNT -gt 5 ]]; then
     echo "⚠️  WARNING: Large cluster ($NODE_COUNT nodes)"
     WARNINGS=$((WARNINGS + 1))
   fi

   # Check for persistent volumes
   PV_COUNT=$(kubectl get pv --no-headers 2>/dev/null | wc -l)
   if [[ $PV_COUNT -gt 0 ]]; then
     echo "⚠️  WARNING: $PV_COUNT Persistent Volumes found (data will be lost)"
     WARNINGS=$((WARNINGS + 1))
   fi

   # Check for load balancers
   LB_COUNT=$(kubectl get svc --all-namespaces --no-headers 2>/dev/null | grep LoadBalancer | wc -l)
   if [[ $LB_COUNT -gt 0 ]]; then
     echo "⚠️  INFO: $LB_COUNT Load Balancer services (will be deleted)"
   fi

   echo ""
   ```

2. **List associated resources**:
   ```bash
   echo "🔗 Associated Azure Resources:"
   echo ""

   # Get resources in the cluster's resource group
   RESOURCES=$(az resource list --resource-group $RESOURCE_GROUP -o json)
   RESOURCE_COUNT=$(echo $RESOURCES | jq 'length')

   echo "  Total resources in resource group: $RESOURCE_COUNT"
   echo ""
   echo "  Resource types:"
   echo $RESOURCES | jq -r '.[].type' | sort | uniq -c | awk '{printf "    - %s: %d\n", $2, $1}'
   echo ""

   # Check for managed resource group (AKS creates additional RG)
   if [[ "$CLUSTER_TYPE" == "aks" ]]; then
     NODE_RG=$(echo $CLUSTER_INFO | jq -r '.nodeResourceGroup')
     if [[ -n "$NODE_RG" && "$NODE_RG" != "null" ]]; then
       echo "  Managed Resource Group: $NODE_RG"
       NODE_RG_RESOURCES=$(az resource list --resource-group $NODE_RG -o json | jq 'length')
       echo "  Resources in managed RG: $NODE_RG_RESOURCES"
       echo ""
     fi
   fi
   ```

### Phase 3: Backup Resources

1. **Create backup** (if --backup enabled):
   ```bash
   if [[ "$BACKUP" == "true" ]]; then
     echo "💾 Backing up cluster resources..."
     echo ""

     BACKUP_DIR="./cluster-backup-$CLUSTER_NAME-$(date +%Y%m%d-%H%M%S)"
     mkdir -p "$BACKUP_DIR"

     # Backup all namespaces
     kubectl get namespaces -o yaml > "$BACKUP_DIR/namespaces.yaml"

     # Backup all resources in each namespace
     kubectl get namespaces --no-headers | awk '{print $1}' | while read NS; do
       echo "  📁 Backing up namespace: $NS"
       mkdir -p "$BACKUP_DIR/$NS"

       # Skip system namespaces for full backup
       if [[ ! "$NS" =~ ^(kube-|openshift-|default$) ]]; then
         kubectl get all,cm,secret,pvc,ing -n $NS -o yaml > "$BACKUP_DIR/$NS/all-resources.yaml" 2>/dev/null
       fi
     done

     # Backup cluster-scoped resources
     echo "  🌍 Backing up cluster-scoped resources"
     kubectl get clusterrole,clusterrolebinding,sc,pv -o yaml > "$BACKUP_DIR/cluster-resources.yaml" 2>/dev/null

     # Save cluster info
     echo $CLUSTER_INFO | jq '.' > "$BACKUP_DIR/cluster-info.json"

     # Create backup archive
     tar -czf "$BACKUP_DIR.tar.gz" -C "$(dirname $BACKUP_DIR)" "$(basename $BACKUP_DIR)"
     rm -rf "$BACKUP_DIR"

     echo ""
     echo "✅ Backup saved: $BACKUP_DIR.tar.gz"
     echo ""
   fi
   ```

2. **Export important data**:
   ```bash
   # Export Helm releases
   if command -v helm &>/dev/null; then
     echo "  📦 Exporting Helm releases"
     helm list --all-namespaces -o json > "$BACKUP_DIR/helm-releases.json" 2>/dev/null
   fi

   # Export ArgoCD applications (if installed)
   if kubectl get namespace argocd &>/dev/null; then
     echo "  📚 Exporting ArgoCD applications"
     kubectl get applications -n argocd -o yaml > "$BACKUP_DIR/argocd-apps.yaml" 2>/dev/null
   fi
   ```

### Phase 4: Confirmation

1. **Show deletion summary**:
   ```bash
   echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
   echo "⚠️  DELETION SUMMARY"
   echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
   echo ""
   echo "Cluster to delete:"
   echo "  Name: $CLUSTER_NAME"
   echo "  Type: $CLUSTER_TYPE"
   echo "  Resource Group: $RESOURCE_GROUP"
   echo ""
   echo "What will be deleted:"
   echo "  ✗ Cluster control plane"
   echo "  ✗ All worker nodes ($NODE_COUNT nodes)"
   echo "  ✗ All pods and containers"
   echo "  ✗ All persistent volumes ($PV_COUNT PVs)"
   echo "  ✗ All load balancers ($LB_COUNT LBs)"
   if [[ "$CLUSTER_TYPE" == "aks" ]]; then
     echo "  ✗ Managed resource group: $NODE_RG"
   fi

   if [[ "$DELETE_RESOURCE_GROUP" == "true" ]]; then
     echo "  ✗ Resource group: $RESOURCE_GROUP ($RESOURCE_COUNT resources)"
   fi
   echo ""

   if [[ "$BACKUP" == "true" ]]; then
     echo "✅ Backup created: $BACKUP_DIR.tar.gz"
   else
     echo "⚠️  No backup created (use --backup to create backup)"
   fi
   echo ""

   if [[ $WARNINGS -gt 0 ]]; then
     echo "⚠️  $WARNINGS warning(s) detected - review carefully before proceeding"
     echo ""
   fi
   echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
   ```

2. **Request confirmation** (unless --yes):
   ```bash
   if [[ "$YES" != "true" ]]; then
     echo ""
     echo "⚠️  THIS ACTION CANNOT BE UNDONE!"
     echo ""
     read -p "Type the cluster name to confirm deletion: " CONFIRM_NAME

     if [[ "$CONFIRM_NAME" != "$CLUSTER_NAME" ]]; then
       echo ""
       echo "❌ Cluster name does not match. Deletion cancelled."
       exit 0
     fi

     echo ""
     read -p "Are you absolutely sure you want to delete this cluster? [yes/NO]: " FINAL_CONFIRM

     if [[ ! "$FINAL_CONFIRM" =~ ^[Yy][Ee][Ss]$ ]]; then
       echo ""
       echo "❌ Deletion cancelled"
       exit 0
     fi
   fi
   ```

### Phase 5: Execute Deletion

1. **Delete cluster**:
   ```bash
   echo ""
   echo "🗑️  Deleting cluster..."
   echo ""

   START_TIME=$(date +%s)

   if [[ "$CLUSTER_TYPE" == "aks" ]]; then
     # Delete AKS cluster
     az aks delete \
       --name $CLUSTER_NAME \
       --resource-group $RESOURCE_GROUP \
       --yes \
       --no-wait

     echo "  Deletion initiated for AKS cluster"
     echo "  This typically takes 5-10 minutes"
   else
     # Delete ARO cluster
     az aro delete \
       --name $CLUSTER_NAME \
       --resource-group $RESOURCE_GROUP \
       --yes \
       --no-wait

     echo "  Deletion initiated for ARO cluster"
     echo "  This typically takes 15-20 minutes"
   fi
   echo ""
   ```

2. **Monitor deletion progress**:
   ```bash
   echo "⏳ Monitoring deletion progress..."
   echo ""

   while true; do
     if [[ "$CLUSTER_TYPE" == "aks" ]]; then
       STATUS=$(az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP \
         --query provisioningState -o tsv 2>/dev/null)
     else
       STATUS=$(az aro show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP \
         --query provisioningState -o tsv 2>/dev/null)
     fi

     if [[ $? -ne 0 ]]; then
       echo "✅ Cluster deleted successfully!"
       break
     fi

     ELAPSED=$(($(date +%s) - START_TIME))
     ELAPSED_MIN=$((ELAPSED / 60))
     echo "  Status: $STATUS (elapsed: ${ELAPSED_MIN}m)"
     sleep 30
   done

   echo ""
   ```

### Phase 6: Cleanup Associated Resources

1. **Delete resource group** (if --delete-resource-group):
   ```bash
   if [[ "$DELETE_RESOURCE_GROUP" == "true" ]]; then
     echo "🗑️  Deleting resource group: $RESOURCE_GROUP"
     echo ""

     az group delete \
       --name $RESOURCE_GROUP \
       --yes \
       --no-wait

     echo "  Resource group deletion initiated"
     echo "  This may take additional time"
     echo ""
   fi
   ```

2. **Clean up kubeconfig**:
   ```bash
   echo "🧹 Cleaning up local configuration..."
   echo ""

   # Remove context from kubeconfig
   kubectl config delete-context $CLUSTER_NAME 2>/dev/null && \
     echo "  ✅ Removed kubectl context"

   kubectl config delete-cluster $CLUSTER_NAME 2>/dev/null && \
     echo "  ✅ Removed cluster from kubeconfig"

   kubectl config unset users.$CLUSTER_NAME 2>/dev/null && \
     echo "  ✅ Removed user credentials"

   echo ""
   ```

### Phase 7: Post-Deletion Report

```bash
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DELETION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Deleted:"
echo "  ✓ Cluster: $CLUSTER_NAME"
echo "  ✓ Type: $CLUSTER_TYPE"
echo "  ✓ Resource Group: $RESOURCE_GROUP"
if [[ "$DELETE_RESOURCE_GROUP" == "true" ]]; then
  echo "  ✓ Resource Group deleted"
fi
echo ""

if [[ "$BACKUP" == "true" ]]; then
  echo "Backup Location:"
  echo "  📁 $BACKUP_DIR.tar.gz"
  echo ""
  echo "To restore from backup:"
  echo "  tar -xzf $BACKUP_DIR.tar.gz"
  echo "  kubectl apply -f $BACKUP_DIR/"
  echo ""
fi

TOTAL_TIME=$(($(date +%s) - START_TIME))
TOTAL_MIN=$((TOTAL_TIME / 60))
echo "Total Time: ${TOTAL_MIN}m"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

## Error Handling

1. **Cluster not found**:
   ```
   ❌ Cluster not found

   Verify cluster name and resource group:
     az aks list --resource-group <rg>
     az aro list --resource-group <rg>
   ```

2. **Deletion failed**:
   ```
   ❌ Cluster deletion failed

   Check Azure portal for errors
   View activity log:
     az monitor activity-log list --resource-group <rg>

   Retry deletion:
     az aks delete --name <name> --resource-group <rg> --yes
   ```

3. **Resource group locked**:
   ```
   ❌ Resource group is locked

   Check locks:
     az lock list --resource-group <rg>

   Remove lock:
     az lock delete --name <lock-name> --resource-group <rg>
   ```

## Best Practices

1. **Always backup production clusters**
2. **Test deletion process in non-production first**
3. **Export configuration for recreation**
4. **Document deletion reason and date**
5. **Verify backup integrity before deletion**
6. **Keep backups for compliance period**
7. **Remove DNS records and external dependencies**

## References

- **AKS**: https://learn.microsoft.com/en-us/azure/aks/
- **ARO**: https://learn.microsoft.com/en-us/azure/openshift/
