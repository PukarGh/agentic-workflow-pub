# Agentic Workflow

Personal Cursor agentic workflow files: commands, skills, hooks, and auto-committed plans.

## Structure

- `commands/` — Global slash commands (symlinked to `~/.cursor/commands`)
- `skills/` — Agent skills (symlinked to `~/.cursor/skills-cursor`)
- `hooks/` — Hook scripts (symlinked to `~/.cursor/hooks`)
- `hooks.json` — Hook configuration (symlinked to `~/.cursor/hooks.json`)
- `plans/` — Implementation plans auto-committed by agent sessions

## Setup

Create symlinks using absolute paths:

```bash
ln -sf $HOME/agentic-workflow/commands ~/.cursor/commands
ln -sf $HOME/agentic-workflow/skills ~/.cursor/skills-cursor
ln -sf $HOME/agentic-workflow/hooks ~/.cursor/hooks
ln -sf $HOME/agentic-workflow/hooks.json ~/.cursor/hooks.json
```
