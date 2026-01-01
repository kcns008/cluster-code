
/**
 * TUI State Management
 * Holds the current state of the TUI application
 */

export interface K8sResource {
    kind: string;
    metadata: {
        name: string;
        namespace?: string;
        creationTimestamp?: string;
        [key: string]: any;
    };
    status?: {
        phase?: string;
        conditions?: any[];
        [key: string]: any;
    };
    spec?: {
        [key: string]: any;
    };
    [key: string]: any;
}

export interface ClusterInfo {
    context: string;
    cluster: string;
    user: string;
    ccVersion: string;
    k8sVersion: string;
    cpu?: string;
    mem?: string;
}

export type ResourceType = 'pods' | 'nodes' | 'deployments' | 'services' | 'events';

export class TuiState {
    private _selectedResource: K8sResource | null = null;
    private _currentNamespace: string = 'default';
    private _currentResourceType: ResourceType = 'pods';
    private _resources: K8sResource[] = [];
    private _filterText: string = '';
    private _clusterInfo: ClusterInfo = {
        context: 'unknown',
        cluster: 'unknown',
        user: 'unknown',
        ccVersion: '0.2.0',
        k8sVersion: 'unknown'
    };
    private _errorResources: Set<string> = new Set();
    private _warningResources: Set<string> = new Set();
    private _warnings: string[] = [];

    // Selected resource
    get selectedResource(): K8sResource | null {
        return this._selectedResource;
    }

    set selectedResource(resource: K8sResource | null) {
        this._selectedResource = resource;
    }

    // Namespace
    get currentNamespace(): string {
        return this._currentNamespace;
    }

    set currentNamespace(namespace: string) {
        this._currentNamespace = namespace;
    }

    // Resource type (pods, nodes, etc.)
    get currentResourceType(): ResourceType {
        return this._currentResourceType;
    }

    set currentResourceType(type: ResourceType) {
        this._currentResourceType = type;
    }

    // Resources list
    get resources(): K8sResource[] {
        return this._resources;
    }

    set resources(resources: K8sResource[]) {
        this._resources = resources;
    }

    // Filter text
    get filterText(): string {
        return this._filterText;
    }

    set filterText(filter: string) {
        this._filterText = filter;
    }

    // Get filtered resources
    get filteredResources(): K8sResource[] {
        if (!this._filterText) {
            return this._resources;
        }
        const filter = this._filterText.toLowerCase();
        return this._resources.filter(r =>
            r.metadata.name.toLowerCase().includes(filter) ||
            r.metadata.namespace?.toLowerCase().includes(filter)
        );
    }

    // Cluster info
    get clusterInfo(): ClusterInfo {
        return this._clusterInfo;
    }

    set clusterInfo(info: ClusterInfo) {
        this._clusterInfo = info;
    }

    // Error resources (for highlighting)
    get errorResources(): Set<string> {
        return this._errorResources;
    }

    addError(resourceName: string): void {
        this._errorResources.add(resourceName);
    }

    clearErrors(): void {
        this._errorResources.clear();
    }

    isError(resourceName: string): boolean {
        return this._errorResources.has(resourceName);
    }

    // Warning resources
    get warningResources(): Set<string> {
        return this._warningResources;
    }

    addWarning(resourceName: string): void {
        this._warningResources.add(resourceName);
    }

    clearWarnings(): void {
        this._warningResources.clear();
    }

    isWarning(resourceName: string): boolean {
        return this._warningResources.has(resourceName);
    }

    // Global warnings (for header display)
    get warnings(): string[] {
        return this._warnings;
    }

    setWarnings(warnings: string[]): void {
        this._warnings = warnings;
    }

    // Helper to get resource status for styling
    getResourceStatus(resource: K8sResource): 'error' | 'warning' | 'running' | 'unknown' {
        const name = resource.metadata.name;

        if (this._errorResources.has(name)) {
            return 'error';
        }
        if (this._warningResources.has(name)) {
            return 'warning';
        }

        // Check phase/status
        const phase = resource.status?.phase?.toLowerCase();
        if (phase === 'running' || phase === 'active' || phase === 'ready' || phase === 'succeeded') {
            return 'running';
        }
        if (phase === 'failed' || phase === 'error' || phase === 'crashloopbackoff') {
            return 'error';
        }
        if (phase === 'pending' || phase === 'containercreating') {
            return 'warning';
        }

        return 'unknown';
    }
}

export const tuiState = new TuiState();
