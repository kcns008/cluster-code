---
name: flux-reconcile
description: Reconcile Flux Kustomizations and HelmReleases
category: gitops-automation
tools:
  - Bash(flux:*)
  - Bash(kubectl:*)
  - Read(.*\.yaml)
parameters:
  - name: resource
    description: Resource type (kustomization, helmrelease, all)
    required: true
    type: string
  - name: name
    description: Resource name
    required: false
    type: string
  - name: namespace
    description: Flux namespace
    required: false
    type: string
    default: flux-system
  - name: with-source
    description: Reconcile source first
    required: false
    type: boolean
    default: false
examples:
  - flux-reconcile --resource kustomization --name my-app
  - flux-reconcile --resource helmrelease --name nginx --with-source
  - flux-reconcile --resource all
---

# Flux Reconcile

Trigger immediate reconciliation of Flux resources to sync cluster state with Git repositories.

## Your Role

You are a Flux GitOps specialist focusing on:
- Flux resource reconciliation
- Git source synchronization
- HelmRelease management
- Troubleshooting sync issues
- Progressive delivery

## Task Workflow

### Phase 1: Prerequisites Check

1. **Verify Flux installation**:
   ```bash
   flux version

   if [[ $? -ne 0 ]]; then
     echo "❌ Flux CLI not found"
     echo "Install: https://fluxcd.io/flux/installation/"
     exit 1
   fi
   ```

2. **Check Flux system**:
   ```bash
   flux check

   if [[ $? -ne 0 ]]; then
     echo "❌ Flux is not properly installed"
     echo "Install Flux: flux install"
     exit 1
   fi
   ```

3. **Verify Flux namespace**:
   ```bash
   kubectl get namespace $NAMESPACE || {
     echo "❌ Namespace '$NAMESPACE' not found"
     exit 1
   }
   ```

### Phase 2: Resource Discovery

1. **List Flux resources**:
   ```bash
   echo "📋 Flux Resources:"
   echo ""

   # Kustomizations
   KUSTOMIZATIONS=$(flux get kustomizations -n $NAMESPACE --no-header 2>/dev/null)
   KUST_COUNT=$(echo "$KUSTOMIZATIONS" | grep -v '^$' | wc -l)
   echo "Kustomizations: $KUST_COUNT"

   # HelmReleases
   HELMRELEASES=$(flux get helmreleases -n $NAMESPACE --no-header 2>/dev/null)
   HELM_COUNT=$(echo "$HELMRELEASES" | grep -v '^$' | wc -l)
   echo "HelmReleases: $HELM_COUNT"

   # GitRepositories
   REPOS=$(flux get sources git -n $NAMESPACE --no-header 2>/dev/null)
   REPO_COUNT=$(echo "$REPOS" | grep -v '^$' | wc -l)
   echo "GitRepositories: $REPO_COUNT"
   echo ""
   ```

2. **Validate resource exists** (if specific name provided):
   ```bash
   if [[ -n "$RESOURCE_NAME" ]]; then
     case "$RESOURCE_TYPE" in
       kustomization)
         flux get kustomization $RESOURCE_NAME -n $NAMESPACE || {
           echo "❌ Kustomization '$RESOURCE_NAME' not found"
           exit 1
         }
         ;;
       helmrelease)
         flux get helmrelease $RESOURCE_NAME -n $NAMESPACE || {
           echo "❌ HelmRelease '$RESOURCE_NAME' not found"
           exit 1
         }
         ;;
     esac
   fi
   ```

### Phase 3: Source Reconciliation

1. **Reconcile Git sources** (if --with-source):
   ```bash
   if [[ "$WITH_SOURCE" == "true" ]]; then
     echo "🔄 Reconciling Git sources first..."
     echo ""

     # Get source for the resource
     if [[ "$RESOURCE_TYPE" == "kustomization" ]]; then
       SOURCE=$(kubectl get kustomization $RESOURCE_NAME -n $NAMESPACE \
         -o jsonpath='{.spec.sourceRef.name}')
       SOURCE_NS=$(kubectl get kustomization $RESOURCE_NAME -n $NAMESPACE \
         -o jsonpath='{.spec.sourceRef.namespace}')
       SOURCE_NS=${SOURCE_NS:-$NAMESPACE}

       echo "Source GitRepository: $SOURCE (namespace: $SOURCE_NS)"
       flux reconcile source git $SOURCE -n $SOURCE_NS

       if [[ $? -eq 0 ]]; then
         echo "✅ Source reconciled successfully"
       else
         echo "⚠️  Source reconciliation had issues"
       fi
       echo ""
     fi
   fi
   ```

### Phase 4: Reconcile Resources

#### Reconcile Kustomization

```bash
reconcile_kustomization() {
  local NAME=$1
  local NS=$2

  echo "🔄 Reconciling Kustomization: $NAME"
  echo ""

  # Get current status
  CURRENT_STATUS=$(kubectl get kustomization $NAME -n $NS \
    -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
  CURRENT_REVISION=$(kubectl get kustomization $NAME -n $NS \
    -o jsonpath='{.status.lastAppliedRevision}')

  echo "Current Status: $CURRENT_STATUS"
  echo "Current Revision: $CURRENT_REVISION"
  echo ""

  # Trigger reconciliation
  flux reconcile kustomization $NAME -n $NS

  RECONCILE_EXIT=$?

  if [[ $RECONCILE_EXIT -eq 0 ]]; then
    echo ""
    echo "✅ Kustomization reconciled successfully"

    # Get updated status
    sleep 2
    NEW_STATUS=$(kubectl get kustomization $NAME -n $NS \
      -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
    NEW_REVISION=$(kubectl get kustomization $NAME -n $NS \
      -o jsonpath='{.status.lastAppliedRevision}')

    echo "New Status: $NEW_STATUS"
    echo "New Revision: $NEW_REVISION"

    # Check for changes
    if [[ "$CURRENT_REVISION" != "$NEW_REVISION" ]]; then
      echo ""
      echo "🆕 Revision changed: $CURRENT_REVISION → $NEW_REVISION"
    fi
  else
    echo ""
    echo "❌ Reconciliation failed"

    # Show error details
    kubectl get kustomization $NAME -n $NS -o yaml | \
      yq eval '.status.conditions[] | select(.type=="Ready")' -
  fi
  echo ""
}
```

#### Reconcile HelmRelease

```bash
reconcile_helmrelease() {
  local NAME=$1
  local NS=$2

  echo "🔄 Reconciling HelmRelease: $NAME"
  echo ""

  # Get current status
  CURRENT_STATUS=$(kubectl get helmrelease $NAME -n $NS \
    -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
  CURRENT_CHART=$(kubectl get helmrelease $NAME -n $NS \
    -o jsonpath='{.status.lastAppliedRevision}')

  echo "Current Status: $CURRENT_STATUS"
  echo "Current Chart: $CURRENT_CHART"
  echo ""

  # Trigger reconciliation
  flux reconcile helmrelease $NAME -n $NS

  RECONCILE_EXIT=$?

  if [[ $RECONCILE_EXIT -eq 0 ]]; then
    echo ""
    echo "✅ HelmRelease reconciled successfully"

    # Get updated status
    sleep 3
    NEW_STATUS=$(kubectl get helmrelease $NAME -n $NS \
      -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
    NEW_CHART=$(kubectl get helmrelease $NAME -n $NS \
      -o jsonpath='{.status.lastAppliedRevision}')

    echo "New Status: $NEW_STATUS"
    echo "New Chart: $NEW_CHART"

    # Check for changes
    if [[ "$CURRENT_CHART" != "$NEW_CHART" ]]; then
      echo ""
      echo "🆕 Chart version changed: $CURRENT_CHART → $NEW_CHART"
    fi

    # Show deployed resources
    echo ""
    echo "📦 Deployed Resources:"
    kubectl get helmrelease $NAME -n $NS \
      -o jsonpath='{.status.lastReleaseRevision}' | \
      xargs -I {} helm list -n $NS --filter $NAME
  else
    echo ""
    echo "❌ Reconciliation failed"

    # Show error details
    kubectl get helmrelease $NAME -n $NS -o yaml | \
      yq eval '.status.conditions[] | select(.type=="Ready")' -
  fi
  echo ""
}
```

#### Reconcile All

```bash
reconcile_all() {
  local NS=$1

  echo "🔄 Reconciling all Flux resources in namespace: $NS"
  echo ""

  # Reconcile all GitRepositories first
  echo "1️⃣ Reconciling Git sources..."
  flux get sources git -n $NS --no-header | while read NAME REVISION AGE STATUS; do
    if [[ -n "$NAME" ]]; then
      echo "  📂 $NAME"
      flux reconcile source git $NAME -n $NS
    fi
  done
  echo ""

  # Reconcile all Kustomizations
  echo "2️⃣ Reconciling Kustomizations..."
  flux get kustomizations -n $NS --no-header | while read NAME REVISION STATUS AGE; do
    if [[ -n "$NAME" ]]; then
      echo "  📋 $NAME"
      flux reconcile kustomization $NAME -n $NS
    fi
  done
  echo ""

  # Reconcile all HelmReleases
  echo "3️⃣ Reconciling HelmReleases..."
  flux get helmreleases -n $NS --no-header | while read NAME REVISION STATUS AGE; do
    if [[ -n "$NAME" ]]; then
      echo "  📦 $NAME"
      flux reconcile helmrelease $NAME -n $NS
    fi
  done
  echo ""

  echo "✅ All resources reconciled"
}
```

### Phase 5: Execute Reconciliation

```bash
case "$RESOURCE_TYPE" in
  kustomization)
    if [[ -n "$RESOURCE_NAME" ]]; then
      reconcile_kustomization "$RESOURCE_NAME" "$NAMESPACE"
    else
      echo "❌ Resource name required for kustomization"
      exit 1
    fi
    ;;

  helmrelease)
    if [[ -n "$RESOURCE_NAME" ]]; then
      reconcile_helmrelease "$RESOURCE_NAME" "$NAMESPACE"
    else
      echo "❌ Resource name required for helmrelease"
      exit 1
    fi
    ;;

  all)
    reconcile_all "$NAMESPACE"
    ;;

  *)
    echo "❌ Unknown resource type: $RESOURCE_TYPE"
    echo "Valid types: kustomization, helmrelease, all"
    exit 1
    ;;
esac
```

### Phase 6: Post-Reconciliation Verification

1. **Check resource health**:
   ```bash
   echo "🏥 Health Check:"
   echo ""

   # Get all Flux resources status
   flux get all -n $NAMESPACE
   ```

2. **Show recent events**:
   ```bash
   echo ""
   echo "📅 Recent Events:"
   kubectl get events -n $NAMESPACE \
     --sort-by='.lastTimestamp' \
     --field-selector involvedObject.kind=Kustomization \
     | tail -10

   kubectl get events -n $NAMESPACE \
     --sort-by='.lastTimestamp' \
     --field-selector involvedObject.kind=HelmRelease \
     | tail -10
   ```

3. **Check for failures**:
   ```bash
   FAILED_KUST=$(flux get kustomizations -n $NAMESPACE | grep False | wc -l)
   FAILED_HELM=$(flux get helmreleases -n $NAMESPACE | grep False | wc -l)

   if [[ $FAILED_KUST -gt 0 || $FAILED_HELM -gt 0 ]]; then
     echo ""
     echo "⚠️  Failed Resources:"
     [[ $FAILED_KUST -gt 0 ]] && echo "  - Kustomizations: $FAILED_KUST"
     [[ $FAILED_HELM -gt 0 ]] && echo "  - HelmReleases: $FAILED_HELM"
     echo ""
     echo "Investigate:"
     echo "  flux logs --level=error"
   fi
   ```

### Phase 7: Monitoring and Next Steps

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Next Steps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Monitor reconciliation:
  flux get all -n <namespace> --watch

View logs:
  flux logs --follow
  flux logs --kind=Kustomization --name=<name>
  flux logs --kind=HelmRelease --name=<name>

Suspend reconciliation:
  flux suspend kustomization <name>
  flux suspend helmrelease <name>

Resume reconciliation:
  flux resume kustomization <name>
  flux resume helmrelease <name>

Export resources:
  flux export kustomization <name> > kust.yaml
  flux export helmrelease <name> > helm.yaml
```

## Error Handling

1. **Reconciliation timeout**:
   ```
   ⏱️  Reconciliation timed out

   Check resource status:
     flux get kustomization <name>
     kubectl describe kustomization <name>

   View logs:
     flux logs --kind=Kustomization --name=<name>
   ```

2. **Source not ready**:
   ```
   ❌ Git source not ready

   Check source:
     flux get sources git
     kubectl describe gitrepository <source-name>

   Reconcile source:
     flux reconcile source git <source-name>

   Check credentials:
     kubectl get secret -n flux-system
   ```

3. **HelmRelease install failed**:
   ```
   ❌ Helm install/upgrade failed

   Check Helm status:
     helm list -n <namespace>
     helm history <release-name> -n <namespace>

   View HelmRelease status:
     kubectl get helmrelease <name> -o yaml

   Rollback:
     helm rollback <release-name> -n <namespace>
   ```

## Best Practices

1. **Reconciliation Strategy**:
   - Use automatic reconciliation for dev/staging
   - Manual reconciliation for production
   - Set appropriate intervals (default: 5m)
   - Use webhooks for faster updates

2. **Git Repository**:
   - Use dedicated branches per environment
   - Tag releases for rollback
   - Keep kustomization manifests in Git
   - Use secrets management (Sealed Secrets, SOPS)

3. **Monitoring**:
   - Set up alerts for failed reconciliations
   - Monitor Flux controller metrics
   - Use Grafana dashboards
   - Check notification controllers

4. **Progressive Delivery**:
   - Use Flagger for canary deployments
   - Implement health checks
   - Define rollback policies
   - Monitor deployment metrics

## References

- **Flux**: https://fluxcd.io/
- **Reconciliation**: https://fluxcd.io/flux/components/kustomize/kustomization/
- **HelmRelease**: https://fluxcd.io/flux/components/helm/helmreleases/
- **Best Practices**: https://fluxcd.io/flux/guides/
