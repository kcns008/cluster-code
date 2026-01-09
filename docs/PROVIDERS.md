# LLM Provider Support

Cluster Code supports multiple LLM providers through the [Vercel AI SDK](https://ai-sdk.dev), enabling you to choose the best model for your needs - whether that's cloud-based services or local, privacy-focused models.

## Quick Start with GitHub Copilot (Recommended)

The easiest way to get started is with GitHub Copilot, which provides access to multiple models through your existing GitHub account:

```bash
# Authenticate with GitHub
cluster-code github login

# Select your preferred model
cluster-code github model
```

See the [GitHub Copilot Setup Guide](/guides/github-copilot-setup) for detailed instructions and PAT permissions.

## Why Multiple Providers?

- **Choice**: Use your preferred LLM provider
- **Cost Control**: Switch to cheaper models for routine tasks
- **Privacy**: Use local models for sensitive cluster data
- **Flexibility**: No vendor lock-in
- **Availability**: Fall back to alternatives if one provider is down

## Supported Providers

### Cloud Providers

| Provider | Models | API Key Required | Best For |
|----------|--------|------------------|----------|
| **GitHub Copilot** | GPT-4o, Claude, Gemini, o1 | GitHub PAT with `copilot` scope | Multi-model access via GitHub |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus | Yes | Complex reasoning, long context |
| **OpenAI** | GPT-4, GPT-3.5 Turbo | Yes | General purpose, good balance |
| **Google** | Gemini 1.5 Pro, Gemini Flash | Yes | Fast responses, cost-effective |

### Local Providers

| Provider | Setup | API Key Required | Best For |
|----------|-------|------------------|----------|
| **Ollama** | Install Ollama + pull models | No | Complete privacy, free |
| **LM Studio** | Download app + models | No | Easy local setup, GUI |
| **LocalAI** | Docker or binary | Optional | Self-hosted, production use |

## Quick Start

### 1. Using Environment Variables (Recommended)

The easiest way to get started is with environment variables:

```bash
# Choose your provider
export ANTHROPIC_API_KEY="sk-ant-..."
# or
export OPENAI_API_KEY="sk-..."
# or
export GOOGLE_GENERATIVE_AI_API_KEY="..."

# Run cluster-code
cluster-code
```

### 2. Using Configuration Commands

For more control, use the configuration commands:

```bash
# Add a provider
cluster-code config provider add anthropic

# Set it as active
cluster-code config provider set anthropic

# Check current configuration
cluster-code config provider show
```

## Provider Details

### Anthropic (Claude)

**Strengths:**
- Excellent for complex Kubernetes troubleshooting
- Long context window (200K tokens)
- Strong reasoning capabilities
- Good at following instructions

**Setup:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Recommended Models:**
- `claude-3-5-sonnet-20241022` - Best balance (recommended)
- `claude-3-opus-20240229` - Most capable
- `claude-3-haiku-20240307` - Fastest, cheapest

**Pricing:** See [Anthropic Pricing](https://www.anthropic.com/pricing)

### OpenAI (GPT)

**Strengths:**
- Widely used and tested
- Good general-purpose performance
- Fast response times
- Strong ecosystem

**Setup:**
```bash
export OPENAI_API_KEY="sk-..."
```

**Recommended Models:**
- `gpt-4` - Best quality (recommended)
- `gpt-4-turbo` - Faster, cheaper than GPT-4
- `gpt-3.5-turbo` - Fast and economical

**Pricing:** See [OpenAI Pricing](https://openai.com/pricing)

### Google (Gemini)

**Strengths:**
- Very fast response times
- Cost-effective
- Large context window
- Multimodal capabilities

**Setup:**
```bash
export GOOGLE_GENERATIVE_AI_API_KEY="..."
```

**Recommended Models:**
- `gemini-1.5-pro` - Best quality (recommended)
- `gemini-1.5-flash` - Fastest, most economical

**Pricing:** See [Google AI Pricing](https://ai.google.dev/pricing)

### Ollama (Local Models)

**Strengths:**
- **100% private** - data never leaves your machine
- **Free** - no API costs
- Run anywhere - no internet required
- Multiple model options

**Setup:**
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3

# Run Ollama
ollama serve

# Configure cluster-code
cluster-code config provider add ollama
cluster-code config provider set ollama
```

**Recommended Models:**
- `llama3` - Good balance (recommended)
- `llama3:70b` - Best quality (requires more RAM)
- `mistral` - Fast and capable
- `codellama` - Optimized for code

**System Requirements:**
- Minimum 8GB RAM for 7B models
- 16GB+ RAM for 13B models
- 32GB+ RAM for 70B models

### LM Studio

**Strengths:**
- Easy GUI interface
- No command line required
- Wide model selection
- Good for beginners

**Setup:**
1. Download from [lmstudio.ai](https://lmstudio.ai/)
2. Download a model through the GUI
3. Start the local server
4. Configure cluster-code:

```bash
cluster-code config provider add lmstudio
# Base URL: http://127.0.0.1:1234/v1
cluster-code config provider set lmstudio
```

## Choosing the Right Provider

### For Production Clusters

**Recommended: Anthropic Claude or OpenAI GPT-4**
- Reliable and well-tested
- Excellent reasoning capabilities
- Good support and documentation

### For Cost Optimization

**Recommended: Google Gemini or GPT-3.5**
- Lower cost per request
- Still high quality for most tasks
- Fast response times

### For Privacy & Compliance

**Recommended: Ollama or LM Studio**
- Data stays on your infrastructure
- No API calls to external services
- Full control over the model

### For Development & Testing

**Recommended: Ollama with Llama 3**
- Free to use
- Fast iteration
- Good enough for testing

## Advanced Configuration

### Multiple Providers

You can configure multiple providers and switch between them:

```bash
# Add multiple providers
cluster-code config provider add anthropic
cluster-code config provider add openai
cluster-code config provider add ollama

# Switch as needed
cluster-code config provider set anthropic  # For complex analysis
cluster-code config provider set ollama     # For privacy-critical tasks

# List all providers
cluster-code config provider list
```

### Custom Provider Options

For advanced use cases, you can manually edit `~/.cluster-code/config.json`:

```json
{
  "llm": {
    "provider": "custom",
    "model": "my-model",
    "maxTokens": 8192,
    "temperature": 0.7
  },
  "providers": {
    "custom": {
      "type": "openai-compatible",
      "name": "My Custom Provider",
      "baseURL": "https://api.custom.com/v1",
      "apiKey": "...",
      "options": {
        "headers": {
          "Custom-Header": "value"
        }
      }
    }
  }
}
```

## Troubleshooting

### Provider Connection Issues

```bash
# Check configuration
cluster-code config provider show

# Test provider connectivity
cluster-code config provider list
```

### API Key Errors

```bash
# Verify environment variable
echo $ANTHROPIC_API_KEY

# Re-add provider with new key
cluster-code config provider add anthropic
```

### Local Provider Not Responding

```bash
# For Ollama
ollama list
curl http://localhost:11434/api/tags

# For LM Studio
curl http://127.0.0.1:1234/v1/models
```

## Best Practices

1. **Use Environment Variables**: Keep API keys out of config files
2. **Start with Defaults**: Use recommended models first
3. **Test Before Production**: Verify provider works with simple queries
4. **Monitor Costs**: Set up billing alerts with cloud providers
5. **Consider Privacy**: Use local models for sensitive data
6. **Have a Backup**: Configure multiple providers for reliability

## Migration from Previous Versions

If you were using cluster-code with only Anthropic support:

```bash
# Your existing ANTHROPIC_API_KEY will continue to work
cluster-code

# Or migrate to new format
cluster-code config provider add anthropic
cluster-code config provider set anthropic
```

Legacy configuration is automatically migrated to the new format.

## Provider Comparison

| Feature | Anthropic | OpenAI | Google | Ollama |
|---------|-----------|--------|--------|--------|
| Cost | $$ | $$ | $ | Free |
| Speed | Fast | Fast | Very Fast | Depends on hardware |
| Quality | Excellent | Excellent | Very Good | Good |
| Privacy | Cloud | Cloud | Cloud | Local |
| Context | 200K | 128K | 1M | Varies |
| Setup | Easy | Easy | Easy | Medium |

## Getting Help

- See [examples/provider-config-examples.md](../examples/provider-config-examples.md) for detailed examples
- Check [Vercel AI SDK Docs](https://ai-sdk.dev/) for provider-specific details
- Open an issue on [GitHub](https://github.com/kcns008/cluster-code/issues) for support

## Contributing

Want to add support for a new provider? We welcome contributions!

1. Check if it's supported by [Vercel AI SDK](https://ai-sdk.dev/providers)
2. Add provider factory in `src/llm/provider.ts`
3. Update documentation
4. Submit a pull request
