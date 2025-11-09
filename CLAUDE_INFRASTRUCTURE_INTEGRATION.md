# Claude Code Infrastructure Integration

This document describes the infrastructure components integrated into cluster-code from the [claude-code-infrastructure-showcase](https://github.com/diet103/claude-code-infrastructure-showcase) repository. These components enhance Claude Code's effectiveness when working with the cluster-code project.

## Overview

The integration adds three key systems:

1. **Skills System**: Domain-specific knowledge and development guidelines
2. **Hooks System**: Automation and context-awareness
3. **Enhanced Agents**: Specialized AI assistants for development tasks

These components work together to provide:
- Context-aware skill suggestions
- Automated file tracking
- Comprehensive development guidelines
- Specialized assistance for architecture, refactoring, and testing

---

## What Was Added

### 1. Skills System

Location: `.claude/skills/`

**cluster-dev-guidelines.md**
- Comprehensive TypeScript/Node.js development patterns
- CLI tool development best practices
- Kubernetes integration patterns
- LLM provider integration guidelines
- Plugin architecture patterns
- Testing and error handling standards

**skill-developer.md**
- Meta-skill for creating new skills
- Skill structure templates
- Auto-activation configuration guide
- Best practices for skill design

### 2. Hooks System

Location: `.claude/hooks/`

**skill-activation-prompt.sh** (UserPromptSubmit hook)
- Analyzes user input and current file context
- Automatically suggests relevant skills
- Uses keywords and file patterns from skill-rules.json
- Runs before each user prompt submission

**post-tool-use-tracker.sh** (PostToolUse hook)
- Tracks file modifications during Claude Code operations
- Provides visibility into changes
- Suggests running type checks after TypeScript changes
- Maintains modification log for context

### 3. Enhanced Agents

Location: `.claude/agents/`

**architecture-review.md**
- Reviews code architecture and design patterns
- Identifies architectural issues and improvements
- Provides refactoring recommendations
- Checks for SOLID principles and best practices

**refactoring-assistant.md**
- Guides safe code refactoring
- Provides refactoring patterns and techniques
- Helps improve code quality incrementally
- Ensures behavior preservation during refactoring

**test-generator.md**
- Generates Jest test suites
- Provides test templates and patterns
- Helps with mocking kubectl and LLM providers
- Includes integration test examples

### 4. Auto-Activation Configuration

**.claude/skill-rules.json**
- Defines when skills should be auto-suggested
- Maps file patterns to relevant skills
- Configures keyword-based skill activation
- Controls suggestion behavior

---

## How It Works

### Skills Auto-Activation

When you work on cluster-code files or mention certain keywords, the skill-activation-prompt hook automatically suggests relevant skills:

**Example 1: Editing TypeScript Files**
```bash
# Edit a TypeScript file
vim src/utils/kubectl.ts

# When you submit a prompt, the hook suggests:
💡 Suggested Skills for this task:
  • cluster-dev-guidelines
    TypeScript/Node.js development patterns for cluster-code

To activate a skill, use: /skill cluster-dev-guidelines
```

**Example 2: Keyword Matching**
```bash
# Your prompt: "Help me refactor this code"

# The hook detects "refactor" and suggests:
💡 Suggested Skills for this task:
  • cluster-dev-guidelines
    TypeScript/Node.js development patterns
```

### File Modification Tracking

The post-tool-use-tracker hook monitors file changes and provides feedback:

```bash
# After editing a TypeScript file:
📝 File Modified:
   Path: src/llm/provider.ts
   Type: TypeScript
   Action: Edit

💡 Tip: Multiple TypeScript files modified. Consider running:
   npm run build
   or
   tsc --noEmit
```

### Specialized Agents

Use agents for specific development tasks:

```bash
# Request architecture review
claude-code agent architecture-review

# Get refactoring assistance
claude-code agent refactoring-assistant

# Generate tests
claude-code agent test-generator
```

---

## Usage Guide

### Activating Skills

**Manual Activation:**
```bash
# Activate a skill for the current session
/skill cluster-dev-guidelines
/skill skill-developer
```

**Auto-Activation:**
Skills are automatically suggested based on:
- Files you're editing (path patterns)
- Keywords in your prompts
- Current working context

### Using Hooks

Hooks run automatically and don't require manual invocation:

- **skill-activation-prompt**: Runs before each user prompt
- **post-tool-use-tracker**: Runs after file modifications

To disable a hook temporarily:
```bash
chmod -x .claude/hooks/hook-name.sh
```

To re-enable:
```bash
chmod +x .claude/hooks/hook-name.sh
```

### Invoking Agents

Agents can be invoked through Claude Code:

**Option 1: Natural Language**
```
"Please review the architecture of the LLM provider module"
(Claude Code will use the architecture-review agent)
```

**Option 2: Direct Invocation**
```bash
# Use the Task tool with the agent
claude-code task --agent architecture-review
```

---

## Configuration

### Adding New Skills

1. Create a new skill file in `.claude/skills/`:
```bash
vim .claude/skills/k8s-troubleshooting.md
```

2. Follow the skill template (see skill-developer.md for guidance)

3. Add an entry to `.claude/skill-rules.json`:
```json
{
  "skills": [
    {
      "name": "k8s-troubleshooting",
      "description": "Kubernetes troubleshooting patterns",
      "pathPatterns": [
        "src/analyzers/**/*.ts",
        ".claude/agents/pod-doctor.md"
      ],
      "keywords": [
        "troubleshoot",
        "debug",
        "kubernetes",
        "pod",
        "failing"
      ],
      "priority": 15
    }
  ]
}
```

### Customizing Hooks

Hooks are bash scripts that can be customized:

```bash
# Edit a hook
vim .claude/hooks/skill-activation-prompt.sh

# Test the hook
cat <<EOF | .claude/hooks/skill-activation-prompt.sh
Help me implement a new feature
EOF
```

### Configuring Auto-Activation

Edit `.claude/skill-rules.json` to:

**Adjust Path Patterns:**
```json
{
  "pathPatterns": [
    "src/**/*.ts",        // All TypeScript in src/
    "plugins/**/index.ts" // Plugin entry points
  ]
}
```

**Add Keywords:**
```json
{
  "keywords": [
    "typescript",
    "refactor",
    "implement"
  ]
}
```

**Set Priority:**
```json
{
  "priority": 20  // Higher = suggested first
}
```

**Global Settings:**
```json
{
  "globalSettings": {
    "maxSuggestions": 3,           // Show max 3 skills
    "suggestionThreshold": 0.5,    // Matching threshold
    "caseSensitive": false         // Case-insensitive keywords
  }
}
```

---

## Benefits

### For Development

1. **Consistent Coding Standards**: cluster-dev-guidelines ensures consistent TypeScript patterns
2. **Faster Onboarding**: New contributors can reference comprehensive guidelines
3. **Better Architecture**: architecture-review agent catches design issues early
4. **Safer Refactoring**: refactoring-assistant provides proven patterns
5. **Higher Test Coverage**: test-generator creates comprehensive test suites

### For Claude Code

1. **Context Awareness**: Skills and hooks provide relevant information automatically
2. **Better Suggestions**: Claude Code knows project-specific patterns
3. **Reduced Repetition**: Guidelines are referenced, not restated each time
4. **Specialized Expertise**: Agents provide focused assistance for specific tasks

---

## Examples

### Example 1: Implementing a New Feature

```bash
# 1. Start working on a new feature
vim src/llm/providers/ollama.ts

# 2. Submit a prompt
> "Help me add Ollama provider support"

# 3. Auto-suggestion appears
💡 Suggested Skills for this task:
  • cluster-dev-guidelines
    TypeScript/Node.js development patterns

# 4. Skill is activated (auto or manually)
# 5. Claude Code provides implementation following guidelines
# 6. File modifications are tracked
📝 File Modified:
   Path: src/llm/providers/ollama.ts
   Type: TypeScript
   Action: Write
```

### Example 2: Refactoring Existing Code

```bash
# 1. Request refactoring help
> "This KubectlClient class is too large, help me refactor it"

# 2. Claude Code uses refactoring-assistant agent
# 3. Agent analyzes code and suggests:
#    - Extract method patterns
#    - Separate concerns
#    - Improve testability

# 4. Provides specific refactoring examples
# 5. Tracks all file changes during refactoring
```

### Example 3: Generating Tests

```bash
# 1. Request test generation
> "Generate tests for the LLMClient class"

# 2. Claude Code uses test-generator agent
# 3. Agent creates comprehensive Jest tests:
#    - Unit tests for each method
#    - Mocks for LLM providers
#    - Edge case coverage
#    - Integration test examples

# 4. Tests follow cluster-code testing patterns
```

---

## Maintenance

### Updating Skills

Skills should be updated as:
- TypeScript/Node.js versions change
- New patterns emerge
- Team standards evolve

Update frequency: Quarterly or as needed

### Monitoring Hook Performance

Check hook execution time:
```bash
# Add timing to hooks
time .claude/hooks/skill-activation-prompt.sh < input.txt
```

If hooks are slow (>500ms), optimize:
- Simplify pattern matching
- Cache results
- Reduce file I/O

### Log Files

**File Tracker Log:**
```bash
# View recent file modifications
tail -n 50 .claude/.file-tracker/modified-files.log
```

**Clean Up Logs:**
```bash
# Logs are auto-trimmed to last 1000 lines
# Manual cleanup if needed:
echo "# File Modification Tracker" > .claude/.file-tracker/modified-files.log
```

---

## Troubleshooting

### Skills Not Activating

**Check skill file exists:**
```bash
ls -la .claude/skills/
```

**Verify skill-rules.json syntax:**
```bash
cat .claude/skill-rules.json | jq .
```

**Test hook manually:**
```bash
echo "typescript development" | .claude/hooks/skill-activation-prompt.sh
```

### Hooks Not Running

**Check permissions:**
```bash
ls -la .claude/hooks/
# Should show: -rwxr-xr-x
```

**Make executable:**
```bash
chmod +x .claude/hooks/*.sh
```

**Test hook:**
```bash
bash -x .claude/hooks/skill-activation-prompt.sh
```

### Agents Not Working

**Verify agent files:**
```bash
ls -la .claude/agents/
```

**Check agent syntax:**
```bash
# Agents are markdown - verify headers
head -n 10 .claude/agents/architecture-review.md
```

---

## Best Practices

### For Skills

1. **Keep Focused**: Each skill should cover one domain
2. **Include Examples**: Show code examples for all patterns
3. **Stay Current**: Update with latest TypeScript/Node.js features
4. **Be Specific**: Tailor to cluster-code's tech stack

### For Hooks

1. **Keep Fast**: Hooks should execute in <500ms
2. **Handle Errors**: Use `set -euo pipefail`
3. **Be Silent**: Only output when there's something useful to say
4. **Test Thoroughly**: Test with various inputs

### For Agents

1. **Provide Context**: Explain reasoning behind recommendations
2. **Show Examples**: Include before/after code samples
3. **Be Actionable**: Give specific steps, not vague advice
4. **Stay Relevant**: Focus on cluster-code's needs

---

## Resources

- **Infrastructure Showcase**: https://github.com/diet103/claude-code-infrastructure-showcase
- **Integration Guide**: https://github.com/diet103/claude-code-infrastructure-showcase/blob/main/CLAUDE_INTEGRATION_GUIDE.md
- **Claude Code Docs**: https://docs.claude.com/docs/claude-code
- **Skills Documentation**: https://docs.claude.com/docs/claude-code/skills
- **Hooks Documentation**: https://docs.claude.com/docs/claude-code/hooks

---

## Summary

This integration brings production-tested infrastructure patterns to cluster-code:

✅ **2 Skills** for development guidelines and skill creation
✅ **2 Hooks** for auto-activation and file tracking
✅ **3 New Agents** for architecture, refactoring, and testing
✅ **Auto-Activation** via skill-rules.json

These components work together to make Claude Code more effective and context-aware when working on cluster-code, providing better suggestions, maintaining consistency, and accelerating development.

For questions or issues, refer to the resources above or check the individual component files for detailed documentation.
