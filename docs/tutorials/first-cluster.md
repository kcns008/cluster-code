---
layout: tutorial
title: Create Your First Cluster
nav_order: 1
parent: Tutorials
description: "Step-by-step tutorial to create and manage your first Kubernetes cluster"
permalink: /tutorials/first-cluster
---

# Create Your First Cluster
{: .no_toc }

Learn how to create, configure, and manage your first production-ready Kubernetes cluster using Cluster Code.
{: .fs-6 .fw-300 }

**Estimated time:** 30-45 minutes
{: .label .label-purple }

**Difficulty:** Beginner
{: .label .label-green }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Prerequisites

Before starting this tutorial, ensure you have:

- ✅ Cluster Code installed ([Installation Guide](/guides/getting-started#installation))
- ✅ Cloud provider CLI configured (choose one):
  - Azure CLI (`az`) for Azure
  - AWS CLI (`aws`) for AWS
  - gcloud CLI for GCP
- ✅ kubectl installed
- ✅ Basic understanding of Kubernetes concepts

**Choose Your Cloud:**
This tutorial covers all three major clouds. Follow the section for your preferred cloud provider.

---

## Part 1: Azure - Create an AKS Cluster

### Step 1: Azure Authentication

First, authenticate with Azure:

```bash
# Login to Azure
az login

# List available subscriptions
az account list --output table

# Set your subscription
az account set --subscription "<subscription-id>"

# Verify current subscription
az account show
```

**Expected output:**
```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "My Azure Subscription",
  "state": "Enabled",
  "tenantId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
}
```

### Step 2: Create Resource Group

```bash
# Create a resource group
az group create \
  --name tutorial-rg \
  --location eastus

# Verify creation
az group show --name tutorial-rg
```

### Step 3: Configure Cluster Code for Azure

```bash
# Enable Azure plugin
cluster-code config set plugins.cloud-azure.enabled true

# Set Azure configuration
cluster-code config set cloud_providers.azure.enabled true
cluster-code config set cloud_providers.azure.subscription_id "<subscription-id>"
cluster-code config set cloud_providers.azure.resource_group "tutorial-rg"
```

### Step 4: Create AKS Cluster

Now, create your first AKS cluster:

```bash
cluster-code azure-cluster-create \
  --type aks \
  --name my-first-aks \
  --resource-group tutorial-rg \
  --region eastus \
  --version 1.28.9 \
  --nodes 3 \
  --vm-size Standard_D2s_v3
```

**What happens next:**
1. ✅ Prerequisites validation
2. ✅ Network infrastructure setup
3. ✅ IAM role creation
4. ✅ Control plane provisioning
5. ✅ Node pool creation
6. ✅ Add-ons installation

**⏱️  Estimated time:** 8-12 minutes

While waiting, you can monitor progress:
```bash
# In another terminal
az aks list --resource-group tutorial-rg --output table

# Or check status
az aks show \
  --name my-first-aks \
  --resource-group tutorial-rg \
  --query provisioningState
```

### Step 5: Connect to Your Cluster

Once creation completes, connect:

```bash
cluster-code azure-cluster-connect \
  --name my-first-aks \
  --resource-group tutorial-rg
```

**This command:**
- Downloads kubeconfig
- Configures kubectl context
- Initializes Cluster Code
- Runs initial health check

### Step 6: Verify Cluster

```bash
# Check cluster status
cluster-code status

# List nodes
kubectl get nodes

# Expected output:
NAME                                STATUS   ROLES   AGE   VERSION
aks-nodepool1-12345678-vmss000000   Ready    agent   5m    v1.28.9
aks-nodepool1-12345678-vmss000001   Ready    agent   5m    v1.28.9
aks-nodepool1-12345678-vmss000002   Ready    agent   5m    v1.28.9
```

**🎉 Congratulations!** You've created your first AKS cluster!

---

## Part 2: AWS - Create an EKS Cluster

### Step 1: AWS Authentication

```bash
# Configure AWS credentials
aws configure

# Verify authentication
aws sts get-caller-identity
```

**Expected output:**
```json
{
    "UserId": "AIDAEXAMPLE",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/my-user"
}
```

### Step 2: Configure Cluster Code for AWS

```bash
# Enable AWS plugin
cluster-code config set plugins.cloud-aws.enabled true

# Set AWS configuration
cluster-code config set cloud_providers.aws.enabled true
cluster-code config set cloud_providers.aws.region "us-east-1"
```

### Step 3: Create EKS Cluster

```bash
cluster-code aws-cluster-create \
  --type eks \
  --name my-first-eks \
  --region us-east-1 \
  --version 1.28 \
  --nodes 2 \
  --instance-type t3.medium
```

**What happens next:**
1. ✅ VPC and subnet creation
2. ✅ IAM role setup
3. ✅ Security group configuration
4. ✅ EKS control plane creation
5. ✅ Node group provisioning
6. ✅ AWS CNI installation

**⏱️  Estimated time:** 12-15 minutes

Monitor progress:
```bash
# Check cluster status
aws eks describe-cluster \
  --name my-first-eks \
  --region us-east-1 \
  --query 'cluster.status'
```

### Step 4: Connect to Your Cluster

```bash
cluster-code aws-cluster-connect \
  --name my-first-eks \
  --region us-east-1
```

### Step 5: Verify Cluster

```bash
# Check status
cluster-code status

# List nodes
kubectl get nodes

# Expected output:
NAME                             STATUS   ROLES    AGE   VERSION
ip-10-0-1-123.ec2.internal       Ready    <none>   5m    v1.28.0
ip-10-0-2-456.ec2.internal       Ready    <none>   5m    v1.28.0
```

**🎉 Success!** Your EKS cluster is ready!

---

## Part 3: Deploy Your First Application

Now that you have a cluster, let's deploy an application.

### Step 1: Create Namespace

```bash
# Create namespace for our app
kubectl create namespace myapp

# Set as default namespace
cluster-code namespace-switch myapp
```

### Step 2: Deploy with Helm

Deploy nginx as our first application:

```bash
# Add Helm repository
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Deploy nginx with Cluster Code
cluster-code helm-deploy \
  --chart bitnami/nginx \
  --release my-nginx \
  --namespace myapp \
  --set service.type=LoadBalancer \
  --wait
```

**What this does:**
1. Validates chart
2. Renders templates
3. Deploys resources
4. Waits for readiness
5. Shows deployment status

### Step 3: Verify Deployment

```bash
# Check deployment
kubectl get deployments -n myapp

# Check pods
kubectl get pods -n myapp

# Check service
kubectl get services -n myapp

# Expected output:
NAME       TYPE           CLUSTER-IP    EXTERNAL-IP     PORT(S)        AGE
my-nginx   LoadBalancer   10.0.123.45   20.30.40.50    80:30123/TCP   2m
```

### Step 4: Access Application

```bash
# Get external IP (cloud load balancer)
EXTERNAL_IP=$(kubectl get service my-nginx -n myapp -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Or for AWS EKS (returns hostname)
EXTERNAL_IP=$(kubectl get service my-nginx -n myapp -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test application
curl http://$EXTERNAL_IP

# Expected: nginx welcome page HTML
```

**📝 Note:** Load balancer provisioning may take 2-3 minutes.

---

## Part 4: Monitor and Troubleshoot

### Run Diagnostics

```bash
# Diagnose entire cluster
cluster-code diagnose

# Focus on myapp namespace
cluster-code diagnose --namespace myapp
```

**Example output:**
```
✅ No critical issues detected

Cluster Health Summary:
- API Server: Healthy
- Nodes: 3/3 Ready
- Pods: 12/12 Running
- Services: 5 Active

Namespace: myapp
- Deployments: 1/1 Ready
- Pods: 1/1 Running
- Services: 1 Active
```

### View Logs

```bash
# Get pod name
POD_NAME=$(kubectl get pods -n myapp -l app.kubernetes.io/name=nginx -o jsonpath='{.items[0].metadata.name}')

# View logs
cluster-code pod-logs $POD_NAME --namespace myapp --tail 50

# Follow logs in real-time
cluster-code pod-logs $POD_NAME --namespace myapp --follow
```

### Resource Utilization

```bash
# Check resource usage
cluster-code resource-top --type pod --namespace myapp

# Node resource usage
cluster-code resource-top --type node
```

### Describe Resources

```bash
# Describe deployment with AI analysis
cluster-code resource-describe deployment my-nginx --namespace myapp --analyze

# Check service connectivity
cluster-code service-describe my-nginx --namespace myapp --test
```

---

## Part 5: Scale Your Application

### Scale Deployment

```bash
# Scale to 3 replicas
kubectl scale deployment my-nginx --replicas=3 -n myapp

# Verify scaling
kubectl get pods -n myapp --watch

# Or use Cluster Code
cluster-code diagnose --namespace myapp
```

### Enable Autoscaling

```bash
# Create Horizontal Pod Autoscaler
kubectl autoscale deployment my-nginx \
  --min=2 \
  --max=10 \
  --cpu-percent=80 \
  -n myapp

# Check HPA status
kubectl get hpa -n myapp
```

---

## Part 6: Cluster Management

### Upgrade Cluster (Future)

```bash
# Check available versions
cluster-code azure-cluster-versions --region eastus

# Upgrade cluster
cluster-code azure-cluster-upgrade \
  --name my-first-aks \
  --resource-group tutorial-rg \
  --version 1.29.0
```

### Backup Configuration

```bash
# Export all resources
kubectl get all -n myapp -o yaml > myapp-backup.yaml

# Or use Helm
helm get values my-nginx -n myapp > nginx-values-backup.yaml
```

### Monitor Costs

```bash
# Azure: View costs
az consumption usage list \
  --start-date $(date -d '7 days ago' +%Y-%m-%d) \
  --end-date $(date +%Y-%m-%d) \
  | grep my-first-aks

# AWS: View costs
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity DAILY \
  --metrics BlendedCost \
  --filter file://eks-filter.json
```

---

## Part 7: GitOps Setup (Optional)

### Install ArgoCD

For OpenShift clusters:
```bash
# Install OpenShift GitOps operator
cluster-code operator-install \
  --operator openshift-gitops-operator

# Wait for installation
kubectl wait --for=condition=Ready \
  -n openshift-gitops \
  pod -l app.kubernetes.io/name=openshift-gitops-server
```

For standard Kubernetes:
```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### Create ArgoCD Application

```bash
# Create application manifest
cat > myapp-argocd.yaml <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-nginx
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/your-repo.git
    targetRevision: HEAD
    path: k8s/myapp
  destination:
    server: https://kubernetes.default.svc
    namespace: myapp
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF

# Apply application
kubectl apply -f myapp-argocd.yaml

# Sync application
cluster-code argocd-sync --app my-nginx
```

---

## Part 8: Clean Up

### Delete Application

```bash
# Delete Helm release
helm uninstall my-nginx -n myapp

# Or use Cluster Code
kubectl delete namespace myapp
```

### Delete Cluster

**Azure:**
```bash
cluster-code azure-cluster-delete \
  --name my-first-aks \
  --resource-group tutorial-rg

# Delete resource group
az group delete --name tutorial-rg --yes
```

**AWS:**
```bash
cluster-code aws-cluster-delete \
  --name my-first-eks \
  --region us-east-1

# Clean up VPC and resources
aws eks delete-cluster --name my-first-eks --region us-east-1
```

**⚠️ Warning:** Deleting a cluster will permanently remove all resources. Make sure to back up any important data first.

---

## Troubleshooting

### Cluster Creation Fails

**Problem:** Cluster creation times out or fails

**Solutions:**
```bash
# Check Azure/AWS quota limits
az vm list-usage --location eastus --output table
aws service-quotas list-service-quotas --service-code eks

# View detailed error logs
cluster-code --log-level debug azure-cluster-create ...

# Check cloud provider console for more details
```

### Cannot Connect to Cluster

**Problem:** kubectl commands fail after cluster creation

**Solutions:**
```bash
# Verify kubeconfig
kubectl config view

# Refresh credentials
cluster-code azure-cluster-connect --name my-first-aks --resource-group tutorial-rg

# Check cluster status
az aks show --name my-first-aks --resource-group tutorial-rg --query provisioningState
```

### Pods Not Starting

**Problem:** Pods stuck in Pending or ImagePullBackOff

**Solutions:**
```bash
# Run diagnostics
cluster-code diagnose --namespace myapp

# Analyze specific pod
cluster-code analyze pod <pod-name> --namespace myapp

# Check node resources
cluster-code resource-top --type node

# View detailed pod description
cluster-code resource-describe pod <pod-name> --namespace myapp --analyze
```

---

## Next Steps

Now that you have a working cluster, explore more features:

### Learn More
- [Deploy with Kustomize](/tutorials/kustomize-deployment)
- [Set up monitoring](/tutorials/monitoring-setup)
- [Configure autoscaling](/tutorials/autoscaling)
- [Implement backup strategy](/tutorials/backup-restore)

### Advanced Topics
- [Multi-cluster management](/guides/multi-cluster)
- [Security best practices](/guides/security)
- [Cost optimization](/guides/cost-optimization)
- [Disaster recovery](/guides/disaster-recovery)

### Explore Plugins
- [OpenShift Features](/plugins/cluster-openshift)
- [GitOps Workflows](/plugins/gitops)
- [Cloud Provider Integration](/plugins/)

---

## Summary

In this tutorial, you learned how to:

✅ Authenticate with cloud providers
✅ Configure Cluster Code
✅ Create a production-ready Kubernetes cluster
✅ Deploy applications with Helm
✅ Monitor and troubleshoot your cluster
✅ Scale applications
✅ Clean up resources

**Time invested:** ~45 minutes
**Skills gained:** Cluster creation, application deployment, troubleshooting

**🎓 Certificate of Completion:** You're now ready to manage Kubernetes clusters with Cluster Code!

---

## Feedback

Was this tutorial helpful? Let us know:
- 🌟 [Star us on GitHub](https://github.com/your-org/cluster-code)
- 💬 [Join Discord](https://discord.gg/cluster-code)
- 📧 [Send feedback](mailto:support@cluster-code.io)
