# LLM Provider Configuration Examples

This guide provides detailed examples for configuring different LLM providers with Cluster Code.

## Table of Contents

- [Anthropic (Claude)](#anthropic-claude)
- [OpenAI (GPT)](#openai-gpt)
- [Google (Gemini)](#google-gemini)
- [Ollama (Local Models)](#ollama-local-models)
- [LM Studio](#lm-studio)
- [LocalAI](#localai)
- [Custom Providers](#custom-providers)

## Anthropic (Claude)

### Using Environment Variable

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
cluster-code init
cluster-code
```

### Using Configuration

```bash
cluster-code config provider add anthropic
# Provider type: Anthropic (Claude)
# Display name: Anthropic
# API Key: sk-ant-api03-...

cluster-code config provider set anthropic
# Model ID: claude-3-5-sonnet-20241022
```

### Available Models

- `claude-3-5-sonnet-20241022` (recommended)
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

### Configuration File Example

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

## OpenAI (GPT)

### Using Environment Variable

```bash
export OPENAI_API_KEY="sk-..."
cluster-code init
cluster-code
```

### Using Configuration

```bash
cluster-code config provider add openai
# Provider type: OpenAI (GPT)
# Display name: OpenAI
# API Key: sk-...

cluster-code config provider set openai
# Model ID: gpt-4
```

### Available Models

- `gpt-4` (recommended)
- `gpt-4-turbo`
- `gpt-3.5-turbo`
- `gpt-4o`

### Configuration File Example

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "maxTokens": 4096
  },
  "providers": {
    "openai": {
      "type": "openai",
      "name": "OpenAI",
      "apiKey": "sk-..."
    }
  }
}
```

## Google (Gemini)

### Using Environment Variable

```bash
export GOOGLE_GENERATIVE_AI_API_KEY="..."
cluster-code init
cluster-code
```

### Using Configuration

```bash
cluster-code config provider add google
# Provider type: Google (Gemini)
# Display name: Google
# API Key: ...

cluster-code config provider set google
# Model ID: gemini-1.5-pro
```

### Available Models

- `gemini-1.5-pro` (recommended)
- `gemini-1.5-flash`
- `gemini-pro`

### Configuration File Example

```json
{
  "llm": {
    "provider": "google",
    "model": "gemini-1.5-pro",
    "maxTokens": 4096
  },
  "providers": {
    "google": {
      "type": "google",
      "name": "Google",
      "apiKey": "..."
    }
  }
}
```

## Ollama (Local Models)

### Prerequisites

1. Install Ollama: https://ollama.ai/
2. Pull a model: `ollama pull llama3`
3. Run Ollama: `ollama serve`

### Configuration

```bash
cluster-code config provider add ollama
# Provider type: Ollama (Local)
# Display name: Ollama
# API Key: (leave empty)
# Base URL: http://localhost:11434/v1

cluster-code config provider set ollama
# Model ID: llama3
```

### Popular Models

- `llama3` (recommended)
- `llama3:70b` (larger, more capable)
- `mistral`
- `codellama`
- `phi3`

### Configuration File Example

```json
{
  "llm": {
    "provider": "ollama",
    "model": "llama3",
    "maxTokens": 4096
  },
  "providers": {
    "ollama": {
      "type": "ollama",
      "name": "Ollama",
      "baseURL": "http://localhost:11434/v1"
    }
  }
}
```

## LM Studio

### Prerequisites

1. Install LM Studio: https://lmstudio.ai/
2. Download and load a model
3. Start the local server (default: http://127.0.0.1:1234)

### Configuration

```bash
cluster-code config provider add lmstudio
# Provider type: OpenAI-compatible (Custom)
# Display name: LM Studio
# API Key: (leave empty or use 'not-needed')
# Base URL: http://127.0.0.1:1234/v1

cluster-code config provider set lmstudio
# Model ID: <model-name-from-lmstudio>
```

### Configuration File Example

```json
{
  "llm": {
    "provider": "lmstudio",
    "model": "mistral-7b-instruct",
    "maxTokens": 4096
  },
  "providers": {
    "lmstudio": {
      "type": "openai-compatible",
      "name": "LM Studio",
      "baseURL": "http://127.0.0.1:1234/v1",
      "apiKey": "not-needed"
    }
  }
}
```

## LocalAI

### Prerequisites

1. Install LocalAI: https://localai.io/
2. Configure and start LocalAI server

### Configuration

```bash
cluster-code config provider add localai
# Provider type: OpenAI-compatible (Custom)
# Display name: LocalAI
# API Key: (as configured in LocalAI)
# Base URL: http://localhost:8080/v1

cluster-code config provider set localai
# Model ID: <model-name>
```

### Configuration File Example

```json
{
  "llm": {
    "provider": "localai",
    "model": "gpt-3.5-turbo",
    "maxTokens": 4096
  },
  "providers": {
    "localai": {
      "type": "openai-compatible",
      "name": "LocalAI",
      "baseURL": "http://localhost:8080/v1",
      "apiKey": "your-api-key"
    }
  }
}
```

## Custom Providers

You can add any OpenAI-compatible provider:

### Configuration

```bash
cluster-code config provider add custom
# Provider type: OpenAI-compatible (Custom)
# Display name: My Custom Provider
# API Key: your-api-key
# Base URL: https://api.your-provider.com/v1

cluster-code config provider set custom
# Model ID: your-model-id
```

### Configuration File Example

```json
{
  "llm": {
    "provider": "custom",
    "model": "your-model-id",
    "maxTokens": 4096
  },
  "providers": {
    "custom": {
      "type": "openai-compatible",
      "name": "My Custom Provider",
      "baseURL": "https://api.your-provider.com/v1",
      "apiKey": "your-api-key"
    }
  }
}
```

## Switching Between Providers

You can easily switch between configured providers:

```bash
# List all providers
cluster-code config provider list

# Switch to a different provider
cluster-code config provider set openai
# Model ID: gpt-4

# Check current provider
cluster-code config provider show
```

## Best Practices

1. **Use Environment Variables for Sensitive Keys**: Avoid storing API keys in configuration files
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

2. **Use Local Models for Privacy**: For sensitive cluster data, use Ollama or LM Studio
   ```bash
   ollama pull llama3
   cluster-code config provider set ollama
   ```

3. **Test Provider Before Using**: Verify connectivity
   ```bash
   cluster-code config provider show
   cluster-code
   # Try a simple query to test
   ```

4. **Keep Backups of Configuration**:
   ```bash
   cp ~/.cluster-code/config.json ~/.cluster-code/config.json.backup
   ```

5. **Use Appropriate Models**: Balance cost, speed, and capability
   - Quick queries: Claude Haiku, GPT-3.5, Gemini Flash
   - Complex analysis: Claude Sonnet, GPT-4, Gemini Pro
   - Privacy-critical: Ollama/local models

## Troubleshooting

### Provider Not Found

```bash
cluster-code config provider list
# Check if provider is configured

cluster-code config provider add <provider-name>
```

### API Key Errors

```bash
# Verify API key
echo $ANTHROPIC_API_KEY

# Or check configuration
cluster-code config provider show
```

### Connection Errors (Local Providers)

```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Verify LM Studio server is running
curl http://127.0.0.1:1234/v1/models
```

### Model Not Found

```bash
# For Ollama, list available models
ollama list

# For LM Studio, check loaded model name in the UI
```

## Support

For more information about supported providers, visit:
- Vercel AI SDK: https://ai-sdk.dev/
- Anthropic: https://docs.anthropic.com/
- OpenAI: https://platform.openai.com/docs
- Google AI: https://ai.google.dev/
- Ollama: https://ollama.ai/
