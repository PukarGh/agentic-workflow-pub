---
name: 4-review
description: Review Implementation — Pre-PR Code Review
disable-model-invocation: true
---

# Review Implementation — Pre-PR Code Review

Conduct a thorough automated and rule-based code review on the current feature branch before creating a PR. Launches parallel review subagents (pre-PR rule check, Coderabbit, tech-lead review), synthesizes findings, and produces a unified verdict.

---

## Usage

- `/4-review PROJ-123`
- `/4-review` (omit story ID to auto-detect from the current branch name)

---

## Configuration

Read `$HOME/agentic-workflow/constants.md` for:

- Active repository config (rules paths, verification command paths, base branch)
- Artifact path conventions
- Jira cloud ID and key pattern

**Repo context:**

- Resolve the **target repo** from CWD. All git operations (`git diff`, `git log`) and review commands run in the **target repo** on the current feature branch.
- Artifacts are read from and written to `$HOME/agentic-workflow/artifacts/...` (the **workflows repo**).
- Rules files referenced via `constants.md` are resolved relative to the **target repo root**.

---

## Tracking

`STARTED` and `COMPLETED`/`FAILED` are logged automatically by hooks for standalone invocations. For orchestrator sub-steps or mid-step events, call the log script via Shell:

```bash
$HOME/agentic-workflow/hooks/log.sh {STORY-ID} 4-review {EVENT} {invoked_via} "{notes}"
```

- If stopping for user action: log `WAITING_FOR_USER` with note describing the block reason
- On resuming after user input: log `RESUMED`

---

## 0) Input validation and setup

### 0.1 Resolve and validate story ID

If a Jira key was provided as an argument, use it directly.

If **no** Jira key was provided, attempt to extract it from the current git branch name:

```bash
currentBranch=$(git rev-parse --abbrev-ref HEAD)
```

Match the branch name against the key pattern from `constants.md` (e.g. `(PROJ|TEAM)-\d+`). Use the first match as the story ID.

If extraction fails (branch doesn't contain a recognizable key), ask the user for the correct issue key and stop.

Validate the resolved key matches the key pattern. If invalid, ask the user for the correct issue key and stop.

### 0.2 Validate branch

```bash
currentBranch=$(git rev-parse --abbrev-ref HEAD)
```

The branch name **must** contain the provided Jira key (case-insensitive). If the current branch does not match the story being reviewed, **STOP** and instruct the user to switch to the correct feature branch.

### 0.3 Check for prior artifacts

Look for existing artifacts at:

```
$HOME/agentic-workflow/artifacts/{STORY-ID}-*/
```

If no artifact directory exists for this story, warn the user but continue — the review can still proceed against the branch diff.

If a prior review artifact exists (`YYYY-MM-DD-review.md`), read it to determine the current `review_cycle` count. Increment from the last cycle.

### 0.4 Determine base branch

Read the base branch from `constants.md` for the active repository.

```bash
base=$(git rev-parse --verify origin/{BASE_BRANCH} >/dev/null 2>&1 && echo origin/{BASE_BRANCH} || echo origin/main)
```

### 0.5 Validate changeset exists

```bash
changedFiles=$(git diff --name-only "$base"...HEAD 2>/dev/null || true)
```

If no changed files exist relative to the base branch, **STOP**:

> "No changes found on this branch relative to `{BASE_BRANCH}`. Nothing to review."

---

## 1) Launch parallel review subagents

In a **single message**, launch the following three subagents in parallel using the Task tool. All three are read-only and analyze the same changeset independently. **Do not proceed to Step 2 until all three subagents have returned.**

### Subagent A — Pre-PR Review Command

- **Type**: `generalPurpose`
- **Readonly**: `true`
- **Pass to subagent**:
  - Target repo path (resolved from `constants.md`)
  - Base branch for diffing
  - Jira key and cloudId from `constants.md`
  - Pre-PR Review command path from `constants.md` (e.g. `.cursor/commands/pre-pr-review.md`)
  - All cursor rules file paths from `constants.md` for the active repo
- **Task**: From the target repo directory, read the **Pre-PR Review command** file (path from `constants.md`, resolved relative to the target repo root) in full. This command file defines the structured review checklist — execute **every** sub-step it specifies. Additionally, run `git diff {base}...HEAD`, `git diff {base}...HEAD --stat`, `git diff {base}...HEAD --name-only`, and `git log --oneline {base}..HEAD`. Read all cursor rules files listed in `constants.md` for the active repo. Fetch the Jira ticket via Atlassian MCP and extract acceptance criteria. The pre-PR review command drives the review.

  Do NOT skip steps because a change seems small. Return all findings as a table (severity 🔴/🟡/🔵, issue, file:line, recommendation), a count per severity, and a verdict (READY FOR PR / NEEDS ATTENTION / NOT READY).

### Subagent B — Coderabbit Review

- **Type**: `generalPurpose`
- **Readonly**: `true`
- **Pass to subagent**:
  - Target repo path (resolved from `constants.md`)
  - Base branch for diffing
- **Task**: From the target repo directory, run `coderabbit review --plain --base {BASE_BRANCH}`. The `--plain` flag is **required** — the default TUI requires TTY which is unavailable. With `--plain`, all review output is written directly to stdout. Capture the full stdout output and parse it for review comments (file, line, severity, message). Return: (1) the full raw stdout output from the `coderabbit` command, (2) all parsed comments — or "Coderabbit: No issues found" if the output contains no issues. If the `coderabbit` command is not installed or fails, return the full error output and note the failure — do not block the review.

### Subagent C — Tech Lead Review

- **Type**: `generalPurpose`
- **Readonly**: `true`
- **Pass to subagent**:
  - Target repo path (resolved from `constants.md`)
  - Base branch for diffing
  - Jira key
  - All cursor rules file paths from `constants.md` for the active repo
  - All verification command paths from `constants.md` for the active repo
- **Task**: Perform a comprehensive tech lead review of the changeset. From the target repo directory, run `git diff {base}...HEAD` and `git log --oneline {base}..HEAD`. Read all cursor rules and verification commands from the provided paths. Execute:
  - **Changeset classification** — categorize changes (feature, bugfix, refactor, config, test)
  - **Security analysis** — OWASP Top 10 relevant checks, input validation, auth guards, sensitive data exposure
  - **Architecture review** — API layering (controllers → services → repositories), MFE boundaries, shared package impact
  - **Code quality** — TypeScript strictness (no `any`, `@ts-ignore`, `@ts-nocheck`), business logic extraction, error handling
  - **Cross-system impact** — shared types/utils consumer impact, event system changes, breaking changes
  - **Testing adequacy** — coverage of happy path, edge cases, error conditions per testing standards

  Return: Risk Assessment table, all section findings, Action Items (Must Fix / Should Fix / Consider / Nice to Have), and final Verdict (APPROVE / APPROVE WITH CONDITIONS / REQUEST CHANGES / BLOCK).

---

## 2) Synthesize results and self-review

Once all three subagents have returned, synthesize findings and produce the unified verdict.

### 2.1 Self-review pass

Before producing a verdict, perform a manual self-review:

- Re-read the diff and confirm no issues were missed by the automated tools.
- Check for obvious problems: typos, leftover debug code, TODO comments, `console.log` statements, commented-out code.
- Note any additional findings or confirm "No additional issues found".

### 2.2 Map tech lead severity to unified scale

- 🔴 Must Fix (Blocking) / BLOCK verdict → 🔴 Critical
- 🟠 Should Fix (Before Merge) / REQUEST CHANGES → 🔴 Critical
- 🟡 Consider (Non-Blocking) → 🟡 Warning
- 🟢 Nice to Have → 🔵 Info

### 2.3 Determine unified verdict

- **READY FOR PR**: Pre-PR review is READY, Coderabbit has no blocking issues, tech lead verdict is APPROVE, self-review found no additional issues.
- **NEEDS ATTENTION**: Only 🟡 warnings exist (no 🔴 criticals), Coderabbit has minor feedback, tech lead verdict is APPROVE or APPROVE WITH CONDITIONS.
- **NOT READY**: Any 🔴 critical issues exist, OR Coderabbit raised blocking issues, OR tech lead verdict is REQUEST CHANGES or BLOCK.

---

## 3) Write review artifact

Determine the artifact directory (use the first directory matching `{STORY-ID}*` under `artifacts/`).

**Before writing**, check if a `*-review*.md` file already exists in the directory. If it does, **do not overwrite or modify it**. Instead, create a new file with a ` - pass N` suffix (see `constants.md` → Multi-pass naming for the convention).

Write the review results to:

```
YYYY-MM-DD-review.md            ← first pass (no existing file)
YYYY-MM-DD-review - pass 2.md   ← second pass
YYYY-MM-DD-review - pass 3.md   ← third pass, etc.
```

The artifact must contain:

### Review metadata

```
| Field        | Value                |
|--------------|----------------------|
| Story        | {STORY-ID}           |
| Branch       | {currentBranch}      |
| Base         | {BASE_BRANCH}        |
| Review Cycle | {n}                  |
| Verdict      | {unified verdict}    |
| Date         | {YYYY-MM-DD}         |
```

### Summary Table

```
| Source           | 🔴 Critical | 🟡 Warning | 🔵 Info |
|:-----------------|:-----------:|:----------:|:-------:|
| Pre-PR Review    | X           | X          | X       |
| Coderabbit       | X           | X          | X       |
| Tech Lead Review | X           | X          | X       |
| Self-Review      | X           | X          | X       |
```

### Pre-PR Review Findings

All findings from Subagent A, grouped by severity (🔴 first), with a Resolution Tracking table:

```
| #   | Severity | Issue              | File:Line             | Recommendation | Resolution |
|:----|:---------|:-------------------|:----------------------|:---------------|:-----------|
| 1   | 🔴       | Missing null check | utils.ts:42           | Add guard      | Pending    |
| 2   | 🟡       | Missing JSDoc      | FuelInfo.utils.ts:125 | Add docs       | Pending    |
```

Include the diff `--stat` output and commit list for context.

### Coderabbit Review

Raw terminal output from Subagent B, then parsed comment list (file, line, severity, message). Note "Coderabbit: No issues found" if empty. If Coderabbit was unavailable, note "Coderabbit: Not available — {reason}".

### Tech Lead Review

Verdict, Risk Assessment table, and all action items mapped to the unified severity scale.

### Self-Review

Manual review notes listing any additional issues or confirming "No additional issues found".

### Decisions

For any 🟡 Warning intentionally not fixed (e.g., accepted as-is), document the rationale.

---

## 4) Output and next steps

Based on the unified verdict:

### READY FOR PR

Output to the user:

> "Review passed — all checks clean. Saved to `artifacts/{STORY-ID}/YYYY-MM-DD-review.md`. Ready to push and create a PR? Run `/5-push-pr` to proceed."

### NEEDS ATTENTION

Output to the user:

> "Review has warnings — no critical issues. Saved to `artifacts/{STORY-ID}/YYYY-MM-DD-review.md`. Review the warnings and decide: proceed with `/5-push-pr` or address issues first."

### NOT READY

Output to the user:

> "Review found critical issues that must be resolved. Saved to `artifacts/{STORY-ID}/YYYY-MM-DD-review.md`. Fix the 🔴 critical issues and re-run `/4-review {STORY-ID}`."

Do NOT proceed to push/PR from this command.
