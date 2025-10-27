---
name: service-describe
description: Detailed service analysis including endpoints, connectivity, and configuration
args:
  - name: service
    description: Service name to analyze (required)
    required: true
    hint: service-name
  - name: namespace
    description: Namespace (default: current)
    required: false
    hint: --namespace
  - name: test
    description: Test connectivity to the service
    required: false
    hint: --test
tools:
  - Bash
  - Grep
permissions:
  allow:
    - Bash(kubectl:*)
    - Bash(oc:*)
model: sonnet
color: blue
---

# Service Analysis and Connectivity Testing

I'll provide comprehensive analysis of your Kubernetes service including configuration, endpoints, and connectivity testing.

## Service Configuration

```bash
# Basic service information
kubectl get service {{service}} -n {{namespace}} -o wide

# Service specification details
kubectl get service {{service}} -n {{namespace}} -o yaml

# Service selector and matching pods
kubectl get service {{service}} -n {{namespace}} -o jsonpath='{.spec.selector}'

# Pods matching the service selector
selector=$(kubectl get service {{service}} -n {{namespace}} -o jsonpath='{.spec.selector | keys[0]}')=$(kubectl get service {{service}} -n {{namespace}} -o jsonpath='{.spec.selector | values[0]}')
kubectl get pods -n {{namespace}} -l $selector -o wide
```

## Endpoint Analysis

```bash
# Service endpoints
kubectl get endpoints {{service}} -n {{namespace}} -o wide

# Endpoint details with pod information
kubectl get endpoints {{service}} -n {{namespace}} -o yaml

# Check if endpoints are ready
kubectl get endpoints {{service}} -n {{namespace}} -o jsonpath='{range .subsets[*]}{range .addresses[*]}{.ip}{":"}{.ports[0].port}{" ready\n"}{end}{end}'

# Check for unready endpoints
kubectl get endpoints {{service}} -n {{namespace}} -o jsonpath='{range .subsets[*]}{range .notReadyAddresses[*]}{.ip}{":"}{.ports[0].port}{" not ready\n"}{end}{end}'
```

## Service Types and Configuration

```bash
# Service type analysis
kubectl get service {{service}} -n {{namespace}} -o jsonpath='{.spec.type}{"\n"}'

# ClusterIP service details
if [ "$(kubectl get service {{service}} -n {{namespace}} -o jsonpath='{.spec.type}')" = "ClusterIP" ]; then
  echo "ClusterIP: $(kubectl get service {{service}} -n {{namespace}} -o jsonpath='{.spec.clusterIP}')"
  echo "Ports: $(kubectl get service {{service}} -n {{namespace}} -o jsonpath='{range .spec.ports[*]}{.port}{"/"}{.targetPort}{", "}{end}')"
fi

# NodePort service details
if [ "$(kubectl get service {{service}} -n {{namespace}} -o jsonpath='{.spec.type}')" = "NodePort" ]; then
  echo "NodePort: $(kubectl get service {{service}} -n {{namespace}} -o jsonpath='{range .spec.ports[*]}{.nodePort}{"\n"}{end}')"
fi

# LoadBalancer service details
if [ "$(kubectl get service {{service}} -n {{namespace}} -o jsonpath='{.spec.type}')" = "LoadBalancer" ]; then
  echo "External IP: $(kubectl get service {{service}} -n {{namespace}} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  echo "Hostname: $(kubectl get service {{service}} -n {{namespace}} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
fi
```

{{#if test}}
## Connectivity Testing

```bash
# Create a test pod for connectivity testing
kubectl run service-test --image=nicolaka/netshoot --rm -it --restart=Never -- bash -c "
echo 'Testing DNS resolution for {{service}}.{{namespace}}.svc.cluster.local'
nslookup {{service}}.{{namespace}}.svc.cluster.local

echo 'Testing service connectivity'
# Test each port
kubectl get service {{service}} -n {{namespace}} -o jsonpath='{range .spec.ports[*]}{.port}{\" \"}{end}' | while read port; do
  echo \"Testing port \$port...\"
  timeout 5 nc -zv {{service}}.{{namespace}}.svc.cluster.local \$port 2>&1 || echo \"Connection failed on port \$port\"
done
"
```

## Port Forwarding Test

```bash
# Set up port forwarding for local testing
echo "Setting up port forwarding for {{service}}..."
kubectl port-forward service/{{service}} 8080:80 -n {{namespace}} &

# Test local connection
sleep 2
curl -s http://localhost:8080/healthz 2>/dev/null && echo "✅ Service accessible via port-forward" || echo "❌ Service not accessible via port-forward"

# Clean up
kill %1 2>/dev/null
```
{{/if}}

## DNS and Service Discovery

```bash
# Test DNS resolution
kubectl run dns-test --image=busybox --rm -it --restart=Never -- nslookup {{service}}.{{namespace}}.svc.cluster.local

# Test service discovery from pods
kubectl run dns-test --image=busybox --rm -it --restart=Never -- wget -qO- {{service}}.{{namespace}}.svc.cluster.local:80/healthz 2>/dev/null || echo "Service not reachable"
```

## Related Resources

```bash
# Ingress resources pointing to this service
kubectl get ingress -n {{namespace}} -o jsonpath='{range .items[*]}{range .spec.rules[*]}{range .http.paths[*]}{.backend.service.name}{"\n"}{end}{end}{end}' | grep {{service}}

# Endpointslice information
kubectl get endpointslices -n {{namespace}} -l kubernetes.io/service-name={{service}}

# Network policies affecting this service
kubectl get networkpolicies -n {{namespace}} -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | while read policy; do
  echo "Checking policy $policy for service {{service}}..."
  kubectl get networkpolicy $policy -n {{namespace}} -o yaml | grep -q {{service}} && echo "Policy $policy affects service {{service}}"
done
```

## Service Health Analysis

I'll analyze:

### 🔍 Configuration Issues
- **Selector Mismatches**: Service selector doesn't match pod labels
- **Port Configuration**: Incorrect port mappings or protocols
- **Service Type**: Inappropriate service type for use case
- **Session Affinity**: Missing or misconfigured session affinity

### 🚨 Connectivity Problems
- **No Endpoints**: Service has no ready endpoints
- **DNS Resolution**: Service not resolvable within cluster
- **Network Policies**: Traffic blocked by network policies
- **Firewall Rules**: External access blocked by security rules

### 📊 Performance Issues
- **Load Balancing**: Uneven traffic distribution
- **Timeout Settings**: Too short or too long timeouts
- **Connection Limits**: Hitting connection or rate limits
- **Resource Exhaustion**: Service endpoints overwhelmed

## Troubleshooting Steps

### Quick Diagnostics
1. **Check service status**: `kubectl get service {{service}} -n {{namespace}}`
2. **Verify endpoints**: `kubectl get endpoints {{service}} -n {{namespace}}`
3. **Check selector labels**: Verify pod labels match service selector
4. **Test DNS resolution**: Use nslookup to test service discovery

### Deep Investigation
1. **Pod health**: Check if backend pods are healthy
2. **Port configuration**: Verify target ports match container ports
3. **Network policies**: Review network policies affecting traffic
4. **Resource limits**: Check for resource constraints

### External Access Issues
1. **Load balancer**: Verify external load balancer provisioning
2. **Ingress configuration**: Check ingress rules and backend services
3. **NodePort access**: Test node port accessibility from external clients
4. **Security groups**: Verify cloud security group rules

## Optimization Recommendations

Based on the analysis, I can suggest:

### Performance Tuning
- **Load balancing algorithms**: Choose appropriate algorithms
- **Health check configuration**: Optimize readiness and liveness probes
- **Timeout settings**: Adjust based on application requirements
- **Connection pooling**: Configure for optimal performance

### Security Hardening
- **Network policies**: Implement least-privilege network access
- **Service mesh integration**: Add mTLS and traffic management
- **Access control**: Implement proper RBAC and access controls
- **Encryption**: Enable TLS for service-to-service communication

### Reliability Improvements
- **Redundancy**: Ensure multiple backend endpoints
- **Health monitoring**: Set up comprehensive health checks
- **Failover testing**: Test service failover scenarios
- **Monitoring**: Implement service-level monitoring and alerting

Would you like me to proceed with the detailed service analysis and connectivity testing?