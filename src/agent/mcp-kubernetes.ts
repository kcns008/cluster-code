/**
 * Kubernetes MCP Server
 * 
 * Custom MCP server with Kubernetes-specific tools for the Agent SDK
 * Enhanced with proper typing and additional tools
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { configManager } from '../config';

const execAsync = promisify(exec);

/**
 * Tool result type for MCP tools
 */
interface ToolResult {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
}

/**
 * Tool result helper for consistent response formatting
 */
function createToolResult(text: string, isError = false): ToolResult {
    return {
        content: [{ type: 'text', text }],
        isError,
    };
}

/**
 * Execute a command and return result
 */
async function executeCommand(command: string, timeout = 60000): Promise<{ success: boolean; output: string; error?: string }> {
    try {
        const { stdout, stderr } = await execAsync(command, {
            timeout,
            maxBuffer: 10 * 1024 * 1024, // 10MB
        });

        return {
            success: true,
            output: stdout.trim(),
            error: stderr ? stderr.trim() : undefined,
        };
    } catch (error: any) {
        return {
            success: false,
            output: error.stdout?.trim() || '',
            error: error.stderr?.trim() || error.message,
        };
    }
}

/**
 * Get the appropriate CLI (kubectl or oc)
 */
async function getCLI(): Promise<string> {
    const cluster = configManager.getCluster();
    if (cluster?.type === 'openshift') {
        try {
            await execAsync('which oc');
            return 'oc';
        } catch {
            return 'kubectl';
        }
    }
    return 'kubectl';
}

/**
 * Build command with context and namespace
 */
async function buildCommand(baseCommand: string, namespace?: string): Promise<string> {
    const cli = await getCLI();
    const cluster = configManager.getCluster();

    const parts = [cli];

    if (cluster?.context) {
        parts.push(`--context=${cluster.context}`);
    }

    if (namespace || cluster?.namespace) {
        parts.push(`--namespace=${namespace || cluster?.namespace}`);
    }

    parts.push(baseCommand);

    return parts.join(' ');
}

/**
 * kubectl tool - Execute kubectl commands against the configured cluster
 */
const kubectlTool = tool(
    'kubectl',
    'Execute kubectl/oc commands against the configured Kubernetes or OpenShift cluster. The command should NOT include "kubectl" or "oc" prefix - just the subcommand and arguments (e.g., "get pods", "describe deployment nginx", "logs -f pod/my-pod").',
    {
        command: z.string().describe('The kubectl command to execute without the kubectl/oc prefix (e.g., "get pods -o wide", "describe node node1")'),
        namespace: z.string().optional().describe('Override the default namespace for this command'),
        output_format: z.enum(['text', 'json', 'yaml']).optional().describe('Output format (default: text)'),
    },
    async ({ command, namespace, output_format }): Promise<ToolResult> => {
        // Add output format if specified and not already in command
        let finalCommand = command;
        if (output_format && !command.includes('-o ') && !command.includes('--output')) {
            finalCommand = `${command} -o ${output_format}`;
        }

        const fullCommand = await buildCommand(finalCommand, namespace);
        const result = await executeCommand(fullCommand);

        if (result.success) {
            return createToolResult(result.output || 'Command completed successfully with no output.');
        } else {
            return createToolResult(`Command failed:\n${result.error}\n\nPartial output:\n${result.output}`, true);
        }
    }
);

/**
 * describe_resource tool - Get detailed information about a Kubernetes resource
 */
const describeResourceTool = tool(
    'describe_resource',
    'Get detailed information about a specific Kubernetes resource including events, conditions, and configuration.',
    {
        resource_type: z.string().describe('The type of resource (e.g., pod, deployment, service, node, configmap, secret)'),
        resource_name: z.string().describe('The name of the resource'),
        namespace: z.string().optional().describe('The namespace of the resource (not needed for cluster-scoped resources like nodes)'),
    },
    async ({ resource_type, resource_name, namespace }): Promise<ToolResult> => {
        const command = `describe ${resource_type} ${resource_name}`;
        const fullCommand = await buildCommand(command, namespace);
        const result = await executeCommand(fullCommand);

        return createToolResult(
            result.success ? result.output : `Failed to describe ${resource_type}/${resource_name}: ${result.error}`,
            !result.success
        );
    }
);

/**
 * get_logs tool - Get logs from a pod or container
 */
const getLogsTool = tool(
    'get_logs',
    'Get logs from a pod or specific container within a pod. Useful for debugging application issues.',
    {
        pod_name: z.string().describe('The name of the pod'),
        container: z.string().optional().describe('The name of the container (required if pod has multiple containers)'),
        namespace: z.string().optional().describe('The namespace of the pod'),
        tail_lines: z.number().optional().describe('Number of lines to show from the end of the logs (default: 100)'),
        previous: z.boolean().optional().describe('Get logs from the previous container instance (useful for crash analysis)'),
        since: z.string().optional().describe('Only return logs newer than this duration (e.g., "1h", "30m", "10s")'),
    },
    async ({ pod_name, container, namespace, tail_lines, previous, since }): Promise<ToolResult> => {
        let command = `logs ${pod_name}`;

        if (container) {
            command += ` -c ${container}`;
        }

        if (tail_lines) {
            command += ` --tail=${tail_lines}`;
        } else {
            command += ' --tail=100';
        }

        if (previous) {
            command += ' --previous';
        }

        if (since) {
            command += ` --since=${since}`;
        }

        const fullCommand = await buildCommand(command, namespace);
        const result = await executeCommand(fullCommand);

        return createToolResult(
            result.success ? (result.output || 'No logs available.') : `Failed to get logs: ${result.error}`,
            !result.success
        );
    }
);

/**
 * get_events tool - Get cluster or namespace events
 */
const getEventsTool = tool(
    'get_events',
    'Get Kubernetes events for debugging. Events show what is happening in the cluster including warnings and errors.',
    {
        namespace: z.string().optional().describe('The namespace to get events from (omit for all namespaces)'),
        resource_name: z.string().optional().describe('Filter events for a specific resource'),
        field_selector: z.string().optional().describe('Field selector to filter events (e.g., "type=Warning")'),
    },
    async ({ namespace, resource_name, field_selector }): Promise<ToolResult> => {
        let command = 'get events --sort-by=.lastTimestamp';

        if (!namespace) {
            command += ' --all-namespaces';
        }

        if (field_selector) {
            command += ` --field-selector=${field_selector}`;
        }

        if (resource_name) {
            command += ` --field-selector=involvedObject.name=${resource_name}`;
        }

        const fullCommand = await buildCommand(command, namespace);
        const result = await executeCommand(fullCommand);

        return createToolResult(
            result.success ? (result.output || 'No events found.') : `Failed to get events: ${result.error}`,
            !result.success
        );
    }
);

/**
 * cluster_health tool - Get overall cluster health status
 */
const clusterHealthTool = tool(
    'cluster_health',
    'Get overall cluster health status including node status, component status, and resource usage.',
    {
        include_metrics: z.boolean().optional().describe('Include resource usage metrics if metrics-server is available'),
    },
    async ({ include_metrics }): Promise<ToolResult> => {
        const results: string[] = [];

        // Get node status
        const nodesCommand = await buildCommand('get nodes -o wide');
        const nodesResult = await executeCommand(nodesCommand);
        results.push('=== Nodes ===');
        results.push(nodesResult.success ? nodesResult.output : `Failed: ${nodesResult.error}`);

        // Get component status (if available)
        const componentCommand = await buildCommand('get componentstatuses 2>/dev/null || echo "Component status not available"');
        const componentResult = await executeCommand(componentCommand);
        results.push('\n=== Component Status ===');
        results.push(componentResult.output || 'Not available');

        // Get pod status summary
        const podsCommand = await buildCommand('get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded');
        const podsResult = await executeCommand(podsCommand);
        results.push('\n=== Non-Running Pods ===');
        results.push(podsResult.success ? (podsResult.output || 'All pods are running or succeeded.') : `Failed: ${podsResult.error}`);

        // Get node resource usage if metrics available
        if (include_metrics) {
            const metricsCommand = await buildCommand('top nodes 2>/dev/null || echo "Metrics server not available"');
            const metricsResult = await executeCommand(metricsCommand);
            results.push('\n=== Node Resource Usage ===');
            results.push(metricsResult.output || 'Not available');
        }

        return createToolResult(results.join('\n'));
    }
);

/**
 * helm tool - Execute Helm commands
 */
const helmTool = tool(
    'helm',
    'Execute Helm commands for managing Kubernetes applications. The command should NOT include "helm" prefix.',
    {
        command: z.string().describe('The Helm command to execute without the helm prefix (e.g., "list -A", "status my-release", "repo list")'),
        namespace: z.string().optional().describe('The namespace for helm operations'),
    },
    async ({ command, namespace }): Promise<ToolResult> => {
        let fullCommand = `helm ${command}`;

        if (namespace && !command.includes('-n ') && !command.includes('--namespace')) {
            fullCommand = `helm ${command} -n ${namespace}`;
        }

        const result = await executeCommand(fullCommand);

        return createToolResult(
            result.success ? result.output : `Helm command failed: ${result.error}`,
            !result.success
        );
    }
);

/**
 * k8sgpt_analyze tool - Run K8sGPT analysis
 */
const k8sgptAnalyzeTool = tool(
    'k8sgpt_analyze',
    'Run K8sGPT analysis to identify issues in the cluster. K8sGPT uses AI to analyze Kubernetes resources and provide recommendations.',
    {
        namespace: z.string().optional().describe('Limit analysis to a specific namespace'),
        filter: z.string().optional().describe('Filter by resource type (e.g., Pod, Service, Deployment)'),
        explain: z.boolean().optional().describe('Get AI-powered explanations for issues (default: true)'),
    },
    async ({ namespace, filter, explain }): Promise<ToolResult> => {
        // Check if k8sgpt is installed
        const checkResult = await executeCommand('which k8sgpt');
        if (!checkResult.success) {
            return createToolResult(
                'K8sGPT is not installed. Install it with: brew install k8sgpt\nOr see: https://docs.k8sgpt.ai/getting-started/installation/',
                true
            );
        }

        let command = 'k8sgpt analyze';

        if (namespace) {
            command += ` --namespace=${namespace}`;
        }

        if (filter) {
            command += ` --filter=${filter}`;
        }

        if (explain !== false) {
            command += ' --explain';
        }

        const result = await executeCommand(command, 120000); // 2 minute timeout for AI analysis

        return createToolResult(
            result.success ? (result.output || 'No issues found.') : `K8sGPT analysis failed: ${result.error}`,
            !result.success
        );
    }
);

/**
 * scale_resource tool - Scale a deployment, statefulset, or replicaset
 */
const scaleResourceTool = tool(
    'scale_resource',
    'Scale a Kubernetes deployment, statefulset, or replicaset to a specified number of replicas.',
    {
        resource_type: z.enum(['deployment', 'statefulset', 'replicaset']).describe('The type of resource to scale'),
        resource_name: z.string().describe('The name of the resource to scale'),
        replicas: z.number().min(0).describe('The target number of replicas'),
        namespace: z.string().optional().describe('The namespace of the resource'),
    },
    async ({ resource_type, resource_name, replicas, namespace }): Promise<ToolResult> => {
        const command = `scale ${resource_type} ${resource_name} --replicas=${replicas}`;
        const fullCommand = await buildCommand(command, namespace);
        const result = await executeCommand(fullCommand);

        return createToolResult(
            result.success 
                ? `Successfully scaled ${resource_type}/${resource_name} to ${replicas} replicas`
                : `Failed to scale: ${result.error}`,
            !result.success
        );
    }
);

/**
 * rollout_status tool - Check the rollout status of a deployment
 */
const rolloutStatusTool = tool(
    'rollout_status',
    'Check the rollout status of a deployment, daemonset, or statefulset.',
    {
        resource_type: z.enum(['deployment', 'daemonset', 'statefulset']).describe('The type of resource'),
        resource_name: z.string().describe('The name of the resource'),
        namespace: z.string().optional().describe('The namespace of the resource'),
        watch: z.boolean().optional().describe('Watch the rollout status until completion (default: false)'),
    },
    async ({ resource_type, resource_name, namespace, watch }): Promise<ToolResult> => {
        let command = `rollout status ${resource_type}/${resource_name}`;
        
        if (!watch) {
            command += ' --watch=false';
        }

        const fullCommand = await buildCommand(command, namespace);
        const result = await executeCommand(fullCommand, watch ? 300000 : 60000); // 5 min timeout if watching

        return createToolResult(
            result.success ? result.output : `Failed to get rollout status: ${result.error}`,
            !result.success
        );
    }
);

/**
 * get_resource_yaml tool - Get the YAML manifest of a resource
 */
const getResourceYamlTool = tool(
    'get_resource_yaml',
    'Get the YAML manifest of a Kubernetes resource. Useful for viewing or modifying resource configurations.',
    {
        resource_type: z.string().describe('The type of resource (e.g., pod, deployment, service)'),
        resource_name: z.string().describe('The name of the resource'),
        namespace: z.string().optional().describe('The namespace of the resource'),
    },
    async ({ resource_type, resource_name, namespace }): Promise<ToolResult> => {
        const command = `get ${resource_type} ${resource_name} -o yaml`;
        const fullCommand = await buildCommand(command, namespace);
        const result = await executeCommand(fullCommand);

        return createToolResult(
            result.success ? result.output : `Failed to get resource YAML: ${result.error}`,
            !result.success
        );
    }
);

/**
 * port_forward tool - Set up port forwarding to a pod or service
 */
const portForwardTool = tool(
    'port_forward',
    'Set up port forwarding to a pod or service. Note: This runs in the background.',
    {
        resource_type: z.enum(['pod', 'service', 'deployment']).describe('The type of resource'),
        resource_name: z.string().describe('The name of the resource'),
        local_port: z.number().describe('The local port to forward from'),
        remote_port: z.number().describe('The remote port to forward to'),
        namespace: z.string().optional().describe('The namespace of the resource'),
    },
    async ({ resource_type, resource_name, local_port, remote_port, namespace }): Promise<ToolResult> => {
        const cli = await getCLI();
        const cluster = configManager.getCluster();
        
        let command = `${cli} port-forward`;
        
        if (cluster?.context) {
            command += ` --context=${cluster.context}`;
        }
        
        if (namespace || cluster?.namespace) {
            command += ` --namespace=${namespace || cluster?.namespace}`;
        }
        
        command += ` ${resource_type}/${resource_name} ${local_port}:${remote_port} &`;
        
        const result = await executeCommand(command);

        return createToolResult(
            result.success 
                ? `Port forwarding started: localhost:${local_port} -> ${resource_type}/${resource_name}:${remote_port}\nNote: Run 'pkill -f port-forward' to stop.`
                : `Failed to start port forwarding: ${result.error}`,
            !result.success
        );
    }
);

/**
 * Create the Kubernetes MCP server with all tools
 */
export function createKubernetesMcpServer() {
    return createSdkMcpServer({
        name: 'kubernetes-tools',
        version: '1.0.0',
        tools: [
            kubectlTool,
            describeResourceTool,
            getLogsTool,
            getEventsTool,
            clusterHealthTool,
            helmTool,
            k8sgptAnalyzeTool,
            scaleResourceTool,
            rolloutStatusTool,
            getResourceYamlTool,
            portForwardTool,
        ],
    });
}

/**
 * Get list of available Kubernetes MCP tools
 */
export function getKubernetesToolNames(): string[] {
    return [
        'mcp__kubernetes-tools__kubectl',
        'mcp__kubernetes-tools__describe_resource',
        'mcp__kubernetes-tools__get_logs',
        'mcp__kubernetes-tools__get_events',
        'mcp__kubernetes-tools__cluster_health',
        'mcp__kubernetes-tools__helm',
        'mcp__kubernetes-tools__k8sgpt_analyze',
        'mcp__kubernetes-tools__scale_resource',
        'mcp__kubernetes-tools__rollout_status',
        'mcp__kubernetes-tools__get_resource_yaml',
        'mcp__kubernetes-tools__port_forward',
    ];
}
