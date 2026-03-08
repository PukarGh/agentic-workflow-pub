Perform a comprehensive technical debt scan across the entire repository. Identify, classify, and prioritize all forms of technical debt. Produce a structured report and publish/update it to Confluence.

---

## Step 0 — Load Standards & Context

Before scanning, read and internalize the following files from the **target repository** (resolved per `constants.md` in the workflows repo):

1. **`.cursor/commands/code-quality.md`** — Contains architecture, type safety, React/NestJS patterns, performance, testing, and code quality standards. Use every checklist item as a scanning criterion.
2. **`.cursor/commands/security-audit.md`** — Contains the severity model (🔴 Critical, 🟠 High, 🟡 Medium, 🔵 Low), mechanical checks, and semantic analysis dimensions. Adopt the same severity model for this scan.
3. **All `.cursor/rules/*.mdc` and `.cursor/rules/*.yaml` files** — These define repo-specific coding standards (React component standards, styling, exported functions, unit testing, NestJS architecture). Any violation of these rules is tech debt.
4. **`constants.md`** in the workflows repo (`agentic-workflow`) — Use the Confluence Cloud ID, repo resolution logic, and workspace groupings defined there.

These files are the **authoritative source of truth** for what constitutes acceptable code in this repository. Any deviation from them is technical debt.

---

## Step 1 — Scan Scope

Scan the **entire repository**, not just changed files. Group findings by workspace:

- `mfes/auth/`, `mfes/settings/` → MFE workspaces
- `apps/profile/`→ App workspaces

Skip: `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`, `storybook-static/`, `*.snap`, `yarn.lock`, lock files, binary files.

---

## Step 2 — Debt Categories & What to Scan For

For each category below, apply both the standards from the files loaded in Step 0 **and** industry best practices (SOLID, DRY, KISS, YAGNI, Clean Code, 12-Factor App, OWASP).

### 2.1 Dead Code

- Unused exports (functions, components, types, constants) — exported but never imported anywhere.
- Commented-out code blocks (not legitimate documentation comments).
- Unreachable code paths (after `return`, impossible conditions).
- Unused imports and variables.
- Deprecated functions/components still present but no longer called.
- Feature flags or conditional code for features that have shipped and are no longer toggled.

### 2.2 Duplicated Logic

- Functions or code blocks with identical or near-identical logic across files.
- Copy-pasted API call patterns that should use a shared utility.
- Repeated type definitions that should be in `types/`.
- Repeated utility functions that should be in `utils/`.
- Duplicated validation logic across MFEs or API modules.
- Similar React components that could be consolidated with props/composition.

### 2.3 Overly Complex Functions

- Functions exceeding 50 lines (per `code-quality.md` standards).
- Components exceeding 150 lines.
- Cyclomatic complexity > 10 (deeply nested conditionals, long switch/case chains).
- Functions with > 5 parameters.
- Deeply nested callbacks or promise chains (> 3 levels).
- God components that mix data fetching, business logic, and presentation.
- Long method chains without intermediate variables for readability.

### 2.4 Missing Tests

- Exported functions/components without corresponding `.test.ts(x)` files.
- Test files that exist but have inadequate coverage (only happy path, no edge cases).
- Critical business logic (auth, payment, data transformation) without tests.
- API endpoints without integration or unit tests.
- Utility functions without tests.
- Pure functions embedded in components that should be extracted and tested independently.

### 2.5 Slow / Problematic Database Queries

- N+1 query patterns (queries inside loops).
- Missing pagination on list endpoints (unbounded data fetching).
- Raw SQL queries instead of TypeORM repository methods.
- Missing database indexes implied by query patterns (frequent WHERE/ORDER BY on non-indexed columns).
- Eager loading of relations that aren't needed.
- Large joins without limits.

### 2.6 Outdated Dependencies

- Run `yarn outdated` (or equivalent) and capture results.
- Run `yarn audit` and capture vulnerability findings.
- Flag dependencies with known CVEs (Critical/High = 🔴/🟠).
- Flag dependencies > 2 major versions behind.
- Flag deprecated packages.
- Flag packages with better modern alternatives (e.g., `moment` → `date-fns`/`dayjs`).

### 2.7 Architecture & Pattern Violations

- Violations of separation of concerns (business logic in components, inline API calls).
- Direct imports between MFEs (all communication must go through events).
- Controllers with inline business logic (should delegate to services).
- `any` types in production code.
- `@ts-ignore` / `@ts-nocheck` directives.
- `require()` / `module.exports` in app code.
- Non-null assertions (`!`) masking potential undefined access.
- Missing Swagger decorators on API endpoints.
- Missing auth guards on protected endpoints.
- Hardcoded magic numbers/strings that should be constants.
- Inconsistent naming conventions.

### 2.8 Performance Debt

- Missing `useMemo`/`useCallback` on expensive computations passed to children.
- `.find()` / `.includes()` on large arrays during render (should use `Set`/`Map`).
- Full library imports instead of tree-shakeable imports (`lodash` vs `lodash/debounce`).
- Components missing `React.memo` that receive stable props.
- Unnecessary re-renders from unstable references.

### 2.9 Configuration & Infrastructure Debt

- Inconsistent environment variable patterns across workspaces.
- Missing `.env.example` entries for variables in use.
- Stale or unused Nx targets/configurations.
- Docker/CI configuration that could be optimized.
- Inconsistent tsconfig settings across workspaces.

---

## Step 3 — Classify Each Finding

Every identified tech debt item MUST include:

| Field                     | Description                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **ID**                    | Unique identifier: `TD-{CATEGORY_CODE}-{NNN}` (e.g., `TD-DC-001` for dead code #1)                                           |
| **Category**              | One of: Dead Code, Duplicated Logic, Complexity, Missing Tests, DB Queries, Outdated Deps, Architecture, Performance, Config |
| **Title**                 | Short descriptive title                                                                                                      |
| **Description**           | What the debt is and why it matters                                                                                          |
| **Location**              | File path(s) and line number(s)                                                                                              |
| **Severity**              | 🔴 Critical / 🟠 High / 🟡 Medium / 🔵 Low (use the severity model from `security-audit.md`)                                 |
| **Level of Effort**       | 🟢 Small (< 1 hour) / 🟡 Medium (1–4 hours) / 🟠 Large (4–16 hours) / 🔴 XL (> 16 hours / multi-sprint)                      |
| **Suggested Fix**         | Concrete, actionable remediation steps                                                                                       |
| **Affected Workspace(s)** | Which workspace(s) this impacts                                                                                              |
| **Status**                | `Open` (for new findings)                                                                                                    |

### Category Codes

- `DC` = Dead Code
- `DL` = Duplicated Logic
- `CX` = Complexity
- `MT` = Missing Tests
- `DB` = Database Queries
- `OD` = Outdated Dependencies
- `AR` = Architecture
- `PF` = Performance
- `CF` = Configuration

### Severity Criteria (aligned with `security-audit.md`)

| Severity    | When to Use                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 Critical | Blocks production stability, causes data loss, active security vulnerability, system-level failure risk                          |
| 🟠 High     | Significant maintainability risk, widespread pattern violation, missing auth/validation on write endpoints, will cause bugs soon |
| 🟡 Medium   | Code smell, moderate maintainability concern, missing tests on non-critical paths, minor pattern violations                      |
| 🔵 Low      | Nice-to-have cleanup, naming improvements, minor style inconsistencies, cosmetic issues                                          |

### Level of Effort Criteria

| Effort    | Scope                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| 🟢 Small  | Single file, mechanical change, no behavioral impact (e.g., remove unused import, rename variable)                   |
| 🟡 Medium | 1–3 files, straightforward refactor, low risk (e.g., extract a utility, add missing tests for one function)          |
| 🟠 Large  | 4+ files, architectural change, requires testing (e.g., extract a service, consolidate duplicated components)        |
| 🔴 XL     | Cross-workspace, breaking changes, migration required (e.g., replace a deprecated library, restructure event system) |

---

## Step 4 — Prioritization

After collecting all findings, produce a **prioritized list** sorted by:

1. **Severity** (🔴 > 🟠 > 🟡 > 🔵)
2. Within same severity, by **effort** ascending (🟢 > 🟡 > 🟠 > 🔴) — quick wins first.

---

## Step 5 — Produce the Report

Structure the final report in Confluence-compatible format (Atlassian Document Format / wiki markup) with these sections:

```
# Technical Debt Report — {Repository Name}

**Last scanned**: {YYYY-MM-DD}
**Scanned by**: Automated Technical Debt Scanner
**Repository**: {repo name}
**Branch**: {branch scanned}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Debt Items | N |
| 🔴 Critical | N |
| 🟠 High | N |
| 🟡 Medium | N |
| 🔵 Low | N |
| Quick Wins (🟢 Small effort) | N |
| Resolved Since Last Scan | N |

---

## Priority Action Items (Top 10)

{Top 10 highest-priority items with full detail}

---

## Findings by Category

### Dead Code
{Table of all dead code findings}

### Duplicated Logic
{Table of all duplication findings}

### Overly Complex Functions
{Table of all complexity findings}

### Missing Tests
{Table of all missing test findings}

### Database Queries
{Table of all DB query findings}

### Outdated Dependencies
{Table of all dependency findings}

### Architecture & Pattern Violations
{Table of all architecture findings}

### Performance
{Table of all performance findings}

### Configuration & Infrastructure
{Table of all config findings}

---

## Resolved Debt

{Table of previously identified items that are now resolved.
 Each row retains all original fields plus:
 - Status: `Resolved`
 - Last Resolved Date: {YYYY-MM-DD}
 DO NOT delete resolved items. Keep them for historical tracking.}

---

## Scan Methodology

Standards applied:
- Repository `.cursor/commands/code-quality.md`
- Repository `.cursor/commands/security-audit.md`
- Repository `.cursor/rules/*` standards files
- Industry: SOLID, DRY, KISS, YAGNI, Clean Code, 12-Factor, OWASP
```

---

## Step 6 — Publish to Confluence

Use the **Atlassian MCP** to publish the report.

### Target Document

- **URL**: `https://your-org.atlassian.net/wiki/x/XXXXX`
- **Cloud ID**: `00000000-0000-0000-0000-000000000000` (from `constants.md`)

---

Step 7 — Notify via Slack
After the Confluence page has been successfully published/updated, send a summary notification to Slack using the Slack MCP.

Target Channel: form this automation's configuration.

### Update Logic

1. **Fetch the existing Confluence page** at the target URL using the Atlassian MCP.
2. **Read the existing content** to identify previously reported debt items (by their `TD-*` IDs).
3. **For each previously reported item**:
   - If the debt **still exists** in this scan: update its details if anything changed (location, description), keep status as `Open`.
   - If the debt **no longer exists** (has been resolved): **do NOT delete it**. Move it to the "Resolved Debt" section, set `Status` to `Resolved`, and add `Last Resolved Date: {today's date YYYY-MM-DD}`.
4. **For new items** found in this scan that don't match existing IDs: add them as new entries with status `Open`.
5. **Update the page** with the full merged report (existing resolved + updated open + new findings).
6. Increment the page version appropriately when updating.

### Important

- Never delete previously identified debt items — resolved items serve as historical record.
- Preserve the `TD-*` ID scheme across scans for traceability.
- If the Confluence page does not yet exist, create it with the full report structure.

---

## Behavioral Rules

- Scan the **entire codebase**, not just recent changes.
- Be thorough — scan every file in the specified scope.
- Do NOT hallucinate findings. Every finding must reference a real file and line number. Verify the file and code exist before reporting.
- Do NOT fix anything during this scan. This is a read-only audit that produces a report.
- If a finding could fall under multiple categories, pick the most specific one.
- When in doubt about severity, err on the side of higher severity.
- Use parallel exploration (multiple search agents) to scan different workspaces concurrently for speed.

---
