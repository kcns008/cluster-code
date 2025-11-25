---
name: k8s-troubleshooting
description: |
  Interpret and troubleshoot Kubernetes and OpenShift cluster events, logs, and errors. Use this skill when:
  (1) Analyzing pod/container logs for errors or issues
  (2) Interpreting cluster events (kubectl get events)
  (3) Debugging pod failures: CrashLoopBackOff, ImagePullBackOff, OOMKilled, etc.
  (4) Diagnosing networking issues: DNS, Service connectivity, Ingress/Route problems
  (5) Investigating storage issues: PVC pending, mount failures
  (6) Analyzing node problems: NotReady, resource pressure, taints
  (7) Troubleshooting OCP-specific issues: SCCs, Routes, Operators, Builds
  (8) Performance analysis and resource optimization
  (9) Cluster health assessment and capacity planning
---

# Kubernetes / OpenShift Troubleshooting Guide

## Command Usage Convention

**IMPORTANT**: This skill uses `kubectl` as the primary command in all examples. When working with:
- **OpenShift/ARO clusters**: Replace all `kubectl` commands with `oc`
- **Standard Kubernetes clusters (AKS, EKS, GKE, etc.)**: Use `kubectl` as shown

The agent will automatically detect the cluster type and use the appropriate command.

Systematic approach to diagnosing and resolving cluster issues through event analysis, log interpretation, and root cause identification.

## Troubleshooting Workflow

1. **Identify Scope**: Pod, Node, Namespace, or Cluster-wide issue?
2. **Gather Context**: Events, logs, resource status, recent changes
3. **Analyze Symptoms**: Match patterns to known issues
4. **Determine Root Cause**: Follow diagnostic tree
5. **Remediate**: Apply fix and verify resolution
6. **Document**: Record findings for future reference

## Quick Diagnostic Commands

```bash
# Pod status overview
kubectl get pods -n ${NAMESPACE} -o wide

# Recent events (sorted by time)
kubectl get events -n ${NAMESPACE} --sort-by='.lastTimestamp'

# Pod details and events
kubectl describe pod ${POD_NAME} -n ${NAMESPACE}

# Container logs (current)
kubectl logs ${POD_NAME} -n ${NAMESPACE} -c ${CONTAINER}

# Container logs (previous crashed instance)
kubectl logs ${POD_NAME} -n ${NAMESPACE} -c ${CONTAINER} --previous

# Node status
kubectl get nodes -o wide
kubectl describe node ${NODE_NAME}

# Resource usage
kubectl top pods -n ${NAMESPACE}
kubectl top nodes

# OpenShift specific
oc get events -n ${NAMESPACE}
oc adm top pods -n ${NAMESPACE}
oc get clusteroperators
oc adm node-logs ${NODE_NAME} -u kubelet
```

## Pod Status Interpretation

### Pod Phase States

| Phase | Meaning | Action |
|-------|---------|--------|
| `Pending` | Not scheduled or pulling images | Check events, node resources, PVC status |
| `Running` | At least one container running | Check container statuses if issues |
| `Succeeded` | All containers completed successfully | Normal for Jobs |
| `Failed` | All containers terminated, at least one failed | Check logs, exit codes |
| `Unknown` | Cannot determine state | Node communication issue |

### Container State Analysis

#### Waiting States

| Reason | Cause | Resolution |
|--------|-------|------------|
| `ContainerCreating` | Setting up container | Check events for errors, volume mounts |
| `ImagePullBackOff` | Cannot pull image | Verify image name, registry access, credentials |
| `ErrImagePull` | Image pull failed | Check image exists, network, ImagePullSecrets |
| `CreateContainerConfigError` | Config error | Check ConfigMaps, Secrets exist and mounted correctly |
| `InvalidImageName` | Malformed image reference | Fix image name in spec |
| `CrashLoopBackOff` | Container repeatedly crashing | Check logs --previous, fix application |

#### Terminated States

| Reason | Exit Code | Cause | Resolution |
|--------|-----------|-------|------------|
| `OOMKilled` | 137 | Memory limit exceeded | Increase memory limit, fix memory leak |
| `Error` | 1 | Application error | Check logs for stack trace |
| `Error` | 126 | Command not executable | Fix command/entrypoint permissions |
| `Error` | 127 | Command not found | Fix command path, verify image contents |
| `Error` | 128 | Invalid exit code | Application bug |
| `Error` | 130 | SIGINT (Ctrl+C) | Normal if manual termination |
| `Error` | 137 | SIGKILL | OOM or forced termination |
| `Error` | 143 | SIGTERM | Graceful shutdown requested |
| `Completed` | 0 | Normal exit | Expected for Jobs/init containers |

## Event Analysis

### Event Types and Severity

```
Type: Normal   → Informational, typically no action needed
Type: Warning  → Potential issue, investigate
```

### Critical Events to Monitor

#### Pod Scheduling Events

| Event Reason | Meaning | Resolution |
|--------------|---------|------------|
| `FailedScheduling` | Cannot place pod | Check node resources, taints, affinity |
| `Unschedulable` | No suitable node | Add nodes, adjust requirements |
| `NodeNotReady` | Target node unavailable | Check node status |
| `TaintManagerEviction` | Pod evicted due to taint | Check node taints, add tolerations |

**FailedScheduling Analysis:**
```
# Common messages and fixes:
"Insufficient cpu"           → Reduce requests or add capacity
"Insufficient memory"        → Reduce requests or add capacity  
"node(s) had taint"          → Add toleration or remove taint
"node(s) didn't match selector" → Fix nodeSelector/affinity
"persistentvolumeclaim not found" → Create PVC or fix name
"0/3 nodes available"        → All nodes have issues, check each
```

#### Image Events

| Event Reason | Meaning | Resolution |
|--------------|---------|------------|
| `Pulling` | Downloading image | Normal, wait |
| `Pulled` | Image downloaded | Normal |
| `Failed` | Pull failed | Check image name, registry, auth |
| `BackOff` | Repeated pull failures | Fix underlying issue |
| `ErrImageNeverPull` | Image not local with Never policy | Change imagePullPolicy or pre-pull |

**ImagePullBackOff Diagnosis:**
```bash
# Check image name is correct
kubectl get pod ${POD} -o jsonpath='{.spec.containers[*].image}'

# Verify ImagePullSecrets
kubectl get pod ${POD} -o jsonpath='{.spec.imagePullSecrets}'
kubectl get secret ${SECRET} -n ${NAMESPACE}

# Test registry access
kubectl run test --image=${IMAGE} --restart=Never --rm -it -- /bin/sh
```

#### Volume Events

| Event Reason | Meaning | Resolution |
|--------------|---------|------------|
| `FailedMount` | Cannot mount volume | Check PVC, storage class, permissions |
| `FailedAttachVolume` | Cannot attach volume | Check cloud provider, volume exists |
| `VolumeResizeFailed` | Cannot expand volume | Check storage class allows expansion |
| `ProvisioningFailed` | Cannot create volume | Check storage class, quotas |

**PVC Pending Diagnosis:**
```bash
# Check PVC status and events
kubectl describe pvc ${PVC_NAME} -n ${NAMESPACE}

# Verify StorageClass exists and is default
kubectl get storageclass

# Check for available PVs (if not dynamic provisioning)
kubectl get pv

# OpenShift: Check storage operator
oc get clusteroperator storage
```

#### Container Events

| Event Reason | Meaning | Resolution |
|--------------|---------|------------|
| `Created` | Container created | Normal |
| `Started` | Container started | Normal |
| `Killing` | Container being stopped | Normal during updates/scale-down |
| `Unhealthy` | Probe failed | Fix probe or application |
| `ProbeWarning` | Probe returned warning | Check probe configuration |
| `BackOff` | Container crashing | Check logs, fix application |

### Event Patterns

#### Flapping Pod (Repeated restarts)
```
Events:
  Warning  BackOff    Container is in waiting state due to CrashLoopBackOff
  Normal   Pulled     Container image already present
  Normal   Created    Created container
  Normal   Started    Started container
  Warning  BackOff    Back-off restarting failed container
```
**Diagnosis**: Check `kubectl logs --previous`, application is crashing on startup.

#### Resource Starvation
```
Events:
  Warning  FailedScheduling  0/3 nodes are available: 3 Insufficient cpu
```
**Diagnosis**: Cluster needs more capacity or pod requests are too high.

#### Probe Failures
```
Events:
  Warning  Unhealthy  Liveness probe failed: HTTP probe failed with statuscode: 503
  Normal   Killing    Container failed liveness probe, will be restarted
```
**Diagnosis**: Application not responding, check if startup is slow (use startupProbe) or app is unhealthy.

## Log Analysis Patterns

### Common Error Patterns

#### Application Startup Failures
```
# Java
java.lang.OutOfMemoryError: Java heap space
→ Increase memory limit, tune JVM heap (-Xmx)

java.net.ConnectException: Connection refused
→ Dependency not ready, add init container or retry logic

# Python
ModuleNotFoundError: No module named 'xxx'
→ Missing dependency, fix requirements.txt/Dockerfile

# Node.js
Error: Cannot find module 'xxx'
→ Missing dependency, fix package.json or node_modules

# General
ECONNREFUSED, Connection refused
→ Service dependency not available

ENOTFOUND, getaddrinfo ENOTFOUND
→ DNS resolution failed, check service name
```

#### Database Connection Issues
```
# PostgreSQL
FATAL: password authentication failed
→ Wrong credentials, check Secret values

connection refused
→ Database not running or wrong host/port

too many connections
→ Connection pool exhaustion, configure pool size

# MySQL
Access denied for user
→ Wrong credentials or missing grants

Can't connect to MySQL server
→ Database not running or network issue

# MongoDB
MongoNetworkError
→ Connection string wrong or network issue
```

#### Memory Issues
```
# Container OOMKilled
Last State: Terminated
Reason: OOMKilled
Exit Code: 137

→ Solutions:
1. Increase memory limit
2. Profile application memory usage
3. Fix memory leaks
4. For JVM: Set -Xmx < container limit (leave ~25% headroom)
```

#### Permission Issues
```
# File system
Permission denied
mkdir: cannot create directory: Permission denied
→ Check securityContext, runAsUser, fsGroup

# OpenShift SCC
Error: container has runAsNonRoot and image has non-numeric user
→ Add runAsUser to securityContext

pods "xxx" is forbidden: unable to validate against any security context constraint
→ Create appropriate SCC or use service account with SCC access
```

### Log Analysis Commands

```bash
# Search for errors in logs
kubectl logs ${POD} -n ${NS} | grep -iE "(error|exception|fatal|panic)"

# Follow logs in real-time
kubectl logs -f ${POD} -n ${NS}

# Logs from all containers in pod
kubectl logs ${POD} -n ${NS} --all-containers

# Logs from multiple pods (by label)
kubectl logs -l app=${APP_NAME} -n ${NS} --all-containers

# Logs with timestamps
kubectl logs ${POD} -n ${NS} --timestamps

# Logs from last hour
kubectl logs ${POD} -n ${NS} --since=1h

# Logs from last 100 lines
kubectl logs ${POD} -n ${NS} --tail=100

# OpenShift: Node-level logs
oc adm node-logs ${NODE} -u kubelet
oc adm node-logs ${NODE} -u crio
oc adm node-logs ${NODE} --path=journal
```

## Node Troubleshooting

### Node Conditions

| Condition | Status | Meaning |
|-----------|--------|---------|
| `Ready` | True | Node healthy |
| `Ready` | False | Kubelet not healthy |
| `Ready` | Unknown | No heartbeat from node |
| `MemoryPressure` | True | Low memory |
| `DiskPressure` | True | Low disk space |
| `PIDPressure` | True | Too many processes |
| `NetworkUnavailable` | True | Network not configured |

### Node NotReady Diagnosis

```bash
# Check node status
kubectl describe node ${NODE_NAME}

# Check kubelet status (SSH to node or via oc adm)
systemctl status kubelet
journalctl -u kubelet -f

# Check container runtime
systemctl status crio  # or containerd/docker
journalctl -u crio -f

# Check node resources
df -h
free -m
top

# OpenShift: Machine status
oc get machines -n openshift-machine-api
oc describe machine ${MACHINE} -n openshift-machine-api
```

### Node Resource Pressure

```bash
# Check resource allocation vs capacity
kubectl describe node ${NODE} | grep -A 10 "Allocated resources"

# Find pods using most resources
kubectl top pods -A --sort-by=cpu
kubectl top pods -A --sort-by=memory

# Evict pods from node (drain)
kubectl drain ${NODE} --ignore-daemonsets --delete-emptydir-data
```

## Networking Troubleshooting

### DNS Issues

```bash
# Test DNS resolution from a debug pod
kubectl run dns-test --image=busybox:1.28 --rm -it --restart=Never -- nslookup ${SERVICE_NAME}
kubectl run dns-test --image=busybox:1.28 --rm -it --restart=Never -- nslookup ${SERVICE_NAME}.${NAMESPACE}.svc.cluster.local

# Check CoreDNS/DNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns

# Check DNS service
kubectl get svc -n kube-system kube-dns
```

### Service Connectivity

```bash
# Verify service exists and has endpoints
kubectl get svc ${SERVICE} -n ${NS}
kubectl get endpoints ${SERVICE} -n ${NS}

# Test service from debug pod
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- \
  curl -v http://${SERVICE}.${NS}.svc.cluster.local:${PORT}

# Check if pods match service selector
kubectl get pods -n ${NS} -l ${SELECTOR} -o wide
```

### Ingress/Route Issues

```bash
# Check Ingress status
kubectl describe ingress ${INGRESS} -n ${NS}

# Check Ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# OpenShift Route
oc describe route ${ROUTE} -n ${NS}
oc get route ${ROUTE} -n ${NS} -o yaml

# Check router pods
oc get pods -n openshift-ingress
oc logs -n openshift-ingress -l ingresscontroller.operator.openshift.io/deployment-ingresscontroller=default
```

### NetworkPolicy Debugging

```bash
# List NetworkPolicies affecting a pod
kubectl get networkpolicy -n ${NS}

# Test connectivity with ephemeral debug container
kubectl debug ${POD} -n ${NS} --image=nicolaka/netshoot -- \
  curl -v http://${TARGET_SERVICE}:${PORT}

# Check if traffic is blocked (look for drops)
# On node running the pod:
conntrack -L | grep ${POD_IP}
```

## OpenShift-Specific Troubleshooting

### Cluster Operators

```bash
# Check overall cluster health
oc get clusteroperators

# Investigate degraded operator
oc describe clusteroperator ${OPERATOR}

# Check operator logs
oc logs -n openshift-${OPERATOR} -l name=${OPERATOR}-operator
```

### Security Context Constraints (SCC)

```bash
# List SCCs
oc get scc

# Check which SCC a pod is using
oc get pod ${POD} -n ${NS} -o yaml | grep scc

# Check which SCC a serviceaccount can use
oc adm policy who-can use scc restricted-v2

# Add SCC to service account (requires admin)
oc adm policy add-scc-to-user ${SCC} -z ${SERVICE_ACCOUNT} -n ${NS}
```

**Common SCC Issues:**
```
Error: pods "xxx" is forbidden: unable to validate against any security context constraint

→ Diagnosis:
1. Check pod securityContext requirements
2. Find compatible SCC: oc get scc
3. Grant SCC to service account or adjust pod spec

Common fixes:
- Add runAsUser to match SCC requirements
- Use less restrictive SCC (not recommended for prod)
- Create custom SCC for specific needs
```

### Build Failures

```bash
# Check build status
oc get builds -n ${NS}
oc describe build ${BUILD} -n ${NS}

# Build logs
oc logs build/${BUILD} -n ${NS}
oc logs -f bc/${BUILDCONFIG} -n ${NS}

# Check builder pod
oc get pods -n ${NS} | grep build
oc describe pod ${BUILD_POD} -n ${NS}
```

**Common Build Issues:**
| Error | Cause | Resolution |
|-------|-------|------------|
| `error: build error: image not found` | Base image missing | Check ImageStream or external registry |
| `AssembleInputError` | S2I assemble failed | Check application dependencies |
| `GenericBuildFailed` | Build command failed | Check build logs for details |
| `PushImageToRegistryFailed` | Cannot push to registry | Check registry access, quotas |

### ImageStream Issues

```bash
# Check ImageStream
oc get is ${IS_NAME} -n ${NS}
oc describe is ${IS_NAME} -n ${NS}

# Import external image
oc import-image ${IS_NAME}:${TAG} --from=${EXTERNAL_IMAGE} --confirm -n ${NS}

# Check image import status
oc get imagestreamtag ${IS_NAME}:${TAG} -n ${NS}
```

## Performance Analysis

### Resource Optimization

```bash
# Get actual resource usage vs requests
kubectl top pods -n ${NS}

# Compare with requests/limits
kubectl get pods -n ${NS} -o custom-columns=\
NAME:.metadata.name,\
CPU_REQ:.spec.containers[*].resources.requests.cpu,\
CPU_LIM:.spec.containers[*].resources.limits.cpu,\
MEM_REQ:.spec.containers[*].resources.requests.memory,\
MEM_LIM:.spec.containers[*].resources.limits.memory

# Find pods without resource limits
kubectl get pods -A -o json | jq -r \
  '.items[] | select(.spec.containers[].resources.limits == null) | 
   "\(.metadata.namespace)/\(.metadata.name)"'
```

### Right-Sizing Recommendations

| Symptom | Indication | Action |
|---------|------------|--------|
| CPU throttling, high latency | CPU limit too low | Increase CPU limit |
| OOMKilled frequently | Memory limit too low | Increase memory limit |
| Low CPU utilization | Over-provisioned | Reduce CPU request |
| Low memory utilization | Over-provisioned | Reduce memory request |
| Pending pods | Cluster capacity full | Add nodes or optimize |

### Latency Investigation

```bash
# Check pod startup time
kubectl get pod ${POD} -n ${NS} -o jsonpath='{.status.conditions}'

# Check container startup
kubectl get pod ${POD} -n ${NS} -o jsonpath='{.status.containerStatuses[*].state}'

# Slow image pulls
kubectl describe pod ${POD} -n ${NS} | grep -A 5 "Events"

# Network latency test
kubectl run nettest --image=nicolaka/netshoot --rm -it --restart=Never -- \
  curl -w "@curl-format.txt" -o /dev/null -s http://${SERVICE}:${PORT}
```

## Diagnostic Decision Trees

### Pod Not Starting

```
Pod stuck in Pending?
├── Yes → Check Events
│   ├── "FailedScheduling" → Check node resources, taints, affinity
│   ├── "no persistent volumes available" → Create PV or check StorageClass
│   └── No events → Check namespace quotas, kube-scheduler
└── No → Pod stuck in ContainerCreating?
    ├── Yes → Check Events
    │   ├── "ImagePullBackOff" → Check image name, registry, secrets
    │   ├── "FailedMount" → Check PVC, secrets, configmaps
    │   └── "NetworkNotReady" → Check CNI plugin
    └── No → Pod in CrashLoopBackOff?
        ├── Yes → Check logs --previous
        │   ├── Exit code 137 → OOMKilled, increase memory
        │   ├── Exit code 1 → Application error, fix code
        │   └── No logs → Entrypoint/command issue
        └── No → Check container status for specific error
```

### Application Not Reachable

```
Can reach Service ClusterIP?
├── No → Check Service selector matches pod labels
│   ├── Endpoints empty → Fix selector or check pod health
│   └── Endpoints exist → Check NetworkPolicy blocking traffic
└── Yes → Can reach via Ingress/Route?
    ├── No → Check Ingress/Route config
    │   ├── Ingress controller running? → Check controller pods
    │   ├── TLS certificate valid? → Check cert-manager/secrets
    │   └── Host header correct? → Test with curl -H "Host: xxx"
    └── Yes → Application returning errors?
        ├── 502/503/504 → Backend not ready, check pods
        ├── 404 → Path routing issue
        └── 5xx → Application error, check logs
```

## Health Check Scripts

### Cluster Health Summary

```bash
#!/bin/bash
# cluster-health.sh - Quick cluster health check

echo "=== Node Status ==="
kubectl get nodes -o wide

echo -e "\n=== Pods Not Running ==="
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded

echo -e "\n=== Recent Warning Events ==="
kubectl get events -A --field-selector type=Warning --sort-by='.lastTimestamp' | tail -20

echo -e "\n=== Resource Pressure ==="
kubectl top nodes

echo -e "\n=== PVCs Not Bound ==="
kubectl get pvc -A --field-selector=status.phase!=Bound

# OpenShift specific
if command -v oc &> /dev/null; then
    echo -e "\n=== Cluster Operators ==="
    oc get clusteroperators | grep -v "True.*False.*False"
fi
```

### Namespace Health Check

```bash
#!/bin/bash
# namespace-health.sh ${NAMESPACE}

NS=${1:-default}

echo "=== Pods in $NS ==="
kubectl get pods -n $NS -o wide

echo -e "\n=== Recent Events ==="
kubectl get events -n $NS --sort-by='.lastTimestamp' | tail -15

echo -e "\n=== Resource Usage ==="
kubectl top pods -n $NS 2>/dev/null || echo "Metrics not available"

echo -e "\n=== Services ==="
kubectl get svc -n $NS

echo -e "\n=== Deployments ==="
kubectl get deploy -n $NS

echo -e "\n=== PVCs ==="
kubectl get pvc -n $NS
```

## Quick Reference: Exit Codes

| Code | Signal | Meaning |
|------|--------|---------|
| 0 | - | Success |
| 1 | - | General error |
| 2 | - | Misuse of command |
| 126 | - | Command not executable |
| 127 | - | Command not found |
| 128 | - | Invalid exit argument |
| 130 | SIGINT | Keyboard interrupt |
| 137 | SIGKILL | Kill signal (OOM or forced) |
| 143 | SIGTERM | Termination signal |
| 255 | - | Exit status out of range |
