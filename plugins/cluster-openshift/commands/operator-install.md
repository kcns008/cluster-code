---
name: operator-install
description: Install and configure OpenShift Operators from OperatorHub
category: openshift-operators
tools:
  - Bash(oc:*)
  - Bash(kubectl:*)
  - Write(.*\.yaml)
parameters:
  - name: operator
    description: Operator name or package name
    required: true
    type: string
  - name: namespace
    description: Target namespace for operator (default: openshift-operators for cluster-wide)
    required: false
    type: string
  - name: channel
    description: Update channel (stable, fast, candidate)
    required: false
    type: string
  - name: approval
    description: Install plan approval (Automatic or Manual)
    required: false
    type: string
    default: Automatic
  - name: source
    description: Catalog source (default: redhat-operators)
    required: false
    type: string
    default: redhat-operators
examples:
  - operator-install --operator elasticsearch-operator
  - operator-install --operator openshift-gitops-operator --namespace openshift-gitops
  - operator-install --operator advanced-cluster-management --channel release-2.10 --approval Manual
---

# OpenShift Operator Installer

Install and configure OpenShift Operators from OperatorHub with validation, prerequisites checking, and post-installation verification.

## Your Role

You are an OpenShift Operator Lifecycle Management specialist. Guide users through:
- Operator discovery and selection
- Prerequisite validation
- Installation with appropriate namespaces and permissions
- Post-installation verification
- Operator configuration best practices

## Task Workflow

### Phase 1: Environment Validation

1. **Verify OpenShift cluster**:
   ```bash
   oc version 2>/dev/null || {
     echo "❌ Not connected to an OpenShift cluster"
     exit 1
   }
   ```

2. **Check cluster-admin permissions** (required for operator installation):
   ```bash
   oc auth can-i create subscription.operators.coreos.com --all-namespaces
   oc auth can-i create operatorgroup.operators.coreos.com --all-namespaces

   if [[ $? -ne 0 ]]; then
     echo "❌ Insufficient permissions. cluster-admin or equivalent required for operator installation."
     exit 1
   fi
   ```

### Phase 2: Operator Discovery

1. **Search OperatorHub** for the operator:
   ```bash
   # List all available operators
   oc get packagemanifests -n openshift-marketplace

   # Search for specific operator
   OPERATOR_PACKAGES=$(oc get packagemanifests -n openshift-marketplace -o json | \
     jq -r --arg name "$OPERATOR_NAME" '.items[] | select(.metadata.name | contains($name)) |
     {name: .metadata.name, catalog: .status.catalogSource, defaultChannel: .status.defaultChannel, channels: [.status.channels[].name]}'
   )
   ```

2. **If operator not found**, suggest alternatives:
   ```
   ❌ Operator '<operator-name>' not found in OperatorHub

   Similar operators:
   <list of similar operators from search>

   Available catalogs:
     - redhat-operators (Red Hat certified)
     - certified-operators (3rd party certified)
     - community-operators (community supported)
     - redhat-marketplace (Red Hat Marketplace)

   Search all catalogs:
     oc get packagemanifests -n openshift-marketplace | grep -i <keyword>
   ```

3. **Display operator information**:
   ```
   📦 Operator Found: <operator-name>

   Catalog Source: <catalog>
   Default Channel: <channel>
   Available Channels: <channel-list>
   Description: <description>

   Provider: <provider>
   Support: <support-level>
   ```

### Phase 3: Operator Configuration

1. **Determine installation scope**:
   - **Cluster-wide** (AllNamespaces): Operator watches all namespaces
     - Installed in `openshift-operators` namespace
     - Requires cluster-admin permissions
     - Single instance across cluster

   - **Single namespace** (OwnNamespace): Operator watches specific namespace
     - Installed in specified namespace
     - Namespace-scoped permissions
     - Can have multiple instances

   - **Multi-namespace** (MultiNamespace): Operator watches specific namespaces
     - Installed in operator namespace
     - Watches designated namespaces
     - Complex setup, less common

2. **Ask user for installation scope** (if not specified):
   ```
   How should this operator be installed?

   1. Cluster-wide (recommended) - Watches all namespaces
      Namespace: openshift-operators
      Scope: AllNamespaces

   2. Single namespace - Watches only one namespace
      Namespace: <custom-namespace>
      Scope: OwnNamespace

   Select installation scope [1|2]:
   ```

3. **Determine update channel**:
   - If not specified, use default channel
   - Show available channels and recommendations:
     ```
     Available Update Channels:
     - stable (recommended for production)
     - fast (early access to updates)
     - candidate (preview releases)

     Using channel: <selected-channel>
     ```

### Phase 4: Prerequisites and Validation

1. **Check operator-specific prerequisites**:

   Common prerequisite checks:
   ```bash
   # Check if namespace exists (for single-namespace install)
   if [[ -n "$NAMESPACE" && "$NAMESPACE" != "openshift-operators" ]]; then
     oc get namespace $NAMESPACE || {
       echo "Creating namespace $NAMESPACE..."
       oc create namespace $NAMESPACE
     }
   fi

   # Check for required CRDs (some operators depend on others)
   # Example: Some operators require cert-manager

   # Check cluster resources (some operators have minimum requirements)
   # Example: Elasticsearch requires certain node resources
   ```

2. **Operator-specific validations**:

   **For Elasticsearch Operator**:
   ```bash
   # Check if cluster has sufficient resources
   TOTAL_MEMORY=$(oc get nodes -o json | jq '[.items[].status.capacity.memory |
     rtrimstr("Ki") | tonumber] | add')

   if [[ $TOTAL_MEMORY -lt 16777216 ]]; then  # 16GB
     echo "⚠️  WARNING: Elasticsearch requires significant memory. Cluster may be under-resourced."
   fi
   ```

   **For GitOps Operator**:
   ```bash
   # Check if GitOps namespace exists
   oc get namespace openshift-gitops &>/dev/null || {
     echo "Creating openshift-gitops namespace..."
     oc create namespace openshift-gitops
   }
   ```

### Phase 5: Create Operator Resources

1. **Create OperatorGroup** (if needed):

   For single-namespace installation:
   ```yaml
   apiVersion: operators.coreos.com/v1
   kind: OperatorGroup
   metadata:
     name: <operator-name>-operatorgroup
     namespace: <namespace>
   spec:
     targetNamespaces:
     - <namespace>
   ```

   For cluster-wide installation in openshift-operators:
   ```
   ℹ️  OperatorGroup already exists in openshift-operators (global default)
   ```

   Apply OperatorGroup:
   ```bash
   cat <<EOF | oc apply -f -
   <operatorgroup-yaml>
   EOF
   ```

2. **Create Subscription**:

   ```yaml
   apiVersion: operators.coreos.com/v1alpha1
   kind: Subscription
   metadata:
     name: <operator-name>
     namespace: <namespace>
   spec:
     channel: <channel>
     name: <package-name>
     source: <catalog-source>
     sourceNamespace: openshift-marketplace
     installPlanApproval: <Automatic|Manual>
   ```

   Apply Subscription:
   ```bash
   cat <<EOF | oc apply -f -
   <subscription-yaml>
   EOF
   ```

3. **Show creation status**:
   ```
   🚀 Installing operator '<operator-name>'...

   Installation Details:
   - Package: <package-name>
   - Channel: <channel>
   - Namespace: <namespace>
   - Scope: <scope>
   - Approval: <approval-mode>

   Resources created:
   ✅ OperatorGroup: <operatorgroup-name>
   ✅ Subscription: <subscription-name>
   ```

### Phase 6: Monitor Installation Progress

1. **Wait for InstallPlan creation**:
   ```bash
   echo "Waiting for InstallPlan to be created..."

   for i in {1..30}; do
     INSTALL_PLAN=$(oc get installplan -n $NAMESPACE --no-headers 2>/dev/null | \
       grep $OPERATOR_NAME | head -1 | awk '{print $1}')

     if [[ -n "$INSTALL_PLAN" ]]; then
       echo "✅ InstallPlan created: $INSTALL_PLAN"
       break
     fi

     sleep 2
   done
   ```

2. **Approve InstallPlan** (if manual approval):
   ```bash
   if [[ "$APPROVAL" == "Manual" ]]; then
     echo "📋 Manual approval required for InstallPlan: $INSTALL_PLAN"
     echo ""
     oc describe installplan $INSTALL_PLAN -n $NAMESPACE
     echo ""
     read -p "Approve installation? [y/N]: " APPROVE

     if [[ "$APPROVE" =~ ^[Yy]$ ]]; then
       oc patch installplan $INSTALL_PLAN -n $NAMESPACE --type merge \
         -p '{"spec":{"approved":true}}'
       echo "✅ InstallPlan approved"
     else
       echo "❌ Installation cancelled"
       exit 0
     fi
   fi
   ```

3. **Monitor CSV installation**:
   ```bash
   echo "Installing ClusterServiceVersion (CSV)..."

   CSV_NAME=""
   for i in {1..60}; do
     CSV_NAME=$(oc get csv -n $NAMESPACE --no-headers 2>/dev/null | \
       grep $OPERATOR_NAME | head -1 | awk '{print $1}')

     if [[ -n "$CSV_NAME" ]]; then
       CSV_PHASE=$(oc get csv $CSV_NAME -n $NAMESPACE -o jsonpath='{.status.phase}')

       if [[ "$CSV_PHASE" == "Succeeded" ]]; then
         echo "✅ Operator installed successfully!"
         break
       elif [[ "$CSV_PHASE" == "Failed" ]]; then
         echo "❌ Operator installation failed"
         oc describe csv $CSV_NAME -n $NAMESPACE
         exit 1
       else
         echo "⏳ Installation in progress... (Phase: $CSV_PHASE)"
       fi
     fi

     sleep 5
   done
   ```

### Phase 7: Post-Installation Verification

1. **Verify operator deployment**:
   ```bash
   # Check operator pod is running
   OPERATOR_PODS=$(oc get pods -n $NAMESPACE -l app.kubernetes.io/part-of=$OPERATOR_NAME \
     --no-headers 2>/dev/null)

   echo "$OPERATOR_PODS" | while read POD STATUS READY AGE; do
     if [[ "$STATUS" == "Running" ]]; then
       echo "✅ Operator pod running: $POD"
     else
       echo "⚠️  Operator pod status: $POD - $STATUS"
     fi
   done
   ```

2. **List installed CRDs**:
   ```bash
   # Get CRDs provided by this operator
   CRDS=$(oc get crd -o json | jq -r --arg csv "$CSV_NAME" \
     '.items[] | select(.metadata.labels."operators.coreos.com/\($csv)") | .metadata.name')

   echo ""
   echo "📋 Custom Resource Definitions (CRDs) installed:"
   echo "$CRDS" | while read CRD; do
     echo "  - $CRD"
   done
   ```

3. **Show operator version and capabilities**:
   ```bash
   CSV_INFO=$(oc get csv $CSV_NAME -n $NAMESPACE -o json)

   VERSION=$(echo $CSV_INFO | jq -r '.spec.version')
   PROVIDER=$(echo $CSV_INFO | jq -r '.spec.provider.name')
   MATURITY=$(echo $CSV_INFO | jq -r '.spec.maturity')

   echo ""
   echo "Operator Details:"
   echo "  Version: $VERSION"
   echo "  Provider: $PROVIDER"
   echo "  Maturity: $MATURITY"
   ```

### Phase 8: Next Steps and Configuration

1. **Provide operator-specific guidance**:

   ```
   ✅ Operator '<operator-name>' installed successfully!

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Next Steps:

   1. Review operator documentation:
      <operator-docs-url>

   2. Create custom resources:
      oc get crd | grep <operator-related-crds>
      oc explain <crd-name>

   3. Example usage:
      <operator-specific-example>

   4. Monitor operator logs:
      oc logs -f deployment/<operator-deployment> -n <namespace>

   5. Configure operator (if needed):
      <operator-specific-configuration>

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

2. **Operator-specific next steps**:

   **For GitOps Operator**:
   ```
   Create an ArgoCD instance:

   cat <<EOF | oc apply -f -
   apiVersion: argoproj.io/v1alpha1
   kind: ArgoCD
   metadata:
     name: argocd
     namespace: openshift-gitops
   spec:
     server:
       route:
         enabled: true
   EOF

   Access ArgoCD UI:
     oc get route argocd-server -n openshift-gitops
   ```

   **For Elasticsearch Operator**:
   ```
   Create an Elasticsearch cluster:

   cat <<EOF | oc apply -f -
   apiVersion: logging.openshift.io/v1
   kind: Elasticsearch
   metadata:
     name: elasticsearch
     namespace: openshift-logging
   spec:
     nodeSpec:
       resources:
         limits:
           memory: 4Gi
         requests:
           memory: 4Gi
     nodes:
     - nodeCount: 3
       roles:
       - master
       - client
       - data
   EOF
   ```

## Error Handling

1. **Operator already installed**:
   ```
   ⚠️  Operator '<operator-name>' is already installed

   Current version: <version>
   Installed in: <namespace>
   Status: <status>

   To upgrade: operator-upgrade --operator <operator-name>
   To view details: oc get csv -n <namespace>
   ```

2. **Insufficient permissions**:
   ```
   ❌ Insufficient permissions to install operator

   Required RBAC permissions:
   - create/update Subscription (operators.coreos.com)
   - create/update OperatorGroup (operators.coreos.com)
   - create/update InstallPlan (operators.coreos.com)

   Contact your cluster administrator for cluster-admin or equivalent access.
   ```

3. **InstallPlan failed**:
   ```
   ❌ InstallPlan failed for operator '<operator-name>'

   Reason: <failure-reason>
   Message: <failure-message>

   Common causes:
   - Incompatible operator versions
   - Missing prerequisites
   - Insufficient cluster resources
   - CRD conflicts

   View full details:
     oc describe installplan <installplan-name> -n <namespace>
   ```

## Best Practices

1. **Production installations**:
   - Use stable channels for production
   - Set installPlanApproval to "Manual" to review changes
   - Monitor operator resource usage
   - Test in non-production first

2. **Namespace organization**:
   - Use dedicated namespaces for namespaced operators
   - Follow naming conventions (<app>-operator)
   - Apply appropriate labels and annotations

3. **Update management**:
   - Review release notes before updates
   - Test updates in non-production
   - Have rollback plan
   - Monitor during and after updates

4. **Security**:
   - Review operator permissions/RBAC
   - Use trusted operator sources
   - Enable audit logging
   - Monitor operator behavior

## References

- **Operators**: https://docs.redhat.com/en/documentation/openshift_container_platform/4.19/html/operators/understanding-operators
- **OperatorHub**: https://docs.redhat.com/en/documentation/openshift_container_platform/4.19/html/operators/administrator-tasks#olm-adding-operators-to-a-cluster
- **Operator Lifecycle Manager**: https://olm.operatorframework.io/

## Output Format

Use clear status indicators:
- ✅ Success
- ⚠️  Warning
- ❌ Error
- 📦 Package/Resource
- 🚀 In Progress
- ℹ️  Information
