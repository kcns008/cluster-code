#!/bin/bash

# Skill Activation Prompt Hook
# Hook Type: UserPromptSubmit
# Purpose: Analyzes user input and current file context to suggest relevant skills
# Auto-activates skills based on keywords and file patterns defined in skill-rules.json

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$(dirname "$SCRIPT_DIR")"
SKILL_RULES="$CLAUDE_DIR/skill-rules.json"
SKILLS_DIR="$CLAUDE_DIR/skills"

# Check if skill-rules.json exists
if [[ ! -f "$SKILL_RULES" ]]; then
  # No skill rules defined, exit silently
  exit 0
fi

# Read user input from stdin (passed by Claude Code)
USER_INPUT=$(cat)

# Get current file path from environment variable (if available)
CURRENT_FILE="${CLAUDE_CURRENT_FILE:-}"

# Initialize suggestions array
SUGGESTIONS=()

# Function to check if a keyword matches user input
matches_keyword() {
  local keyword="$1"
  local input="$2"
  echo "$input" | grep -iq "$keyword"
}

# Function to check if current file matches a path pattern
matches_path() {
  local pattern="$1"
  local file="$2"

  if [[ -z "$file" ]]; then
    return 1
  fi

  # Convert glob pattern to regex (simple conversion)
  # ** -> .* and * -> [^/]*
  local regex="${pattern//\*\*/.*}"
  regex="${regex//\*/[^/]*}"

  echo "$file" | grep -q "$regex"
}

# Parse skill-rules.json and check each skill
if command -v jq &> /dev/null; then
  # Use jq if available for better JSON parsing
  SKILL_COUNT=$(jq '.skills | length' "$SKILL_RULES")

  for ((i=0; i<SKILL_COUNT; i++)); do
    SKILL_NAME=$(jq -r ".skills[$i].name" "$SKILL_RULES")
    SKILL_DESC=$(jq -r ".skills[$i].description" "$SKILL_RULES")

    # Check if skill file exists
    SKILL_FILE="$SKILLS_DIR/${SKILL_NAME}.md"
    if [[ ! -f "$SKILL_FILE" ]]; then
      continue
    fi

    MATCHED=false

    # Check keywords
    KEYWORD_COUNT=$(jq ".skills[$i].keywords | length" "$SKILL_RULES" 2>/dev/null || echo "0")
    for ((j=0; j<KEYWORD_COUNT; j++)); do
      KEYWORD=$(jq -r ".skills[$i].keywords[$j]" "$SKILL_RULES")
      if matches_keyword "$KEYWORD" "$USER_INPUT"; then
        MATCHED=true
        break
      fi
    done

    # Check path patterns if we have a current file
    if [[ -n "$CURRENT_FILE" ]] && [[ "$MATCHED" == "false" ]]; then
      PATTERN_COUNT=$(jq ".skills[$i].pathPatterns | length" "$SKILL_RULES" 2>/dev/null || echo "0")
      for ((k=0; k<PATTERN_COUNT; k++)); do
        PATTERN=$(jq -r ".skills[$i].pathPatterns[$k]" "$SKILL_RULES")
        if matches_path "$PATTERN" "$CURRENT_FILE"; then
          MATCHED=true
          break
        fi
      done
    fi

    # Add to suggestions if matched
    if [[ "$MATCHED" == "true" ]]; then
      SUGGESTIONS+=("$SKILL_NAME: $SKILL_DESC")
    fi
  done
else
  # Fallback: simple grep-based parsing if jq is not available
  # This is less robust but works for basic cases

  # Check for cluster-dev-guidelines
  if echo "$USER_INPUT" | grep -iq -E "(typescript|node\.js|development|coding|implement|refactor|plugin)"; then
    if [[ -f "$SKILLS_DIR/cluster-dev-guidelines.md" ]]; then
      SUGGESTIONS+=("cluster-dev-guidelines: TypeScript/Node.js development patterns for cluster-code")
    fi
  fi

  # Check for skill-developer
  if echo "$USER_INPUT" | grep -iq -E "(create.*skill|new.*skill|skill.*development)"; then
    if [[ -f "$SKILLS_DIR/skill-developer.md" ]]; then
      SUGGESTIONS+=("skill-developer: Meta-skill for creating new Claude Code skills")
    fi
  fi

  # Check current file patterns
  if [[ -n "$CURRENT_FILE" ]]; then
    case "$CURRENT_FILE" in
      */src/*.ts|*/plugins/*.ts)
        if [[ -f "$SKILLS_DIR/cluster-dev-guidelines.md" ]]; then
          SUGGESTIONS+=("cluster-dev-guidelines: TypeScript development patterns")
        fi
        ;;
      */.claude/skills/*.md)
        if [[ -f "$SKILLS_DIR/skill-developer.md" ]]; then
          SUGGESTIONS+=("skill-developer: Skill development guide")
        fi
        ;;
    esac
  fi
fi

# Output suggestions if any were found
if [[ ${#SUGGESTIONS[@]} -gt 0 ]]; then
  echo ""
  echo "💡 Suggested Skills for this task:"
  echo ""

  for suggestion in "${SUGGESTIONS[@]}"; do
    SKILL_NAME="${suggestion%%:*}"
    SKILL_DESC="${suggestion#*: }"
    echo "  • $SKILL_NAME"
    echo "    $SKILL_DESC"
    echo ""
  done

  echo "To activate a skill, use: /skill $SKILL_NAME"
  echo ""
fi

exit 0
