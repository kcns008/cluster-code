#!/bin/bash

# Post Tool Use Tracker Hook
# Hook Type: PostToolUse
# Purpose: Tracks file modifications to help Claude Code maintain context
# Provides visibility into what files were changed during operations

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$(dirname "$SCRIPT_DIR")"
TRACKER_DIR="$CLAUDE_DIR/.file-tracker"
TRACKER_FILE="$TRACKER_DIR/modified-files.log"

# Create tracker directory if it doesn't exist
mkdir -p "$TRACKER_DIR"

# Initialize tracker file if it doesn't exist
if [[ ! -f "$TRACKER_FILE" ]]; then
  echo "# File Modification Tracker" > "$TRACKER_FILE"
  echo "# Tracks files modified during Claude Code operations" >> "$TRACKER_FILE"
  echo "" >> "$TRACKER_FILE"
fi

# Read tool information from environment variables (set by Claude Code)
TOOL_NAME="${CLAUDE_TOOL_NAME:-unknown}"
TOOL_FILE="${CLAUDE_TOOL_FILE:-}"
TOOL_ACTION="${CLAUDE_TOOL_ACTION:-}"

# Get current timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Track file modifications based on tool type
case "$TOOL_NAME" in
  "Write"|"Edit"|"NotebookEdit")
    if [[ -n "$TOOL_FILE" ]]; then
      # Get relative path from project root
      PROJECT_ROOT="$(cd "$CLAUDE_DIR/.." && pwd)"
      REL_PATH="${TOOL_FILE#$PROJECT_ROOT/}"

      # Log the modification
      echo "[$TIMESTAMP] $TOOL_NAME: $REL_PATH" >> "$TRACKER_FILE"

      # Determine file type for categorization
      FILE_EXT="${TOOL_FILE##*.}"
      case "$FILE_EXT" in
        ts|tsx)
          FILE_TYPE="TypeScript"
          ;;
        js|jsx)
          FILE_TYPE="JavaScript"
          ;;
        md)
          FILE_TYPE="Markdown"
          ;;
        json)
          FILE_TYPE="JSON"
          ;;
        yaml|yml)
          FILE_TYPE="YAML"
          ;;
        sh)
          FILE_TYPE="Shell Script"
          ;;
        *)
          FILE_TYPE="Other"
          ;;
      esac

      # Output summary for user (visible in Claude Code)
      echo ""
      echo "📝 File Modified:"
      echo "   Path: $REL_PATH"
      echo "   Type: $FILE_TYPE"
      echo "   Action: $TOOL_NAME"
      echo ""

      # If this is a TypeScript file, suggest running type check
      if [[ "$FILE_EXT" == "ts" ]] || [[ "$FILE_EXT" == "tsx" ]]; then
        # Count how many .ts files were modified recently (last 5 minutes)
        FIVE_MIN_AGO=$(date -d '5 minutes ago' '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v-5M '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "")

        if [[ -n "$FIVE_MIN_AGO" ]]; then
          TS_COUNT=$(grep -c "\.tsx\?$" "$TRACKER_FILE" 2>/dev/null || echo "0")

          # Suggest type check if multiple TypeScript files were modified
          if [[ "$TS_COUNT" -gt 3 ]]; then
            echo "💡 Tip: Multiple TypeScript files modified. Consider running:"
            echo "   npm run build"
            echo "   or"
            echo "   tsc --noEmit"
            echo ""
          fi
        fi
      fi

      # Check if we should suggest running tests
      if [[ "$REL_PATH" =~ src/ ]] && [[ ! "$REL_PATH" =~ \.test\. ]]; then
        echo "💡 Remember to update or add tests for your changes"
        echo ""
      fi
    fi
    ;;

  "Bash")
    # Track significant bash operations
    if [[ "$TOOL_ACTION" =~ (npm|yarn|build|test|lint) ]]; then
      echo "[$TIMESTAMP] Bash: $TOOL_ACTION" >> "$TRACKER_FILE"

      echo ""
      echo "🔧 Build/Test Command Executed:"
      echo "   $TOOL_ACTION"
      echo ""
    fi
    ;;

  *)
    # For other tools, just track the timestamp
    if [[ -n "$TOOL_FILE" ]]; then
      PROJECT_ROOT="$(cd "$CLAUDE_DIR/.." && pwd)"
      REL_PATH="${TOOL_FILE#$PROJECT_ROOT/}"
      echo "[$TIMESTAMP] $TOOL_NAME: $REL_PATH" >> "$TRACKER_FILE"
    fi
    ;;
esac

# Keep tracker file manageable (last 1000 lines)
TEMP_FILE=$(mktemp)
tail -n 1000 "$TRACKER_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$TRACKER_FILE"

# Exit successfully
exit 0
