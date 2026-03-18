---
name: implement-task
description: Implement Jira Story — Orchestrator
disable-model-invocation: true
---

# Implement Jira Story — Orchestrator

End-to-end orchestrator that chains requirement analysis, planning, implementation, and PR creation for a Jira story. Each step is a standalone command that can also be invoked individually.

---

## Usage

- `/implement-task PROJ-123`
- `/implement-task` (omit story ID to auto-detect from the current branch name)

---

## Configuration

Read `$HOME/agentic-workflow/constants.md` for Jira key pattern and artifact path conventions.

**Repo context:**
- Resolve the **target repo** once by matching CWD against repository `Local Path` entries in `constants.md`. All sub-commands inherit this context.
- Artifacts are managed in `$HOME/agentic-workflow` (the **workflows repo**). Code changes, git operations, and verification happen in the **target repo**.

---

## Tracking

`STARTED` and `COMPLETED`/`FAILED` for the orchestrator are logged automatically by hooks (`beforeSubmitPrompt` / `stop`).

For each sub-step, log start and end via Shell since the hooks only fire for the top-level command:

```bash
$HOME/agentic-workflow/hooks/log.sh {STORY-ID} {STEP} {EVENT} orchestrator "{notes}"
```

---

## 0) Input validation (fail fast)

### 0.1 Resolve story ID

If a Jira key was provided as an argument, use it directly.

If **no** Jira key was provided, attempt to extract it from the current git branch name:

```bash
currentBranch=$(git rev-parse --abbrev-ref HEAD)
```

Match the branch name against the key pattern from `constants.md` (e.g. `(PROJ|TEAM)-\d+`). Use the first match as the story ID.

If extraction fails (branch doesn't contain a recognizable key), ask the user for the correct issue key and stop.

### 0.2 Validate key format

Validate the resolved Jira key:
- Must match the key pattern from `constants.md` (e.g. `(PROJ|TEAM)-\d+`)

If invalid, ask the user for the correct issue key and stop.

---

## 1) Research — Requirement Analysis

Execute the `/1-research {STORY-ID}` command (see `commands/1-research.md`).

This step:
- Fetches Jira story details and acceptance criteria
- Scans the codebase for structural context
- Resolves any AC ambiguities with the user
- Writes the requirements artifact (see `constants.md` → **Artifacts** for the naming convention)

**After completion:** Verify the requirements artifact was written. If any ambiguities required user input during research, confirm they have been resolved before proceeding.

---

## 2) Plan — Standards-Compliant Design

Execute the `/2-plan {STORY-ID}` command (see `commands/2-plan.md`).

This step:
- Loads the requirements artifact
- Reads repo rules from `constants.md`
- Drafts an implementation plan
- Runs verification gates (AC mapping, code quality, security)
- Iterates until all gates pass
- Writes the plan artifact (see `constants.md` → **Artifacts** for the naming convention)

**After completion:** Present the verified plan to the user and **STOP**.

> "Plan verified — all gates passed. Do you want me to implement this plan now?"

- If the user says **no** or asks for changes → stop and wait for further instructions.
- If the user says **yes** → proceed to step 3.

---

## 3) Implement — Execute Verified Plan

Execute the `/3-implement {STORY-ID}` command (see `commands/3-implement.md`).

This step:
- Manages the feature branch
- Extracts Figma designs (if available)
- Implements each AC item in plan order
- Writes tests
- Runs verification (type-check, lint, tests)

**After completion:** Present the implementation summary to the user.

> "All AC items implemented and verified. Ready to review?"

- If the user says **no** → stop and wait for further instructions.
- If the user says **yes** → proceed to step 4.

---

## 4) Review — Pre-PR Code Review

Execute the `/4-review {STORY-ID}` command (see `skills/workflow/4-review/SKILL.md`).

This step:
- Launches parallel review subagents (pre-PR rule check, Coderabbit, tech-lead review)
- Performs a self-review pass
- Synthesizes findings into a unified verdict
- Writes the review artifact (see `constants.md` → **Artifacts** for the naming convention)

**After completion:** Present the review verdict to the user.

- If verdict is **READY FOR PR** → proceed to step 5.
- If verdict is **NEEDS ATTENTION** → ask the user whether to proceed or fix issues first.
  - If the user wants to proceed → continue to step 5.
  - If the user wants to fix → stop and wait for further instructions. After fixes, re-run `/4-review {STORY-ID}`.
- If verdict is **NOT READY** → stop and instruct the user to fix critical issues and re-run `/4-review {STORY-ID}`.

---

## 5) Push and PR

Execute the `/5-push-pr` command (see `skills/workflow/5-push-pr/SKILL.md`).

This step:
- Validates the branch name
- Checks for uncommitted changes
- Pushes the branch to origin
- Creates a GitHub PR with Jira context and plan details

**After completion:** Output the PR URL to the user, then **automatically proceed to step 6**.

---

## 6) Work Summary

Execute the `/6-work-summary {STORY-ID}` command (see `skills/workflow/6-work-summary/SKILL.md`).

This step runs **automatically** after the PR is created — no user prompt needed to start it.

This step:
- Fetches Jira story details and loads artifacts (requirements, plan, review)
- Gathers git context (diff, changed files, commit history)
- Generates a structured work summary based on issue type (Bug, Feature, Spike, Task)
- Presents the summary to the user for verification
- Posts the approved summary as a comment on the Jira ticket

**After completion:** Confirm the work summary has been posted to Jira.
