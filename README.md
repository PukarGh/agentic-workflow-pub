# Agentic Workflow

Personal Cursor agentic workflow files: commands, skills, hooks, and auto-committed artifacts.

## Structure

- `commands/` — Global slash commands (symlinked to `~/.cursor/commands`)
- `skills/` — Agent skills (symlinked to `~/.cursor/skills-cursor`)
- `hooks/` — Hook scripts (symlinked to `~/.cursor/hooks`)
- `hooks.json` — Hook configuration (symlinked to `~/.cursor/hooks.json`)
- `constants.md` — Central configuration (repos, Jira, GitHub, rules paths)
- `artifacts/` — Requirements and plan artifacts, organized by story ID
- `plans/` — Implementation plans auto-committed by agent sessions (legacy)

## Commands

| Command | File | Description |
|---------|------|-------------|
| `/implement-task` | `commands/implement-task.md` | Orchestrator — chains all steps end-to-end |
| `/1-research` | `commands/1-research.md` | Requirement analysis — Jira fetch + codebase scan |
| `/2-plan` | `commands/2-plan.md` | Implementation planning with standards verification |
| `/3-implement` | `commands/3-implement.md` | Execute a verified plan (branch, code, tests) |
| `/4-push-pr` | `commands/4-push-pr.md` | Push branch and create GitHub PR |
| `/github-pr` | `commands/github-pr.md` | Legacy PR command (use `/4-push-pr` instead) |

## Workflow

Each command can be invoked standalone or chained via the orchestrator:

```
/1-research PROJ-123      →  artifacts/{STORY-ID}/YYYY-MM-DD-1-requirements.md
/2-plan PROJ-123          →  artifacts/{STORY-ID}/YYYY-MM-DD-2-plan.md
/3-implement PROJ-123     →  code changes (no commit)
/4-push-pr               →  push + GitHub PR
/6-work-summary PROJ-123  →  work summary posted to Jira (auto-runs after push-pr)
```

Or run everything at once: `/implement-task PROJ-123`

## Setup

Create symlinks using absolute paths:

```bash
ln -sf $HOME/agentic-workflow/commands ~/.cursor/commands
ln -sf $HOME/agentic-workflow/skills ~/.cursor/skills-cursor
ln -sf $HOME/agentic-workflow/hooks ~/.cursor/hooks
ln -sf $HOME/agentic-workflow/hooks.json ~/.cursor/hooks.json
```
