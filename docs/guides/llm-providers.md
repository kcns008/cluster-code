---
layout: default
title: LLM Provider Setup
parent: Guides
nav_order: 2
description: "Configure AI providers for Cluster Code"
permalink: /guides/llm-providers
---

# LLM Provider Setup
{: .no_toc }

Configure Cluster Code to work with your preferred AI provider - from cloud-based models to local, self-hosted options.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Cluster Code supports multiple LLM providers through the [Vercel AI SDK](https://ai-sdk.dev), giving you flexibility in choosing between:

- **GitHub Copilot** - Access multiple models (GPT-4o, Claude, Gemini) via your GitHub account **(Recommended)**
- **Cloud Providers** - Anthropic, OpenAI, Google (powerful, but sends data externally)
- **Local Models** - Ollama, LM Studio (complete privacy, no API costs)
- **Custom Providers** - Any OpenAI-compatible endpoint

{: .important }
At least one LLM provider must be configured for Cluster Code to function. Choose based on your privacy, cost, and performance requirements.

---

## Quick Setup

### Using GitHub Copilot (Recommended)

The easiest way to get started is with GitHub Copilot:

```bash
# Authenticate with GitHub
cluster-code github login

# Select your preferred model
cluster-code github model
```

This gives you access to GPT-4o, Claude, Gemini, o1, and more through a single authentication.

See the [GitHub Copilot Setup Guide](/guides/github-copilot-setup) for detailed instructions.

### Using Environment Variables

For direct API access, use environment variables:

```bash
# Anthropic (Claude)
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# OpenAI (GPT)
export OPENAI_API_KEY="sk-..."

# Google (Gemini)
export GOOGLE_GENERATIVE_AI_API_KEY="..."
```

Cluster Code will automatically detect and use these credentials.

### Using Configuration Commands

For persistent configuration:

```bash
# Add a provider
cluster-code config provider add anthropic

# Set as active provider
cluster-code config provider set anthropic

# Verify configuration
cluster-code config provider show
```

---

## Anthropic (Claude)

Claude models from Anthropic provide excellent reasoning and code understanding capabilities.

### Models Available

| Model | Context | Best For |
|-------|---------|----------|
| `claude-3-5-sonnet-20241022` | 200K | **Recommended** - Best balance of speed and intelligence |
| `claude-3-opus-20240229` | 200K | Most capable, slower, more expensive |
| `claude-3-haiku-20240307` | 200K | Fastest, most economical |

### Setup Steps

1. **Get API Key**
   - Visit [Anthropic Console](https://console.anthropic.com/)
   - Sign up or log in
   - Go to API Keys section
   - Create a new API key

2. **Configure Cluster Code**

   **Option A: Environment Variable**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-api03-..."
   ```

   **Option B: Interactive Setup**
   ```bash
   cluster-code config provider add anthropic
   # Provider type: Anthropic (Claude)
   # API Key: sk-ant-api03-...
   # Model: claude-3-5-sonnet-20241022
   ```

   **Option C: Direct Configuration**
   ```bash
   cluster-code config provider add anthropic \
     --api-key "sk-ant-api03-..." \
     --model "claude-3-5-sonnet-20241022"
   ```

3. **Set as Active Provider**
   ```bash
   cluster-code config provider set anthropic
   ```

4. **Verify**
   ```bash
   cluster-code chat "Hello, test my Anthropic connection"
   ```

### Configuration File

Your config will look like this in `~/.cluster-code/config.json`:

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "maxTokens": 4096
  },
  "providers": {
    "anthropic": {
      "type": "anthropic",
      "name": "Anthropic",
      "apiKey": "sk-ant-api03-..."
    }
  }
}
```

---

## OpenAI (GPT)

OpenAI's GPT models are widely used and well-supported.

### Models Available

| Model | Context | Best For |
|-------|---------|----------|
| `gpt-4-turbo` | 128K | Latest GPT-4, faster and cheaper |
| `gpt-4` | 8K | Original GPT-4, most tested |
| `gpt-3.5-turbo` | 16K | Fast and economical |

### Setup Steps

1. **Get API Key**
   - Visit [OpenAI Platform](https://platform.openai.com/)
   - Sign up or log in
   - Go to API Keys
   - Create new secret key

2. **Configure Cluster Code**

   **Option A: Environment Variable**
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

   **Option B: Interactive Setup**
   ```bash
   cluster-code config provider add openai
   # Provider type: OpenAI (GPT)
   # API Key: sk-...
   # Model: gpt-4-turbo
   ```

3. **Set as Active Provider**
   ```bash
   cluster-code config provider set openai
   ```

4. **Verify**
   ```bash
   cluster-code diagnose
   ```

---

## Google (Gemini)

Google's Gemini models offer competitive performance with generous free tier.

### Models Available

| Model | Context | Best For |
|-------|---------|----------|
| `gemini-1.5-pro` | 2M | Largest context, best for complex tasks |
| `gemini-1.5-flash` | 1M | Fast and efficient |
| `gemini-pro` | 32K | General purpose |

### Setup Steps

1. **Get API Key**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with Google account
   - Click "Create API Key"

2. **Configure Cluster Code**

   **Option A: Environment Variable**
   ```bash
   export GOOGLE_GENERATIVE_AI_API_KEY="..."
   ```

   **Option B: Interactive Setup**
   ```bash
   cluster-code config provider add google
   # Provider type: Google (Gemini)
   # API Key: ...
   # Model: gemini-1.5-pro
   ```

3. **Set as Active Provider**
   ```bash
   cluster-code config provider set google
   ```

---

## Ollama (Local Models)

Run models locally for complete privacy and no API costs.

### Popular Models

| Model | Size | Best For |
|-------|------|----------|
| `llama3:70b` | 70B | Best quality, requires powerful hardware |
| `llama3:8b` | 8B | Good balance, runs on most systems |
| `deepseek-coder-v2:16b` | 16B | Code-focused, excellent for Kubernetes |
| `mistral:7b` | 7B | Fast and efficient |
| `codellama:13b` | 13B | Code generation and analysis |

### Setup Steps

1. **Install Ollama**

   **macOS/Linux:**
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

   **Windows:**
   - Download from [ollama.ai](https://ollama.ai/)
   - Run the installer

2. **Pull a Model**
   ```bash
   # For best results (requires 48GB+ RAM)
   ollama pull llama3:70b

   # For good balance (requires 8GB+ RAM)
   ollama pull llama3:8b

   # For code-focused tasks (requires 16GB+ RAM)
   ollama pull deepseek-coder-v2:16b
   ```

3. **Verify Ollama is Running**
   ```bash
   # Start Ollama (if not already running)
   ollama serve

   # Test the model
   ollama run llama3:8b "Hello"
   ```

4. **Configure Cluster Code**

   **Option A: Interactive Setup**
   ```bash
   cluster-code config provider add ollama
   # Provider type: Ollama (Local)
   # Base URL: http://localhost:11434/v1
   # Model: llama3:8b
   # API Key: (leave empty - press Enter)
   ```

   **Option B: Environment Variables**
   ```bash
   export OLLAMA_BASE_URL="http://localhost:11434/v1"
   export OLLAMA_MODEL="llama3:8b"
   ```

5. **Set as Active Provider**
   ```bash
   cluster-code config provider set ollama
   ```

6. **Verify**
   ```bash
   cluster-code chat "Test local model connection"
   ```

### Performance Tips

```bash
# Use GPU acceleration (NVIDIA)
# Ollama automatically uses GPU if available

# Check GPU usage
nvidia-smi

# Adjust context window for better performance
cluster-code config set llm.maxTokens 2048

# Use smaller model for faster responses
ollama pull llama3:8b
cluster-code config provider set ollama --model llama3:8b
```

---

## LM Studio (Alternative Local Option)

LM Studio provides a user-friendly GUI for running local models.

### Setup Steps

1. **Install LM Studio**
   - Download from [lmstudio.ai](https://lmstudio.ai/)
   - Install and launch the application

2. **Download a Model**
   - In LM Studio, go to "Discover" tab
   - Search for models like "Llama 3", "DeepSeek Coder", etc.
   - Download your preferred model

3. **Start Local Server**
   - Click "Local Server" in LM Studio
   - Load your model
   - Start server (default: http://localhost:1234/v1)

4. **Configure Cluster Code**
   ```bash
   cluster-code config provider add lmstudio
   # Provider type: OpenAI-compatible (Custom)
   # Base URL: http://localhost:1234/v1
   # Model: <model-name-from-lmstudio>
   # API Key: (leave empty)
   ```

5. **Set as Active Provider**
   ```bash
   cluster-code config provider set lmstudio
   ```

---

## OpenAI-Compatible Providers

Use any OpenAI-compatible API endpoint.

### Supported Providers

- **LM Studio** - Local GUI for running models
- **LocalAI** - Self-hosted OpenAI alternative
- **Text Generation WebUI** - Gradio-based interface
- **vLLM** - High-performance inference server
- **Together.ai** - Cloud-hosted open models
- **Anyscale** - Hosted LLM endpoints

### Generic Setup

```bash
cluster-code config provider add custom
# Provider type: OpenAI-compatible (Custom)
# Base URL: https://your-api-endpoint.com/v1
# API Key: your-api-key (if required)
# Model: your-model-name
```

**Example: Together.ai**
```bash
cluster-code config provider add together \
  --type openai-compatible \
  --base-url "https://api.together.xyz/v1" \
  --api-key "your-together-api-key" \
  --model "meta-llama/Llama-3-70b-chat-hf"
```

---

## Managing Multiple Providers

### List All Configured Providers

```bash
cluster-code config provider list
```

Output:
```
Configured LLM Providers:
  anthropic (Anthropic Claude) [ACTIVE]
    Model: claude-3-5-sonnet-20241022
  openai (OpenAI GPT)
    Model: gpt-4-turbo
  ollama (Ollama Local)
    Model: llama3:8b
```

### Switch Between Providers

```bash
# Switch to OpenAI
cluster-code config provider set openai

# Switch to local Ollama
cluster-code config provider set ollama

# Switch to Anthropic
cluster-code config provider set anthropic
```

### Remove a Provider

```bash
cluster-code config provider remove openai
```

### Update Provider Settings

```bash
# Update API key
cluster-code config provider update anthropic --api-key "new-key"

# Update model
cluster-code config provider update anthropic --model "claude-3-opus-20240229"

# Update base URL (for custom providers)
cluster-code config provider update custom --base-url "https://new-url.com/v1"
```

---

## Advanced Configuration

### Custom Model Parameters

Edit `~/.cluster-code/config.json` to customize model behavior:

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "maxTokens": 4096,
    "temperature": 0.7,
    "topP": 0.9,
    "stream": true
  }
}
```

**Parameters:**
- `maxTokens`: Maximum response length (default: 4096)
- `temperature`: Randomness (0-1, default: 0.7)
- `topP`: Nucleus sampling (0-1, default: 0.9)
- `stream`: Enable streaming responses (default: true)

### Provider-Specific Options

**Anthropic:**
```json
{
  "providers": {
    "anthropic": {
      "type": "anthropic",
      "apiKey": "sk-ant-api03-...",
      "maxRetries": 3,
      "timeout": 60000
    }
  }
}
```

**OpenAI:**
```json
{
  "providers": {
    "openai": {
      "type": "openai",
      "apiKey": "sk-...",
      "organization": "org-...",
      "baseURL": "https://api.openai.com/v1"
    }
  }
}
```

**Ollama:**
```json
{
  "providers": {
    "ollama": {
      "type": "ollama",
      "baseURL": "http://localhost:11434/v1",
      "keepAlive": "5m",
      "numCtx": 4096
    }
  }
}
```

---

## Privacy & Security Considerations

### Cloud Providers (Anthropic, OpenAI, Google)

{: .warning }
**Data sent to cloud providers:**
- Cluster metadata (names, namespaces, labels)
- Pod logs and error messages
- Resource configurations
- Your questions and commands

**Privacy measures:**
- Use environment variables instead of config files for API keys
- Regularly rotate API keys
- Review provider privacy policies
- Consider data residency requirements

### Local Models (Ollama, LM Studio)

{: .note }
**Benefits:**
- Complete data privacy - nothing leaves your machine
- No API costs
- Works offline
- Full control over model and data

**Trade-offs:**
- Requires local compute resources
- May be slower than cloud models
- Limited to available model capabilities

### Best Practices

```bash
# Use environment variables for sensitive data
export ANTHROPIC_API_KEY="..."
# Don't commit this to git

# Exclude config from version control
echo ".cluster-code/" >> .gitignore
echo "~/.cluster-code/config.json" >> .gitignore

# Use different providers for different sensitivity levels
# Use local models for sensitive clusters
cluster-code config provider set ollama

# Use cloud models for development/testing
cluster-code config provider set anthropic
```

---

## Troubleshooting

### Authentication Errors

```bash
# Verify API key is set
echo $ANTHROPIC_API_KEY  # Should show your key

# Test provider directly
cluster-code config provider show

# Re-configure provider
cluster-code config provider remove anthropic
cluster-code config provider add anthropic
```

### Ollama Connection Issues

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama service
ollama serve

# Check model is pulled
ollama list

# Test model directly
ollama run llama3:8b "Test"
```

### Rate Limiting

```bash
# Add retry logic (in config.json)
{
  "llm": {
    "maxRetries": 5,
    "retryDelay": 1000
  }
}

# Or switch to local model temporarily
cluster-code config provider set ollama
```

### Model Performance Issues

```bash
# Reduce token limit for faster responses
cluster-code config set llm.maxTokens 2048

# Use a faster model
cluster-code config provider update anthropic --model claude-3-haiku-20240307

# For Ollama, use smaller model
ollama pull llama3:8b
cluster-code config provider set ollama --model llama3:8b
```

---

## Recommended Configurations

### For Production Clusters (Privacy-Focused)

```bash
# Use local models only
ollama pull deepseek-coder-v2:16b
cluster-code config provider add ollama --model deepseek-coder-v2:16b
cluster-code config provider set ollama
```

### For Development (Best Performance)

```bash
# Use Anthropic Claude for best results
export ANTHROPIC_API_KEY="sk-ant-api03-..."
cluster-code config provider add anthropic --model claude-3-5-sonnet-20241022
cluster-code config provider set anthropic
```

### For Cost-Conscious Users

```bash
# Use Ollama for free local inference
ollama pull llama3:8b
cluster-code config provider add ollama --model llama3:8b
cluster-code config provider set ollama
```

### For Maximum Capability

```bash
# Use Claude Opus for most complex tasks
cluster-code config provider add anthropic --model claude-3-opus-20240229
cluster-code config provider set anthropic
```

---

## Next Steps

Now that you've configured your LLM provider:

1. **[Getting Started Guide](/guides/getting-started)** - Start using Cluster Code
2. **[Configuration Reference](/api/configuration)** - Advanced configuration options
3. **[Diagnostics Guide](/guides/diagnostics)** - Learn AI-powered troubleshooting

Or try it out:
```bash
cluster-code chat "Show me all pods in my cluster"
```

---

## Additional Resources

- [Vercel AI SDK Documentation](https://ai-sdk.dev)
- [Anthropic API Reference](https://docs.anthropic.com/)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Ollama Model Library](https://ollama.ai/library)
- [LM Studio Documentation](https://lmstudio.ai/docs)
