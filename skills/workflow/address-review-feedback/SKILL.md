---
name: address-review-feedback
description: Address PR review feedback by fetching comments from GitHub, classifying them, and implementing selected fixes. Use when the user wants to address, handle, or fix PR review comments, review feedback, or code review suggestions on a pull request.
---

# Address PR Review Feedback

Fetch review comments from a GitHub pull request, classify them, let the user select which ones to address, then implement the selected changes.

## Step 0: Parse Input

The user provides one of:

- **PR number** — e.g. `123` or `#123`
- **PR URL** — e.g. `https://github.com/owner/repo/pull/123`
- **Review comment URL** — e.g. `https://github.com/owner/repo/pull/123#discussion_r456` or `https://github.com/owner/repo/pull/123#issuecomment-789`

Extract the **owner**, **repo**, and **PR number** from the input:

- If only a number is given, infer owner/repo from the current git remote: run `gh repo view --json owner,name --jq '.owner.login + "/" + .name'`.
- If a URL is given, parse owner/repo/PR number from the URL path segments.
- If a comment URL is given, also extract the comment ID from the fragment for later focus.

## Step 1: Fetch PR Details and Review Comments

Use the **GitHub CLI** (`gh`) to fetch all data. If `gh` is unavailable or errors out, fall back to the **GitHub MCP** tools.

### 1.1 — Fetch PR metadata

```bash
gh pr view <PR_NUMBER> --repo <owner>/<repo> --json title,body,headRefName,baseRefName,url,number
```

### 1.2 — Fetch the PR diff

```bash
gh pr diff <PR_NUMBER> --repo <owner>/<repo>
```

### 1.3 — Fetch review comments (threaded code comments)

```bash
gh api repos/<owner>/<repo>/pulls/<PR_NUMBER>/comments --paginate
```

### 1.4 — Fetch issue comments (general PR comments)

```bash
gh api repos/<owner>/<repo>/issues/<PR_NUMBER>/comments --paginate
```

### 1.5 — Filter comments

From all fetched comments, keep only those that are:

- **Unresolved** (not part of a resolved review thread)
- **Not authored by the current user** — determine current user via `gh api user --jq '.login'`

If the user provided a **comment URL**, filter down to just that comment/thread and its context.

## Step 2: Gather Project Context

Read the following files if they exist, to understand the project's standards:

- `.cursor/rules/` — project rules
- Any project-specific coding standards, linting configs, or architecture docs referenced in the repo

These standards inform severity classification and implementation decisions.

## Step 3: Classify Each Comment

For each unresolved comment, classify by **type**:

### Type A — Question / Clarification Request

The reviewer is asking *why* something was done, requesting an explanation. No code change requested.

**Indicators**: "why", "what does", "can you explain", question marks without imperative statements.

### Type B — Actionable Feedback

The reviewer is requesting a code change, rename, refactor, addition, or removal.

**Indicators**: imperative language ("change", "rename", "move", "extract", "add", "remove", "use X instead"), suggestions ("consider using", "you should"), "nit:" / "suggestion:" prefixes.

### Type C — Praise / Acknowledgment

Positive feedback with no action needed. **Skip these.**

### Severity (for Type B only)

| Severity         | Definition                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **Nitpick**      | Stylistic preference, no functional/safety impact. Reasonable people would disagree.               |
| **Good to Have** | Improves readability/consistency/maintainability but current code is not wrong.                     |
| **Recommended**  | Addresses a real quality, performance, or correctness concern. Not fixing it leaves a weakness.     |
| **Critical**     | Must fix. Bug, security vulnerability, breaking change, or hard project rule violation.             |

## Step 4: Present Comments to User for Selection

**This step is mandatory.** Before making any changes, present ALL classified comments to the user using the `AskQuestion` tool.

Format the presentation as a numbered list showing:

```
# | File / Location         | Reviewer   | Type       | Severity    | Summary
1 | src/utils/auth.ts:42    | @reviewer1 | Actionable | Critical    | Missing null check on token
2 | src/api/handler.ts:15   | @reviewer2 | Actionable | Recommended | Extract validation logic
3 | General comment          | @reviewer3 | Question   | —           | Why was lodash added?
4 | src/components/App.tsx:8 | @reviewer1 | Actionable | Nitpick     | Rename variable
```

Use the `AskQuestion` tool to ask:

> Which review comments would you like me to address?

Provide options including:

- **All comments** — address every comment
- **Critical & Recommended only** — skip nitpicks and good-to-haves
- **Let me pick** — user selects specific comment numbers

If the user chooses "Let me pick", ask a follow-up with checkboxes for each comment number.

**Only proceed with the comments the user selected.**

## Step 5: Handle Selected Type A Comments (Questions)

For each selected question:

1. Read the relevant code the comment references.
2. Understand the intent from the diff, surrounding code, and PR description.
3. Formulate a **brief, technically accurate** reply (1–3 sentences).
4. Post the reply using:

```bash
gh api repos/<owner>/<repo>/pulls/comments/<comment_id>/replies -f body="<response>"
```

For general (non-review) comments, reply with:

```bash
gh api repos/<owner>/<repo>/issues/<PR_NUMBER>/comments -f body="<response>"
```

**Fallback**: Use GitHub MCP `add_reply_to_pull_request_comment` if `gh` fails.

## Step 6: Handle Selected Type B Comments (Actionable Feedback)

For each selected actionable comment:

### 6.1 — Plan the change

Identify which files need modification, what the change is, and downstream effects.

### 6.2 — Implement the change

Make the code modifications following all project standards. Ensure:

- No new type errors or lint violations
- Changes are scoped to what the reviewer requested — no bonus fixes

### 6.3 — Verify

Run type-checks and linters on changed files. Fix any issues introduced.

### 6.4 — Reply to the comment

Post a reply:

```bash
gh api repos/<owner>/<repo>/pulls/comments/<comment_id>/replies -f body="Addressed — <brief description of what was changed>."
```

**Fallback**: Use GitHub MCP `add_reply_to_pull_request_comment` if `gh` fails.

## Step 7: Commit and Summarize

If any code changes were made:

1. Stage and commit all changes:

```
address PR review feedback

- <one-line summary per change made>
```

2. Push the branch.

After all selected comments are processed, post a single top-level PR comment summarizing actions taken:

```bash
gh api repos/<owner>/<repo>/issues/<PR_NUMBER>/comments -f body="<summary>"
```

Use this format for the summary:

```markdown
## Review Feedback Summary

| #   | Comment             | Type       | Severity    | Action Taken           |
| --- | ------------------- | ---------- | ----------- | ---------------------- |
| 1   | {brief description} | Question   | —           | Replied                |
| 2   | {brief description} | Actionable | Critical    | Fixed                  |
| 3   | {brief description} | Actionable | Recommended | Skipped (not selected) |
```

**Fallback**: Use GitHub MCP tools if `gh` fails.

## Rules

1. **Never implement changes without user confirmation** from Step 4.
2. **Never make changes outside what reviewers requested.** No bonus fixes.
3. **Always read the actual code** before replying or making changes.
4. **Keep all replies professional, concise, and technically grounded.** 1–3 sentences max.
5. **Use `gh` CLI as the primary tool.** Only fall back to GitHub MCP if `gh` is unavailable or errors.
6. **Never ignore a selected comment.** Every comment the user chose must be classified and acted on.
