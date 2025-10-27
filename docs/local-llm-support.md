# Local LLM Support for Cluster Code

## Overview

Cluster Code supports integration with locally hosted Large Language Models (LLMs), enabling you to use self-hosted or open-source models instead of proprietary cloud-based models. This provides privacy, cost control, and flexibility for your Kubernetes cluster management workflows.

## Architecture

Local LLM support works through a **LiteLLM proxy** that translates Cluster Code requests into OpenAI-compatible API calls that your local model can understand.

```
Cluster Code -> LiteLLM Proxy -> Local LLM (Ollama/vLLM/etc.)
```

## Supported Local LLM Providers

- **Ollama**: Most popular for local model serving
- **vLLM**: High-performance inference server
- **Llama.cpp**: C++ implementation for efficient inference
- **Text Generation Inference (TGI)**: Hugging Face's inference server
- **Custom OpenAI-compatible endpoints**: Any service with OpenAI-compatible API

## Quick Setup Guide

### 1. Install LiteLLM Proxy

```bash
pip install 'litellm[proxy]'
```

### 2. Create LiteLLM Configuration

Create a `config.yaml` file:

```yaml
model_list:
  - model_name: local-cluster-model
    litellm_params:
      model: ollama/deepseek-coder-v2
      api_base: "http://localhost:11434"
      # Optional: Add temperature, max_tokens, etc.
      temperature: 0.1
      max_tokens: 4096

  - model_name: local-llama
    litellm_params:
      model: ollama/llama3.1:8b
      api_base: "http://localhost:11434"

# Optional: Load balancing between models
router_settings:
  model_group_alias:
    local-cluster-model-group:
      - local-cluster-model
      - local-llama
```

### 3. Start LiteLLM Proxy

```bash
# Set master key (replace with secure key)
export LITELLM_MASTER_KEY="your-secure-master-key-here"

# Start proxy with your config
litellm --config config.yaml --port 4000
```

### 4. Configure Cluster Code

```bash
# Set environment variables for Cluster Code
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_AUTH_TOKEN="your-secure-master-key-here"
```

### 5. Use Local Model with Cluster Code

```bash
# Run cluster operations with local model
cluster-code --model local-cluster-model diagnose
cluster-code --model local-cluster-model "Analyze pod failures in production namespace"
cluster-code --model local-llama chat "Help me troubleshoot service connectivity issues"
```

## Configuration Options

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_BASE_URL` | Yes | URL of your LiteLLM proxy |
| `ANTHROPIC_AUTH_TOKEN` | Yes | Master key for LiteLLM proxy |

### Recommended Models for Cluster Management

Based on testing, these models work well for Kubernetes cluster operations:

#### Code-Specialized Models
- **deepseek-coder-v2**: Excellent for troubleshooting and code analysis
- **codellama**: Good for configuration and script generation
- **starcoder2**: Strong performance on technical tasks

#### General Purpose Models
- **llama3.1:8b**: Good balance of performance and resource usage
- **mistral:7b**: Fast and efficient for cluster diagnostics
- **qwen2.5:7b**: Strong reasoning capabilities

## Advanced Configuration

### Model Selection Strategy

Configure different models for different tasks:

```yaml
model_list:
  # For code analysis and troubleshooting
  - model_name: code-specialist
    litellm_params:
      model: ollama/deepseek-coder-v2
      api_base: "http://localhost:11434"
      temperature: 0.1

  # For general cluster diagnostics
  - model_name: diagnostics-general
    litellm_params:
      model: ollama/llama3.1:8b
      api_base: "http://localhost:11434"
      temperature: 0.3

  # For creative problem-solving
  - model_name: creative-solver
    litellm_params:
      model: ollama/mistral:7b
      api_base: "http://localhost:11434"
      temperature: 0.7
```

### Performance Optimization

```yaml
# Add request/rate limiting
general_settings:
  master_key: "your-secure-key"
  database_url: "sqlite:///litellm.db"  # Enable caching

litellm_settings:
  set_verbose: true
  drop_params: true  # Handle unsupported parameters

# Configure timeouts and retries
router_settings:
  timeout: 120  # seconds
  retries: 3
```

### Resource Management

Monitor and limit resource usage:

```yaml
# Add to your proxy startup
litellm --config config.yaml \
  --num_workers 4 \
  --max_parallel_requests 10 \
  --timeout 120
```

## Usage Examples

### Interactive Troubleshooting

```bash
# Use local model for interactive session
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_AUTH_TOKEN="your-key"

# Start chat with local model
cluster-code --model local-cluster-model chat

# Specific troubleshooting
cluster-code --model local-cluster-model "Why are my pods in CrashLoopBackOff?"
cluster-code --model code-specialist "Help me write a deployment YAML"
```

### Automated Diagnostics

```bash
# Run comprehensive diagnostics with local model
cluster-code --model diagnostics-general diagnose --namespace production

# Analyze specific resources
cluster-code --model local-cluster-model analyze pod my-app-pod-xyz
cluster-code --model code-specialist describe deployment my-api
```

### Script Integration

```bash
#!/bin/bash
# cluster-health-check.sh

export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_AUTH_TOKEN="your-key"

# Use local model for health analysis
cluster-code --model diagnostics-general status --output json > cluster-status.json
cluster-code --model local-cluster-model diagnose --severity critical > issues.txt

# Process results...
```

## Hardware Requirements

### Minimum Requirements
- **CPU**: 4+ cores
- **RAM**: 16GB+ (32GB recommended for larger models)
- **Storage**: 10GB+ for model files
- **GPU**: Optional but recommended (NVIDIA GPU with 8GB+ VRAM)

### Performance Tiers

| Use Case | Recommended Model | RAM | GPU |
|----------|------------------|-----|-----|
| Basic Diagnostics | mistral:7b | 16GB | Optional |
| Code Analysis | deepseek-coder-v2 | 24GB | Recommended |
| Advanced Operations | llama3.1:8b | 32GB | Recommended |
| Production Use | Custom fine-tuned | 64GB+ | Required |

## Limitations and Considerations

### Known Limitations

1. **Model Compatibility**: Not all commands work perfectly with every local model
2. **Output Format**: Different models may format outputs differently
3. **Performance**: Local models are typically slower than cloud APIs
4. **Resource Usage**: High memory and CPU consumption
5. **Feature Compatibility**: Some advanced features may require specific model capabilities

### Best Practices

1. **Start Small**: Begin with smaller models (7B parameters) before scaling up
2. **Monitor Resources**: Use `htop` or similar tools to monitor resource usage
3. **Cache Results**: Enable LiteLLM caching to reduce redundant requests
4. **Test Thoroughly**: Validate that your local model works with your specific use cases
5. **Have Fallback**: Keep cloud model access as backup for critical operations

### Troubleshooting Common Issues

#### Proxy Connection Issues
```bash
# Check if proxy is running
curl http://localhost:4000/health

# Check proxy logs
litellm --config config.yaml --debug
```

#### Model Performance Issues
```bash
# Monitor system resources
htop
nvidia-smi  # If using GPU

# Test model directly
ollama list
ollama run deepseek-coder-v2
```

#### Cluster Code Connection Issues
```bash
# Test connection to proxy
curl -H "Authorization: Bearer your-key" \
     http://localhost:4000/v1/models

# Check environment variables
echo $ANTHROPIC_BASE_URL
echo $ANTHROPIC_AUTH_TOKEN
```

## Security Considerations

### Authentication
- Use strong, unique master keys for LiteLLM proxy
- Rotate keys regularly
- Limit access to proxy server

### Network Security
- Run proxy on localhost or secure internal network
- Use TLS/SSL for remote connections
- Implement firewall rules as needed

### Data Privacy
- Local models keep your data on-premises
- No data sent to external APIs
- Full control over logging and data retention

## Integration with Existing Workflows

### CI/CD Integration

```yaml
# .github/workflows/cluster-check.yml
name: Cluster Health Check
on: [push, pull_request]

jobs:
  diagnose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Local LLM
        run: |
          pip install 'litellm[proxy]'
          litellm --config config.yaml --port 4000 &
      - name: Run Diagnostics
        env:
          ANTHROPIC_BASE_URL: "http://localhost:4000"
          ANTHROPIC_AUTH_TOKEN: "${{ secrets.LITELLM_KEY }}"
        run: |
          cluster-code --model local-cluster-model diagnose --output json
```

### Team Collaboration

Share your LiteLLM configuration with team members:

```bash
# Create team configuration
git add config.yaml
git commit -m "Add shared LLM configuration"

# Team members can easily set up
pip install 'litellm[proxy]'
litellm --config config.yaml
```

## Future Enhancements

Planned improvements to Local LLM support:

1. **Native Integration**: Direct LLM endpoint configuration without proxy
2. **Model Auto-Selection**: Automatically choose best model for specific tasks
3. **Performance Monitoring**: Built-in metrics and alerting
4. **Fine-tuning Support**: Integration with custom fine-tuned models
5. **Edge Deployment**: Support for edge computing scenarios

## Support

For Local LLM support issues:

- **Documentation**: https://docs.cluster-code.io/local-llm
- **Community**: https://discord.gg/cluster-code
- **Issues**: https://github.com/your-org/cluster-code/issues
- **LiteLLM Docs**: https://docs.litellm.ai/

## Contributing

We welcome contributions to improve Local LLM support:

1. Test with different local models
2. Share performance benchmarks
3. Contribute model-specific optimizations
4. Improve documentation and examples
5. Report bugs and suggest enhancements

---

*Local LLM support enables Cluster Code to work with your preferred models while maintaining privacy and control over your cluster management workflows.*