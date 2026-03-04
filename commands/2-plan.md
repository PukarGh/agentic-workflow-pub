# Plan Implementation — Standards-Compliant Design

Create a verified implementation plan for a Jira story based on previously gathered requirements. The plan is validated against the target repo's coding, security, and quality standards before being presented to the user.

---

## Usage

- `/2-plan PROJ-123`

---

## Configuration

Read `$CURSOR_WORKFLOWS_REPO/constants.md` for:

- Active repository config (rules paths, verification command paths)
- Artifact path conventions

**Repo context:**

- Resolve the **target repo** from CWD. Rules files and verification command paths from `constants.md` are **relative to the target repo root** — resolve them as `{TARGET_REPO_PATH}/.cursor/rules/...` and `{TARGET_REPO_PATH}/.cursor/commands/...`.
- Artifacts are read from and written to `$CURSOR_WORKFLOWS_REPO/artifacts/...` (the **workflows repo**).

---

## Tracking

Use `/log` (see `commands/log.md`) to record events. Invoked via = `orchestrator` if called by `/implement-task`, otherwise `standalone`.

- On start: `/log {STORY-ID} 2-plan STARTED {invoked_via}`
- If stopping for user approval: `/log {STORY-ID} 2-plan WAITING_FOR_USER {invoked_via} "plan presented to user"`
- On resuming after user approval: `/log {STORY-ID} 2-plan RESUMED {invoked_via} "user approved"`
- On completion: `/log {STORY-ID} 2-plan COMPLETED {invoked_via} "all gates passed"`
- On failure: `/log {STORY-ID} 2-plan FAILED {invoked_via} "{error summary}"`

---

## 0) Load requirements artifact

Look for the most recent requirements artifact at:

```
$CURSOR_WORKFLOWS_REPO/artifacts/{STORY-ID}-{sluggified-story-title}/YYYY-MM-DD-requirements.md
```

If not found, stop and instruct:

> "No requirements artifact found for {STORY-ID}. Run `/1-research {STORY-ID}` first."

Read the artifact to extract:

- Jira story summary
- Numbered AC list
- Codebase context (impacted workspaces, existing branch work)
- Dependencies/blockers

---

## 1) Load repo rules

From `constants.md`, identify the active repository and read all its cursor rules files. These rules govern the implementation constraints. Do NOT inline rule content into this command — always read the files at runtime.

The rules files are listed in `constants.md` under the repository entry (e.g. security standards, component standards, styling, exported functions, testing, API architecture).

---

## 2) Draft implementation plan

Create a plan that explicitly incorporates the repo's rules. For each AC item, include:

- **What will change** (behavior)
- **Where it will change** (file paths / modules)
- **How it will be validated** (tests + runtime verification)

The plan must also include:

- **Data flow** (inputs → transforms → outputs)
- **Error/empty states**
- **Backward compatibility / breaking change check** (especially for shared types, MFE mount options, events)
- **Testing plan** (unit tests for exported pure functions; React Testing Library for components; API tests where applicable)
- **Database migrations** — if entity or schema changes are planned, a migration must be included. Flag if schema changes are detected without a corresponding migration.
- **Environment variables** — if new config values are needed, document them. `.env.example` must be updated. Sensitive values must NOT be exposed via `NEXT_PUBLIC_*` or `REACT_APP_*` prefixes.

Apply all constraints from the repo's rules files (component standards, styling, exported functions, security, API architecture, MFE boundaries, performance) as read from the paths in `constants.md`.

---

## 3) Verify and iterate on the plan

Run the plan through the verification commands listed in `constants.md` for the active repo as a checklist (plan-level verification).

### 3.1 Plan gate: AC mapping

Create a table:

```
| AC # | Description | Planned changes (file paths) | Tests / evidence | Risks / notes |
|------|-------------|------------------------------|------------------|---------------|
| 1    | ...         | ...                          | ...              | ...           |
```

No AC can be left unmapped. If an AC is genuinely unverifiable/ambiguous, mark **UNCLEAR** and stop to ask the user.

### 3.2 Plan gate: code quality alignment

Run through the code quality verification command (path from `constants.md`) and confirm the plan includes, when relevant:

- Type-check target(s) for affected workspaces
- Lint/test execution for affected workspaces
- Extraction of business logic from components into hooks/utils
- No TypeScript escape hatches (`any`, `@ts-ignore`, `@ts-nocheck`)
- API layering respected (controllers → services → repositories)
- MFE event system used correctly (no cross-MFE imports, proper channel names, listener cleanup)
- Shared types/utils changes assessed for consumer impact across workspaces
- Database migrations included when entity/schema changes are planned
- New env vars documented in `.env.example`

### 3.3 Plan gate: security alignment

Run through the security audit verification command (path from `constants.md`) and confirm the plan includes, when relevant:

- DTO validation / schema validation / parameter validation
- Redirect target validation (no open redirects)
- Sanitization strategy if rendering rich text
- No logging of secrets/tokens/cookies/sessions
- Auth guards on all protected API endpoints
- Owner guards on mutation endpoints acting on user-owned resources
- No auth tokens in localStorage/sessionStorage
- No `eval()` / `new Function()`
- Event payloads do not contain sensitive data (tokens, passwords, PII beyond user IDs)
- API responses do not include sensitive fields (password_hash, session_token, api_key)

### 3.4 Iterate

If any gate fails:

- Amend the plan.
- Re-run gates 3.1–3.3.
- Do not stop until all gates pass (or until user clarification is required).

---

## 4) Write plan artifact

Write the verified plan to:

```
$CURSOR_WORKFLOWS_REPO/artifacts/{STORY-ID}/YYYY-MM-DD-plan.md
```

The artifact must contain:

### Implementation Plan

- **Summary** — 2-3 sentence overview of the approach
- **Impacted workspaces** — which areas of the monorepo are touched
- **Step-by-step implementation** — ordered list of changes with file paths
- **Testing plan** — what tests will be added/modified
- **Security considerations** — how security requirements are addressed
- **Database / config changes** — migrations, new env vars (if any)
- **Performance considerations** — memoization, pagination, bundle impact (if relevant)
- **Breaking changes** — any identified, with mitigation (if any)

### AC Mapping Table

```
| AC # | Description | Planned changes | Tests / evidence | Status |
|------|-------------|-----------------|------------------|--------|
| 1    | ...         | ...             | ...              | MAPPED |
```

### Gate Results

```
| Gate             | Status      |
|------------------|-------------|
| AC Mapping       | PASS / FAIL |
| Code Quality     | PASS / FAIL |
| Security         | PASS / FAIL |
```

**All gates must show PASS before the plan is finalized.**

---

## 5) Present and STOP

Present the verified plan to the user and ask:

> "Plan verified — all gates passed. Saved to `artifacts/{STORY-ID}/YYYY-MM-DD-plan.md`. Do you want me to implement this plan now? Run `/3-implement {STORY-ID}` to proceed."

- If the user asks for changes → amend the plan, re-run gates, and re-present.
- Do **not** proceed to implementation from this command.
