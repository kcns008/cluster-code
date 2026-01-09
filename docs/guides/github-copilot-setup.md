---
layout: default
title: GitHub Copilot Setup
parent: Guides
nav_order: 3
description: "Configure GitHub Copilot as your LLM provider for Cluster Code"
permalink: /guides/github-copilot-setup
---

# GitHub Copilot Setup
{: .no_toc }

Use GitHub Copilot's multi-model API to power all Cluster Code features including the agent mode.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

GitHub Copilot provides access to multiple AI models (GPT-4o, Claude, Gemini, o1, and more) through a single API. When configured, Cluster Code uses GitHub Copilot for:

- **Interactive Chat Mode** - Natural language conversations about your cluster
- **Agent Mode** - Autonomous Kubernetes operations and troubleshooting  
- **Diagnostics** - AI-powered cluster analysis
- **All LLM Features** - Every feature that requires AI will use your selected model

{: .important }
GitHub Copilot requires an active subscription (Individual, Business, or Enterprise).

---

## Authentication Methods

### Method 1: OAuth Authentication (Recommended)

The easiest way to authenticate is using the built-in OAuth flow:

```bash
cluster-code github login
# Or
cluster-code --setup-github
```

This will:
1. Open your browser for GitHub authentication
2. Request the necessary permissions automatically
3. Store your credentials securely

### Method 2: Personal Access Token (PAT)

For environments where OAuth is not available (CI/CD, servers, etc.), you can use a Personal Access Token.

#### Required PAT Permissions

When creating a GitHub Personal Access Token, you need the following scopes:

| Scope | Description | Required |
|-------|-------------|----------|
| `copilot` | Access GitHub Copilot API | ✅ Yes |
| `user:email` | Read user email addresses | ✅ Yes |
| `read:user` | Read user profile data | ⚪ Optional |

#### Creating a Fine-Grained PAT (Recommended)

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/tokens?type=beta)

2. Click **"Generate new token"**

3. Configure the token:
   - **Token name**: `cluster-code-copilot`
   - **Expiration**: Choose an appropriate expiration (90 days recommended)
   - **Repository access**: No repositories needed (select "Public Repositories only")
   
4. Under **Account permissions**, set:
   - **Copilot**: `Read-only` (for API access)
   - **Email addresses**: `Read-only`

5. Click **"Generate token"** and copy it immediately

#### Creating a Classic PAT (Alternative)

If fine-grained tokens don't work for your organization:

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)

2. Click **"Generate new token (classic)"**

3. Select these scopes:
   - ✅ `copilot` - Access GitHub Copilot API
   - ✅ `user:email` - Read user email addresses

4. Click **"Generate token"** and copy it immediately

#### Setting Your PAT

```bash
# Option 1: Use the CLI command
cluster-code github token <your-token>

# Option 2: Set as environment variable  
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"

# Option 3: Add to your shell profile for persistence
echo 'export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"' >> ~/.zshrc
source ~/.zshrc
```

---

## Selecting a Model

GitHub Copilot provides access to multiple models. Choose the best one for your needs:

### Available Models

| Model | Category | Best For |
|-------|----------|----------|
| `gpt-4o` ★ | Chat | Complex reasoning, general tasks (Recommended) |
| `gpt-4o-mini` | Chat | Faster responses, simpler tasks |
| `claude-3.5-sonnet` | Chat | Code understanding, detailed explanations |
| `claude-3-opus` | Chat | Most capable, complex analysis |
| `gemini-1.5-pro` | Chat | Large context, fast responses |
| `o1-preview` | Reasoning | Complex problem solving |
| `o1-mini` | Reasoning | Fast reasoning tasks |

### Select Model Interactively

```bash
cluster-code github model
```

### Set Model Directly

```bash
# For this session only
cluster-code --model claude-3.5-sonnet

# Set as default (persists)
cluster-code github model --set claude-3.5-sonnet
```

---

## Using GitHub Copilot with Agent Mode

When GitHub Copilot is configured, **all features including Agent Mode use your selected model**. This means you get consistent behavior across:

- Interactive chat sessions
- Autonomous agent operations
- Diagnostics and analysis
- All LLM-powered features

### Example: Running Agent Mode with Copilot

```bash
# Ensure you're authenticated
cluster-code github status

# Start agent mode (uses your configured Copilot model)
cluster-code agent

# Or run a single agent query
cluster-code agent "Why are my pods failing?"
```

### Model Recommendations by Use Case

| Use Case | Recommended Model | Why |
|----------|-------------------|-----|
| General Kubernetes help | `gpt-4o` | Good balance of speed and capability |
| Complex debugging | `claude-3.5-sonnet` | Excellent at code analysis |
| Quick status checks | `gpt-4o-mini` | Fast responses |
| Architecture review | `o1-preview` | Deep reasoning capability |
| Security analysis | `claude-3-opus` | Thorough analysis |

---

## Verifying Your Setup

### Check Authentication Status

```bash
cluster-code github status
# Or
cluster-code --whoami
```

Expected output:
```
@your-username
Provider: GitHub Copilot
Model:    gpt-4o
```

### Test Copilot Connection

```bash
cluster-code github test
```

This verifies:
1. GitHub API connection
2. Copilot API access
3. Token permissions

### List Available Models

```bash
cluster-code github models
```

---

## Troubleshooting

### "No access to Copilot" Error

**Cause**: Your GitHub account doesn't have an active Copilot subscription.

**Solution**:
1. Check your subscription at [GitHub Copilot Settings](https://github.com/settings/copilot)
2. If using a Business/Enterprise account, ensure your organization has enabled Copilot for you

### "Token missing required scopes" Warning

**Cause**: Your PAT doesn't have the `copilot` scope.

**Solution**:
1. Create a new token with the `copilot` scope
2. Update your token: `cluster-code github token <new-token>`

### OAuth Flow Fails

**Cause**: OAuth app not configured or network issues.

**Solution**:
1. Try using a PAT instead: `cluster-code github token <your-token>`
2. Check your firewall/proxy settings
3. Try a different network

### Token Expired

**Cause**: Your GitHub token has expired.

**Solution**:
```bash
# Re-authenticate
cluster-code github login
# Or create a new PAT with longer expiration
```

---

## Security Best Practices

1. **Use fine-grained PATs** when possible - they provide least-privilege access

2. **Set expiration dates** - Rotate tokens every 90 days

3. **Use OAuth for personal use** - It handles token refresh automatically

4. **Use environment variables** for CI/CD - Never commit tokens to repositories

5. **Monitor token usage** - Check [GitHub Security Log](https://github.com/settings/security-log) regularly

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub PAT with copilot scope | `ghp_xxx...` |
| `GITHUB_CLIENT_ID` | OAuth App Client ID (optional) | `Iv1.xxx...` |
| `GITHUB_CLIENT_SECRET` | OAuth App Client Secret (optional) | `xxx...` |

---

## Next Steps

- [Getting Started Guide](/guides/getting-started) - Start using Cluster Code
- [Agent Mode Tutorial](/tutorials/agent-mode) - Learn autonomous operations
- [LLM Providers Guide](/guides/llm-providers) - Configure other providers

---

## Comparison: GitHub Copilot vs Direct API

| Feature | GitHub Copilot | Direct API (Anthropic/OpenAI) |
|---------|----------------|------------------------------|
| Setup | GitHub account + Copilot subscription | Separate API key |
| Model Access | Multiple models via one auth | One provider per key |
| Billing | GitHub subscription | Per-token/usage |
| Agent Mode | ✅ Supported | ✅ Supported |
| Privacy | Data via GitHub | Direct to provider |
| Best For | GitHub users, multi-model access | Direct API access, specific needs |
