---
name: 6-work-summary
description: Generate Work Summary for a completed Jira ticket documenting approach, decisions, and compromises. Use when the user wants to create a work summary, document completed work, or after pushing a PR.
disable-model-invocation: true
---

# Work Summary

Generate a Work Summary for a completed Jira ticket documenting approach, decisions, compromises, and any new patterns introduced — so future developers understand the full context beyond just the code.

---

## Usage

- `/6-work-summary PROJ-123`
- `/6-work-summary` (omit story ID to auto-detect from the current branch name)

This step runs automatically after `/5-push-pr` completes in the orchestrator flow.

---

## Configuration

Read `$HOME/agentic-workflow/constants.md` for:
- Jira cloud ID and key pattern
- Active repository context

**Repo context:**
- Resolve the **target repo** from CWD. All git operations run in the **target repo**.
- Artifacts are read from `$HOME/agentic-workflow/artifacts/...` (the **workflows repo**).

---

## Tracking

`STARTED` and `COMPLETED`/`FAILED` are logged automatically by hooks for standalone invocations. For orchestrator sub-steps or mid-step events, call the log script via Shell:

```bash
$HOME/agentic-workflow/hooks/log.sh {STORY-ID} 6-work-summary {EVENT} {invoked_via} "{notes}"
```

---

## 0) Resolve story ID

If a Jira key was provided as an argument, use it directly.

If **no** Jira key was provided, attempt to extract it from the current git branch name:

```bash
currentBranch=$(git rev-parse --abbrev-ref HEAD)
```

Match the branch name against the key pattern from `constants.md` (e.g. `(PROJ|TEAM)-\d+`). Use the first match as the story ID.

If extraction fails (branch doesn't contain a recognizable key), ask the user for the correct issue key and stop.

Validate the resolved key matches the key pattern. If invalid, ask the user for the correct issue key and stop.

---

## 1) Fetch Jira story details

Call Atlassian MCP:
- Tool: `getJiraIssue`
- Args:
  - `cloudId`: from `constants.md`
  - `issueIdOrKey`: the story ID (e.g., `PROJ-123`)
  - `fields`: `["summary", "description", "issuetype", "priority"]`
  - `expand`: `"renderedFields"`

Extract:
- **Summary** (story title)
- **Description** (acceptance criteria, requirements)
- **Issue Type** (Bug, Story, Task, Spike, etc.)
- **Priority**

---

## 2) Gather implementation context

### 2.1 Load artifacts

Load available artifacts from `$HOME/agentic-workflow/artifacts/{STORY-ID}/`:

- `YYYY-MM-DD-requirements.md` — original requirements analysis
- `YYYY-MM-DD-plan.md` — implementation plan
- `YYYY-MM-DD-review.md` — pre-PR review findings

### 2.2 Gather git context

Run in the **target repo**:

```bash
base=$(git rev-parse --verify origin/{BASE_BRANCH} >/dev/null 2>&1 && echo origin/{BASE_BRANCH} || echo origin/main)
git diff --stat "$base"...HEAD
git diff --name-only "$base"...HEAD
git log --oneline "$base"..HEAD
```

---

## 3) Generate the work summary

Structure the summary based on the **Issue Type**:

### Bug

- **Issue description** — what was reported / observed
- **Investigation approach** — how the root cause was identified
- **Root cause** — the underlying problem
- **Fix implemented** — what was changed and why
- **Alternatives considered** — other approaches explored with reasoning for rejection
- **Supplementary improvements** (if any) — work done beyond ticket scope
- **Compromises made** (if any) — trade-offs accepted and their implications
- **Testing performed** — how the fix was verified
- **Files changed** — list of modified files with brief description
- **Considerations** — edge cases, limitations, follow-ups

### Feature / Story

- **Requirement summary** — what was requested
- **Approach taken** — high-level implementation strategy
- **Key design decisions** — decisions made with rationale
- **Implementation overview** — what was built
- **Alternatives explored** — other approaches considered with reasoning
- **Supplementary improvements** (if any) — work done beyond ticket scope
- **Compromises made** (if any) — trade-offs accepted and their implications
- **New patterns/standards introduced** (if any) — patterns other devs should follow
- **Testing performed** — how the implementation was verified
- **Files changed** — list of modified files with brief description
- **Considerations** — limitations, future enhancements

### Spike / Research

- **Objective** — what was investigated
- **Investigation approach** — methodology used
- **Findings** — key discoveries
- **Options evaluated** — with pros/cons for each
- **Recommendation** — chosen direction with reasoning
- **Next steps** — follow-up actions

### Task

- **Objective** — what needed to be done
- **Approach taken** — how it was accomplished
- **Key decisions** (if any) — decisions made with rationale
- **Outcome** — result of the work
- **Files changed** (if applicable) — list of modified files
- **Considerations** — anything noteworthy

---

## 4) Guidelines

- Capture decisions AND reasoning — the "why" matters more than the "what"
- Document alternatives explored (even if not in final code) with why they were rejected
- Note compromises made and their trade-offs
- Highlight new patterns/standards that other devs should follow
- Note manual steps required (migrations, backfills, config changes)
- Keep concise but complete — no fluff, no omissions

---

## 5) Present to user for verification

Output the generated summary directly to the user for review.

> "Here's the work summary for {STORY-ID}. Please review and let me know if you'd like any changes."

- If the user requests changes → update the summary and present again.
- If the user approves → proceed to step 6.

---

## 6) Post to Jira

Add the approved summary as a comment on the Jira ticket using Atlassian MCP:

- Tool: `addCommentToJiraIssue`
- Args:
  - `cloudId`: from `constants.md`
  - `issueIdOrKey`: the story ID (e.g., `PROJ-123`)
  - `body`: the approved work summary (formatted in Jira wiki markup or ADF)

After posting, confirm to the user:

> "Work summary posted to {STORY-ID}."
