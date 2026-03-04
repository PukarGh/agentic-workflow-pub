#!/bin/bash
set -uo pipefail

WORKFLOWS_REPO="${CURSOR_WORKFLOWS_REPO:-$HOME/agentic-workflow}"
STATE_FILE="$WORKFLOWS_REPO/.tracking-state"

input=$(cat)

if ! command -v jq &>/dev/null; then
  echo '{"continue":true}'
  exit 0
fi

prompt=$(echo "$input" | jq -r '.prompt // empty')

if [[ -z "$prompt" ]]; then
  echo '{"continue":true}'
  exit 0
fi

command_name=""

if echo "$prompt" | grep -q "Research Jira Story"; then
  command_name="1-research"
elif echo "$prompt" | grep -q "Plan Implementation"; then
  command_name="2-plan"
elif echo "$prompt" | grep -q "Implement Plan"; then
  command_name="3-implement"
elif echo "$prompt" | grep -q "Push and Create Pull Request"; then
  command_name="4-push-pr"
elif echo "$prompt" | grep -q "Implement Jira Story — Orchestrator"; then
  command_name="implement-task"
fi

if [[ -z "$command_name" ]]; then
  echo '{"continue":true}'
  exit 0
fi

story_id=$(echo "$prompt" | grep -oE '(PROJ|TEAM)-[0-9]+' | head -1)

if [[ -z "$story_id" ]]; then
  echo '{"continue":true}'
  exit 0
fi

invoked_via="standalone"
echo "${command_name}|${story_id}|${invoked_via}" > "$STATE_FILE"

"$WORKFLOWS_REPO/hooks/log.sh" "$story_id" "$command_name" "STARTED" "$invoked_via" 2>/dev/null || true

echo '{"continue":true}'
exit 0
