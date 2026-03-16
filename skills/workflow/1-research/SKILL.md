---
name: 1-research
description: Research Jira Story — Requirement Analysis
disable-model-invocation: true
---

# Research Jira Story — Requirement Analysis

Gather and normalize all requirements for a Jira story by fetching issue details, extracting acceptance criteria, and scanning the target codebase for structural context. Outputs a requirements artifact for downstream commands.

---

## Usage

- `/1-research PROJ-123`
- `/1-research` (omit story ID to auto-detect from the current branch name)

---

## Configuration

Read `$HOME/agentic-workflow/constants.md` for:

- Jira cloud ID and key pattern
- Active repository rules and paths

**Repo context:**

- Resolve the **target repo** by matching CWD against repository `Local Path` entries in `constants.md`. All git commands and codebase scans run in the **target repo**.
- Artifacts are written to `$HOME/agentic-workflow/artifacts/...` (the **workflows repo**).

---

## Tracking

`STARTED` and `COMPLETED`/`FAILED` are logged automatically by hooks for standalone invocations. For orchestrator sub-steps or mid-step events, call the log script via Shell:

```bash
$HOME/agentic-workflow/hooks/log.sh {STORY-ID} 1-research {EVENT} {invoked_via} "{notes}"
```

- If stopping for user input: log `WAITING_FOR_USER` with note "ambiguous AC flagged"
- On resuming after user input: log `RESUMED`

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

## 1) Parallel requirement gathering

In a single message, launch the following subagents in parallel using the Task tool

### Sub-agent A: Jira fetch + AC extraction (sections 1–2)

#### 1.1 Resolve `cloudId`

Call Atlassian MCP:

- Tool: `getAccessibleAtlassianResources`

Fast-path: use the cloud ID from `constants.md` directly if the response contains a matching resource.

If multiple resources are returned:

- Prefer the one matching the cloud ID in `constants.md`.
- If still ambiguous, present a short numbered list (name + URL) and ask the user to pick one; then continue.

#### 1.2 Get issue details

Call Atlassian MCP:

- Tool: `getJiraIssue`
- Args:
  - `cloudId`: from `constants.md`
  - `issueIdOrKey`: the provided Jira key
  - `fields` (array):
    - `summary`
    - `description`
    - `status`
    - `assignee`
    - `reporter`
    - `labels`
    - `priority`
    - `created`
    - `updated`
    - `issuetype`
    - `components`
    - `fixVersions`
    - `versions`
    - `parent`
    - `subtasks`
    - `issuelinks`
    - `comment`
  - `expand`: `renderedFields`

If the ticket is not found or inaccessible:

- Report the error.
- Ask the user whether to proceed using manually pasted story details (summary + AC) and stop until provided.

#### 1.3 Check Jira comments for AC amendments

Scan the `comment` field for PM/QA clarifications that refine or override acceptance criteria in the description. Common patterns:

- "Updated AC:", "Clarification:", "Out of scope:", "Correction:"
- Replies from the reporter or assignee that redefine expected behavior

If comments contain material changes to AC, merge them into the AC list and note the source comment.

#### 1.4 Check parent, subtasks, and linked issues

If the story has:

- **Parent epic/story**: note its summary as context for scope boundaries.
- **Subtasks**: list them and note their status. If subtasks exist, the plan should only cover the scope of the provided key (not its siblings).
- **Linked issues** (`issuelinks`): check for `blocks` / `is blocked by` / `relates to` relationships. Flag any blockers that are not `Done` as risks.

#### 1.5 Normalize story content

Extract and normalize these into a structured story object:

- **Key**
- **Summary**
- **Issue type**
- **Status / Priority**
- **Description** (prefer `renderedFields.description` if present; otherwise `fields.description`)
- **Labels/components** (used only as hints, not truth)
- **Comment-derived amendments** (from 1.3)
- **Dependencies / blockers** (from 1.4)

#### 1.6 Extract acceptance criteria

Parse the description (and comment amendments from 1.3) to produce a numbered AC list. Look for (in order):

- An explicit "Acceptance Criteria" section
- Given/When/Then scenarios
- Checklists / checkboxes
- Numbered/bulleted requirements

If no structured AC exists:

- Derive "implicit AC" from the full description and label it clearly as inferred.

#### 1.7 Detect vague/irrelevant/incorrect AC and STOP to confirm

Before finishing, critically assess AC quality and flag items that are:

- **Ambiguous** (unclear definitions, missing states, unspecified validation)
- **Contradictory** (conflicts with other AC or known platform constraints)
- **Irrelevant scope** (doesn't match story summary or likely product intent)
- **Potentially incorrect** (e.g., suggests insecure behavior, breaking changes, or architecture violations)

If any are found:

- Present a short list of clarification questions to the user.
- Do **not** finalize the requirements until the user answers.

Minimum clarification set to ask (only if triggered):

- What is the exact expected behavior for the ambiguous part?
- What is explicitly out of scope?

---

### Sub-agent B: Codebase structure scan (section 3)

> All operations in this sub-agent run in the **target repo** working directory (resolved from `constants.md`).

#### 3.1 Read the structure doc(s)

Read `context.md` at repo root if it exists.

If `context.md` does **not** exist:

- Identify the closest available "context" documentation (examples: `**/memory-bank/*Context.md`, README(s), architecture docs).
- Use it as the structure reference and call out which file(s) were used.

#### 3.2 Map the story to the correct workspace(s)

Based on AC + repo structure, identify which area(s) are impacted:

- `mfes/*` (micro-frontends)
- `apps/*` (Next.js container or other apps)
- `api/*` (NestJS services)
- `utils/*`, `types/*` (shared packages)

Prefer the smallest-scoped change that meets AC while preserving existing boundaries (no cross-MFE imports; use the event system where required).

#### 3.3 Detect existing implementation on the current branch

Before planning from scratch, check whether partial work already exists:

```bash
currentBranch=$(git rev-parse --abbrev-ref HEAD)
base=$(git rev-parse --verify origin/development >/dev/null 2>&1 && echo origin/development || echo origin/main)
existing_changes=$(git diff --name-only "$base"...HEAD 2>/dev/null || true)
existing_commits=$(git log --oneline "$base..HEAD" --max-count=20 2>/dev/null || true)
```

If changes exist on the current branch:

- Summarize what's already been done (files touched, commit messages).
- Factor existing work into the requirements as "already completed" items.
- Only plan remaining work needed to fully satisfy AC.

If the branch is clean (no existing changes), note that everything will be planned from scratch.

---

## 2) Merge sub-agent results

Combine outputs from both sub-agents into a single requirements document.

---

## 3) Write requirements artifact

Write the merged output to:

```
$HOME/agentic-workflow/artifacts/{STORY-ID}-{slugified-story-title}/YYYY-MM-DD-requirements.md
```

The artifact must contain:

### Jira Story Summary

```
| Field       | Value          |
|-------------|----------------|
| Key         | {key}          |
| Summary     | {summary}      |
| Type        | {issueType}    |
| Priority    | {priority}     |
| Status      | {status}       |
| Blockers    | {blockers or "None"} |
```

### Acceptance Criteria

Numbered list of all AC items (noting source: description, comment, or inferred).

### Ambiguities / Questions

If any AC items were flagged in step 1.7, list the questions and answers here (after user resolution).

### Codebase Context

- Impacted workspaces
- Structure doc(s) referenced
- Existing branch work summary (or "Clean branch — planning from scratch")

### Dependencies / Blockers

List of related issues and their status.

---

## 4) Output

After writing the artifact, present the requirements summary to the user and confirm:

> "Requirements gathered and saved to `artifacts/{STORY-ID}/YYYY-MM-DD-requirements.md`. Ready to proceed with `/2-plan {STORY-ID}`?"
