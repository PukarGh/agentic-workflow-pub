---
name: 4-push-pr
description: Push and Create Pull Request
disable-model-invocation: true
---

# Push and Create Pull Request

Commit changes, push the current branch, and create a GitHub PR enriched with Jira story context and plan details.

---

## Usage

- `/4-push-pr`

---

## Configuration

Read `$CURSOR_WORKFLOWS_REPO/constants.md` for:
- Jira cloud ID and key pattern
- GitHub org, repo name, and base branch for the active repository

**Repo context:**
- Resolve the **target repo** from CWD. All git operations (`git push`, `git status`, `git diff`) run in the **target repo**.
- The GitHub `owner`, `repo`, and `base` branch for the PR are read from the matched repository entry in `constants.md`.
- Plan artifacts (for PR enrichment) are read from `$CURSOR_WORKFLOWS_REPO/artifacts/...` (the **workflows repo**).

---

## Tracking

`STARTED` and `COMPLETED`/`FAILED` are logged automatically by hooks for standalone invocations. The story ID is extracted from the branch name in step 2. For orchestrator sub-steps or mid-step events, call the log script via Shell:

```bash
$CURSOR_WORKFLOWS_REPO/hooks/log.sh {STORY-ID} 4-push-pr {EVENT} {invoked_via} "{notes}"
```

- If stopping for user input: log `WAITING_FOR_USER` with note "uncommitted changes"
- On resuming after user input: log `RESUMED`

---

## 1) Validate implementation branch

Get the current branch name:

```bash
currentBranch=$(git rev-parse --abbrev-ref HEAD)
```

The branch name **must** match the pattern: `^(chore|feature|bug|feat|fix)-[A-Z]+-\d+-.+`

Examples of valid branch names:
- `chore-PROJ-123-implement-something`
- `feature-PROJ-456-add-new-feature`
- `bug-PROJ-789-fix-broken-widget`
- `fix-PROJ-100-resolve-crash`

If the branch does **not** match, **STOP immediately** and output:

> "You are not on an implementation branch. Branch name must follow the pattern: `{type}-{STORY-ID}-{description}` (e.g., `chore-PROJ-123-implement-something`). Switch to an implementation branch and try again."

---

## 2) Extract story ID

Extract the Jira story ID from the branch name using the key pattern from `constants.md`.

Example: from `chore-PROJ-123-implement-something`, extract `PROJ-123`.

---

## 3) Check for uncommitted changes

Run:

```bash
git status --porcelain
```

If the output is **non-empty** (there are uncommitted changes):
- **STOP** and present the list of uncommitted changes to the user.
- Ask: "You have uncommitted changes. Would you like to proceed as-is (only committed changes will be included in the PR), or would you like to commit them first?"
- Wait for the user's response before continuing.
- If the user wants to commit first, stop and let them handle the commit.

If the output is empty, continue to step 4.

---

## 4) Push branch to origin

Push the current branch to the remote:

```bash
git push -u origin HEAD
```

If the push fails, report the error and **STOP**.

---

## 5) Fetch Jira details

Call Atlassian MCP:
- Tool: `getJiraIssue`
- Args:
  - `cloudId`: from `constants.md`
  - `issueIdOrKey`: the extracted story ID (e.g., `PROJ-123`)
  - `fields`: `["summary", "description", "issuetype"]`

Extract from the response:
- **Summary** (story title)
- **Description** (story description for context)
- **Issue type** (Bug, Story, Task, etc.)

If the Jira issue cannot be fetched, warn the user but continue — use the story ID without a title and ask the user to provide context manually.

---

## 6) Load plan artifact (if available)

Look for the most recent plan artifact at:

```
$CURSOR_WORKFLOWS_REPO/artifacts/{STORY-ID}/YYYY-MM-DD-plan.md
```

If found, use the plan summary and AC mapping table to enrich the PR description. If not found, proceed without it.

---

## 7) Analyze changed files

### 7.1 Determine base branch

Use the base branch from `constants.md` for the active repository.

```bash
base=$(git rev-parse --verify origin/{BASE_BRANCH} >/dev/null 2>&1 && echo origin/{BASE_BRANCH} || echo origin/main)
```

### 7.2 Gather diff context

Run all of:

```bash
git diff --stat "$base"...HEAD
git diff --name-only "$base"...HEAD
git log --oneline "$base"..HEAD
```

### 7.3 Summarize changes

From the diff output, build a concise summary of:
- Which files/modules changed
- What the changes accomplish (map them to the Jira story context)
- How the task was implemented at a high level

---

## 8) Create the pull request

### 8.1 Derive the PR title prefix

Map the branch prefix to the conventional commit prefix:

| Branch prefix     | PR title prefix |
|-------------------|-----------------|
| `feature`, `feat` | `feat`          |
| `bug`, `fix`      | `fix`           |
| `chore`           | `chore`         |

If the branch prefix doesn't map cleanly, fall back to the Jira issue type:
- `Bug` → `fix`
- `Story` / `Task` → `feat`
- Anything else → `chore`

### 8.2 Construct PR title

Format: `{prefix}: {STORY-ID} {Story Title}`

Example: `feat: PROJ-123 Add new maintenance log`

### 8.3 Construct PR description

Use this format:

```
## Proposed change/fix
{Concise summary of what this PR does, based on the Jira story context and the analyzed file changes from step 7.3. Explain what was changed and why. If a plan artifact was loaded, incorporate the plan summary.}

## How to run/test
{Provide actionable steps for testing this change. Derive these from the Jira story acceptance criteria and the nature of the changes. Include specific pages to visit, actions to perform, and expected outcomes.}
```

### 8.4 Create PR via GitHub MCP

Read the GitHub org, repo name, and base branch from `constants.md`.

Call GitHub MCP:
- Tool: `create_pull_request`
- Args:
  - `owner`: from `constants.md` (GitHub org)
  - `repo`: from `constants.md` (active repo name)
  - `head`: current branch name
  - `base`: from `constants.md` (base branch)
  - `title`: constructed PR title from 8.2
  - `body`: constructed PR description from 8.3

### 8.5 Output result

After the PR is created, output the PR URL and title to the user.
