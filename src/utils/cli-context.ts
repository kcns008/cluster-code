import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * CLI Context Builder
 * Gathers information about available CLI tools and their capabilities
 * to provide context for AI-powered command generation
 */

export interface CLIToolInfo {
  name: string;
  available: boolean;
  version?: string;
  helpText?: string;
  commonCommands?: string[];
}

export interface CLIContext {
  tools: CLIToolInfo[];
  clusterInfo?: {
    type: 'kubernetes' | 'openshift';
    context?: string;
    namespace?: string;
    cloud?: 'aws' | 'azure' | 'gcp' | 'on-prem';
  };
  timestamp: Date;
}

/**
 * Check if a CLI tool is available
 */
async function isToolAvailable(command: string): Promise<boolean> {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get version of a CLI tool
 */
async function getToolVersion(command: string, versionFlag: string = '--version'): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`${command} ${versionFlag} 2>&1 | head -n 1`, { timeout: 5000 });
    return stdout.trim();
  } catch {
    return undefined;
  }
}

/**
 * Get help text for a CLI tool (truncated for context)
 */
async function getToolHelp(command: string, helpFlag: string = '--help'): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`${command} ${helpFlag} 2>&1 | head -n 50`, { timeout: 5000 });
    return stdout.trim();
  } catch {
    return undefined;
  }
}

/**
 * Build context for kubectl
 */
async function buildKubectlContext(): Promise<CLIToolInfo> {
  const available = await isToolAvailable('kubectl');

  if (!available) {
    return {
      name: 'kubectl',
      available: false,
      commonCommands: []
    };
  }

  const version = await getToolVersion('kubectl', 'version --client --short 2>/dev/null || kubectl version --client');
  const helpText = await getToolHelp('kubectl');

  return {
    name: 'kubectl',
    available: true,
    version,
    helpText,
    commonCommands: [
      'get', 'describe', 'logs', 'exec', 'apply', 'delete', 'create',
      'edit', 'scale', 'rollout', 'port-forward', 'top', 'explain',
      'patch', 'label', 'annotate', 'config', 'cluster-info', 'api-resources'
    ]
  };
}

/**
 * Build context for oc (OpenShift CLI)
 */
async function buildOcContext(): Promise<CLIToolInfo> {
  const available = await isToolAvailable('oc');

  if (!available) {
    return {
      name: 'oc',
      available: false,
      commonCommands: []
    };
  }

  const version = await getToolVersion('oc', 'version --client');
  const helpText = await getToolHelp('oc');

  return {
    name: 'oc',
    available: true,
    version,
    helpText,
    commonCommands: [
      'get', 'describe', 'logs', 'exec', 'apply', 'delete', 'create',
      'new-app', 'new-build', 'start-build', 'deploy', 'rollout',
      'expose', 'route', 'project', 'login', 'whoami', 'status',
      'adm', 'policy', 'secrets', 'serviceaccounts'
    ]
  };
}

/**
 * Build context for AWS CLI
 */
async function buildAwsContext(): Promise<CLIToolInfo> {
  const available = await isToolAvailable('aws');

  if (!available) {
    return {
      name: 'aws',
      available: false,
      commonCommands: []
    };
  }

  const version = await getToolVersion('aws', '--version');
  // AWS help is very verbose, so we'll keep it minimal
  const helpText = 'AWS CLI - Amazon Web Services command line tool for managing AWS services';

  return {
    name: 'aws',
    available: true,
    version,
    helpText,
    commonCommands: [
      's3', 'ec2', 'eks', 'ecr', 'ecs', 'lambda', 'iam', 'cloudformation',
      'rds', 'dynamodb', 'sqs', 'sns', 'cloudwatch', 'route53', 'elb',
      'sts', 'kms', 'secretsmanager', 'ssm'
    ]
  };
}

/**
 * Build context for Azure CLI
 */
async function buildAzContext(): Promise<CLIToolInfo> {
  const available = await isToolAvailable('az');

  if (!available) {
    return {
      name: 'az',
      available: false,
      commonCommands: []
    };
  }

  const version = await getToolVersion('az', '--version | head -n 1');
  const helpText = 'Azure CLI - Microsoft Azure command line tool for managing Azure resources';

  return {
    name: 'az',
    available: true,
    version,
    helpText,
    commonCommands: [
      'account', 'aks', 'vm', 'network', 'storage', 'acr', 'container',
      'webapp', 'functionapp', 'sql', 'cosmosdb', 'keyvault', 'monitor',
      'group', 'resource', 'login', 'logout', 'configure'
    ]
  };
}

/**
 * Build context for Google Cloud CLI
 */
async function buildGcloudContext(): Promise<CLIToolInfo> {
  const available = await isToolAvailable('gcloud');

  if (!available) {
    return {
      name: 'gcloud',
      available: false,
      commonCommands: []
    };
  }

  const version = await getToolVersion('gcloud', '--version | head -n 1');
  const helpText = 'Google Cloud SDK - Command line tool for managing Google Cloud Platform resources';

  return {
    name: 'gcloud',
    available: true,
    version,
    helpText,
    commonCommands: [
      'compute', 'container', 'storage', 'sql', 'app', 'functions',
      'iam', 'projects', 'config', 'auth', 'services', 'dns',
      'deployment-manager', 'logging', 'monitoring'
    ]
  };
}

/**
 * Build context for Helm
 */
async function buildHelmContext(): Promise<CLIToolInfo> {
  const available = await isToolAvailable('helm');

  if (!available) {
    return {
      name: 'helm',
      available: false,
      commonCommands: []
    };
  }

  const version = await getToolVersion('helm', 'version --short');
  const helpText = await getToolHelp('helm');

  return {
    name: 'helm',
    available: true,
    version,
    helpText,
    commonCommands: [
      'install', 'upgrade', 'uninstall', 'list', 'status', 'rollback',
      'get', 'repo', 'search', 'pull', 'template', 'lint', 'test', 'create'
    ]
  };
}

/**
 * Build complete CLI context
 */
export async function buildCLIContext(clusterConfig?: any): Promise<CLIContext> {
  const [kubectl, oc, aws, az, gcloud, helm] = await Promise.all([
    buildKubectlContext(),
    buildOcContext(),
    buildAwsContext(),
    buildAzContext(),
    buildGcloudContext(),
    buildHelmContext()
  ]);

  return {
    tools: [kubectl, oc, aws, az, gcloud, helm],
    clusterInfo: clusterConfig ? {
      type: clusterConfig.type || 'kubernetes',
      context: clusterConfig.context,
      namespace: clusterConfig.namespace,
      cloud: clusterConfig.cloud
    } : undefined,
    timestamp: new Date()
  };
}

/**
 * Generate a system prompt for the AI with CLI context
 */
export function generateSystemPrompt(context: CLIContext): string {
  const availableTools = context.tools.filter(t => t.available);

  let prompt = `You are an intelligent cluster management assistant. You help users interact with Kubernetes/OpenShift clusters and cloud platforms using natural language.

## Your Role
Convert user requests in natural language into the appropriate CLI commands. You have access to the following tools:

`;

  // Add available tools
  availableTools.forEach(tool => {
    prompt += `### ${tool.name}\n`;
    if (tool.version) {
      prompt += `Version: ${tool.version}\n`;
    }
    if (tool.helpText && tool.helpText.length < 500) {
      prompt += `\nHelp:\n${tool.helpText}\n\n`;
    }
    if (tool.commonCommands && tool.commonCommands.length > 0) {
      prompt += `Common commands: ${tool.commonCommands.join(', ')}\n`;
    }
    prompt += '\n';
  });

  // Add cluster context if available
  if (context.clusterInfo) {
    prompt += `## Current Cluster Context\n`;
    prompt += `- Type: ${context.clusterInfo.type}\n`;
    if (context.clusterInfo.context) {
      prompt += `- Context: ${context.clusterInfo.context}\n`;
    }
    if (context.clusterInfo.namespace) {
      prompt += `- Namespace: ${context.clusterInfo.namespace}\n`;
    }
    if (context.clusterInfo.cloud) {
      prompt += `- Cloud Provider: ${context.clusterInfo.cloud}\n`;
    }
    prompt += '\n';
  }

  prompt += `## Instructions
1. Understand the user's intent from their natural language request
2. Generate the appropriate CLI command(s) to accomplish the task
3. Always explain what the command does and why you chose it
4. If multiple commands are needed, show them in sequence
5. Use the current cluster context (namespace, context) when generating kubectl/oc commands
6. If the request is ambiguous, ask clarifying questions
7. Provide the command in a code block for easy copying
8. If the command might be destructive (delete, scale down, etc.), warn the user

## Response Format
When generating commands, use this format:

**Command:**
\`\`\`bash
<the command here>
\`\`\`

**Explanation:**
<explain what the command does and why>

**Important Notes:**
<any warnings or additional context>

## Examples

User: "Show me all pods in the current namespace"
**Command:**
\`\`\`bash
kubectl get pods
\`\`\`

**Explanation:**
This command lists all pods in the current namespace (${context.clusterInfo?.namespace || 'default'}). It will show pod names, status, restarts, and age.

---

User: "Why is my pod crashing?"
You would need more information, so respond:
"I'd be happy to help diagnose the crashing pod. Could you please tell me:
1. What is the name of the pod?
2. Have you checked the logs yet?

Once I know the pod name, I can help you run \`kubectl logs <pod-name>\` and \`kubectl describe pod <pod-name>\` to investigate."

Now, respond to the user's requests in natural language and convert them to appropriate CLI commands.
`;

  return prompt;
}

/**
 * Format CLI context for display
 */
export function formatCLIContext(context: CLIContext): string {
  const available = context.tools.filter(t => t.available);
  const unavailable = context.tools.filter(t => !t.available);

  let output = 'Available CLI Tools:\n';
  available.forEach(tool => {
    output += `  ✓ ${tool.name}`;
    if (tool.version) {
      output += ` (${tool.version})`;
    }
    output += '\n';
  });

  if (unavailable.length > 0) {
    output += '\nUnavailable:\n';
    unavailable.forEach(tool => {
      output += `  ✗ ${tool.name}\n`;
    });
  }

  if (context.clusterInfo) {
    output += '\nCluster Context:\n';
    output += `  Type: ${context.clusterInfo.type}\n`;
    if (context.clusterInfo.context) {
      output += `  Context: ${context.clusterInfo.context}\n`;
    }
    if (context.clusterInfo.namespace) {
      output += `  Namespace: ${context.clusterInfo.namespace}\n`;
    }
  }

  return output;
}
