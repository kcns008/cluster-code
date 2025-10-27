---
name: cluster-init
description: Initialize connection to a Kubernetes or OpenShift cluster
args:
  - name: context
    description: Kubernetes context name (from kubeconfig)
    required: false
    hint: --context
  - name: namespace
    description: Default namespace for operations
    required: false
    hint: --namespace
tools:
  - Bash
  - Read
  - Write
permissions:
  allow:
    - Bash(kubectl:*)
    - Bash(oc:*)
    - Read(.*)
    - Write(.*)
model: sonnet
color: blue
---

# Cluster Connection Initialization

I'll help you initialize a connection to your Kubernetes or OpenShift cluster and set up the configuration for Cluster Code operations.

## Steps

1. **Check cluster connectivity**
2. **Verify cluster type and version**
3. **Set default namespace**
4. **Test permissions and access**
5. **Save configuration**

## Implementation

```bash
# Check available contexts
kubectl config get-contexts

# Get current cluster info
kubectl cluster-info

# Check if this is OpenShift
oc whoami 2>/dev/null && echo "OpenShift cluster detected" || echo "Kubernetes cluster detected"

# Test basic permissions
kubectl auth can-i get pods
kubectl auth can-i get nodes

# Get cluster version
kubectl version --short
```

## Configuration Setup

I'll create/update the Cluster Code configuration with your cluster settings:

```json
{
  "cluster": {
    "context": "{{context}}",
    "namespace": "{{namespace}}",
    "type": "kubernetes", // or "openshift"
    "version": "detected_version",
    "connection_time": "{{current_time}}"
  }
}
```

## Next Steps

After initialization, you can run:
- `cluster-code status` - Check cluster health
- `cluster-code diagnose` - Run comprehensive diagnostics
- `cluster-code chat` - Start interactive troubleshooting

Ready to connect to your cluster?