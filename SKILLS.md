# Skills

This repository includes a comprehensive collection of skills for AI agents working with Kubernetes, OpenShift, and cloud-native infrastructure. These skills extend AI agent capabilities to provide intelligent automation and operational excellence.

## 🔍 QMD Skills

### Quick Markdown Search (QMD)
**Location**: [`skills/qmd.md`](skills/qmd.md)

A powerful local search engine for markdown notes, documentation, and knowledge bases. Combines BM25 keyword search, vector semantic search, and LLM re-ranking for finding relevant information across your collections.

**When to Use:**
- "search my notes / docs / knowledge base"
- "find related notes"
- "retrieve a markdown document"
- "search local markdown files"

**Key Features:**
- **Fast keyword search** (`qmd search`) - Instant BM25 results
- **Semantic search** (`qmd vsearch`) - Conceptual similarity matching
- **Hybrid search** (`qmd query`) - Best quality with LLM reranking
- **Agent integration** - MCP server support for Claude Desktop/Code

**Example Usage:**
```bash
qmd search "kubernetes deployment" -n 5
qmd vsearch "cluster troubleshooting" 
qmd query "operational excellence" --min-score 0.3
```

## 🎯 Core Skills for Cluster Code

### Kubernetes Operations
- **Cluster Management**: Automated deployment, scaling, and lifecycle management
- **Multi-Cloud Support**: Consistent operations across AWS, Azure, GCP, and on-prem
- **GitOps Integration**: Seamless workflow with ArgoCD, Flux, and similar tools

### AI-Powered Diagnostics
- **Intelligent Troubleshooting**: Automated issue detection and resolution
- **Performance Optimization**: Resource analysis and tuning recommendations
- **Security Scanning**: Vulnerability detection and compliance checking

### CLI Automation
- **Command Generation**: AI-powered command suggestions based on context
- **Workflow Orchestration**: Complex multi-step operations automation
- **Configuration Management**: Dynamic configuration generation and validation

## 📚 Related Skills

### Cluster Skills Repository
For additional Kubernetes-focused AI agent skills, see: [kcns008/cluster-skills](https://github.com/kcns008/cluster-skills)

### Platform Engineering Swarm
For advanced orchestration skills, see: [kcns008/cluster-agent-swarm-skills](https://github.com/kcns008/cluster-agent-swarm-skills)

### Active SRE Agent
For comprehensive SRE operations, see: [kcns008/clusterclaw](https://github.com/kcns008/clusterclaw)

## 🔧 Integration

These skills are designed to work together:

1. **QMD** provides knowledge base search and document retrieval
2. **Cluster Code** delivers CLI automation and AI operations
3. **Supporting repositories** extend capabilities with specialized skills

## 🚀 Getting Started

To use these skills with your AI agent:

1. **Install QMD locally** (required for search capabilities):
   ```bash
   bun install -g https://github.com/tobi/qmd
   qmd collection add /path/to/docs --name docs
   qmd embed  # Enable semantic search
   ```

2. **Configure your agent** to recognize the QMD skill format
3. **Add the skills** to your agent's skill registry

## 📖 Documentation

- [QMD Documentation](https://github.com/tobi/qmd)
- [Agent Skills Format](https://agentskills.io/)
- [Cluster Code Documentation](./docs/)

---

These skills transform your AI agent into a Kubernetes and OpenShift operations expert with comprehensive search, automation, and diagnostic capabilities.