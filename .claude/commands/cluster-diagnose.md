---
name: cluster-diagnose
description: Run comprehensive AI-powered cluster diagnostics using K8sGPT analyzers
args:
  - name: namespace
    description: Namespace to analyze (default: all)
    required: false
    hint: --namespace
  - name: analyzer
    description: Specific analyzer to run (pod, service, pvc, node, ingress)
    required: false
    hint: --analyzer
  - name: parallel
    description: Run analyzers in parallel for faster results
    required: false
    hint: --parallel
tools:
  - Bash
  - Grep
  - Read
  - Task
permissions:
  allow:
    - Bash(kubectl:*)
    - Bash(oc:*)
model: sonnet
color: orange
---

# Comprehensive Cluster Diagnostics

I'll run AI-powered diagnostics across your cluster using enhanced K8sGPT analyzers to identify issues, provide explanations, and suggest solutions.

## Available Analyzers

- **pod**: Pod issues (CrashLoopBackOff, ImagePullBackOff, OOMKilled, etc.)
- **service**: Service connectivity and endpoint issues
- **pvc**: Persistent volume claim and storage problems
- **node**: Node health and resource pressure
- **ingress**: Ingress configuration and backend connectivity
- **deployment**: Deployment rollout and replica issues
- **event**: Cluster-wide event analysis

## Analysis Execution

### Step 1: Data Collection

```bash
# Collect cluster data
kubectl get pods --all-namespaces -o wide > /tmp/pods.txt
kubectl get events --all-namespaces --sort-by='.lastTimestamp' > /tmp/events.txt
kubectl get nodes -o wide > /tmp/nodes.txt
kubectl get services --all-namespaces -o wide > /tmp/services.txt
kubectl get pvc --all-namespaces > /tmp/pvcs.txt
kubectl get deployments --all-namespaces > /tmp/deployments.txt
```

### Step 2: Run Analyzers

{{#if parallel}}
I'll run multiple analyzers in parallel for comprehensive coverage:
{{else}}
I'll run the specified analyzer(s) sequentially:
{{/if}}

{{#if analyzer}}
**Running {{analyzer}} analyzer:**
{{else}}
**Running all core analyzers:**
{{/if}}

### Pod Analysis
```bash
# Find problematic pods
kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded
kubectl get pods --all-namespaces -o jsonpath='{range .items[*]}{.metadata.namespace}{" "}{.metadata.name}{" "}{.status.phase}{" "}{.status.reason}{"\n"}{end}' | grep -v "Running\|Succeeded"
```

### Service Analysis
```bash
# Check service endpoints
kubectl get endpoints --all-namespaces --field-selector=endpoints==[]
kubectl get services --all-namespaces -o wide
```

### PVC Analysis
```bash
# Check unbound PVCs
kubectl get pvc --all-namespaces --field-selector=status.phase!=Bound
kubectl describe pv
```

### Node Analysis
```bash
# Node conditions
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{" "}{range .status.conditions[*]}{.type}{"="}{.status}{" "}{end}{"\n"}{end}' | grep "False"
```

### Event Analysis
```bash
# Recent warning events
kubectl get events --all-namespaces --field-selector=type=Warning --sort-by='.lastTimestamp' | tail -50
```

## AI-Powered Analysis

Based on the collected data, I'll provide:

### 📊 Issue Detection
- Identify pods with restart issues
- Detect service connectivity problems
- Find storage mounting issues
- Highlight resource constraints
- Spot configuration errors

### 🔍 Root Cause Analysis
- Explain why issues are occurring
- Correlate related problems
- Identify configuration conflicts
- Analyze resource dependencies

### 💡 Solution Recommendations
- Provide specific commands to fix issues
- Suggest configuration improvements
- Recommend resource adjustments
- Offer preventive measures

### 📈 Health Summary
- Overall cluster health score
- Critical issues requiring immediate attention
- Performance optimization opportunities
- Security considerations

## Interactive Follow-up

After the initial analysis, I can:
- Deep dive into specific issues
- Generate remediation scripts
- Monitor fixes as they're applied
- Provide ongoing troubleshooting support

Would you like me to proceed with the diagnostics?