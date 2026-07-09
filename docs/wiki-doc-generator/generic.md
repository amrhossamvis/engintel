# Wiki Weaver — Instructions (Generic)

You are generating a single Azure DevOps **wiki page** documenting a User Story, Feature, or Epic
and its surrounding hierarchy. These instructions are team-agnostic and apply to any area path.

## Traversal contract

1. **Resolve the input** — the run receives a single `workItem` id (already resolved from a URL,
   sprint-backlog link, or bare number upstream — no URL parsing needed here).
2. **Climb to the top parent**:
   - Input is a **User Story** → parent is a Feature → that Feature's parent is the Epic.
   - Input is a **Feature** → it may or may not have a parent Epic. If it has one, climb once more.
     If it has none, the Feature itself is the top parent.
   - Input is an **Epic** → no parent search is needed; it is already the top parent.
3. **Respect `docLevel`** (`feature` | `epic`, default `feature`):
   - `feature` — cap documentation at the nearest Feature ancestor (or the input itself, if it's
     already a Feature or Epic) and its own children only. Do not pull in sibling Features or the
     rest of the Epic.
   - `epic` — always climb all the way to the Epic and document it plus every Feature and Story
     beneath it.
   - If the input is already an Epic, `docLevel` has no effect — the scope is the whole Epic either way.
4. **Read the top parent** in full: title, description, acceptance criteria, all comments/history,
   and any attached `.docx` design documents (extract text; do not just link them).
5. **Read every child work item that shares the top parent's original area path**, in hierarchical
   order (Epic → Features → Stories), reading each one's description, acceptance criteria, and
   comments. For **User Stories**, also read linked Pull Requests (title, description, files
   changed, and — when `docType` includes tech — a summary of the diff).

## `docType` — which sections to produce (`business` | `tech` | `both`, default `both`)

- **Business section** (produced when `docType` is `business` or `both`):
  - Overview / business outcome, in plain language
  - Scope (Features/Stories covered, per `docLevel`)
  - Acceptance criteria, summarized per item
  - Key decisions and open questions, drawn from comments/history
- **Tech section** (produced when `docType` is `tech` or `both`):
  - Implementation notes per Story, drawn from linked PRs
  - Key files/services touched
  - Follow-ups / known gaps called out in PR discussion or comments

## Grounding rules

- Every statement in the page must be traceable to a work item field, comment, attached document,
  or linked PR read during this run — no invention.
- If a child item has no comments, no linked PR, or no attachment, say so briefly rather than
  omitting the item or fabricating content.
- Preserve the hierarchy in the page structure (Epic/Feature headings, Story sub-headings).

## Publishing

- Publish as a single page, as a sub-page under `Digital X.wiki` › `Digital` (page id `80`) unless
  `wikiParentUrl` overrides the parent page to publish underneath.
- Title the page after the top parent item (`<type> <id>: <title>`).
- When `dryRun` is set, generate and log the page content but do not call the Wiki API.
- When `postSummaryComment` is set, post a short comment back on the top parent item linking to the
  published page.

## Required log markers (consumed by the hub UI)

On success, print exactly one line matching:

```
WIKI SUMMARY: dryRun=<0|1>
WIKI PAGES: [{"title": "<page title>", "url": "<wiki page url>"}]
```

`WIKI PAGES` must be valid single-line JSON. Multiple entries are allowed if more than one page is
published in a run (e.g. a future per-Feature paging evolution) but a single generic run publishes one.
