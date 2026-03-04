# Implement Plan — Execute Verified Implementation

Execute a previously verified implementation plan for a Jira story. Handles branch management, optional Figma design extraction, AC-ordered implementation, test writing, and verification.

---

## Usage

- `/3-implement PROJ-123`

---

## Configuration

Read `$CURSOR_WORKFLOWS_REPO/constants.md` for:
- Active repository config (rules paths, base branch)
- Artifact path conventions

**Repo context:**
- Resolve the **target repo** from CWD. All git operations (branch management), code changes, test creation, and verification commands (`yarn nx affected ...`) run in the **target repo**.
- Artifacts are read from `$CURSOR_WORKFLOWS_REPO/artifacts/...` (the **workflows repo**).
- Rules files referenced via `constants.md` are resolved relative to the **target repo root**.

---

## Tracking

Use `/log` (see `commands/log.md`) to record events. Invoked via = `orchestrator` if called by `/implement-task`, otherwise `standalone`.

- On start: `/log {STORY-ID} 3-implement STARTED {invoked_via}`
- On completion: `/log {STORY-ID} 3-implement COMPLETED {invoked_via} "{files changed, tests added}"`
- On failure: `/log {STORY-ID} 3-implement FAILED {invoked_via} "{error summary}"`

---

## 0) Load plan artifact

Look for the most recent plan artifact at:

```
$CURSOR_WORKFLOWS_REPO/artifacts/{STORY-ID}/YYYY-MM-DD-plan.md
```

If not found, stop and instruct:

> "No plan artifact found for {STORY-ID}. Run `/2-plan {STORY-ID}` first."

Also load the requirements artifact at:

```
$CURSOR_WORKFLOWS_REPO/artifacts/{STORY-ID}/YYYY-MM-DD-requirements.md
```

Read both artifacts to extract:
- Step-by-step implementation plan
- AC list with mapped file paths
- Testing plan
- Jira story summary (for branch naming)

---

## 1) Branch management

```bash
currentBranch=$(git rev-parse --abbrev-ref HEAD)
ticketKey="<lowercase jira key>"
```

- If the current branch already contains the ticket key (e.g., `feature/PROJ-123-add-widget`), stay on it.
- If the current branch is `development` or `main`, create a new branch:
  - Format: `feature/{TICKET_KEY}-{short-kebab-description}` (e.g., `feature/PROJ-123-add-rv-maintenance-log`)
  - Derive the short description from the story summary.

---

## 2) Extract and apply Figma designs (if available)

Scan the requirements artifact (description, comments, and linked issues) for Figma URLs. Figma links match patterns like:
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
     - **Spacing and sizing** — convert `px` values to `rem` (per repo standards)
     - **Colors** — map to design system tokens; flag any colors not in the token set
     - **Typography** — font family, weight, size; map to design system type tokens
     - **Component mapping** — identify which existing design system components can be reused vs. new components needed
     - **States** — default, hover, active, disabled, error, empty, loading states shown in the designs
     - **Responsive behavior** — if multiple breakpoints are present, note the differences

3. **Annotate the plan with design specifications:**
   - For each AC item with a matching design, annotate the planned component structure with the Figma-derived layout and styling details.
   - If the design contradicts the AC or introduces UI elements not covered by AC, flag this to the user before proceeding.

If no Figma links are found, skip this step entirely.

---

## 3) Implement in AC order

- Implement each AC item in the order listed in the plan.
- If Figma design data was extracted in step 2, use it as the source of truth for visual implementation (layout, spacing, colors, typography). Defer to design system tokens over raw Figma values wherever a token match exists.
- After implementing each AC item:
  - Run lint for affected files.
  - Run type-check for affected workspaces: `yarn nx affected -t type-check`
  - Fix any lint/type errors before moving to the next AC item.

---

## 4) Write tests

- Create test files alongside source files (`{sourcefile}.test.{ts|tsx}`).
- Follow the unit testing standards from the repo's rules (path in `constants.md`).
- React components: use React Testing Library with `getByRole` > `getByLabelText` > `getByText` > `getByTestId` priority.
- Pure functions: test happy path, edge cases (`null`, `undefined`, `false`, `-1`, `0`, empty), error conditions, boundary values.
- NestJS services: unit tests with mocked dependencies.

---

## 5) Run verification

After all AC items are implemented:

```bash
yarn nx affected -t type-check 2>&1 || true
yarn nx affected -t test 2>&1 || true
yarn nx affected -t lint 2>&1 || true
```

- If any check fails, fix the issue before declaring done.
- Do NOT commit until all checks pass.

---

## 6) Output

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

Ask:

> "All AC items implemented and verified. Ready to push and create a PR? Run `/4-push-pr` to proceed."

Do NOT commit or push from this command.
