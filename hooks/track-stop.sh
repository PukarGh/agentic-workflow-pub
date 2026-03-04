#!/bin/bash
set -uo pipefail

WORKFLOWS_REPO="${CURSOR_WORKFLOWS_REPO:-$HOME/agentic-workflow}"
STATE_FILE="$WORKFLOWS_REPO/.tracking-state"

input=$(cat)

if [[ ! -f "$STATE_FILE" ]]; then
  exit 0
fi

state=$(cat "$STATE_FILE")
rm -f "$STATE_FILE"

command_name=$(echo "$state" | cut -d'|' -f1)
story_id=$(echo "$state" | cut -d'|' -f2)
invoked_via=$(echo "$state" | cut -d'|' -f3)

if [[ -z "$command_name" || -z "$story_id" ]]; then
  exit 0
fi

status="COMPLETED"
if command -v jq &>/dev/null; then
  agent_status=$(echo "$input" | jq -r '.status // empty')
  if [[ "$agent_status" == "error" || "$agent_status" == "aborted" ]]; then
    status="FAILED"
  fi
fi

"$WORKFLOWS_REPO/hooks/log.sh" "$story_id" "$command_name" "$status" "$invoked_via" 2>/dev/null || true

exit 0
