---
name: pod-logs
description: View and analyze pod logs with AI-powered insights
args:
  - name: pod
    description: Pod name (required)
    required: true
    hint: pod-name
  - name: namespace
    description: Namespace (default: current)
    required: false
    hint: --namespace
  - name: container
    description: Container name for multi-container pods
    required: false
    hint: --container
  - name: follow
    description: Follow logs in real-time
    required: false
    hint: --follow
  - name: tail
    description: Number of lines to show (default: 100)
    required: false
    hint: --tail
  - name: analyze
    description: Use AI to analyze log patterns
    required: false
    hint: --analyze
tools:
  - Bash
  - Grep
  - Read
permissions:
  allow:
    - Bash(kubectl:*)
    - Bash(oc:*)
model: sonnet
color: cyan
---

# Pod Logs Viewer and Analyzer

I'll help you view and analyze pod logs with intelligent insights and pattern recognition.

## Pod Information

```bash
# Get pod details
kubectl get pod {{pod}} -n {{namespace}} -o wide
kubectl describe pod {{pod}} -n {{namespace}}
```

## Log Collection

```bash
# Get recent logs
kubectl logs {{pod}} -n {{namespace}} {{#if container}}-c {{container}}{{/if}} --tail={{tail}} 2>&1
```

{{#if follow}}
```bash
# Follow logs in real-time
kubectl logs {{pod}} -n {{namespace}} {{#if container}}-c {{container}}{{/if}} --follow
```
{{/if}}

## Previous Log Analysis (if container restarted)

```bash
# Check if pod has restarted
kubectl get pod {{pod}} -n {{namespace}} -o jsonpath='{.status.containerStatuses[0].restartCount}'

# Get previous logs if restarted
kubectl logs {{pod}} -n {{namespace}} {{#if container}}-c {{container}}{{/if}} --previous 2>&1
```

{{#if analyze}}
## AI-Powered Log Analysis

I'll analyze the logs for:

### 🔍 Error Pattern Detection
- Common application errors
- Database connection issues
- Network timeout patterns
- Resource exhaustion indicators
- Configuration problems

### 📊 Log Statistics
- Error frequency analysis
- Warning pattern identification
- Performance bottleneck detection
- Anomaly detection in log patterns

### 💡 Intelligent Insights
- Root cause suggestions based on error patterns
- Performance optimization recommendations
- Configuration tuning advice
- Preventive maintenance suggestions

## Analysis Implementation

```bash
# Extract error patterns
kubectl logs {{pod}} -n {{namespace}} {{#if container}}-c {{container}}{{/if}} --tail=1000 2>&1 | grep -i -E "(error|exception|failed|timeout|denied|refused)" | head -20

# Check for common issues
kubectl logs {{pod}} -n {{namespace}} {{#if container}}-c {{container}}{{/if}} --tail=500 2>&1 | grep -i -E "(out of memory|cannot allocate|no space left|connection refused|permission denied)"

# Analyze log patterns
kubectl logs {{pod}} -n {{namespace}} {{#if container}}-c {{container}}{{/if}} --tail=200 2>&1 | awk '{print $1}' | sort | uniq -c | sort -nr | head -10
```
{{/if}}

## Multi-Container Support

{{#if container}}
**Showing logs for container: {{container}}**

Other available containers:
```bash
kubectl get pod {{pod}} -n {{namespace}} -o jsonpath='{range .spec.containers[*]}{.name}{"\n"}{end}'
```
{{else}}
**Available containers in this pod:**
```bash
kubectl get pod {{pod}} -n {{namespace}} -o jsonpath='{range .spec.containers[*]}{.name}{"\n"}{end}'
```
{{/if}}

## Troubleshooting Tips

Based on the log analysis, I can help you:

### 🐛 Debug Common Issues
- **Image Pull Errors**: Check image availability and registry access
- **CrashLoopBackOff**: Analyze application startup failures
- **Resource Limits**: Identify memory/CPU constraints
- **Network Issues**: Detect connectivity and DNS problems

### 🔧 Quick Fixes
- Restart problematic containers
- Adjust resource limits
- Update configuration
- Check dependencies

### 📈 Performance Optimization
- Identify slow operations
- Suggest resource adjustments
- Recommend scaling strategies

Would you like me to proceed with fetching and analyzing the logs?