# Create GitHub Pull Request

Push the current branch and create a GitHub PR enriched with Jira story context.

---

## Usage

- `/github-pr`

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

## 2) Check for uncommitted changes

Run:

```bash
git status --porcelain
```

If the output is **non-empty** (there are uncommitted changes):
- **STOP** and present the list of uncommitted changes to the user.
- Ask: "You have uncommitted changes. Would you like to proceed as-is (only committed changes will be included in the PR), or would you like to commit them first?"
- Wait for the user's response before continuing.
- If the user wants to commit first, stop and let them handle the commit.

If the output is empty, continue to step 3.

---

## 3) Push branch to origin

Push the current branch to the remote:

```bash
git push -u origin HEAD
```

If the push fails, report the error and **STOP**.

---

## 4) Extract story ID and fetch Jira details

### 4.1 Extract story ID from branch name

Extract the Jira story ID from the branch name using the regex pattern `([A-Z]+-\d+)`.

Example: from `chore-PROJ-123-implement-something`, extract `PROJ-123`.

### 4.2 Fetch Jira issue details

Call Atlassian MCP:
- Tool: `getJiraIssue`
- Args:
  - `cloudId`: `00000000-0000-0000-0000-000000000000`
  - `issueIdOrKey`: the extracted story ID (e.g., `PROJ-123`)
  - `fields`: `["summary", "description", "issuetype"]`

Extract from the response:
- **Summary** (story title)
- **Description** (story description for context)
- **Issue type** (Bug, Story, Task, etc.)

If the Jira issue cannot be fetched, warn the user but continue — use the story ID without a title and ask the user to provide context manually.

---

## 5) Analyze changed files

### 5.1 Determine base branch

```bash
base=$(git rev-parse --verify origin/development >/dev/null 2>&1 && echo origin/development || echo origin/main)
```

### 5.2 Gather diff context

Run all of:

```bash
git diff --stat "$base"...HEAD
git diff --name-only "$base"...HEAD
git log --oneline "$base"..HEAD
```

### 5.3 Summarize changes

From the diff output, build a concise summary of:
- Which files/modules changed
- What the changes accomplish (map them to the Jira story context)
- How the task was implemented at a high level

This summary will be used in the PR description.

---

## 6) Create the pull request

### 6.1 Derive the PR title prefix

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

### 6.2 Construct PR title

Format: `{prefix}: {STORY-ID} {Story Title}`

Example: `feat: PROJ-123 Add new maintenance log`

### 6.3 Construct PR description

Use this format:

```
## Proposed change/fix
{Concise summary of what this PR does, based on the Jira story context and the analyzed file changes from step 5.3. Explain what was changed and why.}

## How to run/test
{Provide actionable steps for testing this change. Derive these from the Jira story acceptance criteria and the nature of the changes. Include specific pages to visit, actions to perform, and expected outcomes.}
```

### 6.4 Create PR via GitHub MCP

Call GitHub MCP:
- Tool: `create_pull_request`
- Args:
  - `owner`: `your-org`
  - `repo`: `web-app`
  - `head`: current branch name
  - `base`: `development`
  - `title`: constructed PR title from 6.2
  - `body`: constructed PR description from 6.3

### 6.5 Output result

After the PR is created, output the PR URL and title to the user.
