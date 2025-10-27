---
name: resource-describe
description: Describe any Kubernetes resource with detailed analysis and insights
args:
  - name: type
    description: Resource type (pod, service, deployment, pvc, etc.)
    required: true
    hint: resource-type
  - name: name
    description: Resource name
    required: true
    hint: resource-name
  - name: namespace
    description: Namespace (default: current)
    required: false
    hint: --namespace
  - name: events
    description: Show related events
    required: false
    hint: --events
  - name: analyze
    description: Provide AI-powered analysis of the resource
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
color: purple
---

# Resource Description and Analysis

I'll provide a comprehensive description of your Kubernetes resource with intelligent analysis and insights.

## Resource Information

```bash
# Basic resource description
kubectl describe {{type}} {{name}} -n {{namespace}}

# Resource YAML specification
kubectl get {{type}} {{name}} -n {{namespace}} -o yaml
```

## Resource Status

```bash
# Current status
kubectl get {{type}} {{name}} -n {{namespace}} -o wide

# Resource conditions (if applicable)
kubectl get {{type}} {{name}} -n {{namespace}} -o jsonpath='{range .status.conditions[*]}{.type}{"="}{.status}{" - "}{.reason}{": "}{.message}{"\n"}{end}'
```

{{#if events}}
## Related Events

```bash
# Events for this resource
kubectl get events -n {{namespace}} --field-selector=involvedObject.name={{name}},involvedObject.kind={{type}} --sort-by='.lastTimestamp'

# Recent warnings
kubectl get events -n {{namespace}} --field-selector=involvedObject.name={{name}},involvedObject.kind={{type}},type=Warning --sort-by='.lastTimestamp' | tail -10
```
{{/if}}

## Resource-Specific Analysis

{{#if (eq type "pod")}}
### Pod Analysis
```bash
# Container status
kubectl get pod {{name}} -n {{namespace}} -o jsonpath='{range .status.containerStatuses[*]}{.name}{"\n  Ready: "}{.ready}{"\n  RestartCount: "}{.restartCount}{"\n  State: "}{.state}{"\n\n"}{end}'

# Resource usage
kubectl top pod {{name}} -n {{namespace}} 2>/dev/null || echo "Metrics not available"

# Pod events
kubectl get events -n {{namespace}} --field-selector=involvedObject.name={{name}} --sort-by='.lastTimestamp'
```
{{/if}}

{{#if (eq type "service")}}
### Service Analysis
```bash
# Service endpoints
kubectl get endpoints {{name}} -n {{namespace}} -o wide

# Service details
kubectl get service {{name}} -n {{namespace}} -o jsonpath='{.spec.type}{"\nClusterIP: "}{.spec.clusterIP}{"\nPorts: "}{range .spec.ports[*]}{.port}{"/"}{.targetPort}{", "}{end}{"\n"}'

# Ingress for this service
kubectl get ingress -n {{namespace}} -o jsonpath='{range .items[*]}{range .spec.rules[*]}{range .http.paths[*]}{.backend.service.name}{"\n"}{end}{end}{end}' | grep {{name}}
```
{{/if}}

{{#if (eq type "deployment")}}
### Deployment Analysis
```bash
# Deployment status
kubectl get deployment {{name}} -n {{namespace}} -o jsonpath='{.status.readyReplicas}{"/"}{.status.replicas}{" replicas ready"}'

# Replica sets
kubectl get replicasets -n {{namespace}} -l deployment={{name}}

# Pod status
kubectl get pods -n {{namespace}} -l deployment={{name}} --show-labels

# Rollout history
kubectl rollout history deployment/{{name}} -n {{namespace}}
```
{{/if}}

{{#if (eq type "pvc")}}
### PVC Analysis
```bash
# PVC status and details
kubectl get pvc {{name}} -n {{namespace}} -o jsonpath='{.status.phase}{"\nStorageClass: "}{.spec.storageClassName}{"\nAccessModes: "}{.spec.accessModes}{"\nCapacity: "}{.status.capacity.storage}{"\n"}'

# Persistent volume details
PV=$(kubectl get pvc {{name}} -n {{namespace}} -o jsonpath='{.spec.volumeName}')
kubectl get pv $PV -o yaml

# Storage class details
SC=$(kubectl get pvc {{name}} -n {{namespace}} -o jsonpath='{.spec.storageClassName}')
kubectl get storageclass $SC -o yaml
```
{{/if}}

{{#if analyze}}
## AI-Powered Resource Analysis

I'll analyze the resource configuration and status to provide:

### 🔍 Configuration Analysis
- **Resource Specifications**: Review resource requests, limits, and settings
- **Health Checks**: Analyze readiness/liveness probes and thresholds
- **Network Configuration**: Check services, ports, and connectivity
- **Storage Setup**: Verify volume mounts and storage classes
- **Security Context**: Examine RBAC, security policies, and constraints

### 📊 Performance Assessment
- **Resource Utilization**: Analyze CPU/memory usage patterns
- **Scaling Readiness**: Evaluate HPA configuration and scaling policies
- **Dependencies**: Identify service dependencies and potential bottlenecks
- **Capacity Planning**: Assess resource allocation vs. actual usage

### 💡 Optimization Recommendations
- **Resource Tuning**: Suggest optimal CPU/memory requests and limits
- **Configuration Improvements**: Recommend better probe configurations
- **Performance Enhancements**: Identify optimization opportunities
- **Cost Optimization**: Suggest ways to reduce resource waste

### ⚠️ Issue Detection
- **Configuration Problems**: Spot misconfigurations that could cause issues
- **Resource Constraints**: Identify potential resource bottlenecks
- **Security Concerns**: Highlight security misconfigurations
- **Best Practice Violations**: Point out deviations from Kubernetes best practices

### 📈 Health Summary
- **Overall Status**: Resource health and readiness assessment
- **Critical Issues**: Problems requiring immediate attention
- **Performance Metrics**: Key performance indicators
- **Recommendations**: Actionable improvement suggestions
{{/if}}

## Related Resources

```bash
# Find related resources
kubectl get all -n {{namespace}} -l app={{name}} 2>/dev/null || echo "No resources with label app={{name}}"
kubectl get all -n {{namespace}} -l name={{name}} 2>/dev/null || echo "No resources with label name={{name}}"
```

## Quick Actions

Based on the analysis, I can help you:
- **Edit the resource**: `kubectl edit {{type}} {{name}} -n {{namespace}}`
- **Scale resources**: Adjust replica counts or resource limits
- **Restart services**: Trigger rollouts or pod restarts
- **Debug issues**: Investigate specific problems in detail
- **Optimize configuration**: Apply performance and cost optimizations

Would you like me to proceed with the detailed description and analysis?