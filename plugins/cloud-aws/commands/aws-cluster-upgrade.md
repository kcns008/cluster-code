---
name: aws-cluster-upgrade
description: Upgrade EKS or ROSA cluster to a new Kubernetes version
category: cloud-provisioning
parameters:
  - name: cluster-name
    description: Name of the cluster to upgrade
    required: true
  - name: type
    description: Cluster type (eks or rosa)
    required: true
    default: eks
  - name: region
    description: AWS region where cluster is located
    required: true
  - name: version
    description: Target Kubernetes version (e.g., 1.29)
    required: true
  - name: upgrade-addons
    description: Automatically upgrade add-ons after cluster upgrade
    type: boolean
    default: true
  - name: upgrade-nodegroups
    description: Automatically upgrade node groups after control plane
    type: boolean
    default: true
  - name: skip-backup
    description: Skip pre-upgrade backup
    type: boolean
    default: false
  - name: dry-run
    description: Show what would be upgraded without making changes
    type: boolean
    default: false
tags:
  - aws
  - eks
  - rosa
  - cluster-lifecycle
  - upgrade
  - maintenance
---

# AWS Cluster Upgrade

Safely upgrade an EKS or ROSA cluster to a new Kubernetes version with automated validation, backup, and verification.

## Overview

This command provides a comprehensive cluster upgrade workflow with:

- **Version Validation**: Ensures target version is available and upgrade path is valid
- **Pre-upgrade Backup**: Automatic backup before making changes
- **Staged Upgrade**: Control plane first, then add-ons, then node groups
- **Health Monitoring**: Continuous health checks throughout upgrade
- **Rollback Support**: Documented procedures for rolling back if needed

## Prerequisites

- AWS CLI installed and configured (`aws --version` >= 2.13.0)
- For EKS: `eksctl` CLI installed (>= 0.165.0)
- For ROSA: `rosa` CLI installed and authenticated
- `kubectl` configured with cluster admin access
- Appropriate IAM permissions:
  - EKS: `eks:UpdateClusterVersion`, `eks:UpdateNodegroupVersion`
  - ROSA: Cluster admin or organization admin role

## Important Considerations

### Kubernetes Version Upgrade Policy

- **EKS**: Can only upgrade one minor version at a time (e.g., 1.28 → 1.29)
- **ROSA**: Can upgrade one minor version at a time
- **Patch versions**: Can skip directly to latest patch (e.g., 1.28.2 → 1.28.7)
- **Downgrade**: Not supported - must redeploy cluster

### Upgrade Impact

- **Control Plane**: Brief API server disruption during upgrade (~5-10 min)
- **Workloads**: Continue running during control plane upgrade
- **Node Groups**: Rolling replacement when upgraded (workload disruption possible)
- **Add-ons**: May require update or reinstallation

## Workflow

### Phase 1: Pre-upgrade Validation

#### 1.1 Check Current Version and Status

```bash
CLUSTER_NAME="${CLUSTER_NAME}"
CLUSTER_TYPE="${CLUSTER_TYPE:-eks}"
AWS_REGION="${AWS_REGION}"
TARGET_VERSION="${TARGET_VERSION}"

echo "🔍 Validating cluster upgrade: $CLUSTER_NAME"
echo ""

if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    # Get current EKS version
    CLUSTER_INFO=$(aws eks describe-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" --output json)
    CURRENT_VERSION=$(echo "$CLUSTER_INFO" | jq -r '.cluster.version')
    CLUSTER_STATUS=$(echo "$CLUSTER_INFO" | jq -r '.cluster.status')
    PLATFORM_VERSION=$(echo "$CLUSTER_INFO" | jq -r '.cluster.platformVersion')

    echo "Current cluster version: $CURRENT_VERSION"
    echo "Platform version: $PLATFORM_VERSION"
    echo "Cluster status: $CLUSTER_STATUS"

    # Check cluster is in ACTIVE state
    if [[ "$CLUSTER_STATUS" != "ACTIVE" ]]; then
        echo "❌ ERROR: Cluster must be in ACTIVE state for upgrade"
        echo "   Current state: $CLUSTER_STATUS"
        exit 1
    fi

elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
    # Get current ROSA version
    CLUSTER_INFO=$(rosa describe cluster -c "$CLUSTER_NAME" -o json)
    CURRENT_VERSION=$(echo "$CLUSTER_INFO" | jq -r '.version.raw_id' | cut -d. -f1-2)
    CLUSTER_STATE=$(echo "$CLUSTER_INFO" | jq -r '.status.state')

    echo "Current cluster version: $CURRENT_VERSION"
    echo "Cluster state: $CLUSTER_STATE"

    if [[ "$CLUSTER_STATE" != "ready" ]]; then
        echo "❌ ERROR: Cluster must be in ready state for upgrade"
        exit 1
    fi
fi

echo "Target version: $TARGET_VERSION"
```

#### 1.2 Validate Upgrade Path

```bash
echo ""
echo "✅ Validating upgrade path..."

# Parse versions
CURRENT_MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
CURRENT_MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
TARGET_MAJOR=$(echo "$TARGET_VERSION" | cut -d. -f1)
TARGET_MINOR=$(echo "$TARGET_VERSION" | cut -d. -f2)

# Check major version
if [[ "$CURRENT_MAJOR" != "$TARGET_MAJOR" ]]; then
    echo "❌ ERROR: Major version upgrades are not supported"
    echo "   Current: $CURRENT_MAJOR.x, Target: $TARGET_MAJOR.x"
    exit 1
fi

# Check minor version increment
MINOR_DIFF=$((TARGET_MINOR - CURRENT_MINOR))

if [[ $MINOR_DIFF -lt 0 ]]; then
    echo "❌ ERROR: Downgrading is not supported"
    echo "   Current: $CURRENT_VERSION, Target: $TARGET_VERSION"
    exit 1
elif [[ $MINOR_DIFF -eq 0 ]]; then
    echo "ℹ️  Same minor version - will upgrade to latest patch version"
elif [[ $MINOR_DIFF -gt 1 ]]; then
    echo "❌ ERROR: Can only upgrade one minor version at a time"
    echo "   Current: $CURRENT_VERSION, Target: $TARGET_VERSION"
    echo "   Please upgrade to $CURRENT_MAJOR.$((CURRENT_MINOR + 1)) first"
    exit 1
else
    echo "✅ Valid upgrade path: $CURRENT_VERSION → $TARGET_VERSION"
fi
```

#### 1.3 Check Available Versions

```bash
echo ""
echo "📋 Checking available versions..."

if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    # List available EKS versions
    AVAILABLE_VERSIONS=$(aws eks describe-addon-versions --region "$AWS_REGION" --query 'addons[0].addonVersions[0].compatibilities[].clusterVersion' --output text | sort -V | uniq)

    echo "Available EKS versions:"
    echo "$AVAILABLE_VERSIONS" | tr '\t' '\n' | sed 's/^/  - /'

    # Check if target version is available
    if ! echo "$AVAILABLE_VERSIONS" | grep -q "$TARGET_VERSION"; then
        echo "❌ ERROR: Target version $TARGET_VERSION is not available in region $AWS_REGION"
        exit 1
    fi

elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
    # List available ROSA versions
    AVAILABLE_VERSIONS=$(rosa list versions -o json | jq -r '.[].raw_id' | sort -V)

    echo "Available ROSA versions:"
    echo "$AVAILABLE_VERSIONS" | sed 's/^/  - /'

    # Check if target version is available
    if ! echo "$AVAILABLE_VERSIONS" | grep -q "^$TARGET_VERSION"; then
        echo "❌ ERROR: Target version $TARGET_VERSION is not available"
        exit 1
    fi
fi

echo "✅ Target version $TARGET_VERSION is available"
```

#### 1.4 Health Check

```bash
echo ""
echo "🏥 Running pre-upgrade health check..."

# Update kubeconfig
if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$AWS_REGION"
fi

# Check node status
echo "   Checking node health..."
UNHEALTHY_NODES=$(kubectl get nodes --no-headers | grep -v " Ready" | wc -l)
if [[ $UNHEALTHY_NODES -gt 0 ]]; then
    echo "⚠️  WARNING: $UNHEALTHY_NODES nodes are not in Ready state"
    kubectl get nodes | grep -v " Ready"
fi

# Check pod health
echo "   Checking pod health..."
FAILING_PODS=$(kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded --no-headers 2>/dev/null | wc -l)
if [[ $FAILING_PODS -gt 0 ]]; then
    echo "⚠️  WARNING: $FAILING_PODS pods are not in Running/Succeeded state"
fi

# Check for deprecated APIs
echo "   Checking for deprecated APIs in target version..."
if command -v pluto &>/dev/null; then
    pluto detect-all-in-cluster --target-versions k8s=v$TARGET_VERSION
else
    echo "ℹ️  Install 'pluto' for deprecated API detection: brew install FairwindsOps/tap/pluto"
fi

# Check PodDisruptionBudgets
echo "   Checking PodDisruptionBudgets..."
PDB_COUNT=$(kubectl get pdb --all-namespaces --no-headers 2>/dev/null | wc -l)
if [[ $PDB_COUNT -gt 0 ]]; then
    echo "ℹ️  Found $PDB_COUNT PodDisruptionBudgets (may affect node upgrade)"
fi

echo "✅ Pre-upgrade health check completed"
```

### Phase 2: Backup and Preparation

```bash
if [[ "${SKIP_BACKUP}" != "true" && "${DRY_RUN}" != "true" ]]; then
    echo ""
    echo "💾 Creating pre-upgrade backup..."

    BACKUP_DIR="./cluster-backup-upgrade-$CLUSTER_NAME-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # Backup cluster configuration
    if [[ "$CLUSTER_TYPE" == "eks" ]]; then
        aws eks describe-cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" > "$BACKUP_DIR/cluster-config.json"
        eksctl get nodegroup --cluster "$CLUSTER_NAME" --region "$AWS_REGION" -o json > "$BACKUP_DIR/nodegroups.json" 2>/dev/null
    elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
        rosa describe cluster -c "$CLUSTER_NAME" -o json > "$BACKUP_DIR/cluster-config.json"
    fi

    # Backup Kubernetes resources
    kubectl get all --all-namespaces -o yaml > "$BACKUP_DIR/all-resources.yaml"
    kubectl get pv,pvc --all-namespaces -o yaml > "$BACKUP_DIR/volumes.yaml"
    kubectl get configmap,secret --all-namespaces -o yaml > "$BACKUP_DIR/configs-secrets.yaml"

    echo "✅ Backup saved to: $BACKUP_DIR"
fi
```

### Phase 3: Upgrade Execution

#### 3.1 Upgrade Control Plane

```bash
echo ""
echo "🚀 UPGRADE EXECUTION"
echo "===================="

if [[ "${DRY_RUN}" == "true" ]]; then
    echo "🧪 DRY RUN MODE - No changes will be made"
    echo ""
    echo "Would upgrade:"
    echo "  Cluster: $CLUSTER_NAME"
    echo "  From: $CURRENT_VERSION"
    echo "  To: $TARGET_VERSION"
    echo "  Region: $AWS_REGION"
    exit 0
fi

echo ""
echo "📝 Upgrade Summary:"
echo "  Cluster: $CLUSTER_NAME"
echo "  Type: $CLUSTER_TYPE"
echo "  Current Version: $CURRENT_VERSION"
echo "  Target Version: $TARGET_VERSION"
echo "  Region: $AWS_REGION"
echo ""
echo "Upgrade phases:"
echo "  1. Control plane upgrade (~10-15 minutes)"
if [[ "${UPGRADE_ADDONS}" == "true" ]]; then
    echo "  2. Add-on upgrades (~5-10 minutes)"
fi
if [[ "${UPGRADE_NODEGROUPS}" == "true" ]]; then
    echo "  3. Node group upgrades (~15-30 minutes per group)"
fi
echo ""
echo "⚠️  API server will be briefly unavailable during control plane upgrade"
echo ""

read -p "Continue with upgrade? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    echo "❌ Upgrade cancelled"
    exit 0
fi

echo ""
echo "Step 1/3: Upgrading control plane to $TARGET_VERSION..."
echo "⏳ This may take 10-15 minutes..."

UPGRADE_START=$(date +%s)

if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    # Upgrade EKS control plane
    UPDATE_ID=$(aws eks update-cluster-version \
        --name "$CLUSTER_NAME" \
        --kubernetes-version "$TARGET_VERSION" \
        --region "$AWS_REGION" \
        --output text \
        --query 'update.id')

    echo "   Update ID: $UPDATE_ID"
    echo "   Monitoring upgrade progress..."

    # Wait for upgrade to complete
    while true; do
        UPDATE_STATUS=$(aws eks describe-update \
            --name "$CLUSTER_NAME" \
            --update-id "$UPDATE_ID" \
            --region "$AWS_REGION" \
            --output text \
            --query 'update.status')

        case "$UPDATE_STATUS" in
            "InProgress")
                echo "   Status: In Progress ($(( ($(date +%s) - UPGRADE_START) / 60 )) minutes elapsed)"
                sleep 30
                ;;
            "Successful")
                echo "✅ Control plane upgraded successfully"
                break
                ;;
            "Failed"|"Cancelled")
                echo "❌ Control plane upgrade $UPDATE_STATUS"
                aws eks describe-update --name "$CLUSTER_NAME" --update-id "$UPDATE_ID" --region "$AWS_REGION"
                exit 1
                ;;
        esac
    done

elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
    # Upgrade ROSA cluster
    echo "   Initiating ROSA upgrade..."

    rosa upgrade cluster \
        --cluster "$CLUSTER_NAME" \
        --version "$TARGET_VERSION" \
        --mode auto \
        --yes

    echo "   Monitoring upgrade progress..."

    # Monitor upgrade status
    while true; do
        UPGRADE_STATE=$(rosa describe cluster -c "$CLUSTER_NAME" -o json | jq -r '.status.upgrade.state // "completed"')

        if [[ "$UPGRADE_STATE" == "completed" || "$UPGRADE_STATE" == "null" ]]; then
            # Check if version matches target
            NEW_VERSION=$(rosa describe cluster -c "$CLUSTER_NAME" -o json | jq -r '.version.raw_id' | cut -d. -f1-2)
            if [[ "$NEW_VERSION" == "$TARGET_VERSION" ]]; then
                echo "✅ Control plane upgraded successfully"
                break
            fi
        elif [[ "$UPGRADE_STATE" == "failed" ]]; then
            echo "❌ Control plane upgrade failed"
            rosa logs install -c "$CLUSTER_NAME"
            exit 1
        else
            echo "   Status: $UPGRADE_STATE ($(( ($(date +%s) - UPGRADE_START) / 60 )) minutes elapsed)"
            sleep 30
        fi
    done
fi
```

#### 3.2 Upgrade Add-ons (EKS only)

```bash
if [[ "$CLUSTER_TYPE" == "eks" && "${UPGRADE_ADDONS}" == "true" ]]; then
    echo ""
    echo "Step 2/3: Upgrading EKS add-ons..."

    # Core add-ons to upgrade
    ADDONS=("vpc-cni" "coredns" "kube-proxy" "aws-ebs-csi-driver")

    for ADDON in "${ADDONS[@]}"; do
        # Check if addon is installed
        if aws eks describe-addon \
            --cluster-name "$CLUSTER_NAME" \
            --addon-name "$ADDON" \
            --region "$AWS_REGION" &>/dev/null; then

            CURRENT_ADDON_VERSION=$(aws eks describe-addon \
                --cluster-name "$CLUSTER_NAME" \
                --addon-name "$ADDON" \
                --region "$AWS_REGION" \
                --query 'addon.addonVersion' \
                --output text)

            # Get latest compatible version
            LATEST_ADDON_VERSION=$(aws eks describe-addon-versions \
                --addon-name "$ADDON" \
                --kubernetes-version "$TARGET_VERSION" \
                --region "$AWS_REGION" \
                --query 'addons[0].addonVersions[0].addonVersion' \
                --output text)

            if [[ "$CURRENT_ADDON_VERSION" != "$LATEST_ADDON_VERSION" ]]; then
                echo "   Upgrading $ADDON: $CURRENT_ADDON_VERSION → $LATEST_ADDON_VERSION"

                aws eks update-addon \
                    --cluster-name "$CLUSTER_NAME" \
                    --addon-name "$ADDON" \
                    --addon-version "$LATEST_ADDON_VERSION" \
                    --resolve-conflicts OVERWRITE \
                    --region "$AWS_REGION"

                # Wait for addon update
                aws eks wait addon-active \
                    --cluster-name "$CLUSTER_NAME" \
                    --addon-name "$ADDON" \
                    --region "$AWS_REGION"

                echo "   ✅ $ADDON upgraded"
            else
                echo "   ✅ $ADDON already at latest version"
            fi
        else
            echo "   ℹ️  $ADDON not installed, skipping"
        fi
    done

    echo "✅ Add-ons upgrade completed"
fi
```

#### 3.3 Upgrade Node Groups

```bash
if [[ "${UPGRADE_NODEGROUPS}" == "true" ]]; then
    echo ""
    echo "Step 3/3: Upgrading node groups..."

    if [[ "$CLUSTER_TYPE" == "eks" ]]; then
        # Get all node groups
        NODEGROUPS=$(aws eks list-nodegroups \
            --cluster-name "$CLUSTER_NAME" \
            --region "$AWS_REGION" \
            --output text \
            --query 'nodegroups[]')

        if [[ -z "$NODEGROUPS" ]]; then
            echo "ℹ️  No managed node groups found"
        else
            for NG in $NODEGROUPS; do
                echo ""
                echo "   Upgrading node group: $NG"

                # Get current node group version
                NG_VERSION=$(aws eks describe-nodegroup \
                    --cluster-name "$CLUSTER_NAME" \
                    --nodegroup-name "$NG" \
                    --region "$AWS_REGION" \
                    --query 'nodegroup.version' \
                    --output text)

                if [[ "$NG_VERSION" == "$TARGET_VERSION" ]]; then
                    echo "   ✅ Already at version $TARGET_VERSION"
                    continue
                fi

                echo "   Current version: $NG_VERSION"
                echo "   Target version: $TARGET_VERSION"
                echo "   ⏳ Upgrading (this will perform rolling node replacement)..."

                # Initiate node group upgrade
                UPDATE_ID=$(aws eks update-nodegroup-version \
                    --cluster-name "$CLUSTER_NAME" \
                    --nodegroup-name "$NG" \
                    --region "$AWS_REGION" \
                    --output text \
                    --query 'update.id')

                # Monitor upgrade
                while true; do
                    UPDATE_STATUS=$(aws eks describe-update \
                        --name "$CLUSTER_NAME" \
                        --update-id "$UPDATE_ID" \
                        --nodegroup-name "$NG" \
                        --region "$AWS_REGION" \
                        --output text \
                        --query 'update.status')

                    case "$UPDATE_STATUS" in
                        "InProgress")
                            echo "   Status: In Progress..."
                            sleep 30
                            ;;
                        "Successful")
                            echo "   ✅ $NG upgraded successfully"
                            break
                            ;;
                        "Failed"|"Cancelled")
                            echo "   ❌ $NG upgrade $UPDATE_STATUS"
                            exit 1
                            ;;
                    esac
                done
            done
        fi

    elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
        echo "   Upgrading ROSA machine pools..."

        # List machine pools
        MACHINE_POOLS=$(rosa list machinepools -c "$CLUSTER_NAME" -o json | jq -r '.[].id')

        for MP in $MACHINE_POOLS; do
            echo "   Upgrading machine pool: $MP"

            rosa upgrade machinepool \
                --cluster "$CLUSTER_NAME" \
                --machinepool "$MP" \
                --version "$TARGET_VERSION" \
                --yes

            echo "   ✅ $MP upgrade initiated"
        done
    fi

    echo "✅ Node groups upgrade completed"
else
    echo ""
    echo "⚠️  Skipping node group upgrade (--upgrade-nodegroups=false)"
    echo "   Node groups are still running version $CURRENT_VERSION"
    echo "   Upgrade manually with: aws eks update-nodegroup-version"
fi
```

### Phase 4: Post-Upgrade Verification

```bash
echo ""
echo "🔍 POST-UPGRADE VERIFICATION"
echo "============================"

# Verify control plane version
echo ""
echo "Verifying cluster version..."

if [[ "$CLUSTER_TYPE" == "eks" ]]; then
    NEW_VERSION=$(aws eks describe-cluster \
        --name "$CLUSTER_NAME" \
        --region "$AWS_REGION" \
        --query 'cluster.version' \
        --output text)
elif [[ "$CLUSTER_TYPE" == "rosa" ]]; then
    NEW_VERSION=$(rosa describe cluster -c "$CLUSTER_NAME" -o json | jq -r '.version.raw_id' | cut -d. -f1-2)
fi

if [[ "$NEW_VERSION" == "$TARGET_VERSION" ]]; then
    echo "✅ Cluster version: $NEW_VERSION"
else
    echo "❌ Version mismatch! Expected: $TARGET_VERSION, Got: $NEW_VERSION"
fi

# Check node versions
echo ""
echo "Checking node versions..."
kubectl get nodes -o custom-columns=NAME:.metadata.name,VERSION:.status.nodeInfo.kubeletVersion

# Check pod health
echo ""
echo "Checking pod health..."
FAILING_PODS=$(kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded --no-headers 2>/dev/null | wc -l)

if [[ $FAILING_PODS -eq 0 ]]; then
    echo "✅ All pods healthy"
else
    echo "⚠️  $FAILING_PODS pods not in Running/Succeeded state:"
    kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded
fi

# Run diagnostics
echo ""
echo "Running cluster diagnostics..."
if command -v k8sgpt &>/dev/null; then
    k8sgpt analyze --explain --filter=Node,Pod
else
    echo "ℹ️  Install k8sgpt for AI-powered diagnostics"
fi

UPGRADE_END=$(date +%s)
TOTAL_TIME=$(( (UPGRADE_END - UPGRADE_START) / 60 ))

echo ""
echo "✅ UPGRADE COMPLETED SUCCESSFULLY"
echo "=================================="
echo ""
echo "Cluster: $CLUSTER_NAME"
echo "Old version: $CURRENT_VERSION"
echo "New version: $NEW_VERSION"
echo "Total time: $TOTAL_TIME minutes"
echo ""
echo "Next steps:"
echo "  • Monitor applications for any issues"
echo "  • Update CI/CD pipelines to use new version"
echo "  • Review Kubernetes $TARGET_VERSION changelog for new features"
echo "  • Update documentation and runbooks"
echo ""
```

## Rollback Procedures

If the upgrade fails or causes issues:

### EKS Rollback

1. **Control plane cannot be rolled back** - must deploy new cluster with old version
2. **Node groups can be rolled back**:

```bash
# Deploy old version node group
eksctl create nodegroup \
  --cluster $CLUSTER_NAME \
  --version $OLD_VERSION \
  --name rollback-ng

# Drain and delete new nodes
kubectl drain <node> --ignore-daemonsets
eksctl delete nodegroup --cluster $CLUSTER_NAME --name <new-ng>
```

### ROSA Rollback

ROSA does not support rollback. Recovery options:
1. Restore from backup to new cluster
2. Contact Red Hat support for assistance

## Best Practices

1. **Test in non-production first** - Always upgrade dev/staging before production
2. **Review release notes** - Check Kubernetes and EKS/ROSA release notes
3. **Schedule maintenance window** - Plan for API server downtime
4. **Monitor during upgrade** - Watch for pod evictions and node replacements
5. **Keep backups** - Maintain backups for at least 30 days post-upgrade
6. **Update workloads** - Ensure apps are compatible with new Kubernetes version

## Related Commands

- `aws-cluster-delete`: Delete clusters
- `cluster-diagnose`: Run comprehensive diagnostics
- `backup-cluster`: Create cluster backup
- `node-drain`: Manually drain nodes before upgrade
