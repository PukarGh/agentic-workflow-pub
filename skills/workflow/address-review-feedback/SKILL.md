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

**Indicators**: starts with "why", "what does", "can you explain", "I'm curious", question marks without imperative statements, "what's the reason for".

### Type B — Actionable Feedback

The reviewer is requesting a code change, rename, refactor, addition, or removal.

**Indicators**: imperative language ("change this", "rename", "move", "extract", "add", "remove", "use X instead"), suggestions ("it would be better to", "consider using", "you should"), or explicit "nit:" / "suggestion:" prefixes.

### Type C — Praise / Acknowledgment

The reviewer is expressing approval or positive feedback with no action needed.

**Indicators**: "LGTM", "nice", "great work", thumbs up, etc.

**Action for Type C**: No action needed. Skip.

### 3.1 — Severity Classification (for Type B only)

Classify the requested change into one of four severity levels. Use the project's coding standards and security standards (from `.cursor/rules/` or any project-specific standards files) as your rubric:

| Severity         | Definition                                                                                                                                                                | Examples                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nitpick**      | Stylistic preference with no functional, readability, or safety impact. Reasonable people would disagree.                                                                 | "rename `x` to `y`" when both names are clear, trailing comma preference, comment wording                                                                                    |
| **Good to Have** | Improves readability, consistency, or maintainability but the current code is not _wrong_.                                                                                | Extracting a helper, adding a JSDoc comment, minor naming improvement for consistency with codebase conventions                                                              |
| **Recommended**  | Addresses a real quality, performance, or correctness concern. Not fixing it would leave a known weakness.                                                                | Missing edge case handling, missing memoization for expensive render-path computation, `any` type that should be narrowed, missing test coverage for a new exported function |
| **Critical**     | Must fix. Introduces a bug, security vulnerability, breaking change, or violates a hard project rule.                                                                     | Auth bypass, `eval()`, `@ts-nocheck`, missing auth guard on write endpoint, hardcoded secret, broken type safety in security-critical path                                   |

When classifying, specifically check:

- Does the comment flag something explicitly listed as a FAIL condition in project standards? → **Critical**
- Does the comment flag a violation of a "should" rule in the standards? → **Recommended**
- Does the comment suggest an improvement not covered by any explicit rule? → **Good to Have** or **Nitpick**

### 3.2 — Scope Classification

Determine if the requested change is **in_scope** or **out_of_scope** relative to the PR's intent (derived from the PR title, description, and the diff):

**In Scope** — The requested change:

- Directly relates to the purpose of the PR
- Fixes something broken by the PR's own changes
- Enforces a project standard that the PR's changes violated
- Is a necessary correction within the files/features the PR touches

**Out of Scope** — The requested change:

- Asks to fix/improve pre-existing code that the PR did not introduce or modify
- Requests a new feature or behavior not described in the PR description
- Asks to change an existing process, architecture, or pattern that the PR is only _using_, not _creating_
- Asks to address a concern in code outside the diff boundary that is not a direct consequence of the PR's changes

**Example**: PR documents an existing deployment process in a markdown file. Reviewer comments "this process is insecure, we should use mTLS." The process itself is out of scope — the PR only documents it. → **out_of_scope**.

### 3.3 — Decision Matrix

This matrix determines the recommended action. Present this classification to the user in Step 4 so they can make an informed selection.

| Scope        | Severity     | Recommended Action                                                                                                                                                    |
| ------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| in_scope     | Critical     | **Fix immediately.** Implement the change.                                                                                                                            |
| in_scope     | Recommended  | **Fix.** Implement the change.                                                                                                                                        |
| in_scope     | Good to Have | **Fix.** Implement the change, unless it requires significant refactoring that risks the PR scope — in that case, reply explaining and offer to do it in a follow-up. |
| in_scope     | Nitpick      | **Reply.** Acknowledge and implement if trivial (< 5 min). Otherwise reply explaining rationale for the current approach.                                             |
| out_of_scope | Critical     | **Flag to user.** This is a real issue but not for this PR. Suggest creating a separate ticket/issue.                                                                 |
| out_of_scope | Recommended  | **Flag to user.** Suggest creating a separate ticket/issue.                                                                                                           |
| out_of_scope | Good to Have | **Reply only.** Acknowledge the suggestion, note it's out of scope for this PR.                                                                                       |
| out_of_scope | Nitpick      | **Reply only.** Politely note it's out of scope.                                                                                                                      |

## Step 4: Present Comments to User for Selection

**This step is mandatory.** Before making any changes, present ALL classified comments to the user using the `AskQuestion` tool.

Format the presentation as a numbered list showing:

```
# | File / Location         | Reviewer   | Type       | Severity    | Scope        | Recommended Action | Summary
1 | src/utils/auth.ts:42    | @reviewer1 | Actionable | Critical    | In Scope     | Fix immediately    | Missing null check on token
2 | src/api/handler.ts:15   | @reviewer2 | Actionable | Recommended | In Scope     | Fix                | Extract validation logic
3 | General comment          | @reviewer3 | Question   | —           | —            | Reply              | Why was lodash added?
4 | src/components/App.tsx:8 | @reviewer1 | Actionable | Nitpick     | Out of Scope | Reply only         | Rename variable
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

1. Read the relevant code that the comment references (file + line range from the review thread, or the broader PR context for general comments).
2. Understand the _intent_ behind the code by examining the diff, surrounding code, commit messages, and PR description.
3. Formulate a **brief, concise, technically accurate** reply that:
   - Directly answers the question
   - References the specific reason (e.g., "This follows the project's pattern of X", "The requirement specifies Y", "This avoids Z")
   - Does NOT over-explain or be defensive
   - Is 1–3 sentences maximum unless the question genuinely requires more
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

Identify which files need modification, what the change is, and how it addresses the comment. Consider downstream effects (does changing this file affect other files in the diff?).

### 6.2 — Implement the change

Make the code modifications following all project standards. Ensure:

- No new type errors or lint violations
- Changes are scoped to what the reviewer requested — no bonus fixes
- Proper patterns, proper test coverage where applicable

### 6.3 — Verify

Run type-checks and linters on changed files. Fix any issues introduced.

### 6.4 — Reply to the comment

Post a reply:

```bash
gh api repos/<owner>/<repo>/pulls/comments/<comment_id>/replies -f body="Addressed — <brief description of what was changed>."
```

**Fallback**: Use GitHub MCP `add_reply_to_pull_request_comment` if `gh` fails.

## Step 7: Handle Out-of-Scope but Valid Items

For each selected out-of-scope item classified as **Critical** or **Recommended**:

1. **Flag to the user** that this is a real issue but not for this PR. Suggest creating a separate ticket or GitHub issue.
2. **Reply to the PR comment**:

```bash
gh api repos/<owner>/<repo>/pulls/comments/<comment_id>/replies -f body="Valid point — this is out of scope for this PR. Created a separate issue to track this."
```

**Fallback**: Use GitHub MCP `add_reply_to_pull_request_comment` if `gh` fails.

## Step 8: Reply to Remaining Items

For any out-of-scope **Good to Have** or **Nitpick** items, or in-scope **Nitpick** items that were not implemented, reply with a concise, respectful response:

- If you disagree with the feedback, explain _why_ briefly, referencing project standards or the specific design decision.
- If you agree but it's out of scope, say so directly: `"Agree this would be an improvement. Out of scope for this PR — happy to address in a follow-up."`
- Never be dismissive. Never be verbose. 1–3 sentences.

```bash
gh api repos/<owner>/<repo>/pulls/comments/<comment_id>/replies -f body="<response>"
```

**Fallback**: Use GitHub MCP `add_reply_to_pull_request_comment` if `gh` fails.

## Step 9: Commit and Summarize

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

| #   | Comment             | Type       | Severity    | Scope        | Action Taken           |
| --- | ------------------- | ---------- | ----------- | ------------ | ---------------------- |
| 1   | {brief description} | Question   | —           | —            | Replied                |
| 2   | {brief description} | Actionable | Critical    | In Scope     | Fixed                  |
| 3   | {brief description} | Actionable | Recommended | Out of Scope | Skipped (not selected) |
```

**Fallback**: Use GitHub MCP tools if `gh` fails.

## Rules

1. **Never implement changes without user confirmation** from Step 4.
2. **Never ignore a selected comment.** Every comment the user chose must be classified and acted on.
3. **Never make changes outside what reviewers requested.** No bonus fixes.
4. **Never argue with reviewers on Critical items.** Fix them.
5. **Always read the actual code** before replying or making changes. Never guess based on file names alone.
6. **Treat the project's coding standards and rules as ground truth** for severity classification. If a reviewer flags something the standards explicitly call a FAIL, it's Critical regardless of your opinion.
7. **Keep all replies professional, concise, and technically grounded.** 1–3 sentences max.
8. **Use `gh` CLI as the primary tool.** Only fall back to GitHub MCP if `gh` is unavailable or errors.
