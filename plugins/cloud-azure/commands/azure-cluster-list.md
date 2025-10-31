---
name: azure-cluster-list
description: List all AKS and ARO clusters in Azure subscription
category: cloud-management
tools:
  - Bash(az:*)
parameters:
  - name: resource-group
    description: Filter by resource group
    required: false
    type: string
  - name: type
    description: Filter by cluster type (aks, aro, or all)
    required: false
    type: string
    default: all
  - name: format
    description: Output format (table, json, yaml)
    required: false
    type: string
    default: table
examples:
  - azure-cluster-list
  - azure-cluster-list --resource-group my-rg
  - azure-cluster-list --type aks --format json
---

# Azure Cluster Listing

List all AKS and ARO clusters in your Azure subscription with detailed information.

## Task Workflow

### Phase 1: Authentication Check

1. **Verify Azure CLI authentication**:
   ```bash
   az account show --output json
   ```
   - Extract and display subscription ID and name
   - If not authenticated, instruct user to run `az login`

### Phase 2: List Clusters

#### List AKS Clusters

If `--type` is "aks" or "all":

```bash
az aks list \
  ${RESOURCE_GROUP:+--resource-group $RESOURCE_GROUP} \
  --output json
```

Extract for each AKS cluster:
- Name
- Resource Group
- Location
- Kubernetes Version
- Node Count
- Provisioning State
- FQDN
- Power State

#### List ARO Clusters

If `--type` is "aro" or "all":

```bash
az aro list \
  ${RESOURCE_GROUP:+--resource-group $RESOURCE_GROUP} \
  --output json
```

Extract for each ARO cluster:
- Name
- Resource Group
- Location
- OpenShift Version
- Provisioning State
- Console URL
- API Server URL

### Phase 3: Format and Display

#### Table Format (Default)

```
Azure Clusters in Subscription: <subscription-name> (<subscription-id>)

AKS CLUSTERS:
┌─────────────────┬─────────────────┬──────────┬─────────┬───────┬──────────┐
│ Name            │ Resource Group  │ Location │ Version │ Nodes │ State    │
├─────────────────┼─────────────────┼──────────┼─────────┼───────┼──────────┤
│ prod-aks-001    │ production-rg   │ eastus   │ 1.28.9  │ 5     │ Succeeded│
│ dev-aks-001     │ development-rg  │ westus2  │ 1.28.5  │ 3     │ Succeeded│
└─────────────────┴─────────────────┴──────────┴─────────┴───────┴──────────┘

ARO CLUSTERS:
┌─────────────────┬─────────────────┬──────────┬─────────┬──────────┐
│ Name            │ Resource Group  │ Location │ Version │ State    │
├─────────────────┼─────────────────┼──────────┼─────────┼──────────┤
│ prod-aro-001    │ production-rg   │ eastus2  │ 4.15.0  │ Succeeded│
└─────────────────┴─────────────────┴──────────┴─────────┴──────────┘

Total: 3 clusters (2 AKS, 1 ARO)

Quick Connect:
  cluster-code connect azure --name prod-aks-001 --resource-group production-rg
  cluster-code connect azure --name prod-aro-001 --resource-group production-rg
```

#### JSON Format

If `--format json`, output structured JSON:

```json
{
  "subscription": {
    "id": "...",
    "name": "..."
  },
  "clusters": {
    "aks": [
      {
        "name": "prod-aks-001",
        "resourceGroup": "production-rg",
        "location": "eastus",
        "kubernetesVersion": "1.28.9",
        "nodeCount": 5,
        "provisioningState": "Succeeded",
        "fqdn": "prod-aks-001-dns-12345678.hcp.eastus.azmk8s.io",
        "powerState": "Running"
      }
    ],
    "aro": [
      {
        "name": "prod-aro-001",
        "resourceGroup": "production-rg",
        "location": "eastus2",
        "openshiftVersion": "4.15.0",
        "provisioningState": "Succeeded",
        "consoleUrl": "https://console-openshift-console.apps.prod-aro-001.example.com",
        "apiServerUrl": "https://api.prod-aro-001.example.com:6443"
      }
    ]
  },
  "summary": {
    "total": 3,
    "aks": 2,
    "aro": 1,
    "running": 3,
    "stopped": 0
  }
}
```

### Phase 4: Additional Information

For each cluster, optionally show:

1. **Cost Estimate** (if requested):
   ```bash
   az consumption usage list \
     --start-date $(date -d '30 days ago' +%Y-%m-%d) \
     --end-date $(date +%Y-%m-%d) \
     | grep <cluster-name>
   ```

2. **Node Pool Details** (AKS):
   ```bash
   az aks nodepool list \
     --resource-group <resource-group> \
     --cluster-name <cluster-name>
   ```

3. **Add-ons Status** (AKS):
   ```bash
   az aks addon list \
     --resource-group <resource-group> \
     --name <cluster-name>
   ```

## Error Handling

1. **No clusters found**:
   ```
   ℹ️  No clusters found in subscription.

   Create a new cluster:
     cluster-code azure-cluster-create --type aks --name my-cluster --resource-group my-rg
   ```

2. **Authentication error**:
   ```
   ⚠️  Not authenticated to Azure.

   Run: az login
   ```

3. **Insufficient permissions**:
   ```
   ⚠️  Insufficient permissions to list clusters.

   Required role: Reader or higher on subscription/resource group
   ```

## Output Guidelines

- Use colored output for better readability (green for running, yellow for provisioning, red for failed)
- Show cluster age (created timestamp)
- Highlight clusters with issues or warnings
- Provide quick connect commands
- Show estimated monthly cost if available

## References

- **AKS**: https://learn.microsoft.com/en-us/azure/aks/
- **ARO**: https://learn.microsoft.com/en-us/azure/openshift/
