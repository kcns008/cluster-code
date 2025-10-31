---
name: kustomize-apply
description: Apply Kustomize overlays with validation and intelligent resource management
category: gitops-deployment
tools:
  - Bash(kubectl:*)
  - Bash(kustomize:*)
  - Read(.*\.yaml)
  - Read(.*\.yml)
  - Read(.*/kustomization.yaml)
parameters:
  - name: path
    description: Path to kustomization directory
    required: true
    type: string
  - name: namespace
    description: Override namespace
    required: false
    type: string
  - name: dry-run
    description: Show what would be applied without making changes
    required: false
    type: boolean
    default: false
  - name: prune
    description: Prune resources not in current configuration
    required: false
    type: boolean
    default: false
  - name: wait
    description: Wait for resources to be ready
    required: false
    type: boolean
    default: true
examples:
  - kustomize-apply --path ./overlays/production
  - kustomize-apply --path ./base --namespace my-app --dry-run
  - kustomize-apply --path ./overlays/dev --prune --wait
---

# Kustomize Apply

Apply Kubernetes manifests using Kustomize overlays with comprehensive validation, diff analysis, and intelligent resource management.

## Your Role

You are a Kustomize deployment specialist focusing on:
- Overlay validation and best practices
- Resource patching and transformations
- Configuration management across environments
- Intelligent resource pruning
- GitOps workflows

## Task Workflow

### Phase 1: Prerequisites Check

1. **Verify kubectl with kustomize**:
   ```bash
   kubectl version --client | grep -q "Kustomize" || {
     echo "❌ kubectl with Kustomize support not found"
     echo "Install: https://kubernetes.io/docs/tasks/tools/"
     exit 1
   }
   ```

2. **Check kustomization file**:
   ```bash
   if [[ ! -f "$PATH/kustomization.yaml" && ! -f "$PATH/kustomization.yml" ]]; then
     echo "❌ No kustomization.yaml found in $PATH"
     exit 1
   fi

   echo "✅ Found kustomization file"
   ```

3. **Verify cluster connectivity**:
   ```bash
   kubectl cluster-info || {
     echo "❌ Not connected to a Kubernetes cluster"
     exit 1
   }
   ```

### Phase 2: Kustomization Analysis

1. **Parse kustomization file**:
   ```bash
   KUST_FILE="$PATH/kustomization.yaml"
   [[ ! -f "$KUST_FILE" ]] && KUST_FILE="$PATH/kustomization.yml"

   echo "📋 Kustomization Configuration:"
   echo ""

   # Extract key information
   NAMESPACE=$(yq eval '.namespace // "default"' $KUST_FILE)
   NAME_PREFIX=$(yq eval '.namePrefix // ""' $KUST_FILE)
   NAME_SUFFIX=$(yq eval '.nameSuffix // ""' $KUST_FILE)
   COMMON_LABELS=$(yq eval '.commonLabels // {}' $KUST_FILE)

   echo "  Namespace: ${NAMESPACE_OVERRIDE:-$NAMESPACE}"
   [[ -n "$NAME_PREFIX" ]] && echo "  Name Prefix: $NAME_PREFIX"
   [[ -n "$NAME_SUFFIX" ]] && echo "  Name Suffix: $NAME_SUFFIX"
   ```

2. **List resources**:
   ```bash
   echo ""
   echo "📦 Base Resources:"
   yq eval '.resources[]' $KUST_FILE | while read resource; do
     echo "  - $resource"
   done

   # Check for patches
   PATCHES=$(yq eval '.patches // [] | length' $KUST_FILE)
   if [[ $PATCHES -gt 0 ]]; then
     echo ""
     echo "🔧 Patches: $PATCHES"
     yq eval '.patches[]' $KUST_FILE | while read patch; do
       echo "  - $patch"
     done
   fi

   # Check for strategic merge patches
   STRATEGIC_MERGE=$(yq eval '.patchesStrategicMerge // [] | length' $KUST_FILE)
   if [[ $STRATEGIC_MERGE -gt 0 ]]; then
     echo ""
     echo "🔀 Strategic Merge Patches: $STRATEGIC_MERGE"
   fi

   # Check for JSON 6902 patches
   JSON_PATCHES=$(yq eval '.patchesJson6902 // [] | length' $KUST_FILE)
   if [[ $JSON_PATCHES -gt 0 ]]; then
     echo ""
     echo "🔧 JSON 6902 Patches: $JSON_PATCHES"
   fi
   ```

3. **Check for ConfigMap and Secret generators**:
   ```bash
   CONFIGMAP_GEN=$(yq eval '.configMapGenerator // [] | length' $KUST_FILE)
   SECRET_GEN=$(yq eval '.secretGenerator // [] | length' $KUST_FILE)

   if [[ $CONFIGMAP_GEN -gt 0 ]]; then
     echo ""
     echo "⚙️  ConfigMap Generators: $CONFIGMAP_GEN"
   fi

   if [[ $SECRET_GEN -gt 0 ]]; then
     echo ""
     echo "🔐 Secret Generators: $SECRET_GEN"
   fi
   ```

### Phase 3: Build and Validate

1. **Build Kustomization**:
   ```bash
   echo ""
   echo "🔨 Building Kustomization..."

   KUST_OUTPUT=$(kubectl kustomize $PATH ${NAMESPACE_OVERRIDE:+--namespace=$NAMESPACE_OVERRIDE} 2>&1)

   if [[ $? -ne 0 ]]; then
     echo "❌ Failed to build kustomization:"
     echo "$KUST_OUTPUT"
     exit 1
   fi

   echo "✅ Kustomization built successfully"
   ```

2. **Validate resources**:
   ```bash
   echo ""
   echo "🔍 Validating resources..."

   # Count resources
   RESOURCE_COUNT=$(echo "$KUST_OUTPUT" | grep -c "^kind:")

   echo "📊 Total Resources: $RESOURCE_COUNT"
   echo ""

   # Group by kind
   echo "Resource Types:"
   echo "$KUST_OUTPUT" | grep "^kind:" | sort | uniq -c | \
     awk '{printf "  - %s: %d\n", $2, $1}'

   # Validate YAML syntax
   echo "$KUST_OUTPUT" | kubectl apply --dry-run=client -f - &>/dev/null

   if [[ $? -eq 0 ]]; then
     echo ""
     echo "✅ All resources are valid"
   else
     echo ""
     echo "❌ Resource validation failed"
     exit 1
   fi
   ```

3. **Extract resource names**:
   ```bash
   # Parse all resource names for tracking
   RESOURCES=$(echo "$KUST_OUTPUT" | yq eval -N '
     .kind + "/" + .metadata.name +
     (if .metadata.namespace then " -n " + .metadata.namespace else "" end)
   ' -)
   ```

### Phase 4: Diff Analysis

1. **Compare with cluster state**:
   ```bash
   echo ""
   echo "📊 Analyzing changes..."

   # Get server-side diff
   DIFF_OUTPUT=$(echo "$KUST_OUTPUT" | kubectl diff -f - 2>&1)
   DIFF_EXIT_CODE=$?

   if [[ $DIFF_EXIT_CODE -eq 0 ]]; then
     echo "ℹ️  No changes detected - cluster is up to date"
   elif [[ $DIFF_EXIT_CODE -eq 1 ]]; then
     echo "⚠️  Changes detected:"
     echo ""
     echo "$DIFF_OUTPUT"
   else
     echo "⚠️  Could not generate diff (some resources may not exist yet)"
   fi
   ```

2. **Categorize changes**:
   ```bash
   # Count new, modified, and deleted resources
   NEW_RESOURCES=$(echo "$RESOURCES" | while read res; do
     kubectl get $res &>/dev/null || echo "$res"
   done | wc -l)

   MODIFIED_RESOURCES=$(echo "$DIFF_OUTPUT" | grep -c "^±" || echo "0")

   echo ""
   echo "Change Summary:"
   echo "  New Resources: $NEW_RESOURCES"
   echo "  Modified Resources: $MODIFIED_RESOURCES"

   if [[ "$PRUNE" == "true" ]]; then
     # Calculate resources to be deleted (simplified)
     echo "  ⚠️  Prune enabled - orphaned resources will be removed"
   fi
   ```

### Phase 5: Apply Configuration

1. **Apply or dry-run**:

   **Dry Run Mode**:
   ```bash
   if [[ "$DRY_RUN" == "true" ]]; then
     echo ""
     echo "🧪 DRY RUN MODE - No changes will be applied"
     echo ""
     echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
     echo "Rendered Manifests:"
     echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
     echo "$KUST_OUTPUT"
     exit 0
   fi
   ```

   **Apply Mode**:
   ```bash
   echo ""
   read -p "Proceed with deployment? [y/N]: " CONFIRM

   if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
     echo "❌ Deployment cancelled"
     exit 0
   fi

   echo ""
   echo "🚀 Applying kustomization..."

   # Build apply command
   APPLY_CMD="kubectl apply -k $PATH"
   [[ -n "$NAMESPACE_OVERRIDE" ]] && APPLY_CMD="$APPLY_CMD --namespace=$NAMESPACE_OVERRIDE"
   [[ "$PRUNE" == "true" ]] && APPLY_CMD="$APPLY_CMD --prune"
   [[ "$WAIT" == "true" ]] && APPLY_CMD="$APPLY_CMD --wait"

   # Apply
   APPLY_OUTPUT=$($APPLY_CMD 2>&1)
   APPLY_EXIT_CODE=$?

   if [[ $APPLY_EXIT_CODE -eq 0 ]]; then
     echo ""
     echo "✅ Kustomization applied successfully!"
     echo ""
     echo "$APPLY_OUTPUT"
   else
     echo ""
     echo "❌ Failed to apply kustomization:"
     echo "$APPLY_OUTPUT"
     exit 1
   fi
   ```

### Phase 6: Post-Deployment Verification

1. **Verify resource status**:
   ```bash
   echo ""
   echo "🔍 Verifying deployed resources..."
   echo ""

   # Check each resource
   echo "$RESOURCES" | while read resource; do
     if kubectl get $resource &>/dev/null; then
       STATUS=$(kubectl get $resource -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)

       if [[ "$STATUS" == "True" ]]; then
         echo "  ✅ $resource"
       else
         echo "  ⏳ $resource (not ready yet)"
       fi
     else
       echo "  ❌ $resource (not found)"
     fi
   done
   ```

2. **Check pod health**:
   ```bash
   echo ""
   echo "🏥 Pod Health Check:"

   # Get all pods in the namespace
   PODS=$(kubectl get pods -n ${NAMESPACE_OVERRIDE:-$NAMESPACE} --no-headers 2>/dev/null)

   if [[ -n "$PODS" ]]; then
     TOTAL_PODS=$(echo "$PODS" | wc -l)
     RUNNING_PODS=$(echo "$PODS" | grep "Running" | wc -l)
     READY_PODS=$(echo "$PODS" | grep "Running" | grep -E "([0-9]+)/\1" | wc -l)

     echo "  Total Pods: $TOTAL_PODS"
     echo "  Running: $RUNNING_PODS"
     echo "  Ready: $READY_PODS"

     # Show pods with issues
     if [[ $READY_PODS -lt $RUNNING_PODS ]]; then
       echo ""
       echo "⚠️  Pods with issues:"
       echo "$PODS" | while read POD READY STATUS RESTARTS AGE; do
         if [[ "$STATUS" != "Running" ]] || [[ ! "$READY" =~ ([0-9]+)/\1 ]]; then
           echo "    - $POD: $STATUS (Ready: $READY, Restarts: $RESTARTS)"
         fi
       done
     fi
   fi
   ```

3. **Check services and endpoints**:
   ```bash
   echo ""
   echo "🌐 Services:"

   SERVICES=$(kubectl get services -n ${NAMESPACE_OVERRIDE:-$NAMESPACE} --no-headers 2>/dev/null)

   if [[ -n "$SERVICES" ]]; then
     echo "$SERVICES" | while read SVC TYPE CLUSTER_IP EXTERNAL_IP PORT AGE; do
       # Check endpoints
       ENDPOINTS=$(kubectl get endpoints $SVC -n ${NAMESPACE_OVERRIDE:-$NAMESPACE} \
         -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null)

       if [[ -n "$ENDPOINTS" ]]; then
         ENDPOINT_COUNT=$(echo "$ENDPOINTS" | wc -w)
         echo "  ✅ $SVC ($TYPE) - $ENDPOINT_COUNT endpoints"
       else
         echo "  ⚠️  $SVC ($TYPE) - no endpoints"
       fi
     done
   fi
   ```

4. **Generate deployment report**:
   ```bash
   echo ""
   echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
   echo "Deployment Report"
   echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
   echo ""
   echo "Kustomization: $PATH"
   echo "Namespace: ${NAMESPACE_OVERRIDE:-$NAMESPACE}"
   echo "Resources Deployed: $RESOURCE_COUNT"
   echo "Status: $(if [[ $READY_PODS -eq $TOTAL_PODS ]]; then echo "✅ Healthy"; else echo "⚠️  Partially Ready"; fi)"
   echo ""
   ```

### Phase 7: Monitoring and Next Steps

1. **Provide monitoring commands**:
   ```
   📋 Next Steps:

   Monitor resources:
     kubectl get all -n <namespace>

   Watch pod status:
     kubectl get pods -n <namespace> --watch

   View logs:
     kubectl logs -n <namespace> -l <label-selector> --tail=100 -f

   Update deployment:
     # Edit your kustomization files, then:
     kustomize-apply --path <path>

   Rollback:
     kubectl rollout undo deployment/<deployment-name> -n <namespace>

   View applied manifests:
     kubectl kustomize <path>
   ```

2. **GitOps recommendations**:
   ```
   💡 GitOps Best Practices:

   1. Store kustomization files in Git
   2. Use separate overlays for each environment
   3. Automate deployments with CI/CD
   4. Use ArgoCD or Flux for continuous sync

   Set up ArgoCD:
     cluster-code argocd-sync --path <path>

   Set up Flux:
     flux create kustomization <name> --source=<git-repo> --path=<path>
   ```

## Error Handling

1. **Kustomization build errors**:
   ```
   ❌ Failed to build kustomization

   Common causes:
   - Invalid YAML syntax in patches
   - Missing base resources
   - Incorrect file paths in resources[]
   - Invalid transformers

   Debug:
     kubectl kustomize <path> --enable-helm
     kustomize build <path> --load-restrictor LoadRestrictionsNone
   ```

2. **Resource conflicts**:
   ```
   ❌ Resource already exists and is not managed by kustomize

   Solutions:
   1. Add management labels to existing resources
   2. Delete existing resources manually
   3. Use different resource names
   4. Adopt resources with kubectl label
   ```

3. **Namespace issues**:
   ```
   ⚠️  Namespace mismatch

   Kustomization namespace: <namespace1>
   Override namespace: <namespace2>

   Note: --namespace flag overrides kustomization.yaml namespace setting
   ```

## Best Practices

1. **Directory Structure**:
   ```
   my-app/
   ├── base/
   │   ├── deployment.yaml
   │   ├── service.yaml
   │   └── kustomization.yaml
   └── overlays/
       ├── dev/
       │   ├── kustomization.yaml
       │   └── patches/
       ├── staging/
       │   └── kustomization.yaml
       └── production/
           ├── kustomization.yaml
           └── patches/
   ```

2. **Naming Convention**:
   - Use namePrefix for environment distinction
   - Use nameSuffix for versioning
   - Apply commonLabels for resource grouping

3. **Patch Strategy**:
   - Use strategic merge for simple changes
   - Use JSON 6902 for precise modifications
   - Document patch rationale in comments

4. **Secret Management**:
   - Never commit secrets to Git
   - Use secretGenerator with external files
   - Consider sealed-secrets or external-secrets

## References

- **Kustomize Docs**: https://kustomize.io/
- **Kubectl Kustomize**: https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/
- **Best Practices**: https://kubectl.docs.kubernetes.io/guides/config_management/
