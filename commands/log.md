# Log Workflow Event

Utility command that appends a tracking row to a story's tracking log. Called by other workflow commands — not intended for direct user invocation.

---

## Usage

Called internally by workflow commands with the following parameters:

- **STORY-ID** (required): Jira story key (e.g. `PROJ-123`)
- **STEP** (required): command name (e.g. `1-research`, `2-plan`, `3-implement`, `4-push-pr`, `implement-task`)
- **EVENT** (required): one of `STARTED`, `COMPLETED`, `FAILED`, `WAITING_FOR_USER`, `RESUMED`, `SKIPPED`
- **INVOKED_VIA** (required): `orchestrator` or `standalone`
- **NOTES** (optional): short one-liner (e.g. "artifact written", "PR #247 created", "ambiguous AC flagged")

---

## Behavior

1. Determine the tracking file path: `$CURSOR_WORKFLOWS_REPO/artifacts/{STORY-ID}/tracking.md`

2. If the file does not exist, create it with:

```markdown
# Workflow Tracking: {STORY-ID}

| Timestamp (UTC) | Step | Event | Invoked Via | Notes |
|-----------------|------|-------|-------------|-------|
```

3. Append a single row to the table with the current UTC timestamp and the provided parameters:

```
| {YYYY-MM-DD HH:MM:SS} | {STEP} | {EVENT} | {INVOKED_VIA} | {NOTES or empty} |
```

4. Return immediately — do not block the calling command.
