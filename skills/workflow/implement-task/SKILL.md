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

---

## Configuration

Read `$CURSOR_WORKFLOWS_REPO/constants.md` for Jira key pattern and artifact path conventions.

**Repo context:**
- Resolve the **target repo** once by matching CWD against repository `Local Path` entries in `constants.md`. All sub-commands inherit this context.
- Artifacts are managed in `$CURSOR_WORKFLOWS_REPO` (the **workflows repo**). Code changes, git operations, and verification happen in the **target repo**.

---

## Tracking

`STARTED` and `COMPLETED`/`FAILED` for the orchestrator are logged automatically by hooks (`beforeSubmitPrompt` / `stop`).

For each sub-step, log start and end via Shell since the hooks only fire for the top-level command:

```bash
$CURSOR_WORKFLOWS_REPO/hooks/log.sh {STORY-ID} {STEP} {EVENT} orchestrator "{notes}"
```

---

## 0) Input validation (fail fast)

Validate the provided Jira key:
- Must match the key pattern from `constants.md` (e.g. `(PROJ|TEAM)-\d+`)

If missing/invalid, ask the user for the correct issue key and stop.

---

## 1) Research — Requirement Analysis

Execute the `/1-research {STORY-ID}` command (see `commands/1-research.md`).

This step:
- Fetches Jira story details and acceptance criteria
- Scans the codebase for structural context
- Resolves any AC ambiguities with the user
- Writes the requirements artifact to `artifacts/{STORY-ID}/YYYY-MM-DD-requirements.md`

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
- Writes the plan artifact to `artifacts/{STORY-ID}/YYYY-MM-DD-plan.md`

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
- Writes the review artifact to `artifacts/{STORY-ID}/YYYY-MM-DD-review.md`

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

**After completion:** Output the PR URL to the user.
