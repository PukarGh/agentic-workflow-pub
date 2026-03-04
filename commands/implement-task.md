# Implement Jira Story — Plan + Standards Verification + Implementation

Create an implementation plan for a Jira story key (e.g. `PROJ-123`) by fetching details from Jira via Atlassian MCP, analyzing acceptance criteria, aligning the plan to this repo's coding/security standards, and verifying the plan against the configured review requirements. After the plan is verified, ask the user whether to implement it.

---

## Usage

- `/implement-task PROJ-123`

---

## 0) Input validation (fail fast)

Validate the provided Jira key:
- Must match: `^[A-Z][A-Z0-9]+-\d+$`
- Example valid: `PROJ-123`

If missing/invalid, ask the user for the correct issue key and stop.

---

## 1) Fetch Jira story details (Atlassian MCP)

### 1.1 Resolve `cloudId`

Call Atlassian MCP:
- Tool: `getAccessibleAtlassianResources`

Fast-path: if the response contains a single resource matching `00000000-0000-0000-0000-000000000000`, use it directly.

If multiple resources are returned:
- Prefer the one that clearly corresponds to this repo's Jira site.
- If still ambiguous, present a short numbered list (name + URL) and ask the user to pick one; then continue.

### 1.2 Get issue details

Call Atlassian MCP:
- Tool: `getJiraIssue`
- Args:
  - `cloudId`: resolved in 1.1
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

### 1.3 Check Jira comments for AC amendments

Scan the `comment` field for PM/QA clarifications that refine or override acceptance criteria in the description. Common patterns:
- "Updated AC:", "Clarification:", "Out of scope:", "Correction:"
- Replies from the reporter or assignee that redefine expected behavior

If comments contain material changes to AC, merge them into the AC list (section 2) and note the source comment.

### 1.4 Check parent, subtasks, and linked issues

If the story has:
- **Parent epic/story**: note its summary as context for scope boundaries.
- **Subtasks**: list them and note their status. If subtasks exist, the plan should only cover the scope of the provided key (not its siblings).
- **Linked issues** (`issuelinks`): check for `blocks` / `is blocked by` / `relates to` relationships. Flag any blockers that are not `Done` as risks.

### 1.5 Normalize story content

Extract and normalize these into a structured story object:
- **Key**
- **Summary**
- **Issue type**
- **Status / Priority**
- **Description** (prefer `renderedFields.description` if present; otherwise `fields.description`)
- **Labels/components** (used only as hints, not truth)
- **Comment-derived amendments** (from 1.3)
- **Dependencies / blockers** (from 1.4)

---

## 2) Acceptance criteria extraction + sanity review

### 2.1 Extract acceptance criteria

Parse the description (and comment amendments from 1.3) to produce a numbered AC list. Look for (in order):
- An explicit "Acceptance Criteria" section
- Given/When/Then scenarios
- Checklists / checkboxes
- Numbered/bulleted requirements

If no structured AC exists:
- Derive "implicit AC" from the full description and label it clearly as inferred.

### 2.2 Detect vague/irrelevant/incorrect AC and STOP to confirm

Before planning, critically assess AC quality and flag items that are:
- **Ambiguous** (unclear definitions, missing states, unspecified validation)
- **Contradictory** (conflicts with other AC or known platform constraints)
- **Irrelevant scope** (doesn't match story summary or likely product intent)
- **Potentially incorrect** (e.g., suggests insecure behavior, breaking changes, or architecture violations)

If any are found:
- Present a short list of clarification questions to the user.
- Do **not** finalize the plan until the user answers.

Minimum clarification set to ask (only if triggered):
- What is the exact expected behavior for the ambiguous part?
- What is explicitly out of scope?

---

## 3) Understand codebase structure (context-first)

### 3.1 Read the structure doc(s)

Read `context.md` at repo root if it exists.

If `context.md` does **not** exist:
- Identify the closest available "context" documentation (examples: `**/memory-bank/*Context.md`, README(s), architecture docs).
- Use it as the structure reference and call out which file(s) were used.

### 3.2 Map the story to the correct workspace(s)

Based on AC + repo structure, identify which area(s) are impacted:
- `mfes/*` (micro-frontends)
- `apps/*` (Next.js container or other apps)
- `api/*` (NestJS services)
- `utils/*`, `types/*` (shared packages)

Prefer the smallest-scoped change that meets AC while preserving existing boundaries (no cross-MFE imports; use the event system where required).

### 3.3 Detect existing implementation on the current branch

Before planning from scratch, check whether partial work already exists:

```bash
currentBranch=$(git rev-parse --abbrev-ref HEAD)
base=$(git rev-parse --verify origin/development >/dev/null 2>&1 && echo origin/development || echo origin/main)
existing_changes=$(git diff --name-only "$base"...HEAD 2>/dev/null || true)
existing_commits=$(git log --oneline "$base..HEAD" --max-count=20 2>/dev/null || true)
```

If changes exist on the current branch:
- Summarize what's already been done (files touched, commit messages).
- Factor existing work into the plan as "already completed" items.
- Only plan remaining work needed to fully satisfy AC.

If the branch is clean (no existing changes), plan everything from scratch.

---

## 4) Draft a standards-compliant implementation plan

Create a plan that explicitly incorporates these repo standards:
- `.cursor/rules/security-standards.mdc`
- `.cursor/rules/react-component-standards.mdc`
- `.cursor/rules/react-component-styling.mdc`
- `.cursor/rules/exported-functions.mdc`
- `.cursor/rules/unit-testing-standards.mdc`
- `.cursor/rules/api-nest-architecture.yaml`

### 4.1 Plan requirements (must be present)

For each AC item, include:
- **What will change** (behavior)
- **Where it will change** (file paths / modules)
- **How it will be validated** (tests + runtime verification)

Plan must also include:
- **Data flow** (inputs → transforms → outputs)
- **Error/empty states**
- **Backward compatibility / breaking change check** (especially for `types/`, MFE mount options, events)
- **Testing plan** (unit tests required for new exported pure functions; React Testing Library for components; API tests where applicable)
- **Database migrations** — if entity or schema changes are planned, a migration must be included. Flag if schema changes are detected without a corresponding migration.
- **Environment variables** — if new config values are needed, document them. `.env.example` must be updated. Sensitive values must NOT be exposed via `NEXT_PUBLIC_*` or `REACT_APP_*` prefixes.

### 4.2 React/component constraints (when planning UI)

Ensure the plan enforces (per `.cursor/rules/react-component-standards.mdc` and `.cursor/rules/react-component-styling.mdc`):
- Components use arrow functions and are typed with `FunctionComponent<Props>`
- Props interface naming: `ComponentNameProps`
- Optional props have default values in parameters; required props do not
- Complex logic extracted into custom hooks and/or pure utilities
- Styling uses CSS Modules (`ComponentName.module.css`) with design tokens from `@your-org/design-system`
- Root class name matches component name (camelCase)
- CSS nesting limited to one level deep
- `rem` units preferred over `px` (1rem = 10px with 62.5% root font-size)
- No hardcoded hex colors or raw pixel values
- `className` prop on design system components used ONLY for layout/positioning
- Mobile-first responsive approach with design system breakpoint variables
- **Accessibility** — semantic HTML elements, ARIA attributes where needed, keyboard navigability, focus management for interactive elements

### 4.3 Exported pure function constraints (when planning utils)

Any new exported function in the plan must be (per `.cursor/rules/exported-functions.mdc` and `.cursor/rules/unit-testing-standards.mdc`):
- Pure (no side effects; no external state)
- Fully typed (params + return types)
- Covered by comprehensive unit tests (edge cases: `null`, `undefined`, `false`, `-1`, `0`, empty arrays/strings, boundary values)
- Tests follow AAA pattern (Arrange, Act, Assert)
- Test file naming: `{sourcefile}.test.{ts|tsx}`
- Documented with JSDoc when complex

### 4.4 Security constraints (always)

Plan must explicitly address (per `.cursor/rules/security-standards.mdc`):
- **Input validation** at boundaries (forms, query params, API DTOs)
- **XSS prevention** (no `dangerouslySetInnerHTML` unless sanitized with DOMPurify)
- **Sensitive data handling** (no secrets/tokens in localStorage; no sensitive logging)
- **AuthZ/AuthN** where applicable (guards, role checks, ownership checks)
- **Fail-secure behavior** on errors
- **No `eval()` or `new Function()`**
- **Security headers** where applicable

### 4.5 NestJS API constraints (when planning API changes)

If the plan touches `api/*`, enforce (per `.cursor/rules/api-nest-architecture.yaml`):

**Module architecture:**
- Each domain/feature has its own NestJS module
- Providers are private by default; only export what is part of the module's public API
- No cross-module direct file imports — use module imports
- No circular dependencies; no `forwardRef` without strong justification
- Constructor injection only; never instantiate providers with `new`

**Layering:**
- **Controllers** — HTTP transport only (routing, status codes, serialization). No business logic. Swagger decorators required (`@ApiTags`, `@ApiOperation`, `@ApiSwaggerDocs`).
- **Services** — business rules and orchestration. Must be unit-testable.
- **Repositories** — persistence and queries only. No business rules.
- **DTOs** — validate and type request/response shapes via `class-validator` and `ValidationPipe`. Keep DTOs separate from DB entities.

**Auth & Guards:**
- Protected routes use `JwtAuthGuard`, `UserGuard`, or owner guards (`TripOwnerGuard`, `StopOwnerGuard`)
- Public routes explicitly use `@Public()` decorator
- Path params validated (e.g., `ParseIntPipe` for numeric IDs)

**Error handling:**
- Use `HttpException` subclasses (`BadRequestException`, `NotFoundException`, `ConflictException`, etc.)
- No generic `throw new Error`
- Error responses must not leak stack traces or internal details in production

**Database:**
- Use TypeORM repositories/entities, not raw SQL
- Use migrations for schema changes
- Use transactions for multi-step atomic updates
- Consider race conditions for concurrent writes (unique constraints, optimistic locking)

**Performance:**
- Avoid N+1 query patterns; batch where possible
- Pagination for list endpoints
- Timeouts/retries for external calls (with backoff)

### 4.6 MFE architecture constraints (when planning MFE changes)

If the plan touches `mfes/*`, enforce:

**Event system:**
- Events use correct channel names (`app_auth`, `app_garage`, `app_settings`, `app_trip`, `app_data`)
- Event payloads conform to `IEventMessage` interface from `@your-org/types`
- `triggerEvent` for dispatching; `addListener`/`removeListener` for consuming
- Event listeners must be cleaned up on unmount via `removeListener`
- `app_data` update events follow the `update-${endpoint}` pattern with method in `extra`

**Cross-MFE boundaries:**
- No direct imports between MFEs — all communication through events
- No auth tokens stored in localStorage or sessionStorage — cookies only
- Auth state obtained from `app_auth` channel, not duplicated or bypassed

**Mount / Bootstrap:**
- `MountOptions` changes must be backward-compatible (new options must be optional)
- `mount` and `unmount` function signatures must not break
- New required `MountOptions` fields are a BREAKING CHANGE — flag and require documentation

**Breaking change detection:**
- Event channel name constants unchanged (or documented as breaking)
- `IEventMessage` interface unchanged (or documented as breaking)
- If breaking changes detected, flag that `apps/profile` (the container) must be updated and other consuming teams notified

### 4.7 Performance constraints

Plan must consider:
- **Memoization** — `useMemo`/`useCallback` for expensive computations or callbacks passed to children. Not over-applied to trivial values.
- **O(1) lookups** — use `Map` or `Set` instead of `.find()`/`.includes()` on large arrays during render
- **Bundle size** — no heavy library imports (e.g., all of `lodash` vs `lodash/debounce`)
- **Unbounded lists** — API calls must have pagination or limits. No unbounded data fetching.
- **Unnecessary re-renders** — components receiving stable props wrapped in `React.memo` where appropriate

---

## 5) Verify and iterate on the plan until it satisfies repo requirements

Run the plan through these command requirements as a checklist (plan-level verification):
- `.cursor/commands/verify-ac.md` (map each AC → planned evidence)
- `.cursor/commands/code-quality.md` (architecture, TS strictness, testing, workspace boundaries)
- `.cursor/commands/security-audit.md` (input validation, auth, XSS, secrets, redirects, logging)

### 5.1 Plan gate: AC mapping

Create a table:

```
| AC # | Description | Planned changes (file paths) | Tests / evidence | Risks / notes |
|------|-------------|------------------------------|------------------|---------------|
| 1    | ...         | ...                          | ...              | ...           |
```

No AC can be left unmapped. If an AC is genuinely unverifiable/ambiguous, mark **UNCLEAR** and stop to ask the user.

### 5.2 Plan gate: code quality alignment

Confirm the plan includes, when relevant:
- Type-check target(s) for affected workspaces
- Lint/test execution for affected workspaces
- Extraction of business logic from components into hooks/utils
- No TypeScript escape hatches (`any`, `@ts-ignore`, `@ts-nocheck`)
- NestJS layering respected (controllers → services → repositories, no inline business logic in controllers)
- MFE event system used correctly (no cross-MFE imports, proper channel names, listener cleanup)
- Shared types/utils changes assessed for consumer impact across workspaces
- Database migrations included when entity/schema changes are planned
- New env vars documented in `.env.example`

### 5.3 Plan gate: security alignment

Confirm the plan includes, when relevant:
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

### 5.4 Iterate

If any gate fails:
- Amend the plan.
- Re-run gates 5.1–5.3.
- Do not stop until all gates pass (or until user clarification is required).

---

## Output format

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

If any AC items were flagged in step 2.2, list them here and **STOP** for answers before continuing.

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
| Gate             | Status |
|------------------|--------|
| AC Mapping       | PASS / FAIL |
| Code Quality     | PASS / FAIL |
| Security         | PASS / FAIL |
```

**All gates must show PASS before the plan is finalized.**

After presenting the verified plan, ask the user:

> "Plan verified — all gates passed. Do you want me to implement this plan now?"

- If the user says **yes** → proceed to section 6 (Implementation).
- If the user says **no** or asks for changes → stop and wait for further instructions.

---

## Plan persistence

After the plan passes all gates and before asking the user to implement:

1. Write the full plan (from "Jira Story Summary" through "Gate Results") to:
   `$CURSOR_WORKFLOWS_REPO/plans/YYYY-MM-DD-{TICKET-KEY}-{short-slug}.md`
   - Example: `$HOME/agentic-workflow/plans/2026-02-27-PROJ-805-auth-logout-only-on-session-loss.md`
   - Derive the short slug from the story summary (lowercase, kebab-case, max 6 words).

2. The `afterFileEdit` hook will auto-commit the plan file to the workflows repo.

---

## 6) Implementation (after user confirms)

Only proceed with this section after the user has reviewed the plan and explicitly confirmed they want to implement it.

### 6.1 Branch management

```bash
currentBranch=$(git rev-parse --abbrev-ref HEAD)
ticketKey="<lowercase jira key>"
```

- If the current branch already contains the ticket key (e.g., `feature/PROJ-123-add-widget`), stay on it.
- If the current branch is `development` or `main`, create a new branch:
  - Format: `feature/{TICKET_KEY}-{short-kebab-description}` (e.g., `feature/PROJ-123-add-rv-maintenance-log`)
  - Derive the short description from the story summary.

### 6.2 Extract and apply Figma designs (if available)

Scan the normalized story content (description, comments, and linked issues from step 1) for Figma URLs. Figma links match patterns like:
- `https://www.figma.com/file/...`
- `https://www.figma.com/design/...`
- `https://www.figma.com/proto/...`
- `https://figma.com/...`

If one or more Figma links are found:

1. **Get file/node details via Figma MCP:**
   - For each Figma link, extract the file key and any node ID from the URL.
   - Call Figma MCP tool `get_figma_data` with the file key and node ID to retrieve design details (layout, components, styles, spacing, colors, typography).
   - If the Figma MCP is not available or the call fails, log a warning and continue without design data — do not block implementation.

2. **Map Figma designs to AC items:**
   - Match each design frame/screen to the relevant AC item(s).
   - Extract from the design data:
     - **Layout structure** — element hierarchy, flex/grid layout, alignment, padding, margins
     - **Spacing and sizing** — convert `px` values to `rem` (1rem = 10px with 62.5% root font-size per repo standards)
     - **Colors** — map to design system tokens from `@your-org/design-system`; flag any colors not in the token set
     - **Typography** — font family, weight, size; map to design system type tokens
     - **Component mapping** — identify which existing design system components can be reused vs. new components needed
     - **States** — default, hover, active, disabled, error, empty, loading states shown in the designs
     - **Responsive behavior** — if multiple breakpoints are present, note the differences

3. **Update the implementation plan with design specifications:**
   - For each AC item with a matching design, annotate the planned component structure with the Figma-derived layout and styling details.
   - If the design contradicts the AC or introduces UI elements not covered by AC, flag this to the user before proceeding.

If no Figma links are found, skip this step entirely and proceed to 6.3.

### 6.3 Implement in AC order

- Implement each AC item in the order listed in the plan.
- If Figma design data was extracted in 6.2, use it as the source of truth for visual implementation (layout, spacing, colors, typography). Defer to design system tokens over raw Figma values wherever a token match exists.
- After implementing each AC item:
  - Run lint for affected files.
  - Run type-check for affected workspaces: `yarn nx affected -t type-check`
  - Fix any lint/type errors before moving to the next AC item.

### 6.4 Write tests

- Create test files alongside source files (`{sourcefile}.test.{ts|tsx}`).
- Follow `.cursor/rules/unit-testing-standards.mdc` for test structure.
- React components: use React Testing Library with `getByRole` > `getByLabelText` > `getByText` > `getByTestId` priority.
- Pure functions: test happy path, edge cases (`null`, `undefined`, `false`, `-1`, `0`, empty), error conditions, boundary values.
- NestJS services: unit tests with mocked dependencies.

### 6.5 Run verification

After all AC items are implemented:

```bash
yarn nx affected -t type-check 2>&1 || true
yarn nx affected -t test 2>&1 || true
yarn nx affected -t lint 2>&1 || true
```

- If any check fails, fix the issue before declaring done.
- Do NOT commit until all checks pass.

### 6.6 Final output

After successful implementation, present:

```
| AC # | Description | Status      |
|------|-------------|-------------|
| 1    | ...         | IMPLEMENTED |
| 2    | ...         | IMPLEMENTED |

Files changed: {count}
Tests added:   {count}
Type-check:    PASS
Lint:          PASS
Tests:         PASS
```

Ask: "All AC items implemented and verified. Ready to commit?"
