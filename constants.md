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


| Key         | Value                                  |
| ----------- | -------------------------------------- |
| Cloud ID    | `00000000-0000-0000-0000-000000000000` |
| Key Pattern | `(PROJ|TEAM)-\d+`           |
| Default Spike Project | `PROJ`                         |


---

## Confluence


| Key                | Value                                  |
| ------------------ | -------------------------------------- |
| Cloud ID           | `00000000-0000-0000-0000-000000000000` |
| Spike Space Key    | `SPACE`                                   |
| Parent Page ID     | `123456789`                            |
| Page Title Prefix  | `Spike:`                               |


---

## Slack


| Key                | Value               |
| ------------------ | ------------------- |
| Workspace Label    | `your-org`           |
| Default Channel ID | ``                  |


---

## GitHub


| Key          | Value         |
| ------------ | ------------- |
| Org          | `your-org`     |
| Default Base | `development` |


---

## Artifacts

Artifact paths are relative to the **workflows repo** (`$HOME/agentic-workflow`), not the target repo.

| Key            | Value                                             |
| -------------- | ------------------------------------------------- |
| Base Directory | `$HOME/agentic-workflow/artifacts/`               |
| Requirements   | `artifacts/{STORY-ID}/YYYY-MM-DD-1-requirements.md` |
| Plan           | `artifacts/{STORY-ID}/YYYY-MM-DD-2-plan.md`         |
| Review         | `artifacts/{STORY-ID}/YYYY-MM-DD-3-review.md`       |
| Review Feedback| `artifacts/{STORY-ID}/YYYY-MM-DD-4-review-feedback.md` |
| Tracking       | `artifacts/{STORY-ID}/tracking.md`                 |

### Naming convention

Artifact filenames follow the pattern `YYYY-MM-DD-{N}-{step-name}.md` where `{N}` is the sequence number reflecting the workflow order:

| N | Step Name         | Example Filename                     |
|---|-------------------|--------------------------------------|
| 1 | requirements      | `2026-03-15-1-requirements.md`       |
| 2 | plan              | `2026-03-15-2-plan.md`               |
| 3 | review            | `2026-03-15-3-review.md`             |
| 4 | review-feedback   | `2026-03-15-4-review-feedback.md`    |

This ensures files sort chronologically and by workflow step when viewed in a directory listing.

### Multi-pass naming

When writing an artifact, **never overwrite or modify an existing file**. Before writing, check if a file matching the base name already exists in the artifact directory (regardless of date prefix). If it does, append ` - pass N` before the `.md` extension, where `N` is the next sequential pass number.

| Pass | Filename example                              |
| ---- | --------------------------------------------- |
| 1st  | `YYYY-MM-DD-3-review.md` (no suffix)         |
| 2nd  | `YYYY-MM-DD-3-review - pass 2.md`            |
| 3rd  | `YYYY-MM-DD-3-review - pass 3.md`            |

To determine `N`: count files in the artifact directory whose names end with the same base name (e.g. `*-review*.md`). If the count is 0, use the base name. Otherwise, `N = count + 1`.

This applies to all artifact types: `requirements`, `plan`, `review`, and `review-feedback`. It does **not** apply to `tracking.md` (which is append-only).


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


| Key         | Value                                   |
| ----------- | --------------------------------------- |
| Local Path  | `$HOME/code/design-system`  |
| Base Branch | `main`                                  |
| GitHub Repo | `design-system`                         |


**Cursor Rules:** (none)

**Verification Commands:** (none)


