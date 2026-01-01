import * as blessed from 'blessed';
import { createLayout, formatContextPanel, formatShortcutsPanel, formatLogoPanel } from './layout';
import { TuiAgentIntegration } from './agent-integration';
import { tuiState } from './state';
import {
    getPods,
    getNodes,
    getDeployments,
    getServices,
    isClusterReachable,
    getClusterContextInfo,
    getKubeVersion,
    getNodeMetrics
} from '../utils/kubectl';

// Import package version
import packageJson from '../../package.json';

export async function startTui() {
    // 1. Check connection
    const connected = await isClusterReachable();
    if (!connected) {
        console.error('Cluster not reachable. Please check your kubeconfig.');
        process.exit(1);
    }

    // 2. Initialize Screen
    const screen = blessed.screen({
        smartCSR: true,
        title: 'Cluster Code TUI'
    });

    // 3. Create Layout
    const widgets = createLayout(screen);
    const { contextBox, shortcutsBox, logoBox, resourceTable, chatLog, input } = widgets;

    // 4. Agent Integration
    const agent = new TuiAgentIntegration(chatLog, screen);

    // 5. Initialize cluster info
    const initClusterInfo = async () => {
        try {
            const [ctxInfo, versionInfo] = await Promise.all([
                getClusterContextInfo(),
                getKubeVersion()
            ]);

            tuiState.clusterInfo = {
                context: ctxInfo.context,
                cluster: ctxInfo.cluster,
                user: ctxInfo.user,
                ccVersion: 'v' + packageJson.version,
                k8sVersion: versionInfo.serverVersion
            };

            updateHeaderPanels();
        } catch (err) {
            // Use defaults on error
            updateHeaderPanels();
        }
    };

    // Update header panels
    const updateHeaderPanels = () => {
        // Context panel (left)
        contextBox.setContent(formatContextPanel(tuiState.clusterInfo));

        // Shortcuts panel (middle)
        shortcutsBox.setContent(formatShortcutsPanel());

        // Logo panel (right) with any warnings
        const warning = tuiState.warnings.length > 0 ? tuiState.warnings[0] : undefined;
        logoBox.setContent(formatLogoPanel(warning));

        screen.render();
    };

    // Set initial header content
    shortcutsBox.setContent(formatShortcutsPanel());
    logoBox.setContent(formatLogoPanel());
    contextBox.setContent(formatContextPanel({
        context: 'Loading...',
        cluster: 'Loading...',
        user: 'Loading...',
        ccVersion: 'v' + packageJson.version,
        k8sVersion: 'Loading...'
    }));
    screen.render();

    // Initialize cluster info
    await initClusterInfo();

    // Loading state
    resourceTable.setData({
        headers: ['NAME', 'STATUS', 'RESTARTS', 'AGE'],
        data: [['Loading...', '', '', '']]
    });
    screen.render();

    // Fetch and display resources based on current type
    const refreshData = async () => {
        try {
            let resources: any[] = [];
            let headers: string[] = [];
            let columnWidths: number[] = [];

            switch (tuiState.currentResourceType) {
                case 'nodes':
                    resources = await getNodes();
                    headers = ['NAME', 'STATUS', 'ROLE', 'VERSION', 'CPU%', 'MEM%', 'AGE'];
                    columnWidths = [35, 10, 12, 12, 8, 8, 10];

                    // Try to get node metrics
                    const metrics = await getNodeMetrics();

                    tuiState.resources = resources;
                    const nodeData = resources.map(node => {
                        const name = node.metadata.name;
                        const conditions = node.status?.conditions || [];
                        const readyCondition = conditions.find((c: any) => c.type === 'Ready');
                        const status = readyCondition?.status === 'True' ? 'Ready' : 'NotReady';
                        const roles = Object.keys(node.metadata.labels || {})
                            .filter(k => k.startsWith('node-role.kubernetes.io/'))
                            .map(k => k.replace('node-role.kubernetes.io/', ''))
                            .join(',') || '<none>';
                        const version = node.status?.nodeInfo?.kubeletVersion || 'unknown';
                        const metric = metrics.get(name);
                        const cpu = metric?.cpu || '-';
                        const mem = metric?.memory || '-';
                        const age = formatAge(node.metadata.creationTimestamp);

                        // Track non-ready nodes as errors
                        if (status !== 'Ready') {
                            tuiState.addError(name);
                        }

                        return [name, status, roles, version, cpu, mem, age];
                    });

                    resourceTable.options.columnWidth = columnWidths;
                    resourceTable.setData({ headers, data: nodeData });
                    break;

                case 'deployments':
                    resources = await getDeployments();
                    headers = ['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE'];
                    columnWidths = [40, 10, 12, 12, 10];

                    tuiState.resources = resources;
                    const deployData = resources.map(deploy => {
                        const name = deploy.metadata.name;
                        const replicas = deploy.status?.replicas || 0;
                        const ready = deploy.status?.readyReplicas || 0;
                        const updated = deploy.status?.updatedReplicas || 0;
                        const available = deploy.status?.availableReplicas || 0;
                        const age = formatAge(deploy.metadata.creationTimestamp);

                        if (ready < replicas) {
                            tuiState.addWarning(name);
                        }

                        return [name, ready + '/' + replicas, String(updated), String(available), age];
                    });

                    resourceTable.options.columnWidth = columnWidths;
                    resourceTable.setData({ headers, data: deployData });
                    break;

                case 'services':
                    resources = await getServices();
                    headers = ['NAME', 'TYPE', 'CLUSTER-IP', 'EXTERNAL-IP', 'PORT(S)', 'AGE'];
                    columnWidths = [30, 12, 16, 16, 20, 10];

                    tuiState.resources = resources;
                    const svcData = resources.map(svc => {
                        const name = svc.metadata.name;
                        const type = svc.spec?.type || 'ClusterIP';
                        const clusterIP = svc.spec?.clusterIP || '<none>';
                        const externalIP = svc.status?.loadBalancer?.ingress?.[0]?.ip ||
                            svc.spec?.externalIPs?.[0] || '<none>';
                        const ports = (svc.spec?.ports || [])
                            .map((p: any) => p.port + '/' + p.protocol)
                            .join(',') || '<none>';
                        const age = formatAge(svc.metadata.creationTimestamp);

                        return [name, type, clusterIP, externalIP, ports, age];
                    });

                    resourceTable.options.columnWidth = columnWidths;
                    resourceTable.setData({ headers, data: svcData });
                    break;

                case 'pods':
                default:
                    resources = await getPods();
                    headers = ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'];
                    columnWidths = [45, 8, 15, 10, 10];

                    tuiState.resources = resources;
                    const podData = resources.map(pod => {
                        const name = pod.metadata.name;
                        const containers = pod.spec?.containers?.length || 0;
                        const readyContainers = (pod.status?.containerStatuses || [])
                            .filter((c: any) => c.ready).length;
                        const phase = pod.status?.phase || 'Unknown';
                        const restarts = (pod.status?.containerStatuses || [])
                            .reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);
                        const age = formatAge(pod.metadata.creationTimestamp);

                        // Track error states
                        if (phase === 'Failed' || phase === 'Error') {
                            tuiState.addError(name);
                        } else if (phase === 'Pending' || restarts > 5) {
                            tuiState.addWarning(name);
                        }

                        return [name, readyContainers + '/' + containers, phase, String(restarts), age];
                    });

                    resourceTable.options.columnWidth = columnWidths;
                    resourceTable.setData({ headers, data: podData });
                    break;
            }

            // Update table label with count
            const resourceType = tuiState.currentResourceType.charAt(0).toUpperCase() +
                tuiState.currentResourceType.slice(1);
            resourceTable.setLabel(' ' + resourceType + '(all)[' + resources.length + '] ');

            screen.render();
        } catch (err: any) {
            resourceTable.setData({
                headers: ['ERROR'],
                data: [['{red-fg}' + err.message + '{/red-fg}']]
            });
            screen.render();
        }
    };

    // Initial data fetch
    await refreshData();

    // ═══════════════════════════════════════════════════════════════════════
    // KEY BINDINGS
    // ═══════════════════════════════════════════════════════════════════════

    // Quit
    screen.key(['q', 'C-c'], () => {
        return process.exit(0);
    });

    // Refresh
    screen.key(['r'], async () => {
        await refreshData();
    });

    // Focus switching
    screen.key(['tab'], () => {
        if ((input as any).focused) {
            input.style.border.fg = 'yellow';
            resourceTable.focus();
        } else {
            resourceTable.style.border.fg = 'cyan';
            input.focus();
            input.style.border.fg = 'yellow';
        }
        screen.render();
    });

    // Command mode - focus input and prefill with ':'
    screen.key([':'], () => {
        input.focus();
        input.setValue(':');
        screen.render();
    });

    // Filter mode - focus input and prefill with '/'
    screen.key(['/'], () => {
        input.focus();
        input.setValue('/');
        screen.render();
    });

    // Resource type shortcuts
    screen.key(['1'], async () => {
        tuiState.currentResourceType = 'pods';
        tuiState.clearErrors();
        tuiState.clearWarnings();
        await refreshData();
    });

    screen.key(['2'], async () => {
        tuiState.currentResourceType = 'nodes';
        tuiState.clearErrors();
        tuiState.clearWarnings();
        await refreshData();
    });

    screen.key(['3'], async () => {
        tuiState.currentResourceType = 'deployments';
        tuiState.clearErrors();
        tuiState.clearWarnings();
        await refreshData();
    });

    screen.key(['4'], async () => {
        tuiState.currentResourceType = 'services';
        tuiState.clearErrors();
        tuiState.clearWarnings();
        await refreshData();
    });

    // Resource selection handler
    resourceTable.rows.on('select', (_item: any, index: number) => {
        const resources = tuiState.resources;
        if (resources[index]) {
            tuiState.selectedResource = resources[index];

            // Show selection feedback in agent log
            const resource = resources[index];
            chatLog.pushLine('{cyan-fg}Selected:{/cyan-fg} ' + resource.metadata.name);
            chatLog.setScrollPerc(100);
            screen.render();
        }
    });

    // Input handling
    input.key('enter', async () => {
        const text = input.getValue().trim();
        input.clearValue();
        screen.render();

        if (!text) return;

        // Handle special commands
        if (text.startsWith(':')) {
            const cmd = text.substring(1).toLowerCase();

            switch (cmd) {
                case 'pods':
                case 'pod':
                case 'po':
                    tuiState.currentResourceType = 'pods';
                    await refreshData();
                    break;
                case 'nodes':
                case 'node':
                case 'no':
                    tuiState.currentResourceType = 'nodes';
                    await refreshData();
                    break;
                case 'deployments':
                case 'deployment':
                case 'deploy':
                    tuiState.currentResourceType = 'deployments';
                    await refreshData();
                    break;
                case 'services':
                case 'service':
                case 'svc':
                    tuiState.currentResourceType = 'services';
                    await refreshData();
                    break;
                case 'q':
                case 'quit':
                case 'exit':
                    process.exit(0);
                    break;
                default:
                    chatLog.pushLine('{yellow-fg}Unknown command: ' + cmd + '{/yellow-fg}');
                    chatLog.setScrollPerc(100);
                    screen.render();
            }

            input.focus();
            return;
        }

        // Handle filter (text starting with /)
        if (text.startsWith('/')) {
            tuiState.filterText = text.substring(1);
            await refreshData();
            input.focus();
            return;
        }

        // Otherwise, send to agent
        await agent.processInput(text);
        input.focus();
        screen.render();
    });

    // Start with input focused
    input.focus();
    screen.render();
}

// Helper: format age like "5d", "2h", "30m"
function formatAge(timestamp: string | undefined): string {
    if (!timestamp) return 'N/A';

    const created = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) return diffDays + 'd';
    if (diffHours > 0) return diffHours + 'h';
    if (diffMinutes > 0) return diffMinutes + 'm';
    return '<1m';
}
