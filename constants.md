# Workflow Constants

Central configuration referenced by all workflow commands.

Two repos are involved in every workflow run:

- **Workflows repo** (`$HOME/agentic-workflow` / `agentic-workflow`) — where commands, constants, and artifacts live.
- **Target repo** (e.g. `web-app`) — where code changes, git operations, rules files, and verification commands live.

---

## Repo Resolution

The agent determines the **target repo** by matching its current working directory against the `Local Path` entries in the Repositories section below.

- If CWD is within (or equal to) a listed `Local Path`, that repository is the active target repo.
- If no match is found, stop and ask the user which repo they are working in.
- Once resolved, use the matched repo's config (rules, verification commands, GitHub details, base branch) for the rest of the session.

---

## Jira

| Key                   | Value                                  |
| --------------------- | -------------------------------------- |
| Cloud ID              | `00000000-0000-0000-0000-000000000000` |
| Key Pattern           | `(PROJ|TEAM)-\d+`                                  |
| Default Spike Project | `PROJ`                                  |

---

## Confluence

| Key               | Value                                  |
| ----------------- | -------------------------------------- |
| Cloud ID          | `00000000-0000-0000-0000-000000000000` |
| Spike Space Key   | `SPACE`                                   |
| Parent Page ID    | `123456789`                            |
| Page Title Prefix | `Spike:`                               |

---

## Slack

| Key                | Value     |
| ------------------ | --------- |
| Workspace Label    | `your-org` |
| Default Channel ID | ``        |

---

## GitHub

| Key          | Value         |
| ------------ | ------------- |
| Org          | `your-org`     |
| Default Base | `development` |

---

## Artifacts

Artifact paths are relative to the **workflows repo** (`$HOME/agentic-workflow`), not the target repo.

| Key                  | Value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Base Directory       | `$HOME/agentic-workflow/artifacts/`              |
| Requirements         | `artifacts/{STORY-ID}/YYYY-MM-DD-1-requirements ({n}).md`         |
| Plan                 | `artifacts/{STORY-ID}/YYYY-MM-DD-2-plan ({n}).md`                 |
| Review               | `artifacts/{STORY-ID}/YYYY-MM-DD-3-review ({n}).md`               |
| Review Feedback Plan | `artifacts/{STORY-ID}/YYYY-MM-DD-4-review-feedback-plan ({n}).md` |
| Review Feedback      | `artifacts/{STORY-ID}/YYYY-MM-DD-4-review-feedback ({n}).md`      |
| Tracking             | `artifacts/{STORY-ID}/tracking.md`                                |

### Naming convention

Artifact filenames follow the pattern `YYYY-MM-DD-{N}-{step-name} ({n}).md` where:

- `YYYY-MM-DD` — the current date
- `{N}` — a fixed sequence number reflecting the workflow order
- `{step-name}` — the step slug
- `{n}` — the pass number (always present, starting at 1)

To determine `{n}`: count files in the artifact directory whose names match the same step name (e.g. `*-review*.md`). Set `n = count + 1`. The first artifact for a step is always `(1)`.

| N   | Step Name            | Example Filename                           |
| --- | -------------------- | ------------------------------------------ |
| 1   | requirements         | `2026-03-15-1-requirements (1).md`         |
| 2   | plan                 | `2026-03-15-2-plan (1).md`                 |
| 3   | review               | `2026-03-15-3-review (1).md`               |
| 4   | review-feedback-plan | `2026-03-15-4-review-feedback-plan (1).md` |
| 4   | review-feedback      | `2026-03-15-4-review-feedback (1).md`      |

This ensures files sort chronologically and by workflow step when viewed in a directory listing.

### Multi-pass naming

When writing an artifact, **never overwrite or modify an existing file**. Before writing, count existing files matching the step name (e.g. `*-review*.md`) and use `n = count + 1`.

| Pass | Filename example             |
| ---- | ---------------------------- |
| 1st  | `2026-03-15-3-review (1).md` |
| 2nd  | `2026-03-18-3-review (2).md` |
| 3rd  | `2026-03-20-3-review (3).md` |

This applies to all artifact types: `requirements`, `plan`, `review`, `review-feedback-plan`, and `review-feedback`. It does **not** apply to `tracking.md` (which is append-only).

---

## Repositories

All **Cursor Rules** paths and **Verification Commands** paths listed under each repository are **relative to that repo's root** (i.e. resolve them against the repo's `Local Path`).

### web-app

| Key         | Value                               |
| ----------- | ----------------------------------- |
| Local Path  | `$HOME/code/web-app` |
| Base Branch | `development`                       |
| GitHub Repo | `web-app`                        |

**Cursor Rules:**

| Rule                      | Path                                                 |
| ------------------------- | ---------------------------------------------------- |
| Security Standards        | `.cursor/rules/security-standards.mdc`               |
| React Component Standards | `.cursor/rules/react-component-standards.mdc`        |
| React Component Styling   | `.cursor/rules/react-component-styling.mdc`          |
| Exported Functions        | `.cursor/rules/exported-functions.mdc`               |
| Unit Testing Standards    | `.cursor/rules/unit-testing-standards.mdc`           |
| NestJS API Architecture   | `.cursor/rules/api-nest-architecture.yaml` |

**Verification Commands:**

| Command        | Path                                 |
| -------------- | ------------------------------------ |
| Verify AC      | `.cursor/commands/verify-ac.md`      |
| Code Quality   | `.cursor/commands/code-quality.md`   |
| Security Audit | `.cursor/commands/security-audit.md` |
| Pre-PR Review  | `.cursor/commands/pre-pr-review.md`  |

### design-system

| Key         | Value                                  |
| ----------- | -------------------------------------- |
| Local Path  | `$HOME/code/design-system` |
| Base Branch | `main`                                 |
| GitHub Repo | `design-system`                        |

**Cursor Rules:** (none)

**Verification Commands:** (none)
