---
name: azure-cluster-connect
description: Connect to an AKS or ARO cluster and configure kubectl/oc context
category: cloud-management
tools:
  - Bash(az:*)
  - Bash(kubectl:*)
  - Bash(oc:*)
  - Write(.*\.kube/config)
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
  - name: admin
    description: Get admin credentials (AKS only)
    required: false
    type: boolean
    default: false
examples:
  - azure-cluster-connect --name my-aks-cluster --resource-group my-rg
  - azure-cluster-connect --name my-aro-cluster --resource-group my-rg --type aro
  - azure-cluster-connect --name prod-aks --resource-group production --admin
---

# Azure Cluster Connection

Connect to an AKS or ARO cluster and configure your local kubectl/oc context for cluster management.

## Task Workflow

### Phase 1: Cluster Detection

1. **Auto-detect cluster type** (if not specified):
   ```bash
   # Try AKS first
   if az aks show --name <name> --resource-group <resource-group> &>/dev/null; then
     CLUSTER_TYPE="aks"
   # Try ARO
   elif az aro show --name <name> --resource-group <resource-group> &>/dev/null; then
     CLUSTER_TYPE="aro"
   else
     echo "❌ Cluster not found in resource group"
     exit 1
   fi
   ```

2. **Get cluster information**:
   - For AKS: `az aks show --name <name> --resource-group <resource-group>`
   - For ARO: `az aro show --name <name> --resource-group <resource-group>`

3. **Check cluster state**:
   - Verify `provisioningState` is "Succeeded"
   - For AKS, check `powerState` is "Running"
   - If not ready, warn user and ask if they want to continue

### Phase 2: Get Credentials

#### For AKS Clusters:

1. **Get kubeconfig credentials**:
   ```bash
   az aks get-credentials \
     --resource-group <resource-group> \
     --name <cluster-name> \
     ${ADMIN:+--admin} \
     --overwrite-existing
   ```

2. **Verify connection**:
   ```bash
   kubectl cluster-info
   kubectl get nodes
   ```

3. **Display connection info**:
   ```
   ✅ Connected to AKS cluster: <cluster-name>

   Context: <cluster-name>
   API Server: <api-endpoint>
   Kubernetes Version: <version>
   Nodes: <node-count>

   Current context set to: <cluster-name>
   ```

#### For ARO Clusters:

1. **Get cluster credentials**:
   ```bash
   # Get kubeadmin credentials
   CREDENTIALS=$(az aro list-credentials \
     --name <cluster-name> \
     --resource-group <resource-group> \
     --output json)

   KUBEADMIN_USER=$(echo $CREDENTIALS | jq -r '.kubeadminUsername')
   KUBEADMIN_PASS=$(echo $CREDENTIALS | jq -r '.kubeadminPassword')

   # Get API server URL
   API_SERVER=$(az aro show \
     --name <cluster-name> \
     --resource-group <resource-group> \
     --query 'apiserverProfile.url' \
     --output tsv)

   # Get console URL
   CONSOLE_URL=$(az aro show \
     --name <cluster-name> \
     --resource-group <resource-group> \
     --query 'consoleProfile.url' \
     --output tsv)
   ```

2. **Login with oc CLI**:
   ```bash
   oc login $API_SERVER \
     --username=$KUBEADMIN_USER \
     --password=$KUBEADMIN_PASS \
     --insecure-skip-tls-verify
   ```

3. **Verify connection**:
   ```bash
   oc cluster-info
   oc get nodes
   oc whoami
   ```

4. **Display connection info**:
   ```
   ✅ Connected to ARO cluster: <cluster-name>

   Context: <cluster-name>/<namespace>/kubeadmin
   API Server: <api-server>
   OpenShift Version: <version>
   Console: <console-url>
   Username: kubeadmin

   ⚠️  IMPORTANT: The kubeadmin user has cluster-admin privileges.
   For production use, create a dedicated user with appropriate RBAC.

   Current context set to: <context-name>
   ```

### Phase 3: Initialize Cluster Code

1. **Automatically run cluster-code init**:
   ```bash
   cluster-code init --context <cluster-context>
   ```

2. **Update cluster configuration**:
   - Set cluster type (AKS/ARO)
   - Enable appropriate plugins
   - Configure cloud provider settings

### Phase 4: Run Initial Diagnostics

1. **Quick health check**:
   ```bash
   cluster-code status --quick
   ```

2. **Show cluster summary**:
   ```
   Cluster Health Summary:
   - API Server: ✅ Healthy
   - Nodes: ✅ All Ready (5/5)
   - System Pods: ✅ All Running
   - Resource Usage: ✅ Normal (CPU: 25%, Memory: 40%)

   Run full diagnostics: cluster-code diagnose
   ```

### Phase 5: Post-Connection Setup

1. **For ARO clusters**, recommend creating a dedicated user:
   ```
   📋 ARO Post-Connection Steps:

   1. Create an Azure AD user or group for cluster access:
      https://learn.microsoft.com/en-us/azure/openshift/configure-azure-ad-cli

   2. Grant cluster-admin role:
      oc adm policy add-cluster-role-to-user cluster-admin <user@domain.com>

   3. Create project and grant permissions:
      oc new-project my-app
      oc policy add-role-to-user admin <user@domain.com> -n my-app
   ```

2. **For AKS clusters**, recommend Azure AD integration:
   ```
   📋 AKS Post-Connection Steps:

   1. Enable Azure AD integration (if not already enabled):
      az aks update --resource-group <rg> --name <name> --enable-aad

   2. Configure RBAC with Azure AD:
      kubectl create clusterrolebinding <binding-name> \
        --clusterrole=cluster-admin \
        --user=<azure-ad-user>

   3. Use AAD credentials for future connections:
      az aks get-credentials --resource-group <rg> --name <name> --overwrite-existing
   ```

## Error Handling

### Common Errors & Solutions:

1. **Cluster not found**:
   ```
   ❌ Cluster '<name>' not found in resource group '<resource-group>'

   List available clusters:
     cluster-code azure-cluster-list
   ```

2. **Cluster not ready**:
   ```
   ⚠️  Cluster is in '<provisioning-state>' state

   Wait for cluster to be ready, then try again:
     az <aks|aro> show --name <name> --resource-group <rg> --query provisioningState
   ```

3. **AKS cluster stopped**:
   ```
   ⚠️  Cluster is stopped

   Start the cluster:
     az aks start --name <name> --resource-group <resource-group>

   This may take 5-10 minutes.
   ```

4. **Insufficient permissions**:
   ```
   ❌ Insufficient permissions to get cluster credentials

   Required RBAC roles:
   - AKS: "Azure Kubernetes Service Cluster User" or "Contributor"
   - ARO: "Contributor" or "Owner"

   Contact your Azure administrator to request access.
   ```

5. **kubectl/oc not installed**:
   ```
   ⚠️  kubectl/oc CLI not found

   Install:
   - kubectl: https://kubernetes.io/docs/tasks/tools/
   - oc: https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/getting-started-cli.html
   ```

## Best Practices

1. **Use admin credentials sparingly**:
   - Only use `--admin` for AKS when necessary
   - Prefer Azure AD integration for production
   - Use RBAC for least-privilege access

2. **Multiple clusters**:
   - Use descriptive context names
   - Switch contexts with: `kubectl config use-context <name>`
   - View all contexts: `kubectl config get-contexts`

3. **Security**:
   - Rotate kubeadmin password (ARO): `az aro update --name <name> --resource-group <rg> --client-id <id> --client-secret <secret>`
   - Use service principals or managed identities for automation
   - Enable audit logging

4. **ARO-specific**:
   - Never disable the kubeadmin user until you have alternative admin access
   - Use Azure AD or OpenShift OAuth for user management
   - Monitor OpenShift console at the console URL

## Output Format

Provide clear, structured output with:
- ✅ Success confirmation
- 📊 Cluster details and status
- ⚠️  Important security warnings
- 📋 Next steps and recommendations
- 🔗 Relevant URLs (console, portal)

## Context Management

After connection, show:

```
📍 Current Kubernetes Context:

Name: <cluster-name>
Cluster: <api-server>
User: <user>
Namespace: <default-namespace>

Switch contexts:
  kubectl config use-context <other-context>

View all contexts:
  kubectl config get-contexts
```

## References

- **AKS**: https://learn.microsoft.com/en-us/azure/aks/
- **ARO**: https://learn.microsoft.com/en-us/azure/openshift/
- **ARO CLI**: https://learn.microsoft.com/en-us/azure/openshift/tutorial-connect-cluster
- **kubectl**: https://kubernetes.io/docs/reference/kubectl/
- **oc**: https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/
