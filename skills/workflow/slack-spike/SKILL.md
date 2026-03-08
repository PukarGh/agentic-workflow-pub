---
name: slack-spike
description: Slack to Spike
disable-model-invocation: true
---

# Slack to Spike

Read a Slack message via Slack MCP, run preliminary research, present a brief recommended response, and ask whether deeper research plus Confluence documentation is needed. If approved, create a Confluence spike page and optionally a Jira follow-up card linked to that page.

---

## Usage

- `/slack-spike <slack-message-link-or-channel-and-ts>`

Examples:

- `/slack-spike https://app.slack.com/client/T000/C111/p1731029255001209`
- `/slack-spike C11111111 1731029255.001209`

---

## Configuration

Read `$CURSOR_WORKFLOWS_REPO/constants.md` for:

- Jira cloud/project settings:
  - `Cloud ID`
  - `Key Pattern`
  - `Default Spike Project`
- Confluence destination settings:
  - `Cloud ID`
  - `Spike Space Key`
  - `Parent Page ID`
  - `Page Title Prefix`
- Slack defaults:
  - `Workspace Label`
  - `Default Channel ID` (optional)

**Repo context:**

- Resolve the **target repo** by matching CWD against repository `Local Path` entries in `constants.md`.
- All codebase research runs in the **target repo**.
- Optional local artifacts for notes can be written under `$CURSOR_WORKFLOWS_REPO/artifacts/...`.
- Confluence destination must be taken strictly from config values in `constants.md` (cloud, space, and parent page). Do not override from ad-hoc input.

---

## 0) Input validation

Accept one of:

- Full Slack message link
- Pair of values: `{channelId} {messageTs}`

If input is missing or malformed, ask the user for a valid Slack message reference and stop.

---

## 1) Discover and validate MCP tools before use

Before calling any MCP tool:

1. Read the relevant MCP tool descriptor schema from the MCP file system.
2. Validate required parameters and output shapes.
3. Then call the tool.

Do this for all tools you intend to call in this command:

- Slack MCP read-message tool(s)
- Atlassian MCP tools for Confluence page creation
- Atlassian MCP tools for Jira issue creation

If required MCP tools are unavailable, report the missing tool names and stop.

Also validate required configuration values before continuing:

- `Confluence Cloud ID`
- `Spike Space Key`
- `Parent Page ID`
- `Default Spike Project`

If any of the above is missing, stop and ask the user to update `constants.md`.

---

## 2) Read Slack message

Using Slack MCP, fetch:

- Message text/body
- Channel ID/name
- Author (if available)
- Message permalink
- Thread replies (if available)
- Attachments/snippets/links (if available)

Normalize into:

- `problem_statement` (what is being asked)
- `constraints` (explicit limits, timelines, non-goals)
- `references` (URLs, ticket IDs, design links)
- `open_questions` (unknowns that must be researched)

If the message content is too vague to proceed, ask clarifying questions and stop.

---

## 3) Preliminary research + proposed response

Run a lightweight first-pass analysis in the **target repo** focused on answering the Slack ask quickly.

At minimum:

1. Identify likely impacted area(s).
2. Check whether similar implementation already exists.
3. Identify obvious constraints/risks.
4. Produce an initial answer or recommendation.

Then present the user:

- A brief overview of findings (3-6 bullets max)
- The preliminary answer/response you would give in Slack
- Whether the issue appears `trivial` vs `needs deeper spike`

Ask and stop:

> "Would you like me to proceed with in-depth research and create a Confluence spike document?"

- If user says **no**: stop (no Confluence doc, no Jira card).
- If user says **yes**: continue to step 4.
- If user asks for edits to the preliminary response: revise and re-ask.

---

## 4) In-depth research codebase context

Research enough context in the **target repo** to produce a credible spike recommendation.

At minimum:

1. Identify impacted domains/modules/workspaces.
2. Locate existing implementations/patterns relevant to the Slack ask.
3. Identify integration points, data contracts, and likely side effects.
4. Identify risks, unknowns, and validation paths (tests/verification).
5. Assess if requested behavior conflicts with existing architecture/rules.

Research output must include:

- `current_state`
- `gaps`
- `options` (1-3 feasible approaches with trade-offs)
- `recommendation` (preferred option and why)
- `estimated_scope` (small/medium/large + rationale)

If the ask is invalid or risky, challenge it and propose a safer alternative.

---

## 5) Draft spike document content

Create a draft spike body with this structure:

1. Context (Slack source + normalized ask)
2. Problem Statement
3. What Was Researched
4. Current Implementation Findings
5. Options Considered
6. Recommendation
7. Risks and Mitigations
8. Suggested Implementation Plan (high-level)
9. Open Questions
10. Decision Needed

Include:

- Slack permalink
- Any referenced Jira keys / design links
- Concrete file/module references from research

---

## 6) Confirm before Confluence page creation (STOP)

Present a concise preview to the user and ask:

> "Spike draft is ready. Do you want me to publish this to Confluence now?"

- If user says **no**: stop.
- If user asks for edits: revise and re-confirm.
- If user says **yes**: continue to step 7.

---

## 7) Create Confluence spike page

Using Atlassian MCP:

1. Resolve cloud/workspace using `Confluence Cloud ID` from `constants.md`.
2. Create a Confluence page in:
   - Space: `Spike Space Key`
   - Parent page: `Parent Page ID` (required)
3. Title format:
   - `{Page Title Prefix} {short topic from Slack ask}`
4. Body:
   - Use the approved spike content from step 5.

Strict rule: always create the page in the exact configured Confluence space and exact configured parent page from `constants.md`.

Capture the resulting Confluence page URL and page ID.

If page creation fails, report error details and stop before Jira creation.

---

## 8) Create Jira follow-up card (if recommendation exists)

If the spike includes a concrete recommendation requiring implementation:

1. Create a Jira issue using Atlassian MCP in project:
   - `Default Spike Project` from `constants.md`
2. Issue type: `Story` (default) unless recommendation clearly maps to `Task`/`Bug`.
3. Title format:
   - `Implement recommendation from spike: {short topic}`
4. Description must include:
   - Link to the Confluence spike page
   - Recommendation summary
   - Proposed scope and risks
   - Suggested acceptance criteria (bullet list)

If no actionable recommendation exists, skip Jira creation and state why.

---

## 9) Offer Slack thread reply (if Confluence/Jira links exist)

If a Confluence page and Jira issue were created, ask:

> "Do you want me to reply in the original Slack thread with the Confluence spike and Jira links?"

- If user says **yes**: post a concise thread reply including both links and one-line context.
- If user says **no**: skip posting.

---

## 10) Final output

Return:

- Slack source reference used
- Confluence spike page URL
- Jira issue key/URL (if created)
- One-paragraph recommendation summary
- Explicit next step for implementation
- Slack thread reply status (posted/skipped)

If Jira was skipped, return:

- "No follow-up Jira card created" with reason.
