/**
 * Hooks System - Inspired by pi-mono's extension architecture
 *
 * Provides a plugin/hook system for extending cluster-code functionality
 */

export interface HookContext {
  clusterContext?: string;
  namespace?: string;
  provider?: string;
  [key: string]: any;
}

export interface HookResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface BeforeAgentStartEvent {
  context: HookContext;
  messages: Array<{ role: string; content: string }>;
  tools: string[];
}

export interface AgentToolCallEvent {
  toolName: string;
  arguments: Record<string, any>;
  result?: any;
  error?: string;
}

export interface AgentToolResultEvent {
  toolName: string;
  arguments: Record<string, any>;
  result: any;
  success: boolean;
}

export interface BeforeCommandExecutionEvent {
  command: string;
  context: HookContext;
  shouldExecute: boolean;
}

export interface AfterCommandExecutionEvent {
  command: string;
  context: HookContext;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface BeforeDiagnosticRunEvent {
  options: Record<string, any>;
  context: HookContext;
}

export interface DiagnosticResultEvent {
  results: Array<{
    resource: string;
    status: 'healthy' | 'warning' | 'error';
    message: string;
    details?: any;
  }>;
  duration: number;
}

export interface ClusterConnectEvent {
  context: string;
  cluster: string;
  type: 'kubernetes' | 'openshift';
  success: boolean;
  error?: string;
}

export interface LLMCallEvent {
  provider: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  tokens?: {
    input: number;
    output: number;
  };
  duration: number;
  success: boolean;
  error?: string;
}

export interface SessionStartEvent {
  mode: 'interactive' | 'agent' | 'tui';
  context: HookContext;
}

export interface SessionEndEvent {
  mode: 'interactive' | 'agent' | 'tui';
  context: HookContext;
  duration: number;
  messagesProcessed: number;
}

export type HookName =
  | 'before:agent:start'
  | 'agent:tool:call'
  | 'agent:tool:result'
  | 'before:command:execute'
  | 'after:command:execute'
  | 'before:diagnostic:run'
  | 'diagnostic:result'
  | 'cluster:connect'
  | 'llm:call'
  | 'session:start'
  | 'session:end';

export type HookEvent =
  | BeforeAgentStartEvent
  | AgentToolCallEvent
  | AgentToolResultEvent
  | BeforeCommandExecutionEvent
  | AfterCommandExecutionEvent
  | BeforeDiagnosticRunEvent
  | DiagnosticResultEvent
  | ClusterConnectEvent
  | LLMCallEvent
  | SessionStartEvent
  | SessionEndEvent;

export type HookHandler<T extends HookEvent = HookEvent> = (
  event: T,
) => HookResult | Promise<HookResult>;

export interface HookRegistration {
  name: HookName;
  handler: HookHandler;
  priority?: number;
  enabled?: boolean;
}

export interface HookStats {
  totalHooks: number;
  hooksByName: Record<string, number>;
  callsByName: Record<string, number>;
  errorsByName: Record<string, number>;
}

/**
 * Event Bus for hooks - inspired by pi-mono's event bus
 */
export class HookBus {
  private handlers: Map<HookName, Array<{ handler: HookHandler; priority: number }>> = new Map();
  private stats: HookStats = {
    totalHooks: 0,
    hooksByName: {},
    callsByName: {},
    errorsByName: {},
  };

  /**
   * Register a hook handler
   */
  register(registration: HookRegistration): void {
    const { name, handler, priority = 0, enabled = true } = registration;

    if (!enabled) {
      return;
    }

    if (!this.handlers.has(name)) {
      this.handlers.set(name, []);
    }

    const handlers = this.handlers.get(name)!;
    handlers.push({ handler, priority });

    handlers.sort((a, b) => b.priority - a.priority);

    this.stats.totalHooks++;
    this.stats.hooksByName[name] = (this.stats.hooksByName[name] || 0) + 1;
  }

  /**
   * Unregister a hook handler
   */
  unregister(name: HookName, handler: HookHandler): void {
    const handlers = this.handlers.get(name);
    if (!handlers) return;

    const index = handlers.findIndex(h => h.handler === handler);
    if (index !== -1) {
      handlers.splice(index, 1);
      this.stats.totalHooks--;
      this.stats.hooksByName[name] = (this.stats.hooksByName[name] || 1) - 1;
    }
  }

  /**
   * Emit an event to all registered handlers asynchronously
   */
  async emitAsync<T extends HookEvent>(name: HookName, event: T): Promise<HookResult[]> {
    const handlers = this.handlers.get(name);
    if (!handlers || handlers.length === 0) {
      return [];
    }

    this.stats.callsByName[name] = (this.stats.callsByName[name] || 0) + 1;

    const results: HookResult[] = [];

    for (const { handler } of handlers) {
      try {
        const result = await handler(event);
        results.push(result);
      } catch (error: any) {
        this.stats.errorsByName[name] = (this.stats.errorsByName[name] || 0) + 1;
        results.push({
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Emit synchronously (for simple handlers)
   */
  emit<T extends HookEvent>(name: HookName, event: T): HookResult[] {
    const handlers = this.handlers.get(name);
    if (!handlers || handlers.length === 0) {
      return [];
    }

    this.stats.callsByName[name] = (this.stats.callsByName[name] || 0) + 1;

    const results: HookResult[] = [];

    for (const { handler } of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          results.push({ success: true });
        } else {
          results.push(result);
        }
      } catch (error: any) {
        this.stats.errorsByName[name] = (this.stats.errorsByName[name] || 0) + 1;
        results.push({
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get hook statistics
   */
  getStats(): HookStats {
    return { ...this.stats };
  }

  /**
   * List registered hooks
   */
  listHooks(): Array<{ name: HookName; priority: number }> {
    const hookList: Array<{ name: HookName; priority: number }> = [];

    for (const [name, handlers] of this.handlers.entries()) {
      for (const { priority } of handlers) {
        hookList.push({ name, priority });
      }
    }

    return hookList.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.handlers.clear();
    this.stats = {
      totalHooks: 0,
      hooksByName: {},
      callsByName: {},
      errorsByName: {},
    };
  }
}

/**
 * Global hook event bus instance
 */
export const hooks = new HookBus();

/**
 * Register multiple hooks at once
 */
export function registerHooks(registrations: HookRegistration[]): void {
  for (const reg of registrations) {
    hooks.register(reg);
  }
}

/**
 * Create a hook handler for cluster context
 */
export function createClusterHookHandler(
  handler: (context: HookContext) => HookResult | Promise<HookResult>,
): HookHandler {
  return async (event: any) => {
    if ('context' in event) {
      return handler(event.context);
    }
    return { success: true };
  };
}

/**
 * Built-in hooks for cluster-code
 */
export const builtInHooks: HookRegistration[] = [
  {
    name: 'session:start',
    handler: () => {
      return { success: true };
    },
    priority: -100,
  },
  {
    name: 'session:end',
    handler: () => {
      return { success: true };
    },
    priority: -100,
  },
];
