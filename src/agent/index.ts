/**
 * Agent SDK Module
 * 
 * Exports Agent SDK components for agentic Kubernetes operations
 * Enhanced with session management, hooks, subagents, and improved streaming
 * 
 * Supports two backends:
 * - Claude Agent SDK (for direct Anthropic API usage)
 * - Copilot Agent (for GitHub Copilot with any model)
 */

export { AgentClient, AgentClientOptions } from './agent-client';
export { AgentSession, AgentSessionOptions } from './agent-session';
export { CopilotAgent, CopilotAgentOptions, createCopilotAgent } from './copilot-agent';
export { createKubernetesMcpServer, getKubernetesToolNames } from './mcp-kubernetes';
