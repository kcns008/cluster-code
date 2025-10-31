---
name: gcp-cluster-create
description: Create a new GKE Standard or Autopilot cluster on Google Cloud
category: cloud-provisioning
parameters:
  - name: cluster-name
    description: Name of the cluster to create
    required: true
  - name: mode
    description: Cluster mode (standard or autopilot)
    required: true
    default: standard
  - name: project
    description: GCP project ID
    required: true
  - name: region
    description: GCP region (e.g., us-central1)
    required: false
  - name: zone
    description: GCP zone for zonal cluster (e.g., us-central1-a)
    required: false
  - name: version
    description: Kubernetes version (e.g., 1.29)
    required: false
  - name: num-nodes
    description: Number of nodes per zone (Standard mode only)
    type: number
    default: 3
  - name: machine-type
    description: Machine type for nodes (Standard mode only)
    default: e2-medium
  - name: disk-size
    description: Boot disk size in GB
    type: number
    default: 100
  - name: enable-autoscaling
    description: Enable cluster autoscaler
    type: boolean
    default: false
  - name: min-nodes
    description: Minimum nodes per zone (if autoscaling enabled)
    type: number
    default: 1
  - name: max-nodes
    description: Maximum nodes per zone (if autoscaling enabled)
    type: number
    default: 10
  - name: network
    description: VPC network name
    required: false
  - name: subnetwork
    description: Subnetwork name
    required: false
  - name: release-channel
    description: Release channel (rapid, regular, stable, None)
    default: regular
tags:
  - gcp
  - gke
  - cluster-lifecycle
  - provisioning
---

# GCP Cluster Create

Create a new Google Kubernetes Engine (GKE) cluster with support for both Standard and Autopilot modes.

## Overview

This command creates production-ready GKE clusters with:

- **Two modes**: Standard (full control) or Autopilot (managed infrastructure)
- **High Availability**: Regional or zonal deployment
- **Auto-scaling**: Cluster and pod autoscaling options
- **Security**: Workload Identity, GKE security features
- **Monitoring**: Cloud Operations integration
- **Networking**: VPC-native clusters with custom networking

## Prerequisites

- Google Cloud SDK installed (`gcloud --version` >= 450.0.0)
- `kubectl` installed (>= 1.28.0)
- Authenticated to GCP: `gcloud auth login`
- Project configured: `gcloud config set project PROJECT_ID`
- Required APIs enabled:
  - `container.googleapis.com` (GKE)
  - `compute.googleapis.com` (Compute Engine)
  - `cloudresourcemanager.googleapis.com`
- IAM permissions:
  - `container.clusters.create`
  - `compute.networks.create` (if creating network)
  - `iam.serviceAccounts.create`

## Cluster Modes

### Standard Mode

- **Full control** over node configuration and management
- **Customizable** machine types, node pools, networking
- **Pay per node** - charged for all provisioned nodes
- **Best for**: Workloads requiring specific configurations, GPU workloads, Windows nodes

### Autopilot Mode

- **Fully managed** - Google manages nodes, scaling, security
- **Pod-based pricing** - pay only for pod resource requests
- **Optimized** for cost and operations
- **Best for**: Standard workloads, teams wanting less operational overhead

## Workflow

### Phase 1: Pre-creation Validation

#### 1.1 Validate Prerequisites

```bash
CLUSTER_NAME="${CLUSTER_NAME}"
CLUSTER_MODE="${CLUSTER_MODE:-standard}"
GCP_PROJECT="${GCP_PROJECT}"
GCP_REGION="${GCP_REGION}"
GCP_ZONE="${GCP_ZONE}"
K8S_VERSION="${K8S_VERSION}"
RELEASE_CHANNEL="${RELEASE_CHANNEL:-regular}"

echo "🔍 Validating prerequisites for GKE cluster creation"
echo ""
echo "Cluster configuration:"
echo "  Name: $CLUSTER_NAME"
echo "  Mode: $CLUSTER_MODE"
echo "  Project: $GCP_PROJECT"
if [[ -n "$GCP_REGION" ]]; then
    echo "  Region: $GCP_REGION (regional cluster)"
    LOCATION="$GCP_REGION"
    LOCATION_TYPE="region"
elif [[ -n "$GCP_ZONE" ]]; then
    echo "  Zone: $GCP_ZONE (zonal cluster)"
    LOCATION="$GCP_ZONE"
    LOCATION_TYPE="zone"
else
    echo "❌ ERROR: Either --region or --zone must be specified"
    exit 1
fi

# Set project
gcloud config set project "$GCP_PROJECT"

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
    echo "❌ ERROR: Not authenticated to GCP"
    echo "   Run: gcloud auth login"
    exit 1
fi

echo "✅ Authentication verified"

# Check if APIs are enabled
echo ""
echo "Checking required APIs..."

REQUIRED_APIS=("container.googleapis.com" "compute.googleapis.com")
for API in "${REQUIRED_APIS[@]}"; do
    if gcloud services list --enabled --filter="name:$API" --format="value(name)" | grep -q "$API"; then
        echo "  ✅ $API enabled"
    else
        echo "  ⚠️  $API not enabled. Enabling..."
        gcloud services enable "$API"
    fi
done
```

#### 1.2 Check Cluster Name Availability

```bash
echo ""
echo "Checking cluster name availability..."

if gcloud container clusters describe "$CLUSTER_NAME" --$LOCATION_TYPE="$LOCATION" &>/dev/null; then
    echo "❌ ERROR: Cluster '$CLUSTER_NAME' already exists in $LOCATION"
    exit 1
fi

echo "✅ Cluster name available"
```

#### 1.3 Determine Kubernetes Version

```bash
if [[ -z "$K8S_VERSION" ]]; then
    echo ""
    echo "📋 Fetching available Kubernetes versions..."

    if [[ "$RELEASE_CHANNEL" == "None" ]]; then
        # Get default version for static version clusters
        K8S_VERSION=$(gcloud container get-server-config \
            --$LOCATION_TYPE="$LOCATION" \
            --format="value(defaultClusterVersion)")
        echo "   Using default version: $K8S_VERSION"
    else
        # Get default version for the release channel
        K8S_VERSION=$(gcloud container get-server-config \
            --$LOCATION_TYPE="$LOCATION" \
            --format="value(channels.$RELEASE_CHANNEL.defaultVersion)")
        echo "   Using $RELEASE_CHANNEL channel version: $K8S_VERSION"
    fi
else
    echo "   Using specified version: $K8S_VERSION"
fi
```

### Phase 2: Network Configuration

#### 2.1 Setup VPC Network

```bash
NETWORK_NAME="${NETWORK:-gke-network-$CLUSTER_NAME}"
SUBNET_NAME="${SUBNETWORK:-gke-subnet-$CLUSTER_NAME}"

echo ""
echo "🌐 Configuring network..."

# Check if network exists
if gcloud compute networks describe "$NETWORK_NAME" &>/dev/null; then
    echo "   Using existing network: $NETWORK_NAME"
else
    echo "   Creating VPC network: $NETWORK_NAME"
    gcloud compute networks create "$NETWORK_NAME" \
        --subnet-mode=custom \
        --bgp-routing-mode=regional
fi

# Check if subnet exists
if gcloud compute networks subnets describe "$SUBNET_NAME" --region="$GCP_REGION" &>/dev/null 2>&1; then
    echo "   Using existing subnet: $SUBNET_NAME"
else
    echo "   Creating subnet: $SUBNET_NAME"

    # Determine region from zone if needed
    if [[ "$LOCATION_TYPE" == "zone" ]]; then
        SUBNET_REGION=$(echo "$GCP_ZONE" | sed 's/-[a-z]$//')
    else
        SUBNET_REGION="$GCP_REGION"
    fi

    gcloud compute networks subnets create "$SUBNET_NAME" \
        --network="$NETWORK_NAME" \
        --region="$SUBNET_REGION" \
        --range=10.0.0.0/20 \
        --secondary-range pods=10.4.0.0/14 \
        --secondary-range services=10.0.16.0/20 \
        --enable-private-ip-google-access \
        --enable-flow-logs
fi

echo "✅ Network configuration completed"
```

#### 2.2 Configure Firewall Rules

```bash
echo ""
echo "🔥 Configuring firewall rules..."

# Allow internal communication
if ! gcloud compute firewall-rules describe "gke-$CLUSTER_NAME-internal" &>/dev/null; then
    gcloud compute firewall-rules create "gke-$CLUSTER_NAME-internal" \
        --network="$NETWORK_NAME" \
        --allow=tcp,udp,icmp \
        --source-ranges=10.0.0.0/8
fi

# Allow SSH from IAP
if ! gcloud compute firewall-rules describe "gke-$CLUSTER_NAME-ssh-iap" &>/dev/null; then
    gcloud compute firewall-rules create "gke-$CLUSTER_NAME-ssh-iap" \
        --network="$NETWORK_NAME" \
        --allow=tcp:22 \
        --source-ranges=35.235.240.0/20
fi

echo "✅ Firewall rules configured"
```

### Phase 3: Cluster Creation

#### 3.1 Build Cluster Creation Command

```bash
echo ""
echo "🚀 Creating GKE cluster..."
echo ""

# Base command
if [[ "$CLUSTER_MODE" == "autopilot" ]]; then
    CREATE_CMD="gcloud container clusters create-auto \"$CLUSTER_NAME\""
else
    CREATE_CMD="gcloud container clusters create \"$CLUSTER_NAME\""
fi

# Location
CREATE_CMD="$CREATE_CMD --$LOCATION_TYPE=\"$LOCATION\""

# Network
CREATE_CMD="$CREATE_CMD --network=\"$NETWORK_NAME\""
CREATE_CMD="$CREATE_CMD --subnetwork=\"$SUBNET_NAME\""
CREATE_CMD="$CREATE_CMD --enable-ip-alias"
CREATE_CMD="$CREATE_CMD --cluster-secondary-range-name=pods"
CREATE_CMD="$CREATE_CMD --services-secondary-range-name=services"

# Release channel or version
if [[ "$RELEASE_CHANNEL" != "None" ]]; then
    CREATE_CMD="$CREATE_CMD --release-channel=\"$RELEASE_CHANNEL\""
else
    CREATE_CMD="$CREATE_CMD --cluster-version=\"$K8S_VERSION\""
    CREATE_CMD="$CREATE_CMD --no-enable-autoupgrade"
fi

# Standard mode specific settings
if [[ "$CLUSTER_MODE" == "standard" ]]; then
    NUM_NODES="${NUM_NODES:-3}"
    MACHINE_TYPE="${MACHINE_TYPE:-e2-medium}"
    DISK_SIZE="${DISK_SIZE:-100}"

    CREATE_CMD="$CREATE_CMD --num-nodes=\"$NUM_NODES\""
    CREATE_CMD="$CREATE_CMD --machine-type=\"$MACHINE_TYPE\""
    CREATE_CMD="$CREATE_CMD --disk-size=\"$DISK_SIZE\""
    CREATE_CMD="$CREATE_CMD --disk-type=pd-standard"
    CREATE_CMD="$CREATE_CMD --image-type=COS_CONTAINERD"

    # Autoscaling
    if [[ "${ENABLE_AUTOSCALING}" == "true" ]]; then
        MIN_NODES="${MIN_NODES:-1}"
        MAX_NODES="${MAX_NODES:-10}"
        CREATE_CMD="$CREATE_CMD --enable-autoscaling"
        CREATE_CMD="$CREATE_CMD --min-nodes=\"$MIN_NODES\""
        CREATE_CMD="$CREATE_CMD --max-nodes=\"$MAX_NODES\""
    fi

    # Node pool settings
    CREATE_CMD="$CREATE_CMD --enable-autorepair"
    CREATE_CMD="$CREATE_CMD --enable-autoupgrade"
    CREATE_CMD="$CREATE_CMD --max-surge-upgrade=1"
    CREATE_CMD="$CREATE_CMD --max-unavailable-upgrade=0"
fi

# Security features
CREATE_CMD="$CREATE_CMD --enable-shielded-nodes"
CREATE_CMD="$CREATE_CMD --workload-pool=\"$GCP_PROJECT.svc.id.goog\""
CREATE_CMD="$CREATE_CMD --enable-network-policy"

# Monitoring and logging
CREATE_CMD="$CREATE_CMD --enable-cloud-logging"
CREATE_CMD="$CREATE_CMD --enable-cloud-monitoring"
CREATE_CMD="$CREATE_CMD --logging=SYSTEM,WORKLOAD"
CREATE_CMD="$CREATE_CMD --monitoring=SYSTEM"

# Additional features
CREATE_CMD="$CREATE_CMD --addons=HorizontalPodAutoscaling,HttpLoadBalancing,GcePersistentDiskCsiDriver"
CREATE_CMD="$CREATE_CMD --enable-stackdriver-kubernetes"

# Maintenance window (02:00-06:00 UTC)
CREATE_CMD="$CREATE_CMD --maintenance-window-start=2024-01-01T02:00:00Z"
CREATE_CMD="$CREATE_CMD --maintenance-window-duration=4h"
CREATE_CMD="$CREATE_CMD --maintenance-window-recurrence='FREQ=WEEKLY;BYDAY=SA'"

echo "Cluster creation command:"
echo "$CREATE_CMD"
echo ""
echo "⏳ This may take 5-10 minutes..."
echo ""
```

#### 3.2 Execute Cluster Creation

```bash
# Execute the command
eval "$CREATE_CMD"

if [[ $? -eq 0 ]]; then
    echo ""
    echo "✅ GKE cluster created successfully"
else
    echo ""
    echo "❌ Cluster creation failed"
    exit 1
fi
```

### Phase 4: Post-Creation Configuration

#### 4.1 Configure kubectl

```bash
echo ""
echo "⚙️  Configuring kubectl access..."

gcloud container clusters get-credentials "$CLUSTER_NAME" \
    --$LOCATION_TYPE="$LOCATION" \
    --project="$GCP_PROJECT"

echo "✅ kubectl configured"

# Verify connection
echo ""
echo "Testing cluster connection..."
if kubectl cluster-info &>/dev/null; then
    echo "✅ Cluster connection verified"
else
    echo "❌ Failed to connect to cluster"
    exit 1
fi
```

#### 4.2 Install Essential Components

```bash
echo ""
echo "📦 Installing essential components..."

# Install metrics-server (if not autopilot, which includes it)
if [[ "$CLUSTER_MODE" == "standard" ]]; then
    echo "   Installing metrics-server..."
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
fi

# Create monitoring namespace
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Setup Workload Identity for common namespaces
for NS in default kube-system monitoring; do
    if [[ "$NS" != "kube-system" ]]; then
        kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
    fi

    # Annotate service account for Workload Identity
    kubectl annotate serviceaccount default \
        -n "$NS" \
        iam.gke.io/gcp-service-account="${CLUSTER_NAME}-sa@${GCP_PROJECT}.iam.gserviceaccount.com" \
        --overwrite 2>/dev/null || true
done

echo "✅ Essential components installed"
```

#### 4.3 Apply Security Policies

```bash
echo ""
echo "🔒 Applying security policies..."

# Create Pod Security Standards
kubectl create namespace prod --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace prod \
    pod-security.kubernetes.io/enforce=restricted \
    pod-security.kubernetes.io/audit=restricted \
    pod-security.kubernetes.io/warn=restricted

kubectl label namespace default \
    pod-security.kubernetes.io/enforce=baseline \
    pod-security.kubernetes.io/audit=baseline \
    pod-security.kubernetes.io/warn=baseline

# Create default NetworkPolicy (deny all ingress)
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: default
spec:
  podSelector: {}
  policyTypes:
  - Ingress
EOF

echo "✅ Security policies applied"
```

#### 4.4 Cluster Information and Diagnostics

```bash
echo ""
echo "📊 Gathering cluster information..."

# Cluster details
echo ""
echo "Cluster Details:"
echo "================"
gcloud container clusters describe "$CLUSTER_NAME" \
    --$LOCATION_TYPE="$LOCATION" \
    --format="table(
        name,
        location,
        currentMasterVersion,
        currentNodeCount,
        status
    )"

# Node information
echo ""
echo "Nodes:"
echo "======"
kubectl get nodes -o wide

# Check cluster health
echo ""
echo "Cluster Health:"
echo "==============="

READY_NODES=$(kubectl get nodes --no-headers | grep -c " Ready ")
TOTAL_NODES=$(kubectl get nodes --no-headers | wc -l)

echo "Ready Nodes: $READY_NODES / $TOTAL_NODES"

if [[ "$READY_NODES" -eq "$TOTAL_NODES" ]]; then
    echo "✅ All nodes ready"
else
    echo "⚠️  Some nodes not ready"
fi

# System pods
echo ""
echo "System Pods:"
echo "============"
kubectl get pods -n kube-system

# Get cluster endpoint
CLUSTER_ENDPOINT=$(gcloud container clusters describe "$CLUSTER_NAME" \
    --$LOCATION_TYPE="$LOCATION" \
    --format="value(endpoint)")

echo ""
echo "Cluster Endpoint: https://$CLUSTER_ENDPOINT"
```

### Phase 5: Cost Estimation

```bash
echo ""
echo "💰 COST ESTIMATION"
echo "=================="

if [[ "$CLUSTER_MODE" == "autopilot" ]]; then
    echo ""
    echo "Autopilot Mode - Pay per pod resource request"
    echo ""
    echo "Estimated costs (approximate):"
    echo "  • Base: \$0.10 per vCPU per hour"
    echo "  • Base: \$0.011 per GB memory per hour"
    echo "  • No charge for cluster management"
    echo ""
    echo "Example: 10 pods @ 0.5 vCPU, 1GB RAM each"
    echo "  • Monthly: ~\$182 (vCPU) + ~\$40 (memory) = ~\$222"

else
    HOURLY_COST=$(echo "scale=2; $NUM_NODES * 0.05" | bc)  # Rough estimate for e2-medium
    MONTHLY_COST=$(echo "scale=2; $HOURLY_COST * 730" | bc)

    echo ""
    echo "Standard Mode - Pay per node"
    echo ""
    echo "Current configuration:"
    echo "  • Machine Type: $MACHINE_TYPE"
    echo "  • Number of Nodes: $NUM_NODES"
    if [[ "${ENABLE_AUTOSCALING}" == "true" ]]; then
        echo "  • Autoscaling: $MIN_NODES - $MAX_NODES nodes"
    fi
    echo ""
    echo "Estimated costs (very approximate):"
    echo "  • Per node per hour: ~\$0.05"
    echo "  • Total per hour: ~\$$HOURLY_COST"
    echo "  • Total per month: ~\$$MONTHLY_COST"
    echo ""
    echo "Note: Actual costs vary by machine type, region, and usage"
fi

echo ""
echo "For accurate pricing, use: https://cloud.google.com/products/calculator"
```

### Phase 6: Summary and Next Steps

```bash
echo ""
echo "✅ CLUSTER CREATION COMPLETE"
echo "============================"
echo ""
echo "Cluster: $CLUSTER_NAME"
echo "Mode: $CLUSTER_MODE"
echo "Location: $LOCATION"
echo "Version: $K8S_VERSION"
if [[ "$CLUSTER_MODE" == "standard" ]]; then
    echo "Nodes: $NUM_NODES x $MACHINE_TYPE"
fi
echo ""
echo "Next steps:"
echo ""
echo "1. Deploy your first application:"
echo "   kubectl create deployment hello --image=gcr.io/google-samples/hello-app:1.0"
echo "   kubectl expose deployment hello --type=LoadBalancer --port=80 --target-port=8080"
echo ""
echo "2. Enable additional features:"
echo "   • Install Ingress controller: gcloud container clusters update $CLUSTER_NAME --update-addons=HttpLoadBalancing=ENABLED"
echo "   • Enable Binary Authorization for image security"
echo "   • Configure Cloud Armor for DDoS protection"
echo ""
echo "3. Setup monitoring:"
echo "   • View metrics in Cloud Console: https://console.cloud.google.com/kubernetes/clusters/$LOCATION/$CLUSTER_NAME"
echo "   • Install GKE Dashboard: kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml"
echo ""
echo "4. Configure CI/CD:"
echo "   • Setup Cloud Build triggers"
echo "   • Configure Artifact Registry"
echo "   • Implement GitOps with Config Sync"
echo ""
echo "5. Review security:"
echo "   • Enable Binary Authorization"
echo "   • Configure Workload Identity for all workloads"
echo "   • Review GKE Security Posture dashboard"
echo ""
echo "Documentation: https://cloud.google.com/kubernetes-engine/docs"
echo ""
```

## Cluster Modes Comparison

| Feature | Standard | Autopilot |
|---------|----------|-----------|
| **Node Management** | Manual | Fully managed |
| **Pricing** | Per node | Per pod request |
| **Customization** | Full control | Limited |
| **Operations** | More overhead | Less overhead |
| **GPU Support** | Yes | Yes |
| **Windows Nodes** | Yes | No |
| **Best For** | Custom configs | Standard workloads |

## Common Issues

### Issue: Insufficient quota

**Error**: `Quota exceeded for quota metric 'compute.googleapis.com/cpus'`

**Solution**: Request quota increase:
```bash
gcloud compute project-info describe --project=$PROJECT_ID
# Request increase in GCP Console > IAM & Admin > Quotas
```

### Issue: VPC network errors

**Solution**: Ensure VPC has sufficient IP ranges:
```bash
# Check subnet ranges
gcloud compute networks subnets describe $SUBNET_NAME --region=$REGION

# Expand if needed
gcloud compute networks subnets expand-ip-range $SUBNET_NAME \
    --region=$REGION \
    --prefix-length=16
```

### Issue: Autopilot pod scheduling failures

**Solution**: Check pod resource requests match Autopilot constraints:
- vCPU: 0.25-110 in increments of 0.25
- Memory: Must match CPU (1:4 ratio typical)

## Examples

### Example 1: Create regional Autopilot cluster (recommended for production)

```bash
cluster-code gcp-cluster-create \
  --cluster-name prod-cluster \
  --mode autopilot \
  --project my-project \
  --region us-central1 \
  --release-channel regular
```

### Example 2: Create Standard cluster with autoscaling

```bash
cluster-code gcp-cluster-create \
  --cluster-name dev-cluster \
  --mode standard \
  --project my-project \
  --zone us-central1-a \
  --machine-type n2-standard-4 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 20
```

### Example 3: Create high-performance Standard cluster

```bash
cluster-code gcp-cluster-create \
  --cluster-name ml-cluster \
  --mode standard \
  --project my-ml-project \
  --region us-central1 \
  --machine-type n2-highmem-8 \
  --disk-size 200 \
  --num-nodes 5
```

## Related Commands

- `gcp-cluster-delete`: Delete GKE clusters
- `gcp-cluster-upgrade`: Upgrade cluster version
- `cluster-diagnose`: Run diagnostics
- `backup-cluster`: Create cluster backup
