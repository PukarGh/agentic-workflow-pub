#!/bin/bash
set -uo pipefail

WORKFLOWS_REPO="${CURSOR_WORKFLOWS_REPO:-$HOME/agentic-workflow}"
input=$(cat)

if ! command -v jq &>/dev/null; then
  exit 0
fi

file_path=$(echo "$input" | jq -r '.file_path // empty')

if [[ -z "$file_path" ]]; then
  exit 0
fi

if [[ "$file_path" == "$WORKFLOWS_REPO/plans/"* ]]; then
  cd "$WORKFLOWS_REPO" || exit 0
  git add plans/
  if git diff --staged --quiet; then
    exit 0
  fi
  filename=$(basename "$file_path")
  git commit -m "Add/update plan: $filename" --no-verify
fi
exit 0
