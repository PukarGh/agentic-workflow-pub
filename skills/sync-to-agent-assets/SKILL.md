---
name: sync-to-agent-assets
description: Sync this repository's contents to the people/PukarGh folder in the your-org/Agent-Assets GitHub repo. Use when the user asks to sync, push to Agent-Assets, or update the shared repo.
---

# Sync to Agent-Assets

Copies all contents from this repo (`agentic-workflow`) into the `people/PukarGh/` folder of the `your-org/Agent-Assets` repo, commits, and pushes.

## Prerequisites

- SSH or HTTPS access to `git@github.com:your-org/Agent-Assets.git`
- The current repo must have a clean or committed working tree (warn the user if there are uncommitted changes)

## Workflow

### Step 1: Check for uncommitted changes

Run `git status` in this repo. If there are uncommitted changes, **stop and warn the user**. Only sync committed state.

### Step 2: Clone or update Agent-Assets

Use a persistent local clone at `~/.cursor/cache/agent-assets` to avoid re-cloning every time.

```bash
CACHE_DIR="$HOME/.cursor/cache/agent-assets"

if [ -d "$CACHE_DIR/.git" ]; then
  cd "$CACHE_DIR" && git fetch origin && git checkout main && git reset --hard origin/main
else
  mkdir -p "$HOME/.cursor/cache"
  git clone git@github.com:your-org/Agent-Assets.git "$CACHE_DIR"
  cd "$CACHE_DIR"
fi
```

### Step 3: Sync files

Clear the target folder and copy everything from this repo, excluding `.git`, `.DS_Store`, and any other git-internal files.

```bash
TARGET_DIR="$CACHE_DIR/people/PukarGh"
SOURCE_DIR="$HOME/agentic-workflow"

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

rsync -a --exclude='.git' --exclude='.DS_Store' "$SOURCE_DIR/" "$TARGET_DIR/"
```

### Step 4: Commit and push

```bash
cd "$CACHE_DIR"
git add -A
git diff --cached --quiet && echo "Nothing to sync — Agent-Assets is already up to date." && exit 0
git commit -m "sync: update people/PukarGh from agentic-workflow"
git push origin main
```

### Step 5: Confirm

Report the commit hash and confirm the push succeeded. If the push fails (e.g., due to conflicts), inform the user and suggest pulling first.

## Important Notes

- **Never force push** to Agent-Assets.
- If the push is rejected, pull with rebase and retry once. If it still fails, stop and notify the user.
- The `.git` directory of this repo must **never** be copied into Agent-Assets.
