---
name: kowalski-analysis
description: Multi-step deep research workflow (codebase + industry best practices + solution options) with a mandatory plan-then-approve gate before execution. Use when the user asks for a "deep research", "spike", "analysis", "investigation", "kowalski analysis", or wants a methodical, evidence-based recommendation on an architectural / process / tooling problem.
disable-model-invocation: true
---

# Kowalski, Analysis

A generic, evidence-based deep-research workflow. Produces a numbered set of artifacts that build a complete picture of a problem: current state -> reproduction -> external research -> alternatives -> solution options -> phased recommendation.

**Hard rule:** Always plan first, get explicit user approval, then execute. No execution before approval. No silent scope changes.

---

## Usage

- `/kowalski-analysis <input>`

`<input>` is flexible. Any of the following is accepted:

| Input shape                       | Example                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Topic slug + free-text statement  | `release-process-investigation Accidental cross-team releases via shared staging`                |
| Free-text problem only            | `p95 itinerary GET requests jumped 4x last week, suspect query plan regression`                  |
| Jira issue key                    | `PROJ-873`                                                                                        |
| Jira issue URL                    | `https://your-org.atlassian.net/browse/PROJ-873`                                                    |
| Confluence/spike page URL         | `https://your-org.atlassian.net/wiki/spaces/SPACE/pages/123456789/Spikes`                             |
| Slack message link                | `https://your-org.slack.com/archives/C0XXX/p1731029255001209`                                     |
| GitHub issue / PR URL             | `https://github.com/your-org/web-app/issues/1234`                                              |
| Empty                             | (skill asks for one of the above)                                                                |

### Input normalization

Resolve `<input>` to the canonical frame `{topic-slug, problem-statement, source-refs[]}` before planning:

1. **If input matches a Jira key pattern** (per `constants.md` Key Pattern, e.g. `PROJ-873`):
   - Validate MCP availability (`mcps/<atlassian>/tools/getJiraIssue.json`).
   - Fetch via Atlassian MCP `getJiraIssue` (fields: `summary`, `description`, `status`, `labels`, `comment`, `issuelinks`, `parent`).
   - Derive `topic-slug` = `{KEY-lower}-{kebab-case-summary-truncated-to-6-words}`.
   - Derive `problem-statement` from summary + description + any AC; fold material clarifications from comments.
   - Add the Jira URL to `source-refs`.
2. **If input is a Jira URL**: extract the key from the path, then run step 1.
3. **If input is a Confluence page URL**: extract `pageId`; fetch via Atlassian MCP `getConfluencePage`; treat its title as topic seed and its body as problem context.
4. **If input is a Slack message link**: parse `{channelId, ts}`; fetch via Slack MCP; use message text as `problem-statement`, derive `topic-slug` from the first 6 meaningful words.
5. **If input is a GitHub issue/PR URL**: parse `{owner, repo, number}`; fetch via `gh issue view` / `gh pr view`; use title + body as seed.
6. **If input starts with a kebab-case token followed by free text**: treat first token as `topic-slug`, remainder as `problem-statement`.
7. **If input is free text only**: derive `topic-slug` from the first 3-6 meaningful words (kebab-case, lowercase, alphanumerics + hyphens). Use the full text as `problem-statement`.
8. **If input is empty**: ask for one of the supported shapes and stop.

If a referenced MCP is missing, **stop and notify the user** — do not silently fall back. (User rule: do not work around missing tools.)

### Confirm the resolved frame (lightweight gate)

After normalization but before Phase 1 framing, echo the resolved frame in one short block and ask for confirmation if any field was inferred:

```
Resolved input:
  topic-slug:        {slug}
  problem-statement: {one-paragraph, possibly truncated}
  source-refs:
    - {url-or-key-1}
    - {url-or-key-2}
```

If the slug or problem statement was **fully derived** (i.e., user didn't supply them verbatim), ask: "Use this frame, edit slug/statement, or cancel?" Otherwise proceed straight to Phase 1.

---

## Configuration

Read `$HOME/agentic-workflow/constants.md` for:

- Repository `Local Path` (to resolve target repo from CWD)
- Artifact `Base Directory`

**Repo context:**

- Resolve the **target repo** from CWD via `constants.md` Repositories section. All git/codebase scans run there.
- All artifacts are written to: `{Artifact Base Directory}/{topic-slug}/`
- This skill **does not** create Confluence pages, Jira issues, or PRs. Output is artifacts only.

---

## Required tools

Validate availability before planning. If any are unavailable, **stop and notify the user**; do not improvise.

**Always required:**

- `Shell` (git, rg, gh, ls)
- `Read`, `Glob`, `Grep` (codebase inspection)
- `WebSearch` and/or `WebFetch` (industry research)
- `Task` with `subagent_type=explore` (parallelizable codebase exploration)
- `TodoWrite` (track plan steps)

**Conditionally required (based on input shape):**

| Input shape                | Tool/MCP needed                                                   |
| -------------------------- | ----------------------------------------------------------------- |
| Jira key or URL            | Atlassian MCP `getJiraIssue` (+ `getAccessibleAtlassianResources`)|
| Confluence URL             | Atlassian MCP `getConfluencePage`                                 |
| Slack message link         | Slack MCP read-message tool                                       |
| GitHub issue/PR URL        | `gh` CLI (or GitHub MCP equivalent)                               |

Validate via the MCP descriptor files at `mcps/<server>/tools/*.json` before invoking. If a required MCP is missing for the supplied input shape, stop and notify.

---

## Workflow Overview

```
Phase 1: Frame the problem (no research yet)
Phase 2: Generate research plan        <-- STOP for user approval
Phase 3: Execute plan step-by-step     <-- one artifact per step
Phase 4: Final synthesis artifact
Phase 5: Hand off (artifact index + open decisions)
```

---

## Phase 1: Frame the problem

Starting from the resolved frame (`{topic-slug, problem-statement, source-refs[]}` from input normalization), capture a sharper outline in scratch (do not write to disk yet):

1. **Problem statement** (1-3 sentences, restated in your own words; refined from the input)
2. **Reported symptoms** (what the user/source actually observes)
3. **Suspected domain** (which subsystem(s), which package(s), which workflows)
4. **Constraints / non-goals** (what's explicitly out of scope; pull from Jira AC, Slack thread, or input text if present)
5. **Success criteria** for the research itself (e.g., "produce a phased recommendation with at least two viable options and concrete file-level changes")
6. **Source refs** (carry forward all `source-refs` from normalization — Jira key, Confluence pageId, Slack permalink, GitHub URL)

If any of #1–#5 are unclear after consulting the input source, **ask the user before planning**. Vague framing produces vague research.

---

## Phase 2: Generate the research plan (STOP gate)

Produce a research plan, **not an implementation plan**. The plan describes *what* will be researched and *how*, broken into discrete steps. Each step yields one artifact.

### 2.1 Default step template

Use the following step skeleton as a baseline and **tailor each step's title and scope to the topic**. Drop steps that don't apply; add domain-specific steps where the topic demands them.

| #   | Step                              | Purpose                                                                                                  | Typical methods                                                          |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 01  | Scope & current-state inventory   | Map the system surface relevant to the problem: packages, services, data flows, branches, tags, configs. | `Glob`, `Grep`, `git log/branch/tag`, `Read` on key configs              |
| 02  | Configuration / tooling audit     | How the relevant subsystem is configured today, version pins, manifests.                                 | `Read` of config/manifest files, dependency graphs                       |
| 03  | Mechanism / workflow audit        | How it actually operates end-to-end: scripts, workflows, runtime paths.                                  | `Read` of workflows/CI/runtime entry points, sequence diagrams           |
| 04  | Documented vs actual reality      | Where docs disagree with code/behavior; drift inventory.                                                 | `Read` docs, cross-check against findings from steps 01-03               |
| 05  | Problem reproduction              | Concrete, evidence-backed reproduction of each reported symptom.                                         | `git log/show`, real commits, real changelogs, real logs / metrics       |
| 06  | Industry best practices survey    | What other orgs / OSS projects do for this class of problem.                                             | `WebSearch`, `WebFetch`, citations to canonical sources (Fowler, RFCs)   |
| 07  | Tooling / alternatives comparison | Available tools or architectural alternatives, with trade-offs.                                          | `WebSearch`, vendor docs, comparison matrix                              |
| 08  | Solution options                  | 2-5 distinct options with concrete file-level changes, effort, risk.                                     | Synthesis of 01-07 + delta against current state                         |
| 09  | Synthesis & phased recommendation | Final answer: phased plan, open decisions, follow-up spikes.                                             | Tabulated risks, decision matrix, explicit open questions for the user   |

For lighter topics, collapse to fewer steps (e.g., 5 steps). For heavier topics, split a step into sub-steps. **Never** drop steps 01, 05, 08, 09 — they are the load-bearing skeleton.

### 2.2 Plan format

Print the plan to chat (do not write to disk). Format:

```markdown
## Research Plan: {topic-slug}

**Problem statement:** {one paragraph}

**Source refs:** {Jira key / Confluence URL / Slack link / GitHub URL / "user-supplied free text"}

**Out of scope:** {bullets}

**Steps:**

1. **{Step title}** — {1-2 sentences on what this step covers and how}
   - Inputs: {files / branches / external sources to consult}
   - Output: `01-{step-slug}.md`
   - Estimated tool calls: {low / medium / high}
2. **{Step title}** — ...
...

**Final deliverable:** `09-synthesis-and-recommendation.md` containing phased recommendation and open decisions.
```

### 2.3 STOP and ask

After printing the plan, post exactly one question and **wait**:

> "Plan above. Approve to execute as-is, request edits, or cancel?"

Do not proceed to Phase 3 until the user explicitly approves (a "yes", "go", "execute", "approved", "lgtm", or equivalent). Edits restart Phase 2.

---

## Phase 3: Execute the plan

Once approved:

### 3.1 Create artifact directory

```bash
mkdir -p $HOME/agentic-workflow/artifacts/{topic-slug}
```

If the directory already contains files from a prior run, **do not overwrite**. Append a suffix (e.g., `release-process-investigation-v2`) and confirm with the user before proceeding.

### 3.2 Track progress with TodoWrite

Create one todo per planned step. Mark exactly one as `in_progress` at a time. Mark `completed` immediately on finishing each step's artifact.

### 3.3 Per-step execution rules

For each step:

1. **Parallelize where possible.** If two sub-investigations are independent (e.g., codebase grep + web search), launch them in the same message via parallel `Task` (`subagent_type=explore`) and/or `WebSearch` calls.
2. **Evidence-first.** Every claim in an artifact must cite at least one of:
   - File path with line range, e.g., `path/to/file.ts:42-67`
   - Git ref (commit SHA, branch, tag), with the relevant `git show` or `git log` excerpt
   - Web source URL with title and access date
   - Tool output (workflow run ID, log line, query result)
3. **No speculation.** If a claim cannot be backed by evidence, label it explicitly: `(hypothesis — not yet verified)` and add a follow-up to the synthesis step.
4. **Cross-link.** When a finding builds on a prior step, reference the prior artifact by relative path (e.g., `[01-codebase-inventory.md](01-codebase-inventory.md)`).
5. **Write the artifact** before moving on. One file per step. Use the artifact template below.

### 3.4 Artifact template

```markdown
# Step {NN}: {Step Title}

**Date:** YYYY-MM-DD
**Topic:** {topic-slug}
**Inputs:** {files, branches, sources consulted}

## 1. Objective

{1-2 sentences on what this step is meant to establish}

## 2. Method

{What was actually done: which files read, which commands run, which queries issued. Reproducible.}

## 3. Findings

{Numbered or tabulated, each with explicit evidence. Use code references for in-repo evidence.}

## 4. Implications for next steps

{What this means for the remainder of the plan. Flag any new questions surfaced.}

## 5. Open questions / gaps

{Anything left unresolved, to be carried into synthesis.}
```

### 3.5 STOP gates within Phase 3

If during a step you discover that the plan is materially wrong (e.g., the symptom turns out to be something different), **stop**, surface the discovery to the user, and ask whether to revise the plan before continuing. Do not silently re-scope.

---

## Phase 4: Final synthesis artifact

The last artifact (`09-synthesis-and-recommendation.md` or whichever number is final) **must** include:

1. **Ground truth recap** — table of headline findings from earlier steps with source links
2. **Core diagnosis** — one paragraph naming the root cause(s) in plain language
3. **Recommended path forward** — phased (Phase 0/1/2/3 ordering of effort vs leverage), each phase with:
   - Rationale
   - Concrete deliverables
   - Success metrics
4. **Reasoning summary** — Q&A table addressing "why this order, why not X first" objections
5. **Risks and mitigations** across the recommended path
6. **Open decisions required from the user** — explicit, numbered, blocking questions
7. **Suggested next research / spike topics** — 1-day to 2-day de-risking spikes
8. **One-paragraph final recommendation** — the TL;DR a busy stakeholder reads first
9. **Artifact index** — table linking every prior step file with its purpose

---

## Phase 5: Hand off

After the synthesis artifact is written:

1. Print a hand-off summary in chat:
   - Path to the artifact directory
   - One-line per artifact
   - The 1-paragraph recommendation from the synthesis
   - The list of open decisions awaiting user input
2. **Do not** create Confluence pages, Jira issues, PRs, or edit production files. This skill ends at the artifact handoff. Other skills (e.g., `slack-spike`, the workflow `/2-plan`) consume these artifacts downstream.

---

## Defaults & conventions

| Concern                | Default                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Artifact filenames     | `NN-kebab-case-step-name.md` (e.g., `01-codebase-inventory.md`)                          |
| Step count             | Default 9; minimum 5 (always include 01, 05, 08, 09 equivalents)                         |
| Parallelism            | Use parallel `Task` (`explore`) + `WebSearch` calls within a single step where sensible  |
| Evidence threshold     | Every finding cites file:line / commit SHA / URL / tool output                           |
| Speculation            | Allowed only when explicitly labeled `(hypothesis — not yet verified)`                   |
| Confluence / Jira / PR | **Not in scope.** Out of band. Skill ends at artifact handoff.                           |
| Re-running             | New runs land in `{topic-slug}-v2`, `-v3`, etc. — never overwrite                        |

---

## Failure modes & escapes

| Situation                                                                 | Action                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Required tool (MCP, CLI, or web) unavailable                              | Stop, notify user, do not improvise                                                          |
| Plan generated but user does not respond                                  | Wait. Do not start execution.                                                                |
| Mid-execution discovery invalidates the plan                              | Stop, surface to user, request revised plan approval before continuing                       |
| Evidence gap on a key claim                                               | Label as hypothesis, add to synthesis open questions; do not fabricate evidence              |
| Artifact directory already exists with content                            | Append `-v2` suffix and confirm with user before proceeding                                  |
| Topic is too vague to plan ("make it faster")                             | Stop in Phase 1, demand a sharper problem statement and at least one observable symptom      |
| Jira/Confluence/Slack/GitHub URL provided but MCP/CLI unavailable         | Stop, notify user, do not fall back to scraping or guessing the content                      |
| Jira ticket exists but description is empty / un-actionable               | Surface in Phase 1; ask user to provide a problem statement before planning                  |
| Multiple inputs provided (e.g., Jira key + free text)                     | Treat Jira as primary source-ref; merge free text as additional context in problem-statement |

---

## Anti-patterns (do not do)

- Writing implementation code or modifying source files. This skill produces *research artifacts*, not patches.
- Generating any artifact before plan approval.
- Citing "common knowledge" without a source link in the industry-research step.
- Recommending a single option without considering at least two alternatives.
- Burying open decisions in prose. They go in a numbered list in the synthesis.
- Producing a flat "do everything" recommendation. Recommendations must be **phased** with explicit ordering rationale.
- Continuing past a STOP gate without explicit user approval.

---

## Reference: prior run

For a worked example of this workflow's outputs, see:

- `artifacts/release-process-investigation/` (9 steps, ~170KB total, produced the phased Phase 0/1/2/3 recommendation pattern)

That run is the reference shape for what good outputs look like.
