# Cluster Code

![](https://img.shields.io/badge/Kubernetes-1.28%2B-blue?style=flat-square) ![](https://img.shields.io/badge/OpenShift-4.15%2B-red?style=flat-square) [![Cluster Code]](https://github.com/kcns008/cluster-code)

[Cluster Code]: https://img.shields.io/badge/Cluster%20Code-v1.0.0-brightgreen.svg?style=flat-square

AI-powered CLI tool for Kubernetes and OpenShift cluster management with intelligent diagnostics, multi-cloud support, and GitOps workflows.

## ⚡ Quick Start

### Install

```sh
npm install -g cluster-code
```

### Configure LLM Provider

```sh
# Anthropic (Claude)
export ANTHROPIC_API_KEY=your-api-key

# Or OpenAI
export OPENAI_API_KEY=your-api-key

# Or use local models (no API key needed)
ollama pull llama3
cluster-code config provider add ollama
```

### Connect & Go

```sh
cluster-code init
cluster-code
```

That's it! Start chatting with your cluster in plain English.

## ✨ Key Features

- 💬 **Natural Language Interface** - Control your cluster using plain English
- 🔍 **AI-Powered Diagnostics** - Intelligent troubleshooting with K8sGPT
- 🔎 **Semantic Code Search** - Auto-enabled mgrep integration for 2x better token efficiency
- ☁️ **Multi-Cloud Support** - AWS EKS, Azure AKS/ARO, GCP GKE
- 🚀 **GitOps Ready** - Helm, Kustomize, ArgoCD, Flux integration
- 🔒 **Local LLM Support** - Use Ollama for complete data privacy
- 🎯 **OpenShift Native** - Routes, Operators, BuildConfigs support

## 📚 Documentation

**[View Full Documentation →](https://kcns008.github.io/cluster-code)**

- [Installation Guide](https://kcns008.github.io/cluster-code/guides/installation) - Detailed setup instructions
- [LLM Provider Setup](https://kcns008.github.io/cluster-code/guides/llm-providers) - Configure Anthropic, OpenAI, Google, or local models
- [Getting Started](https://kcns008.github.io/cluster-code/guides/getting-started) - First steps and tutorials
- [API Reference](https://kcns008.github.io/cluster-code/api/commands) - Complete command reference

## 💡 Usage Examples

### Interactive Mode (Primary)

```bash
$ cluster-code

You: Show me all pods that are failing
You: Why is my deployment crashing?
You: Scale my app to 5 replicas
```

### Direct Commands

```bash
# Run cluster diagnostics
cluster-code diagnose

# Analyze specific resources
cluster-code analyze pod my-pod

# Deploy with Helm
cluster-code helm-deploy --chart ./my-chart --release my-app

# Create cloud cluster
cluster-code azure-cluster-create --type aks --name prod-aks
```

## 🔌 Plugin Architecture

- **cluster-core** - Core Kubernetes operations
- **k8sgpt-analyzers** - AI-powered diagnostics
- **cluster-openshift** - OpenShift-specific features
- **cloud-providers** - Multi-cloud provisioning
- **gitops** - Deployment automation

[Learn more about plugins →](./plugins/README.md)

## 🔎 Semantic Code Search with mgrep

Cluster Code integrates with [mgrep](https://github.com/mixedbread-ai/mgrep) to provide AI-powered semantic code search, using **2x fewer tokens** than traditional grep-based workflows.

### Auto-Enable During Init

During `cluster-code init`, you'll be prompted to enable mgrep:

```bash
$ cluster-code init
...
? Would you like to enable mgrep semantic code search? (Recommended) Yes
```

This will:
1. Install `@mixedbread/mgrep` globally (if needed)
2. Authenticate with Mixedbread (browser or API key)
3. Install the mgrep Claude Code plugin
4. Optionally start indexing your repository

### Manual Setup

If you skip during init, you can set it up later:

```bash
npm install -g @mixedbread/mgrep
mgrep login
mgrep install-claude-code
mgrep watch
```

### Benefits

- 🚀 **2x Token Efficiency** - Uses fewer tokens with better search quality
- 🧠 **Semantic Understanding** - Finds code by intent, not just keywords
- 📁 **Multi-Format Support** - Search code, images, PDFs, and more
- 🔄 **Live Sync** - Keeps your code index up-to-date automatically

Learn more at [mixedbread.ai/mgrep](https://github.com/mixedbread-ai/mgrep)

## 🤝 Contributing

We welcome contributions! Check out our [contributing guide](./CONTRIBUTING.md) to get started.

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details

## 🔗 Links

- [Documentation](https://kcns008.github.io/cluster-code)
- [GitHub Issues](https://github.com/kcns008/cluster-code/issues)
- [Changelog](./CHANGELOG.md)

---

**Ready to get started?** Install cluster-code and check out our [Quick Start Guide](https://kcns008.github.io/cluster-code/guides/getting-started) →
