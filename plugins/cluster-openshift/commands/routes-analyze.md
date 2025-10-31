---
name: routes-analyze
description: Analyze OpenShift Routes for connectivity, TLS, and backend service issues
category: openshift-networking
tools:
  - Bash(oc:*)
  - Bash(kubectl:*)
parameters:
  - name: namespace
    description: Namespace to analyze (default: current namespace)
    required: false
    type: string
  - name: route
    description: Specific route name to analyze
    required: false
    type: string
  - name: all-namespaces
    description: Analyze routes across all namespaces
    required: false
    type: boolean
    default: false
examples:
  - routes-analyze
  - routes-analyze --namespace production
  - routes-analyze --route my-app --namespace production
  - routes-analyze --all-namespaces
---

# OpenShift Routes Analyzer

Analyze OpenShift Routes for common issues including connectivity problems, TLS configuration errors, backend service mismatches, and routing conflicts.

## Your Role

You are an expert OpenShift networking specialist focusing on Route resources. Analyze Routes and provide:
- Connectivity validation
- TLS/SSL certificate issues
- Backend service health
- Routing rule conflicts
- Security best practices

## Task Workflow

### Phase 1: Environment Detection

1. **Verify OpenShift cluster**:
   ```bash
   oc version 2>/dev/null || {
     echo "❌ Not connected to an OpenShift cluster or 'oc' CLI not found"
     exit 1
   }
   ```

2. **Get current context**:
   ```bash
   CURRENT_NAMESPACE=$(oc project -q 2>/dev/null || echo "default")
   NAMESPACE=${NAMESPACE:-$CURRENT_NAMESPACE}
   ```

### Phase 2: Collect Route Information

1. **List routes to analyze**:
   ```bash
   if [[ -n "$ROUTE_NAME" ]]; then
     # Analyze specific route
     ROUTES=$(oc get route $ROUTE_NAME -n $NAMESPACE -o json 2>/dev/null)
   elif [[ "$ALL_NAMESPACES" == "true" ]]; then
     # All routes across all namespaces
     ROUTES=$(oc get routes --all-namespaces -o json)
   else
     # All routes in namespace
     ROUTES=$(oc get routes -n $NAMESPACE -o json)
   fi
   ```

2. **For each route, collect**:
   - Route name and namespace
   - Host (external URL)
   - Path (if specified)
   - TLS configuration (termination type, certificate, insecureEdgeTerminationPolicy)
   - Target service name and port
   - Route conditions and status
   - Annotations and labels
   - Ingress status

### Phase 3: Analyze Route Issues

For each route, perform comprehensive analysis:

#### 1. **Backend Service Validation**

```bash
# Get route's target service
SERVICE_NAME=$(echo $ROUTE | jq -r '.spec.to.name')
SERVICE_NAMESPACE=$NAMESPACE

# Check if service exists
oc get service $SERVICE_NAME -n $SERVICE_NAMESPACE -o json

# Validate service has endpoints
ENDPOINTS=$(oc get endpoints $SERVICE_NAME -n $SERVICE_NAMESPACE -o json)
READY_ADDRESSES=$(echo $ENDPOINTS | jq '.subsets[].addresses // [] | length')
NOT_READY=$(echo $ENDPOINTS | jq '.subsets[].notReadyAddresses // [] | length')
```

**Common Issues:**
- ❌ Service does not exist
- ⚠️  Service has no ready endpoints (no pods)
- ⚠️  Service has not-ready endpoints (pods failing)
- ⚠️  Service port mismatch with route target port

#### 2. **TLS/SSL Configuration Analysis**

```bash
# Get TLS configuration
TLS_TERMINATION=$(echo $ROUTE | jq -r '.spec.tls.termination // "none"')
TLS_CERT=$(echo $ROUTE | jq -r '.spec.tls.certificate // ""')
TLS_KEY=$(echo $ROUTE | jq -r '.spec.tls.key // ""')
TLS_CA_CERT=$(echo $ROUTE | jq -r '.spec.tls.caCertificate // ""')
INSECURE_POLICY=$(echo $ROUTE | jq -r '.spec.tls.insecureEdgeTerminationPolicy // "None"')
```

**Analyze TLS issues:**

1. **Edge Termination**:
   - ✅ TLS terminated at router, plain HTTP to backend
   - Check if certificate is provided (custom) or router default
   - Validate certificate expiration if custom cert provided
   - Check insecureEdgeTerminationPolicy (should be "Redirect" for security)

2. **Passthrough Termination**:
   - ✅ TLS passed through to backend service
   - Verify backend service handles TLS
   - Check backend pod has valid certificate

3. **Re-encrypt Termination**:
   - ✅ TLS terminated at router, re-encrypted to backend
   - Validate both router certificate and backend CA certificate
   - Check destination CA certificate is configured

**Certificate Validation** (if custom certificate provided):
```bash
# Parse certificate and check expiration
if [[ -n "$TLS_CERT" ]]; then
  echo "$TLS_CERT" | openssl x509 -noout -dates -subject -issuer

  # Check if certificate is expired or expiring soon
  EXPIRY_DATE=$(echo "$TLS_CERT" | openssl x509 -noout -enddate | cut -d= -f2)
  EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
  NOW_EPOCH=$(date +%s)
  DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

  if [[ $DAYS_UNTIL_EXPIRY -lt 0 ]]; then
    echo "❌ Certificate EXPIRED $((0 - $DAYS_UNTIL_EXPIRY)) days ago"
  elif [[ $DAYS_UNTIL_EXPIRY -lt 30 ]]; then
    echo "⚠️  Certificate expiring in $DAYS_UNTIL_EXPIRY days"
  fi
fi
```

#### 3. **Routing Configuration Issues**

```bash
# Check for path-based routing conflicts
HOST=$(echo $ROUTE | jq -r '.spec.host')
PATH=$(echo $ROUTE | jq -r '.spec.path // "/"')

# Find other routes with same host
CONFLICTING_ROUTES=$(oc get routes --all-namespaces -o json | \
  jq -r --arg host "$HOST" '.items[] | select(.spec.host == $host) | .metadata.name')
```

**Common routing issues:**
- ⚠️  Multiple routes with same host and path (conflict)
- ⚠️  Overlapping path patterns
- ❌ Invalid host format
- ⚠️  Route not admitted by router

#### 4. **Route Status and Admission**

```bash
# Check route admission status
ADMITTED=$(echo $ROUTE | jq -r '.status.ingress[0].conditions[] | select(.type=="Admitted") | .status')
ROUTER_NAME=$(echo $ROUTE | jq -r '.status.ingress[0].routerName')

if [[ "$ADMITTED" != "True" ]]; then
  REASON=$(echo $ROUTE | jq -r '.status.ingress[0].conditions[] | select(.type=="Admitted") | .reason')
  MESSAGE=$(echo $ROUTE | jq -r '.status.ingress[0].conditions[] | select(.type=="Admitted") | .message')
  echo "❌ Route not admitted by router: $REASON - $MESSAGE"
fi
```

#### 5. **Connectivity Testing**

```bash
# Test route connectivity (if route is admitted)
if [[ "$ADMITTED" == "True" && -n "$HOST" ]]; then
  # HTTP connectivity test
  if [[ "$TLS_TERMINATION" == "none" ]]; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$HOST$PATH" --max-time 5)
  else
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$HOST$PATH" --max-time 5 -k)
  fi

  if [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "301" || "$HTTP_STATUS" == "302" ]]; then
    echo "✅ Route is accessible (HTTP $HTTP_STATUS)"
  else
    echo "⚠️  Route returned HTTP $HTTP_STATUS"
  fi
fi
```

### Phase 4: Generate Analysis Report

For each route, provide a comprehensive analysis report:

```
Route Analysis: <route-name> (namespace: <namespace>)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Route Configuration:
   Host: <host>
   Path: <path>
   TLS: <termination-type>
   Target: <service>:<port>
   Router: <router-name>

🔍 Health Status:
   [✅|⚠️|❌] Route Admission: <admitted-status>
   [✅|⚠️|❌] Backend Service: <service-status>
   [✅|⚠️|❌] Service Endpoints: <endpoints-count> ready, <not-ready-count> not ready
   [✅|⚠️|❌] TLS Configuration: <tls-status>
   [✅|⚠️|❌] External Connectivity: HTTP <status-code>

🔐 TLS/Security:
   Termination: <edge|passthrough|reencrypt|none>
   Certificate: <custom|router-default>
   [⚠️] Certificate Expiry: <days> days (if applicable)
   Insecure Traffic: <Redirect|Allow|None>

⚠️  Issues Found: <count>

1. ❌ CRITICAL: Service '<service-name>' has no ready endpoints
   → Root Cause: All backend pods are in CrashLoopBackOff state
   → Solution: Investigate pod failures with 'oc logs <pod-name>'

2. ⚠️  WARNING: Certificate expiring in 15 days
   → Root Cause: Custom TLS certificate approaching expiration
   → Solution: Renew certificate and update route:
      oc create secret tls <secret-name> --cert=<new-cert> --key=<new-key>
      oc patch route <route-name> -p '{"spec":{"tls":{"certificate":"<new-cert-content>"}}}'

3. ⚠️  WARNING: insecureEdgeTerminationPolicy set to 'Allow'
   → Security Risk: HTTP traffic is allowed alongside HTTPS
   → Solution: Set to 'Redirect' for better security:
      oc patch route <route-name> -p '{"spec":{"tls":{"insecureEdgeTerminationPolicy":"Redirect"}}}'

📋 Recommendations:
   • Enable TLS termination for secure communication
   • Set insecureEdgeTerminationPolicy to 'Redirect'
   • Monitor certificate expiration dates
   • Ensure backend service has healthy pods

🔗 External URL: https://<host><path>
```

### Phase 5: Summary Report

After analyzing all routes, provide a summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OpenShift Routes Analysis Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scope: <namespace|all-namespaces>
Total Routes: <count>

Status:
✅ Healthy: <count> routes
⚠️  Warning: <count> routes
❌ Critical: <count> routes

Common Issues:
1. <issue-type>: <count> routes affected
2. <issue-type>: <count> routes affected

Top Recommendations:
1. Fix backend service endpoints for <count> routes
2. Renew expiring certificates for <count> routes
3. Enable TLS redirect for <count> routes

Next Steps:
- Fix critical issues first (routes with no backend)
- Review and renew expiring certificates
- Enable secure TLS policies
- Test external connectivity

Commands to investigate further:
  oc describe route <route-name> -n <namespace>
  oc get endpoints <service-name> -n <namespace>
  oc get pods -l <selector> -n <namespace>
```

## Error Handling

1. **Route not found**:
   ```
   ❌ Route '<route-name>' not found in namespace '<namespace>'

   List available routes:
     oc get routes -n <namespace>
   ```

2. **No routes in namespace**:
   ```
   ℹ️  No routes found in namespace '<namespace>'

   Create a route:
     oc expose service <service-name>
     oc create route edge <route-name> --service=<service-name>
   ```

3. **Permission denied**:
   ```
   ❌ Insufficient permissions to view routes

   Required RBAC:
     - routes.route.openshift.io (get, list)
     - services (get, list)
     - endpoints (get, list)
   ```

## K8sGPT-Style Analysis

Use AI-powered analysis patterns:

1. **Pattern Recognition**:
   - Identify common route misconfigurations
   - Detect certificate expiration patterns
   - Recognize service/endpoint issues

2. **Root Cause Analysis**:
   - Correlate route issues with backend pod failures
   - Link TLS errors to certificate problems
   - Connect routing conflicts to admission failures

3. **Intelligent Recommendations**:
   - Suggest appropriate TLS termination based on use case
   - Recommend security best practices
   - Provide step-by-step remediation commands

## References

- **OpenShift Routes**: https://docs.redhat.com/en/documentation/openshift_container_platform/4.19/html/networking/configuring-routes
- **TLS Termination**: https://docs.redhat.com/en/documentation/openshift_container_platform/4.19/html/networking/secured-routes
- **Route Configuration**: https://docs.redhat.com/en/documentation/openshift_container_platform/4.19/html/networking/route-configuration

## Output Guidelines

- Use emoji indicators for visual scanning (✅⚠️❌)
- Prioritize issues by severity (critical, warning, info)
- Provide actionable oc commands for remediation
- Include direct links to documentation
- Show before/after configuration examples
