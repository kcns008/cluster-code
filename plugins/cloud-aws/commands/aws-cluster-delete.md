---
name: aws-cluster-delete
description: Safely delete an EKS or ROSA cluster with validation and backup
category: cloud-provisioning
parameters:
  - name: cluster-name
    description: Name of the cluster to delete
    required: true
  - name: type
    description: Cluster type (eks or rosa)
    required: true
    default: eks
  - name: region
    description: AWS region where cluster is located
    required: true
  - name: skip-backup
    description: Skip automatic backup before deletion
    type: boolean
    default: false
  - name: force
    description: Skip all confirmation prompts (dangerous)
    type: boolean
    default: false
  - name: delete-vpc
    description: Delete associated VPC and networking resources
    type: boolean
    default: false
tags:
  - aws
  - eks
  - rosa
  - cluster-lifecycle
  - deletion
  - safety
---

# AWS Cluster Delete

Safely delete an EKS or ROSA cluster with comprehensive validation, automatic backup, and resource cleanup.

## Overview

This command provides a safe way to delete AWS-managed Kubernetes clusters (EKS or ROSA) with multiple safety checks, automatic backups, and proper resource cleanup.

**⚠️ WARNING: This is a destructive operation that cannot be undone. All cluster data will be permanently deleted.**

## Prerequisites

- AWS CLI installed and configured (`aws --version`)
- For EKS: `eksctl` CLI installed
- For ROSA: `rosa` CLI installed and authenticated
- `kubectl` configured with cluster access
- Appropriate IAM permissions:
  - EKS: `eks:DeleteCluster`, `eks:DescribeCluster`, `ec2:DeleteVpc`, etc.
  - ROSA: Cluster admin or organization admin role

## Safety Features

This command implements multiple layers of safety:

1. **Production Detection**: Warns if cluster has production tags
2. **Resource Analysis**: Lists all resources that will be deleted
3. **Persistent Volume Warning**: Alerts about PV data loss
4. **Automatic Backup**: Creates backup before deletion (unless skipped)
5. **Confirmation Prompts**: Requires explicit confirmation
6. **Grace Period**: Provides time to cancel operation

## Workflow

### Phase 1: Pre-deletion Validation

#### 1.1 Verify Cluster Exists

```bash
CLUSTER_NAME="${CLUSTER_NAME}"
CLUSTER_TYPE="${CLUSTER_TYPE:-eks}"
AWS_REGION="${AWS_REGION}"

echo "🔍 Verifying cluster: $CLUSTER_NAME in region $AWS_REGION"

if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    # Check EKS cluster exists
    if ! aws eks describe-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" &>/dev/null; then
        echo "❌ ERROR: EKS cluster '$CLUSTER_NAME' not found in region $AWS_REGION"
        exit 1
    fi

    # Get cluster details
    CLUSTER_INFO=$(aws eks describe-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" --output json)
    CLUSTER_STATUS=$(echo "$CLUSTER_INFO" | jq -r '.cluster.status')
    CLUSTER_VERSION=$(echo "$CLUSTER_INFO" | jq -r '.cluster.version')
    CLUSTER_VPC=$(echo "$CLUSTER_INFO" | jq -r '.cluster.resourcesVpcConfig.vpcId')
    CLUSTER_ARN=$(echo "$CLUSTER_INFO" | jq -r '.cluster.arn')

elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
    # Check ROSA cluster exists
    if ! rosa describe cluster -c "$CLUSTER_NAME" &>/dev/null; then
        echo "❌ ERROR: ROSA cluster '$CLUSTER_NAME' not found"
        exit 1
    fi

    # Get cluster details
    CLUSTER_INFO=$(rosa describe cluster -c "$CLUSTER_NAME" -o json)
    CLUSTER_STATUS=$(echo "$CLUSTER_INFO" | jq -r '.status.state')
    CLUSTER_VERSION=$(echo "$CLUSTER_INFO" | jq -r '.version.raw_id')
    CLUSTER_ID=$(echo "$CLUSTER_INFO" | jq -r '.id')
fi

echo "✅ Cluster found: $CLUSTER_NAME"
echo "   Type: $CLUSTER_TYPE"
echo "   Status: $CLUSTER_STATUS"
echo "   Version: $CLUSTER_VERSION"
```

#### 1.2 Analyze Cluster Resources

```bash
echo ""
echo "📊 Analyzing cluster resources..."

# Get kubeconfig
if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$AWS_REGION" --kubeconfig /tmp/kubeconfig-$CLUSTER_NAME
elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
    rosa create admin -c "$CLUSTER_NAME" > /tmp/rosa-admin-$CLUSTER_NAME.txt
    # Extract credentials and configure kubeconfig
    ADMIN_USER=$(grep "oc login" /tmp/rosa-admin-$CLUSTER_NAME.txt | awk '{print $5}')
    ADMIN_PASS=$(grep "oc login" /tmp/rosa-admin-$CLUSTER_NAME.txt | awk '{print $7}')
fi

export KUBECONFIG=/tmp/kubeconfig-$CLUSTER_NAME

# Count resources
NAMESPACE_COUNT=$(kubectl get namespaces --no-headers 2>/dev/null | wc -l)
POD_COUNT=$(kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l)
SERVICE_COUNT=$(kubectl get services --all-namespaces --no-headers 2>/dev/null | wc -l)
PV_COUNT=$(kubectl get pv --no-headers 2>/dev/null | wc -l)
PVC_COUNT=$(kubectl get pvc --all-namespaces --no-headers 2>/dev/null | wc -l)
DEPLOYMENT_COUNT=$(kubectl get deployments --all-namespaces --no-headers 2>/dev/null | wc -l)

echo "   Namespaces: $NAMESPACE_COUNT"
echo "   Pods: $POD_COUNT"
echo "   Services: $SERVICE_COUNT"
echo "   Deployments: $DEPLOYMENT_COUNT"
echo "   Persistent Volumes: $PV_COUNT"
echo "   Persistent Volume Claims: $PVC_COUNT"
```

#### 1.3 Safety Checks and Warnings

```bash
echo ""
echo "⚠️  SAFETY CHECKS"
echo "================="

WARNINGS=0

# Check for production tags/labels
if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    TAGS=$(aws eks list-tags-for-resource --resource-arn "$CLUSTER_ARN" --region "$AWS_REGION" --output json)
    ENV_TAG=$(echo "$TAGS" | jq -r '.tags.Environment // .tags.environment // .tags.env // ""')
elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
    ENV_TAG=$(rosa describe cluster -c "$CLUSTER_NAME" -o json | jq -r '.tags.environment // ""')
fi

if [[ "$ENV_TAG" =~ ^(prod|production|prd)$ ]]; then
    echo "⚠️  WARNING: Cluster is tagged as PRODUCTION"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for persistent volumes
if [[ $PV_COUNT -gt 0 ]]; then
    echo "⚠️  WARNING: $PV_COUNT Persistent Volumes will be deleted"
    echo "   This may result in DATA LOSS if volumes contain important data"
    WARNINGS=$((WARNINGS + 1))
fi

# Check for LoadBalancer services
LB_COUNT=$(kubectl get services --all-namespaces -o json 2>/dev/null | jq '[.items[] | select(.spec.type=="LoadBalancer")] | length')
if [[ $LB_COUNT -gt 0 ]]; then
    echo "⚠️  WARNING: $LB_COUNT LoadBalancer services found"
    echo "   Associated AWS Load Balancers and security groups will be deleted"
    WARNINGS=$((WARNINGS + 1))
fi

# Check cluster age
if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    CREATED_AT=$(echo "$CLUSTER_INFO" | jq -r '.cluster.createdAt')
    DAYS_OLD=$(( ($(date +%s) - $(date -d "$CREATED_AT" +%s)) / 86400 ))
elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
    CREATED_AT=$(echo "$CLUSTER_INFO" | jq -r '.creation_timestamp')
    DAYS_OLD=$(( ($(date +%s) - $(date -d "$CREATED_AT" +%s)) / 86400 ))
fi

if [[ $DAYS_OLD -gt 30 ]]; then
    echo "ℹ️  INFO: Cluster is $DAYS_OLD days old"
fi

echo ""
echo "Total warnings: $WARNINGS"
```

### Phase 2: Backup (Optional)

```bash
if [[ "${SKIP_BACKUP}" != "true" ]]; then
    echo ""
    echo "💾 Creating backup before deletion..."

    BACKUP_DIR="./cluster-backup-$CLUSTER_NAME-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    echo "   Backup directory: $BACKUP_DIR"

    # Backup all resources
    echo "   Backing up all Kubernetes resources..."
    kubectl get all --all-namespaces -o yaml > "$BACKUP_DIR/all-resources.yaml" 2>/dev/null

    # Backup persistent volumes and claims
    echo "   Backing up PV/PVC definitions..."
    kubectl get pv -o yaml > "$BACKUP_DIR/persistent-volumes.yaml" 2>/dev/null
    kubectl get pvc --all-namespaces -o yaml > "$BACKUP_DIR/persistent-volume-claims.yaml" 2>/dev/null

    # Backup ConfigMaps and Secrets
    echo "   Backing up ConfigMaps and Secrets..."
    kubectl get configmaps --all-namespaces -o yaml > "$BACKUP_DIR/configmaps.yaml" 2>/dev/null
    kubectl get secrets --all-namespaces -o yaml > "$BACKUP_DIR/secrets.yaml" 2>/dev/null

    # Backup CRDs and custom resources
    echo "   Backing up CRDs..."
    kubectl get crds -o yaml > "$BACKUP_DIR/crds.yaml" 2>/dev/null

    # Backup cluster-specific info
    if [[ "$CLUSTER_TYPE" == "eks" ]]; then
        aws eks describe-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" > "$BACKUP_DIR/cluster-info.json"
        eksctl get nodegroup --cluster "$CLUSTER_NAME" --region "$AWS_REGION" -o json > "$BACKUP_DIR/nodegroups.json" 2>/dev/null
    elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
        rosa describe cluster -c "$CLUSTER_NAME" -o json > "$BACKUP_DIR/cluster-info.json"
    fi

    echo "✅ Backup completed: $BACKUP_DIR"
else
    echo "⚠️  Skipping backup (--skip-backup flag set)"
fi
```

### Phase 3: Confirmation

```bash
echo ""
echo "🚨 FINAL CONFIRMATION REQUIRED"
echo "=============================="
echo ""
echo "You are about to DELETE the following cluster:"
echo ""
echo "  Cluster Name: $CLUSTER_NAME"
echo "  Cluster Type: $CLUSTER_TYPE"
echo "  Region: $AWS_REGION"
echo "  Resources: $NAMESPACE_COUNT namespaces, $POD_COUNT pods, $PV_COUNT PVs"
echo ""
echo "This action will:"
echo "  ❌ Delete the entire Kubernetes cluster"
echo "  ❌ Delete all workloads and configurations"
echo "  ❌ Delete all persistent volumes and data"
echo "  ❌ Delete associated AWS resources (node groups, security groups, etc.)"
if [[ "${DELETE_VPC}" == "true" ]]; then
    echo "  ❌ Delete the VPC and networking resources"
fi
echo ""
echo "⚠️  THIS CANNOT BE UNDONE!"
echo ""

if [[ "${FORCE}" != "true" ]]; then
    # First confirmation: type cluster name
    echo "To confirm, please type the cluster name: $CLUSTER_NAME"
    read -r CONFIRM_NAME

    if [[ "$CONFIRM_NAME" != "$CLUSTER_NAME" ]]; then
        echo "❌ Cluster name does not match. Aborting."
        exit 1
    fi

    # Second confirmation: yes/no
    echo ""
    echo "Are you absolutely sure you want to delete this cluster? (yes/no)"
    read -r CONFIRM_DELETE

    if [[ "$CONFIRM_DELETE" != "yes" ]]; then
        echo "❌ Deletion cancelled."
        exit 0
    fi

    # Grace period
    echo ""
    echo "⏳ Starting deletion in 10 seconds... (Ctrl+C to cancel)"
    sleep 10
else
    echo "⚠️  FORCE mode enabled - skipping confirmations"
fi
```

### Phase 4: Deletion

```bash
echo ""
echo "🗑️  Deleting cluster..."

if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    # Delete EKS cluster using eksctl (handles nodegroups, etc.)
    echo "   Deleting EKS cluster and node groups..."

    if eksctl delete cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" --wait; then
        echo "✅ EKS cluster deleted successfully"
    else
        echo "⚠️  eksctl delete failed or timed out, attempting manual cleanup..."

        # Manual cleanup of node groups
        echo "   Deleting node groups..."
        NODEGROUPS=$(aws eks list-nodegroups --cluster-name "$CLUSTER_NAME" --region "$AWS_REGION" --output text --query 'nodegroups[]' 2>/dev/null)
        for NG in $NODEGROUPS; do
            echo "   - Deleting nodegroup: $NG"
            aws eks delete-nodegroup --cluster-name "$CLUSTER_NAME" --nodegroup-name "$NG" --region "$AWS_REGION"
        done

        # Wait for nodegroups to delete
        echo "   Waiting for node groups to delete..."
        sleep 30

        # Delete cluster
        echo "   Deleting cluster control plane..."
        aws eks delete-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION"
    fi

    # Clean up VPC if requested
    if [[ "${DELETE_VPC}" == "true" && -n "$CLUSTER_VPC" ]]; then
        echo ""
        echo "   Deleting VPC and networking resources..."

        # Delete NAT Gateways
        NAT_GATEWAYS=$(aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$CLUSTER_VPC" --region "$AWS_REGION" --query 'NatGateways[].NatGatewayId' --output text)
        for NAT in $NAT_GATEWAYS; do
            echo "   - Deleting NAT Gateway: $NAT"
            aws ec2 delete-nat-gateway --nat-gateway-id "$NAT" --region "$AWS_REGION"
        done

        sleep 30

        # Delete subnets
        SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$CLUSTER_VPC" --region "$AWS_REGION" --query 'Subnets[].SubnetId' --output text)
        for SUBNET in $SUBNETS; do
            echo "   - Deleting subnet: $SUBNET"
            aws ec2 delete-subnet --subnet-id "$SUBNET" --region "$AWS_REGION" 2>/dev/null || true
        done

        # Delete route tables
        ROUTE_TABLES=$(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$CLUSTER_VPC" --region "$AWS_REGION" --query 'RouteTables[?Associations[0].Main==`false`].RouteTableId' --output text)
        for RT in $ROUTE_TABLES; do
            echo "   - Deleting route table: $RT"
            aws ec2 delete-route-table --route-table-id "$RT" --region "$AWS_REGION" 2>/dev/null || true
        done

        # Delete internet gateway
        IGW=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$CLUSTER_VPC" --region "$AWS_REGION" --query 'InternetGateways[0].InternetGatewayId' --output text)
        if [[ "$IGW" != "None" && -n "$IGW" ]]; then
            echo "   - Detaching and deleting Internet Gateway: $IGW"
            aws ec2 detach-internet-gateway --internet-gateway-id "$IGW" --vpc-id "$CLUSTER_VPC" --region "$AWS_REGION"
            aws ec2 delete-internet-gateway --internet-gateway-id "$IGW" --region "$AWS_REGION"
        fi

        # Delete security groups (except default)
        SECURITY_GROUPS=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$CLUSTER_VPC" --region "$AWS_REGION" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text)
        for SG in $SECURITY_GROUPS; do
            echo "   - Deleting security group: $SG"
            aws ec2 delete-security-group --group-id "$SG" --region "$AWS_REGION" 2>/dev/null || true
        done

        # Finally delete VPC
        echo "   - Deleting VPC: $CLUSTER_VPC"
        aws ec2 delete-vpc --vpc-id "$CLUSTER_VPC" --region "$AWS_REGION"

        echo "✅ VPC and networking resources deleted"
    fi

elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
    # Delete ROSA cluster
    echo "   Deleting ROSA cluster..."

    if rosa delete cluster --cluster "$CLUSTER_NAME" --yes; then
        echo "   Waiting for cluster deletion to complete..."

        # Monitor deletion progress
        while rosa describe cluster -c "$CLUSTER_NAME" &>/dev/null; do
            echo "   Cluster still deleting..."
            sleep 30
        done

        echo "✅ ROSA cluster deleted successfully"
    else
        echo "❌ ROSA cluster deletion failed"
        exit 1
    fi
fi
```

### Phase 5: Post-Deletion Cleanup

```bash
echo ""
echo "🧹 Cleaning up local resources..."

# Remove kubeconfig entry
kubectl config delete-context "$CLUSTER_NAME" 2>/dev/null || true
kubectl config delete-cluster "$CLUSTER_NAME" 2>/dev/null || true

# Clean up temporary files
rm -f /tmp/kubeconfig-$CLUSTER_NAME
rm -f /tmp/rosa-admin-$CLUSTER_NAME.txt

echo "✅ Local cleanup completed"
```

### Phase 6: Summary

```bash
echo ""
echo "✅ CLUSTER DELETION COMPLETE"
echo "============================"
echo ""
echo "Cluster '$CLUSTER_NAME' has been successfully deleted."
echo ""

if [[ "${SKIP_BACKUP}" != "true" ]]; then
    echo "Backup saved to: $BACKUP_DIR"
    echo ""
fi

echo "Next steps:"
echo "  • Verify AWS resources are fully cleaned up in the console"
echo "  • Check for any orphaned resources (EBS volumes, EIPs, etc.)"
if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    echo "  • Review CloudFormation stacks for eksctl-* stacks"
fi
echo "  • Update documentation and inventory"
echo ""
```

## Safety Best Practices

1. **Always create backups** unless absolutely certain
2. **Review the resource list** before confirming
3. **Test deletion in non-production** first
4. **Check for orphaned resources** after deletion
5. **Document the deletion** for audit purposes
6. **Verify IAM cleanup** if cluster-specific roles were created

## Common Issues

### Issue: Deletion stuck or timing out

**Solution**: Check for resources blocking deletion:

```bash
# Check for lingering node groups
aws eks list-nodegroups --cluster-name $CLUSTER_NAME --region $AWS_REGION

# Check for persistent volumes
kubectl get pv

# Check for LoadBalancer services
kubectl get svc --all-namespaces -o wide | grep LoadBalancer
```

### Issue: VPC deletion fails

**Solution**: Manually identify and delete dependencies:

```bash
# Find ENIs
aws ec2 describe-network-interfaces --filters "Name=vpc-id,Values=$VPC_ID" --region $AWS_REGION

# Find security group dependencies
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --region $AWS_REGION
```

### Issue: ROSA cluster deletion requires manual steps

**Solution**: Use ROSA CLI to check status:

```bash
rosa logs uninstall -c $CLUSTER_NAME
```

## Examples

### Example 1: Safe EKS deletion with backup

```bash
# Production-safe deletion with all safety features
cluster-code aws-cluster-delete \
  --cluster-name my-prod-cluster \
  --type eks \
  --region us-west-2
```

### Example 2: Quick deletion for development

```bash
# Skip backup for temporary dev cluster
cluster-code aws-cluster-delete \
  --cluster-name dev-test-123 \
  --type eks \
  --region us-east-1 \
  --skip-backup
```

### Example 3: Complete cleanup including VPC

```bash
# Delete cluster and all networking
cluster-code aws-cluster-delete \
  --cluster-name old-cluster \
  --type eks \
  --region eu-west-1 \
  --delete-vpc
```

### Example 4: Delete ROSA cluster

```bash
# Delete Red Hat OpenShift Service on AWS cluster
cluster-code aws-cluster-delete \
  --cluster-name rosa-prod \
  --type rosa \
  --region us-east-1
```

## Related Commands

- `aws-cluster-create`: Create new EKS/ROSA clusters
- `aws-cluster-upgrade`: Upgrade cluster version
- `backup-cluster`: Create comprehensive cluster backup
- `cluster-diagnose`: Run diagnostics before deletion
