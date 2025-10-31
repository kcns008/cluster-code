/**
 * Run cluster diagnostics
 */

import { configManager } from '../config';
import { logger } from '../utils/logger';
import { kubectl, getPods } from '../utils/kubectl';
import { DiagnosticResult } from '../types';
import Table from 'cli-table3';

export async function diagnoseCommand(): Promise<void> {
  logger.section('Cluster Diagnostics');

  const cluster = configManager.getCluster();
  if (!cluster) {
    logger.error('Cluster not configured. Run "cluster-code init" first.');
    process.exit(1);
  }

  logger.info(`Context: ${cluster.context}`);
  logger.info(`Namespace: ${cluster.namespace}`);
  logger.newline();

  const results: DiagnosticResult[] = [];

  try {
    // Check cluster info
    logger.startSpinner('Checking cluster connectivity...');
    await kubectl('cluster-info', { context: cluster.context });
    results.push({
      resource: 'Cluster',
      status: 'healthy',
      message: 'Cluster is reachable',
    });
    logger.succeedSpinner('Cluster is healthy');

    // Check nodes
    logger.startSpinner('Checking nodes...');
    const nodesOutput = await kubectl('get nodes -o json', { context: cluster.context });
    const nodes = JSON.parse(nodesOutput);
    const nodeCount = nodes.items?.length || 0;

    const unhealthyNodes = nodes.items?.filter((node: any) => {
      const conditions = node.status?.conditions || [];
      const ready = conditions.find((c: any) => c.type === 'Ready');
      return ready?.status !== 'True';
    }) || [];

    if (unhealthyNodes.length > 0) {
      results.push({
        resource: 'Nodes',
        status: 'warning',
        message: `${unhealthyNodes.length} of ${nodeCount} nodes are not ready`,
        details: unhealthyNodes.map((n: any) => n.metadata.name),
      });
      logger.failSpinner(`Found ${unhealthyNodes.length} unhealthy nodes`);
    } else {
      results.push({
        resource: 'Nodes',
        status: 'healthy',
        message: `All ${nodeCount} nodes are ready`,
      });
      logger.succeedSpinner(`All ${nodeCount} nodes are healthy`);
    }

    // Check pods
    logger.startSpinner('Checking pods...');
    const pods = await getPods({
      context: cluster.context,
      namespace: cluster.namespace,
    });

    const failedPods = pods.filter((pod: any) => {
      const phase = pod.status?.phase;
      return phase === 'Failed' || phase === 'Unknown' || phase === 'Pending';
    });

    if (failedPods.length > 0) {
      results.push({
        resource: 'Pods',
        status: 'warning',
        message: `${failedPods.length} pods have issues`,
        details: failedPods.map((p: any) => ({
          name: p.metadata.name,
          phase: p.status.phase,
        })),
      });
      logger.failSpinner(`Found ${failedPods.length} pods with issues`);
    } else {
      results.push({
        resource: 'Pods',
        status: 'healthy',
        message: `All ${pods.length} pods are running`,
      });
      logger.succeedSpinner(`All ${pods.length} pods are healthy`);
    }

    // Check deployments
    logger.startSpinner('Checking deployments...');
    const deploymentsOutput = await kubectl('get deployments -o json', {
      context: cluster.context,
      namespace: cluster.namespace,
    });
    const deployments = JSON.parse(deploymentsOutput);

    const unhealthyDeployments = deployments.items?.filter((dep: any) => {
      const replicas = dep.status?.replicas || 0;
      const ready = dep.status?.readyReplicas || 0;
      return ready < replicas;
    }) || [];

    if (unhealthyDeployments.length > 0) {
      results.push({
        resource: 'Deployments',
        status: 'warning',
        message: `${unhealthyDeployments.length} deployments are not fully ready`,
        details: unhealthyDeployments.map((d: any) => d.metadata.name),
      });
      logger.failSpinner(`Found ${unhealthyDeployments.length} deployments with issues`);
    } else {
      results.push({
        resource: 'Deployments',
        status: 'healthy',
        message: `All deployments are ready`,
      });
      logger.succeedSpinner('All deployments are healthy');
    }

    // Display summary
    logger.newline();
    logger.section('Diagnostic Summary');

    const table = new Table({
      head: ['Resource', 'Status', 'Message'],
      colWidths: [20, 15, 50],
    });

    results.forEach(result => {
      table.push([
        result.resource,
        { content: result.status.toUpperCase(), hAlign: 'center' },
        result.message,
      ]);
    });

    console.log(table.toString());

    const hasIssues = results.some(r => r.status !== 'healthy');
    if (hasIssues) {
      logger.newline();
      logger.warning('Some issues were detected. Run "cluster-code chat" for interactive troubleshooting.');
    } else {
      logger.newline();
      logger.success('All checks passed! Your cluster is healthy.');
    }
  } catch (error: any) {
    logger.error(`Diagnostics failed: ${error.message}`);
    process.exit(1);
  }
}
