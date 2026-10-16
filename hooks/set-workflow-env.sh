#!/bin/bash
set -euo pipefail

cat > /dev/null
WORKFLOWS_REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
echo "{\"env\":{\"CURSOR_WORKFLOWS_REPO\":\"$WORKFLOWS_REPO\"},\"continue\":true}"
