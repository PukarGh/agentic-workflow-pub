# Workflow Constants

Central configuration referenced by all workflow commands.

Two repos are involved in every workflow run:

- **Workflows repo** (`$CURSOR_WORKFLOWS_REPO` / `agentic-workflow`) — where commands, constants, and artifacts live.
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

Artifact paths are relative to the **workflows repo** (`$CURSOR_WORKFLOWS_REPO`), not the target repo.

| Key            | Value                                             |
| -------------- | ------------------------------------------------- |
| Base Directory | `$CURSOR_WORKFLOWS_REPO/artifacts/`               |
| Requirements   | `artifacts/{STORY-ID}/YYYY-MM-DD-requirements.md` |
| Plan           | `artifacts/{STORY-ID}/YYYY-MM-DD-plan.md`         |
| Tracking       | `artifacts/{STORY-ID}/tracking.md`                 |


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


