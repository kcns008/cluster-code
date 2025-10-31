---
name: helm-deploy
description: Deploy applications using Helm charts with intelligent validation and rollback
category: gitops-deployment
tools:
  - Bash(helm:*)
  - Bash(kubectl:*)
  - Read(.*\.yaml)
  - Read(.*\.yml)
  - Read(.*/Chart.yaml)
  - Read(.*/values.yaml)
  - Write(.*\.yaml)
parameters:
  - name: chart
    description: Helm chart name or path
    required: true
    type: string
  - name: release
    description: Release name
    required: true
    type: string
  - name: namespace
    description: Target namespace
    required: false
    type: string
    default: default
  - name: values
    description: Values file path
    required: false
    type: string
  - name: set
    description: Set values on command line (key=value)
    required: false
    type: array
  - name: create-namespace
    description: Create namespace if it doesn't exist
    required: false
    type: boolean
    default: false
  - name: dry-run
    description: Simulate deployment without applying
    required: false
    type: boolean
    default: false
  - name: wait
    description: Wait for resources to be ready
    required: false
    type: boolean
    default: true
  - name: timeout
    description: Timeout for waiting (e.g., 5m, 10m)
    required: false
    type: string
    default: 5m
examples:
  - helm-deploy --chart nginx --release my-nginx --namespace web
  - helm-deploy --chart ./my-chart --release my-app --values prod-values.yaml
  - helm-deploy --chart bitnami/postgresql --release db --set postgresqlPassword=secret123
  - helm-deploy --chart ./app --release my-app --dry-run
---

# Helm Chart Deployment

Deploy applications to Kubernetes using Helm charts with comprehensive validation, health checks, and intelligent rollback capabilities.

## Your Role

You are a Helm deployment specialist focused on:
- Chart validation and best practices
- Values configuration and templating
- Deployment health monitoring
- Rollback strategies
- Resource dependency management

## Task Workflow

### Phase 1: Prerequisites Check

1. **Verify Helm installation**:
   ```bash
   helm version --short || {
     echo "❌ Helm not installed"
     echo "Install: https://helm.sh/docs/intro/install/"
     exit 1
   }
   ```

2. **Verify kubectl connectivity**:
   ```bash
   kubectl cluster-info || {
     echo "❌ Not connected to a Kubernetes cluster"
     exit 1
   }
   ```

3. **Check namespace**:
   ```bash
   if ! kubectl get namespace $NAMESPACE &>/dev/null; then
     if [[ "$CREATE_NAMESPACE" == "true" ]]; then
       kubectl create namespace $NAMESPACE
       echo "✅ Created namespace: $NAMESPACE"
     else
       echo "❌ Namespace '$NAMESPACE' does not exist"
       echo "Use --create-namespace to create it automatically"
       exit 1
     fi
   fi
   ```

### Phase 2: Chart Resolution

1. **Determine chart type**:

   **Local chart** (path starts with . or /):
   ```bash
   if [[ -f "$CHART/Chart.yaml" ]]; then
     CHART_TYPE="local"
     CHART_PATH="$CHART"
   else
     echo "❌ Chart.yaml not found in $CHART"
     exit 1
   fi
   ```

   **Repository chart** (format: repo/chart):
   ```bash
   if [[ "$CHART" == *"/"* ]]; then
     CHART_TYPE="repository"
     REPO_NAME="${CHART%%/*}"
     CHART_NAME="${CHART##*/}"

     # Update repository
     helm repo update $REPO_NAME 2>/dev/null || {
       echo "⚠️  Repository '$REPO_NAME' not found"
       echo "Add repository first: helm repo add <name> <url>"
       exit 1
     }
   fi
   ```

   **Chart name only** (search in added repos):
   ```bash
   if [[ "$CHART" != *"/"* && ! -d "$CHART" ]]; then
     CHART_TYPE="search"

     # Search for chart in repositories
     SEARCH_RESULTS=$(helm search repo $CHART --output json)

     if [[ $(echo "$SEARCH_RESULTS" | jq 'length') -eq 0 ]]; then
       echo "❌ Chart '$CHART' not found in any repository"
       echo "Search all repositories: helm search repo $CHART"
       exit 1
     fi

     # Use first result
     CHART_FULL=$(echo "$SEARCH_RESULTS" | jq -r '.[0].name')
     echo "📦 Found chart: $CHART_FULL"
   fi
   ```

2. **Display chart information**:
   ```bash
   helm show chart $CHART_PATH 2>/dev/null || helm show chart $CHART_FULL

   # Extract key information
   CHART_VERSION=$(helm show chart $CHART | yq eval '.version' -)
   APP_VERSION=$(helm show chart $CHART | yq eval '.appVersion' -)
   DESCRIPTION=$(helm show chart $CHART | yq eval '.description' -)

   echo ""
   echo "📋 Chart Details:"
   echo "  Name: $CHART"
   echo "  Version: $CHART_VERSION"
   echo "  App Version: $APP_VERSION"
   echo "  Description: $DESCRIPTION"
   ```

### Phase 3: Values Configuration

1. **Load values files**:
   ```bash
   VALUES_ARGS=""

   if [[ -n "$VALUES_FILE" ]]; then
     if [[ ! -f "$VALUES_FILE" ]]; then
       echo "❌ Values file not found: $VALUES_FILE"
       exit 1
     fi

     VALUES_ARGS="-f $VALUES_FILE"
     echo "📄 Using values file: $VALUES_FILE"
   fi
   ```

2. **Process --set arguments**:
   ```bash
   SET_ARGS=""
   if [[ ${#SET_VALUES[@]} -gt 0 ]]; then
     for kv in "${SET_VALUES[@]}"; do
       SET_ARGS="$SET_ARGS --set $kv"
     done
     echo "⚙️  Overriding values: ${SET_VALUES[*]}"
   fi
   ```

3. **Show merged values** (if requested):
   ```bash
   if [[ "$SHOW_VALUES" == "true" ]]; then
     echo ""
     echo "📋 Final Values (after merging):"
     helm template $RELEASE $CHART $VALUES_ARGS $SET_ARGS --namespace $NAMESPACE | \
       helm get values $RELEASE --all 2>/dev/null || \
       helm show values $CHART
   fi
   ```

### Phase 4: Pre-Deployment Validation

1. **Template validation** (dry-run):
   ```bash
   echo ""
   echo "🔍 Validating chart templates..."

   TEMPLATE_OUTPUT=$(helm template $RELEASE $CHART \
     $VALUES_ARGS $SET_ARGS \
     --namespace $NAMESPACE \
     --validate 2>&1)

   if [[ $? -ne 0 ]]; then
     echo "❌ Template validation failed:"
     echo "$TEMPLATE_OUTPUT"
     exit 1
   fi

   echo "✅ Chart templates are valid"
   ```

2. **Resource validation**:
   ```bash
   # Count resources to be created
   RESOURCE_COUNT=$(echo "$TEMPLATE_OUTPUT" | grep -c "^kind:")

   echo "📊 Resources to be deployed: $RESOURCE_COUNT"
   echo ""
   echo "Resource Types:"
   echo "$TEMPLATE_OUTPUT" | grep "^kind:" | sort | uniq -c | \
     awk '{printf "  - %s: %d\n", $2, $1}'
   ```

3. **Check for existing release**:
   ```bash
   if helm list -n $NAMESPACE | grep -q "^$RELEASE"; then
     EXISTING_VERSION=$(helm list -n $NAMESPACE -o json | \
       jq -r ".[] | select(.name==\"$RELEASE\") | .chart")

     echo ""
     echo "⚠️  Release '$RELEASE' already exists (version: $EXISTING_VERSION)"
     echo ""
     read -p "Upgrade existing release? [y/N]: " UPGRADE

     if [[ ! "$UPGRADE" =~ ^[Yy]$ ]]; then
       echo "❌ Deployment cancelled"
       echo "Use helm-upgrade command to upgrade existing releases"
       exit 0
     fi

     OPERATION="upgrade"
   else
     OPERATION="install"
   fi
   ```

### Phase 5: Deployment

1. **Execute Helm deployment**:

   **For new installation**:
   ```bash
   if [[ "$DRY_RUN" == "true" ]]; then
     echo "🧪 DRY RUN MODE - No changes will be applied"
     echo ""

     helm install $RELEASE $CHART \
       --namespace $NAMESPACE \
       $VALUES_ARGS $SET_ARGS \
       --dry-run --debug
   else
     echo "🚀 Deploying release '$RELEASE'..."
     echo ""

     helm install $RELEASE $CHART \
       --namespace $NAMESPACE \
       $VALUES_ARGS $SET_ARGS \
       ${CREATE_NAMESPACE:+--create-namespace} \
       ${WAIT:+--wait --timeout $TIMEOUT} \
       --output json | tee /tmp/helm-install-$RELEASE.json

     if [[ $? -eq 0 ]]; then
       echo ""
       echo "✅ Release '$RELEASE' deployed successfully!"
     else
       echo ""
       echo "❌ Deployment failed"
       exit 1
     fi
   fi
   ```

   **For upgrade**:
   ```bash
   if [[ "$DRY_RUN" == "true" ]]; then
     echo "🧪 DRY RUN MODE - No changes will be applied"
     echo ""

     helm upgrade $RELEASE $CHART \
       --namespace $NAMESPACE \
       $VALUES_ARGS $SET_ARGS \
       --dry-run --debug
   else
     echo "⬆️  Upgrading release '$RELEASE'..."
     echo ""

     helm upgrade $RELEASE $CHART \
       --namespace $NAMESPACE \
       $VALUES_ARGS $SET_ARGS \
       ${WAIT:+--wait --timeout $TIMEOUT} \
       --output json | tee /tmp/helm-upgrade-$RELEASE.json

     if [[ $? -eq 0 ]]; then
       echo ""
       echo "✅ Release '$RELEASE' upgraded successfully!"
     else
       echo ""
       echo "❌ Upgrade failed"
       echo "Rollback: helm rollback $RELEASE -n $NAMESPACE"
       exit 1
     fi
   fi
   ```

### Phase 6: Post-Deployment Verification

1. **Show release status**:
   ```bash
   echo ""
   echo "📊 Release Status:"
   helm status $RELEASE -n $NAMESPACE
   ```

2. **Check deployed resources**:
   ```bash
   echo ""
   echo "🔍 Deployed Resources:"

   # Get all resources from release
   helm get manifest $RELEASE -n $NAMESPACE | \
     kubectl get -f - --show-kind --show-labels -o wide 2>/dev/null || \
     echo "⚠️  Some resources may not be ready yet"
   ```

3. **Health checks**:
   ```bash
   echo ""
   echo "🏥 Health Checks:"

   # Check pods
   PODS=$(kubectl get pods -n $NAMESPACE -l "app.kubernetes.io/instance=$RELEASE" \
     --no-headers 2>/dev/null)

   if [[ -n "$PODS" ]]; then
     TOTAL_PODS=$(echo "$PODS" | wc -l)
     READY_PODS=$(echo "$PODS" | grep "Running" | grep -E "([0-9]+)/\1" | wc -l)

     echo "  Pods: $READY_PODS/$TOTAL_PODS ready"

     if [[ $READY_PODS -lt $TOTAL_PODS ]]; then
       echo ""
       echo "⚠️  Not all pods are ready:"
       echo "$PODS" | while read POD STATUS READY AGE; do
         if [[ "$STATUS" != "Running" ]] || [[ ! "$READY" =~ ([0-9]+)/\1 ]]; then
           echo "    - $POD: $STATUS (Ready: $READY)"
         fi
       done
     fi
   fi

   # Check services
   SERVICES=$(kubectl get services -n $NAMESPACE -l "app.kubernetes.io/instance=$RELEASE" \
     --no-headers 2>/dev/null)

   if [[ -n "$SERVICES" ]]; then
     SERVICE_COUNT=$(echo "$SERVICES" | wc -l)
     echo "  Services: $SERVICE_COUNT deployed"
   fi

   # Check ingresses/routes
   INGRESSES=$(kubectl get ingress -n $NAMESPACE -l "app.kubernetes.io/instance=$RELEASE" \
     --no-headers 2>/dev/null)

   if [[ -n "$INGRESSES" ]]; then
     INGRESS_COUNT=$(echo "$INGRESSES" | wc -l)
     echo "  Ingresses: $INGRESS_COUNT deployed"

     echo ""
     echo "🌐 External Access:"
     echo "$INGRESSES" | while read NAME CLASS HOSTS ADDRESS PORTS AGE; do
       echo "    - https://$HOSTS"
     done
   fi
   ```

4. **Show notes**:
   ```bash
   echo ""
   echo "📝 Release Notes:"
   helm get notes $RELEASE -n $NAMESPACE
   ```

### Phase 7: Monitoring and Next Steps

1. **Provide monitoring commands**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📋 Next Steps
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Monitor deployment:
     kubectl get pods -n <namespace> -l app.kubernetes.io/instance=<release> --watch

   View logs:
     kubectl logs -n <namespace> -l app.kubernetes.io/instance=<release> --tail=100 -f

   Check release history:
     helm history <release> -n <namespace>

   Upgrade release:
     helm-upgrade --release <release> --namespace <namespace>

   Rollback if needed:
     helm rollback <release> -n <namespace>

   Uninstall release:
     helm uninstall <release> -n <namespace>
   ```

2. **Set up monitoring** (if monitoring enabled):
   ```bash
   # Create ServiceMonitor for Prometheus (if Prometheus Operator is installed)
   if kubectl get crd servicemonitors.monitoring.coreos.com &>/dev/null; then
     echo ""
     echo "💡 Prometheus Operator detected. You can create a ServiceMonitor:"
     cat <<EOF
   apiVersion: monitoring.coreos.com/v1
   kind: ServiceMonitor
   metadata:
     name: $RELEASE
     namespace: $NAMESPACE
   spec:
     selector:
       matchLabels:
         app.kubernetes.io/instance: $RELEASE
     endpoints:
     - port: metrics
       interval: 30s
   EOF
   fi
   ```

## Error Handling

1. **Chart not found**:
   ```
   ❌ Chart '<chart>' not found

   Search for charts:
     helm search repo <keyword>
     helm search hub <keyword>

   Add a repository:
     helm repo add bitnami https://charts.bitnami.com/bitnami
     helm repo add stable https://charts.helm.sh/stable
   ```

2. **Template rendering errors**:
   ```
   ❌ Failed to render chart templates

   Common causes:
   - Invalid values in values.yaml
   - Missing required values
   - Syntax errors in templates

   Debug:
     helm template <release> <chart> --debug
     helm lint <chart>
   ```

3. **Deployment timeout**:
   ```
   ⏱️  Deployment timed out after <timeout>

   Check pod status:
     kubectl get pods -n <namespace> -l app.kubernetes.io/instance=<release>

   View pod logs:
     kubectl logs -n <namespace> <pod-name>

   Increase timeout:
     helm-deploy --chart <chart> --release <release> --timeout 10m
   ```

4. **Resource conflicts**:
   ```
   ❌ Resource already exists

   This usually happens when:
   - A previous installation wasn't fully removed
   - Resources are managed by multiple Helm releases

   Solutions:
   1. Delete conflicting resources manually
   2. Use different release name
   3. Change namespace
   ```

## Best Practices

1. **Version Control**:
   - Store values files in Git
   - Use semantic versioning for charts
   - Tag releases in Git to match Helm releases

2. **Values Management**:
   - Separate values files per environment (dev, staging, prod)
   - Use --set sparingly, prefer values files
   - Document all custom values

3. **Security**:
   - Don't store secrets in values files
   - Use Kubernetes secrets or external secret managers
   - Review chart templates before deployment
   - Enable RBAC for Helm

4. **Deployment Strategy**:
   - Always test with --dry-run first
   - Use --wait to ensure successful deployment
   - Keep deployment history (helm history)
   - Plan rollback strategy before upgrading

## References

- **Helm Docs**: https://helm.sh/docs/
- **Chart Best Practices**: https://helm.sh/docs/chart_best_practices/
- **Helm Hub**: https://artifacthub.io/
- **Bitnami Charts**: https://github.com/bitnami/charts
