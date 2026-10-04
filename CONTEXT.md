# Project Context

A short orientation to the Human Tech Tree Wiki for anyone, human or AI, starting a session cold.
It summarizes the project and points at the essays. **The essays in `wiki/` are the source of truth.**
If this file and an essay disagree, the essay wins, and this file should be fixed.

## How to use this file

1. Read this file, then `wiki/policy/about-the-project.md` (it has the glossary).
2. Open `wiki/policy/essay-index.md` or `wiki/tech/tech-index.md`, whichever matches the task. Each lists every
   essay with its status and a one-paragraph position.
3. Read the specific essay before relying on it. Essays link to each other heavily, so search the repo for any
   term you are about to use (`grep -ri "blast radius" wiki/`).
4. Do not treat a summary here as enough to edit an essay. Read the whole essay first.

Everything is currently **Proposed**. Nothing is Ratified, and any essay may change.

## What the project is

A wiki that maps human technology and history as one large prerequisite graph, following Sagan's remark that
an apple pie from scratch requires inventing the universe. The core value is the connections between entries,
not the descriptions of the entries. It should feel somewhat like a game's tech tree while staying a serious
reference. Scope is deliberately huge, and keeping it manageable is a standing concern.

The project is in its policy-drafting phase. The graph has not been populated. A small TerminusDB prototype
exists to test the tech essays' assumptions.

## The model in brief

- **Node.** A discovery, invention, or achievement. Natural phenomena (gravity, ore, the ability to feel
  heat) are the "floor" and never nodes, but the human understanding of them can be (shadow nodes).
- **Edge.** One claim about an ordered pair of nodes. Three independent fields: relationship-kind (material
  necessity, conceptual enablement, combination, mere influence), basis (historical attestation or logical
  necessity), and grounding. No field is ever required to be filled in.
- **Basis.** Historical attestation is dated and regional and may repeat once per independent origin. Logical
  necessity is timeless, and at most one exists per pair. Both can apply to one pair as two edges.
- **Grounding.** A citation (a source states the claim) or an argument (a deductive chain whose premises are
  each grounded). Neither outranks the other. Reviews bind to a version of the grounding.
- **Status.** Computed, never assigned: ungrounded, red, yellow, green. It discloses support and does not
  certify truth. The number of reviews required is computed from blast radius, with a human floor.
- **Blast radius.** The count of transitive descendants. It drives protection tiers and review requirements.
- **Stored is not shown.** Parallel edges draw as one line, with detail in an inspector panel.

## Policy essays: positions in one line

- **Founding Axioms.** A candidate is excluded iff no human action is responsible for its existence (origin),
  and it must itself be a discovery, invention, or achievement (category).
- **Achievement vs. Discovery vs. Invention.** Discovery reveals what pre-existed, invention creates what
  did not, and achievement is an unchanged capability exercised to a superlative with no transferable
  technique. Importance is independent of category.
- **What Constitutes a Discovery?** Nodes have a required subject and an optional stage (observation,
  exploitation, production, explanation). Shapes are guidance only. The anchor stage is computed.
- **Node Granularity.** Split a topic only when each part is eligible, has its own history, and, for
  independent origins, differs in mechanism. Open-ended macro-topics such as AI are computed clusters and
  never nodes.
- **Culture / Social-Systems Layer.** Separate the general capacity (floor) from the specific institutional
  form (eligible). No new machinery is needed. Iterative abstraction is the default shape. Writing upgrades
  the non-transmissibility test for everything after it.
- **Edge Schema.** An edge is a claim with three independent fields, and multiplicity follows from that.
- **Historical Attestation vs. Logical Necessity.** Two bases, one claim each. Independent discovery is one
  node with an edge per origin.
- **Sourcing and Citation Policy.** Grounding, review, and computed status as above. Wikipedia's sourcing
  policy is pinned as a placeholder. Bots may review, with model-family independence and a human floor.
- **Governance and Moderation.** Automatic checks after every merge, protection scaled to blast radius, no
  hard deletion of nodes with dependents, stable identifiers with redirects, and disputes as objections.

Planned, not written: Notability / Inclusion Threshold, Spotlight / Feed Mechanism, Bot and Automation Policy,
Argument Page Format, and Can an Achievement Become a Genuine Prerequisite.

## Tech essays: positions in one line

- **Architecture Overview.** Four layers (data and version control, wiki mechanics, presentation, delivery),
  with a tool chosen per layer.
- **Database Choice.** TerminusDB for the graph, talk-page comments, and argument pages. Long-form prose
  lives in PostgreSQL, and accounts in a separate PostgreSQL database. MediaWiki,
  Wikibase, Blazegraph, QLever, Gollum, and Wiki.js were each rejected, with reasons recorded.
- **Editing Model.** Branch-and-merge, using apply with an explicit merge base through the official client
  (rebase only for the final fast-forward), one claim per document, and an application-side merge queue that
  serializes landings, translates errors, and retries.
- **Data Model.** Node, edge/claim, grounding, review, and objection schema. Reviews bind to a content hash,
  not a commit ID. Edges use a composite key, groundings are Sets, and clusters are never stored, apart from
  a thin pinned-cluster record.
- **Prose Merging.** The graph store does not merge text inside a field. Prose is kept as immutable full-text
  revisions in PostgreSQL and merged in the application with a three-way merge, and block storage is deferred.

Open, not written: Computed Values, The Validation Gate, Versioning and Reviews, Accounts and Permissions,
Talk Pages and Argument Pages, Content Sourcing, Search, Graph Rendering, Node and Edge Pages, Text Editor,
Achievements and Spotlight, Cluster Rendering, Application Framework, Bot Infrastructure, Seeding and Import,
Hosting and Operations, The Essays Themselves.

## Current state and open gates

The stress test (variants A to D, TerminusDB 12.0.7) found that prose volume, not placement, drives memory and
disk cost, so long-form prose is held in PostgreSQL instead of the graph store. Details are in Database Choice.

The prototype's suite (50 scenarios) has run in several rounds against TerminusDB 12.0.7, including
repeated runs with and without the sync step. The database questions are answered:

- **Conflicts are always reported.** Two edits to one field gave a conflict in 40 of 40 repeated runs and
  never overwrote the first editor's text. An earlier silent landing did not reproduce.
- **Conflicts arrive as schema-validation errors**, not merge conflicts, and a conflicted branch cannot be
  repaired in place, so resolution happens on a fresh branch.
- **Intermittent HTTP 500s** hit parallel landings onto one branch (four in five, always) and about one in
  seven sequential replays landed immediately after another landing. They fall to zero with a one-second
  wait, a fast-forward never fails, and retries after a pause always worked. The sync step is irrelevant.
  The cause is unknown and the server log gives only the status code. A nonexistent branch also returns a
  500 where the spec says 404.
- **Edges use a composite key** over source, target, basis, and origin, which makes the store enforce one
  logical-necessity edge per pair and one historical-attestation edge per origin. A key field cannot be
  edited in place, so changing one is a new document. Nodes keep random keys.
- **Groundings and objections are Sets** of sub-documents nested in the claim. `List` conflicts on
  concurrent appends and `Array` silently corrupts, so `Array` is never used.
- **The store still misses** cycles, self-loops, an origin set on a logical-necessity edge, and an edge that
  lands on main after another branch deleted its target (replaying the deletion onto the edge branch fails,
  but the reverse replay succeeds), so the validation gate is required.
- **Native prose merge fails**, hence the application-level merge.
- **Reviews bind to a content hash**, because rebase rewrites a branch's own commit IDs.

The merge queue (`src/db/merge-queue.ts`) lands each edit through a staging branch and the gate
(`src/db/validation-gate.ts`), so main only moves to a state that passed. Live runs passed concurrent
landings, conflicts, the missing-branch check, and composite-key duplicates. The staged refusal of a dangling edge and of a cycle, reading a document at a past commit, and
nested collections beyond the first case have since passed live, and apply works as a three-way merge given
an explicit base and passes the queue's live scenarios through apply, which is now the queue's default (`--rebase` selects the old
landing). The merge base is recorded when a branch is created (`src/db/branch.ts`), with the log-derived finder as the
fallback; its live check (`npm run base-record-live`) has not been run yet. Still unbuilt: the application-level prose merge. The full list is tracked as
GitHub issues in the repo; the settled results are in the "Prototype test backlog" in `wiki/tech/tech-index.md`.

Cross-cutting policy questions still open: redirects versus reviewed claims, reviewer eligibility and
permission tiers, multi-origin subjects with stage chains, mere-influence sub-kinds, a two-layer floor, and
where cluster governance lives.

## Repository layout

```text
wiki/policy/      policy essays, plus essay-index.md
wiki/tech/        tech essays, plus tech-index.md
src/config.ts     env-based settings
src/db/           client factory, rebase and apply helpers, commit-log helper, merge-base finder,
                  branch-with-recorded-base helper, merge queue (apply by default, rebase selectable), staged landing, validation gate
src/schema/       Node/Edge schema transcribed from Data Model
src/scripts/      init-db, reset-db
src/scripts/tests/ concurrent-suite (50 scenarios), merge-queue-test and
                    validation-gate-test (no server needed), merge-queue-live (needs the server)
tools/            run-experiments.js, gen_openapi_md.py
```

Housekeeping to fix: `README.md` is stale (it describes scripts that no longer exist and says rebase bypasses
the JS client), and `.env` is tracked even though it is a template, so it should be renamed `.env.example`.

## Working conventions

- **Debate first, essay second.** Each essay is worked out in back-and-forth discussion before it is written.
- **Reference essays by name**, never by number. Cross-references are hyperlinks, and only the first
  occurrence of each linked essay or term gets the link. Links are relative.
- **Essays read as self-contained documents.** No drafting chronology, amendment scaffolding, or
  "depends on / gates" headers. The audience is the wiki's readers, and the structure is an accessible policy
  statement first, then rationale, worked examples, boundaries, and open questions.
- **Every essay carries `Status: Proposed`** until ratified, and open questions stay in the essay.
- **Markdown lint.** No trailing whitespace (MD009), no multiple consecutive blank lines (MD012), and blank
  lines around headings (MD022).
- **Deliver substantial content as files**, not inline in chat.

## External references and environment

- **TerminusDB docs:** public repo `dfrnt-labs/terminusdb-docs-static`, sparse paths `src/app/docs` and
  `src/app/blog`. The main TerminusDB repo's docs are for its developers, not users.
- **Authoritative API spec:**
  `https://raw.githubusercontent.com/terminusdb/terminusdb/main/docs/openapi.yaml` (label 12.0.5). Re-fetch when
  the docs are updated. Order of trust: spec, client type declarations, tested doc examples, then prose docs.
  The running server is the final arbiter.
- **Client package:** `terminusdb` (12.0.5), not the older `@terminusdb/terminusdb-client`.
- **Dev environment:** TerminusDB runs in a Docker container named `terminus-db`, inside an Alpine VM under
  VirtualBox, with port 6363 exposed at `http://localhost:6363`. Docker commands run in the VM, while npm and
  the tests run from the main machine.
- **Docs questions** can be handed to the "TerminusDB Expert" mode in the editor, which consults a local docs
  clone. Its answers are leads to verify, not findings.
