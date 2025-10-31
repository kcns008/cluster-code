---
name: argocd-sync
description: Synchronize ArgoCD applications with GitOps repositories
category: gitops-automation
tools:
  - Bash(argocd:*)
  - Bash(kubectl:*)
  - Read(.*\.yaml)
parameters:
  - name: app
    description: Application name
    required: true
    type: string
  - name: namespace
    description: ArgoCD namespace
    required: false
    type: string
    default: argocd
  - name: prune
    description: Delete resources not in Git
    required: false
    type: boolean
    default: false
  - name: force
    description: Force sync even if already synced
    required: false
    type: boolean
    default: false
  - name: dry-run
    description: Preview sync without applying
    required: false
    type: boolean
    default: false
  - name: timeout
    description: Timeout for sync operation
    required: false
    type: string
    default: 5m
examples:
  - argocd-sync --app my-app
  - argocd-sync --app prod-app --prune --force
  - argocd-sync --app staging-app --dry-run
---

# ArgoCD Application Sync

Synchronize ArgoCD applications with their Git repository sources, ensuring deployed resources match the desired state defined in Git.

## Your Role

You are an ArgoCD GitOps specialist focusing on:
- Application synchronization and health monitoring
- Git repository validation
- Resource diff analysis
- Sync strategy optimization
- Rollback and recovery

## Task Workflow

### Phase 1: Prerequisites Check

1. **Verify ArgoCD installation**:
   ```bash
   kubectl get namespace argocd || kubectl get namespace openshift-gitops || {
     echo "❌ ArgoCD not installed"
     echo "Install: cluster-code operator-install --operator openshift-gitops-operator"
     exit 1
   }
   ```

2. **Check argocd CLI**:
   ```bash
   argocd version --client || {
     echo "❌ ArgoCD CLI not found"
     echo "Install: https://argo-cd.readthedocs.io/en/stable/cli_installation/"
     exit 1
   }
   ```

3. **Login to ArgoCD**:
   ```bash
   # Get ArgoCD server address
   ARGOCD_SERVER=$(kubectl get route argocd-server -n $NAMESPACE -o jsonpath='{.spec.host}' 2>/dev/null || \
                   kubectl get ingress argocd-server -n $NAMESPACE -o jsonpath='{.spec.rules[0].host}')

   # Login (use existing session if available)
   argocd login $ARGOCD_SERVER --grpc-web
   ```

### Phase 2: Application Discovery and Validation

1. **Check if application exists**:
   ```bash
   APP_INFO=$(argocd app get $APP_NAME --output json 2>/dev/null)

   if [[ $? -ne 0 ]]; then
     echo "❌ Application '$APP_NAME' not found"
     echo ""
     echo "Available applications:"
     argocd app list
     exit 1
   fi
   ```

2. **Display application status**:
   ```bash
   echo "📋 Application: $APP_NAME"
   echo ""

   # Extract key information
   REPO=$(echo $APP_INFO | jq -r '.spec.source.repoURL')
   PATH=$(echo $APP_INFO | jq -r '.spec.source.path')
   BRANCH=$(echo $APP_INFO | jq -r '.spec.source.targetRevision')
   DEST_NS=$(echo $APP_INFO | jq -r '.spec.destination.namespace')
   SYNC_STATUS=$(echo $APP_INFO | jq -r '.status.sync.status')
   HEALTH_STATUS=$(echo $APP_INFO | jq -r '.status.health.status')

   echo "Repository: $REPO"
   echo "Path: $PATH"
   echo "Branch: $BRANCH"
   echo "Destination: $DEST_NS"
   echo "Sync Status: $SYNC_STATUS"
   echo "Health Status: $HEALTH_STATUS"
   echo ""
   ```

3. **Check Git repository connectivity**:
   ```bash
   # Verify repo is accessible
   argocd repo get $REPO || {
     echo "⚠️  Repository not accessible or not registered"
     echo "Add repository: argocd repo add $REPO"
   }
   ```

### Phase 3: Diff Analysis

1. **Generate diff between Git and cluster**:
   ```bash
   echo "🔍 Analyzing differences..."
   echo ""

   DIFF_OUTPUT=$(argocd app diff $APP_NAME 2>&1)
   DIFF_EXIT_CODE=$?

   if [[ $DIFF_EXIT_CODE -eq 0 && -z "$DIFF_OUTPUT" ]]; then
     echo "✅ Application is in sync - no changes detected"

     if [[ "$FORCE" != "true" ]]; then
       echo ""
       read -p "Force sync anyway? [y/N]: " CONFIRM
       [[ ! "$CONFIRM" =~ ^[Yy]$ ]] && exit 0
     fi
   else
     echo "⚠️  Differences detected:"
     echo ""
     echo "$DIFF_OUTPUT"
     echo ""
   fi
   ```

2. **Categorize changes**:
   ```bash
   # Count resources to be created, updated, deleted
   TO_CREATE=$(echo "$DIFF_OUTPUT" | grep -c "^\+" || echo 0)
   TO_UPDATE=$(echo "$DIFF_OUTPUT" | grep -c "^±" || echo 0)
   TO_DELETE=$(echo "$DIFF_OUTPUT" | grep -c "^-" || echo 0)

   echo "Change Summary:"
   echo "  Resources to create: $TO_CREATE"
   echo "  Resources to update: $TO_UPDATE"
   echo "  Resources to delete: $TO_DELETE"
   echo ""
   ```

3. **Check for dangerous operations**:
   ```bash
   # Warn about StatefulSet updates or PVC deletions
   if echo "$DIFF_OUTPUT" | grep -q "kind: StatefulSet"; then
     echo "⚠️  WARNING: StatefulSet changes detected"
     echo "   StatefulSet updates may require manual intervention"
     echo ""
   fi

   if echo "$DIFF_OUTPUT" | grep -q "kind: PersistentVolumeClaim"; then
     echo "⚠️  WARNING: PVC changes detected"
     echo "   PVC deletion may result in data loss"
     echo ""
   fi
   ```

### Phase 4: Sync Execution

1. **Dry-run mode** (if requested):
   ```bash
   if [[ "$DRY_RUN" == "true" ]]; then
     echo "🧪 DRY RUN MODE - Previewing sync..."
     echo ""

     argocd app sync $APP_NAME --dry-run --prune=$PRUNE
     exit 0
   fi
   ```

2. **Confirm sync**:
   ```bash
   echo "Ready to synchronize application '$APP_NAME'"
   echo ""
   read -p "Proceed with sync? [y/N]: " CONFIRM

   if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
     echo "❌ Sync cancelled"
     exit 0
   fi
   ```

3. **Execute sync**:
   ```bash
   echo ""
   echo "🚀 Synchronizing application..."
   echo ""

   # Build sync command
   SYNC_CMD="argocd app sync $APP_NAME"
   [[ "$PRUNE" == "true" ]] && SYNC_CMD="$SYNC_CMD --prune"
   [[ "$FORCE" == "true" ]] && SYNC_CMD="$SYNC_CMD --force"
   SYNC_CMD="$SYNC_CMD --timeout $TIMEOUT"

   # Execute sync
   $SYNC_CMD 2>&1 | tee /tmp/argocd-sync-$APP_NAME.log

   SYNC_EXIT_CODE=${PIPESTATUS[0]}
   ```

4. **Monitor sync progress**:
   ```bash
   if [[ $SYNC_EXIT_CODE -eq 0 ]]; then
     echo ""
     echo "⏳ Monitoring sync progress..."
     echo ""

     # Wait for sync to complete
     argocd app wait $APP_NAME \
       --timeout $TIMEOUT \
       --health 2>&1

     WAIT_EXIT_CODE=$?
   else
     echo ""
     echo "❌ Sync command failed"
     WAIT_EXIT_CODE=1
   fi
   ```

### Phase 5: Post-Sync Verification

1. **Check sync result**:
   ```bash
   echo ""
   echo "📊 Sync Result:"
   echo ""

   # Get updated application status
   UPDATED_INFO=$(argocd app get $APP_NAME --output json)

   SYNC_STATUS=$(echo $UPDATED_INFO | jq -r '.status.sync.status')
   SYNC_REVISION=$(echo $UPDATED_INFO | jq -r '.status.sync.revision')
   HEALTH_STATUS=$(echo $UPDATED_INFO | jq -r '.status.health.status')
   HEALTH_MESSAGE=$(echo $UPDATED_INFO | jq -r '.status.health.message')

   if [[ "$SYNC_STATUS" == "Synced" && "$HEALTH_STATUS" == "Healthy" ]]; then
     echo "✅ Sync completed successfully!"
     echo ""
     echo "Status: $SYNC_STATUS"
     echo "Health: $HEALTH_STATUS"
     echo "Revision: $SYNC_REVISION"
   elif [[ "$SYNC_STATUS" == "Synced" ]]; then
     echo "⚠️  Sync completed but application not healthy"
     echo ""
     echo "Status: $SYNC_STATUS"
     echo "Health: $HEALTH_STATUS"
     echo "Message: $HEALTH_MESSAGE"
   else
     echo "❌ Sync failed"
     echo ""
     echo "Status: $SYNC_STATUS"
     echo "Health: $HEALTH_STATUS"
   fi
   ```

2. **Show resource status**:
   ```bash
   echo ""
   echo "🔍 Resource Status:"
   echo ""

   argocd app resources $APP_NAME --output wide
   ```

3. **Check for degraded resources**:
   ```bash
   DEGRADED=$(echo $UPDATED_INFO | jq -r '.status.resources[] | select(.health.status=="Degraded") | .kind + "/" + .name')

   if [[ -n "$DEGRADED" ]]; then
     echo ""
     echo "⚠️  Degraded Resources:"
     echo "$DEGRADED" | while read resource; do
       echo "  - $resource"
     done
     echo ""
     echo "Investigate: argocd app resources $APP_NAME"
   fi
   ```

4. **Display operation history**:
   ```bash
   echo ""
   echo "📝 Recent Operations:"
   argocd app history $APP_NAME --output wide | head -10
   ```

### Phase 6: Rollback (if sync failed)

1. **Offer rollback on failure**:
   ```bash
   if [[ $WAIT_EXIT_CODE -ne 0 ]]; then
     echo ""
     echo "💡 Sync failed or timed out"
     echo ""
     read -p "Rollback to previous version? [y/N]: " ROLLBACK

     if [[ "$ROLLBACK" =~ ^[Yy]$ ]]; then
       # Get previous successful sync
       PREV_REVISION=$(argocd app history $APP_NAME --output json | \
         jq -r '[.[] | select(.sync.status=="Synced")] | .[1].revision')

       if [[ -n "$PREV_REVISION" && "$PREV_REVISION" != "null" ]]; then
         echo "🔄 Rolling back to revision $PREV_REVISION..."
         argocd app rollback $APP_NAME --revision $PREV_REVISION
       else
         echo "❌ No previous successful revision found"
       fi
     fi
   fi
   ```

### Phase 7: Next Steps and Monitoring

1. **Provide monitoring commands**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📋 Next Steps
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Monitor application:
     argocd app get <app-name> --watch
     argocd app resources <app-name>

   View logs:
     argocd app logs <app-name> --follow
     kubectl logs -n <namespace> -l app=<app-name>

   Rollback if needed:
     argocd app rollback <app-name> --revision <revision>

   View sync history:
     argocd app history <app-name>

   Trigger manual sync:
     argocd app sync <app-name>
   ```

2. **Set up auto-sync** (if not enabled):
   ```bash
   AUTO_SYNC=$(echo $APP_INFO | jq -r '.spec.syncPolicy.automated')

   if [[ "$AUTO_SYNC" == "null" ]]; then
     echo ""
     echo "💡 Tip: Enable auto-sync for continuous deployment:"
     echo ""
     echo "argocd app set $APP_NAME --sync-policy automated --auto-prune --self-heal"
   fi
   ```

## Error Handling

1. **Application not found**:
   ```
   ❌ Application not found in ArgoCD

   List applications:
     argocd app list

   Create application:
     argocd app create <name> --repo <git-repo> --path <path> --dest-namespace <ns>
   ```

2. **Sync timeout**:
   ```
   ⏱️  Sync operation timed out

   Possible causes:
   - Resource creation taking longer than expected
   - Init containers not completing
   - Image pull issues

   Check resource status:
     kubectl get pods -n <namespace>
     argocd app get <app-name>

   Increase timeout:
     argocd-sync --app <name> --timeout 10m
   ```

3. **Git repository errors**:
   ```
   ❌ Failed to fetch from Git repository

   Check:
   - Repository URL is correct
   - Branch/tag exists
   - Credentials are valid
   - Repository is registered in ArgoCD

   Register repository:
     argocd repo add <repo-url> --username <user> --password <token>
   ```

4. **Permission denied**:
   ```
   ❌ Insufficient permissions to sync application

   Required RBAC:
   - ArgoCD AppProject permissions
   - Kubernetes namespace access

   Check ArgoCD RBAC:
     argocd account can-i sync applications '<app-name>'
   ```

## Best Practices

1. **Sync Strategy**:
   - Use auto-sync for non-production environments
   - Manual sync for production (with approval)
   - Enable auto-prune carefully (can delete resources)
   - Use sync windows for controlled deployments

2. **Git Repository**:
   - One application per directory
   - Use separate branches for environments
   - Tag releases for easy rollback
   - Keep manifests in sync with cluster

3. **Health Checks**:
   - Define custom health checks for CRDs
   - Use readiness probes in pods
   - Monitor sync status regularly
   - Set up alerts for degraded apps

4. **Rollback**:
   - Always test in non-production first
   - Keep sync history for rollback
   - Document rollback procedures
   - Use progressive delivery (Argo Rollouts)

## References

- **ArgoCD**: https://argo-cd.readthedocs.io/
- **Sync Options**: https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/
- **Best Practices**: https://argo-cd.readthedocs.io/en/stable/user-guide/best_practices/
