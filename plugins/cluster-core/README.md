# Cluster Core Plugin

The **cluster-core** plugin provides essential Kubernetes cluster operations and resource management commands for Cluster Code.

## Features

### 📋 Core Commands
- **`node-status`**: Comprehensive node health and resource analysis
- **`service-describe`**: Detailed service analysis with connectivity testing
- **`pvc-status`**: Persistent volume claim and storage resource analysis
- **`config-view`**: Cluster configuration and settings viewer
- **`resource-top`**: Real-time resource utilization monitoring
- **`namespace-switch`**: Namespace context switching and management

### 🤖 Specialized Agents
- **`workload-analyzer`**: Advanced analysis of deployments, StatefulSets, and other workloads
- **`storage-analyzer`**: Comprehensive storage and PVC analysis with optimization recommendations

## Quick Start

### Install the Plugin
```bash
# The plugin is included with Cluster Code
# Activate it in your current session:
cluster-code plugin activate cluster-core
```

### Basic Usage

#### Check Node Health
```bash
# Overview of all nodes
node-status

# Detailed analysis of specific node
node-status worker-node-01 --detailed
```

#### Analyze Services
```bash
# Service connectivity analysis
service-describe my-api-service

# Test service connectivity
service-describe my-web-service --test
```

#### Monitor Storage
```bash
# All PVCs status
pvc-status

# Detailed storage analysis
pvc-status --detailed

# Specific PVC analysis
pvc-status my-data-pvc --namespace production
```

#### Analyze Workloads
```bash
# Start the workload analyzer agent
cluster-code agent workload-analyzer

# Get comprehensive workload analysis
```

## Command Reference

### node-status
Analyzes cluster node health, resource utilization, and identifies potential issues.

**Usage:**
```bash
node-status [node-name] [--detailed]
```

**Examples:**
```bash
node-status                    # Show all nodes
node-status worker-01          # Specific node
node-status --detailed         # Include pod distribution and resource usage
```

**What it analyzes:**
- Node conditions and readiness
- CPU, memory, and storage capacity
- Resource pressure detection
- Pod distribution and density
- Taints and tolerations
- Network configuration

### service-describe
Provides comprehensive service analysis including configuration, endpoints, and connectivity testing.

**Usage:**
```bash
service-describe <service-name> [--namespace=<ns>] [--test]
```

**Examples:**
```bash
service-describe my-api --namespace production
service-describe frontend-service --test
```

**What it analyzes:**
- Service configuration and selectors
- Endpoint health and availability
- DNS resolution and service discovery
- Port connectivity testing
- Load balancer status (for LoadBalancer services)
- Network policy impacts

### pvc-status
Analyzes persistent volume claims, storage resources, and provides capacity planning insights.

**Usage:**
```bash
pvc-status [pvc-name] [--namespace=<ns>] [--detailed]
```

**Examples:**
```bash
pvc-status                                    # All PVCs
pvc-status my-data-pvc --namespace prod      # Specific PVC
pvc-status --detailed                        # Capacity analysis
```

**What it analyzes:**
- PVC binding status and issues
- Storage class configuration
- Persistent volume health
- Capacity utilization trends
- Access mode distribution
- Cost optimization opportunities

### config-view
Displays cluster configuration details and settings.

**Usage:**
```bash
config-view [--component=<name>]
```

**Examples:**
```bash
config-view                    # Overview
config-view --component=dns   # DNS configuration
```

### resource-top
Shows real-time resource utilization across the cluster.

**Usage:**
```bash
resource-top [--sort-by=cpu|memory] [--namespace=<ns>]
```

**Examples:**
```bash
resource-top                   # All resources
resource-top --sort-by=memory # Sort by memory usage
```

### namespace-switch
Manages namespace context for operations.

**Usage:**
```bash
namespace-switch <namespace>
namespace-switch --list
```

## Agent Reference

### workload-analyzer
A specialized AI agent that analyzes Kubernetes workloads comprehensively.

**Launch:**
```bash
cluster-code agent workload-analyzer
```

**Analysis Coverage:**
- Deployments: Rollout status, update strategies, health checks
- StatefulSets: Pod identity, volume management, ordered updates
- DaemonSets: Node coverage, update strategies, resource impact
- Jobs/CronJobs: Completion rates, retry policies, scheduling
- Resource optimization and performance tuning
- Security configuration analysis

**Capabilities:**
- Identify configuration issues and optimization opportunities
- Analyze resource utilization and recommend improvements
- Review health check configurations
- Assess scaling readiness and strategies
- Provide security best practices recommendations

### storage-analyzer
Advanced storage analysis and optimization agent.

**Launch:**
```bash
cluster-code agent storage-analyzer
```

**Analysis Coverage:**
- PVC health and binding issues
- Storage class configuration and provisioning
- Capacity planning and utilization trends
- Performance optimization recommendations
- Cost optimization strategies
- Backup and disaster recovery planning

## Configuration

The plugin uses these permissions:
- `Bash(kubectl:*)` - Execute kubectl commands
- `Bash(oc:*)` - Execute OpenShift commands
- `Read(.*\.yaml)` - Read YAML configuration files
- `Write(.*\.yaml)` - Write YAML configuration files

## Troubleshooting

### Common Issues

**Plugin not found:**
```bash
# Verify plugin installation
cluster-code plugin list

# Install if missing
cluster-code plugin install cluster-core
```

**kubectl not found:**
```bash
# Install kubectl
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

**Permission denied:**
```bash
# Check RBAC permissions
kubectl auth can-i get pods
kubectl auth can-i get nodes

# Request additional permissions if needed
```

### Debug Mode

Enable debug output for troubleshooting:
```bash
export CLUSTER_CODE_DEBUG=true
node-status --detailed
```

## Contributing

To contribute to the cluster-core plugin:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit a pull request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/cluster-code.git
cd cluster-code/plugins/cluster-core

# Test changes locally
cluster-code plugin link ./cluster-core

# Run tests
npm test
```

## Support

- **Documentation**: https://docs.cluster-code.io/plugins/cluster-core
- **Issues**: https://github.com/your-org/cluster-code/issues
- **Discord**: https://discord.gg/cluster-code

## License

MIT License - see LICENSE file for details.