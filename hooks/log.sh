#!/bin/bash
set -uo pipefail

WORKFLOWS_REPO="${CURSOR_WORKFLOWS_REPO:-$HOME/agentic-workflow}"

STORY_ID="${1:-}"
STEP="${2:-}"
EVENT="${3:-}"
INVOKED_VIA="${4:-standalone}"
NOTES="${5:-}"

if [[ -z "$STORY_ID" || -z "$STEP" || -z "$EVENT" ]]; then
  echo "Usage: log.sh <STORY-ID> <STEP> <EVENT> [INVOKED_VIA] [NOTES]" >&2
  exit 1
fi

EXISTING_DIR=$(find "$WORKFLOWS_REPO/artifacts" -maxdepth 1 -type d -name "${STORY_ID}*" | head -1)
TRACKING_DIR="${EXISTING_DIR:-$WORKFLOWS_REPO/artifacts/$STORY_ID}"
TRACKING_FILE="$TRACKING_DIR/tracking.md"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S')

mkdir -p "$TRACKING_DIR"

if [[ ! -f "$TRACKING_FILE" ]]; then
  cat > "$TRACKING_FILE" <<EOF
# Workflow Tracking: $STORY_ID

| Timestamp (UTC) | Step | Event | Invoked Via | Notes |
|-----------------|------|-------|-------------|-------|
EOF
fi

echo "| $TIMESTAMP | $STEP | $EVENT | $INVOKED_VIA | $NOTES |" >> "$TRACKING_FILE"
