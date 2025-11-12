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
