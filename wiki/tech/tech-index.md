# Tech Essays: Contents and Status

The Human Tech Tree Wiki's implementation decisions are set out in a series of short essays, in the
same style and tone as the project's policy essays. Each settles one question about how the wiki is
built and gives its reasoning, rather than describing what the wiki's rules are. This page lists the
essays, what each one decides, and where each stands.

These essays live alongside the policy essays but answer a different kind of question. The policy
essays decide what the graph means: what counts as a node, what an edge claims, how a claim is
grounded. The tech essays decide how that meaning is built and served: what stores it, what enforces
it, and what renders it.

## Status

- **Open.** The question has been identified but no position has been written.
- **Proposed.** A position is written and awaiting testing against a real prototype.
- **Ratified.** The position is settled and binds the implementation.

Architecture Overview, Database Choice, Editing Model, Data Model, and Prose Merging are Proposed; every
other tech essay is still Open. A prototype now exists (`src/`), and its first broad test run has
already changed several of the Proposed essays; the results are folded into them, and what remains
untested is listed under "Prototype test backlog" below. Drafting proceeds roughly in the order listed
under "Suggested drafting order", since several later essays depend on positions taken in earlier ones.

## Architecture and data

- **[Architecture Overview](architecture-overview.md)** (Proposed). What the system is, what it must
  support, and how the problem divides into four layers: data and version control, wiki mechanics,
  presentation, and delivery. Wiki mechanics fold into the data layer under the current direction, with
  long-form prose as the exception; presentation stays a separate, still-open concern.
- **[Database Choice](database-choice.md)** (Proposed). TerminusDB for the graph and, conditional on
  application-level prose merging, for talk pages, policy pages, and argument pages as well. Records the
  rejection of MediaWiki alongside TerminusDB, Wikibase alone, Blazegraph, QLever, and two git-backed
  wiki engines (Gollum, Wiki.js), each for a distinct reason, and what the prototype has shown about the
  store. The prose-merge test has been run and native merging failed; the remaining gates are a working
  application-level merge and an explanation for the store's intermittent server errors.
- **[Editing Model](editing-model.md)** (Proposed). Branch-and-merge, using TerminusDB's native
  commit/branch/diff/merge model, with one claim per document to keep unrelated edits apart. Testing
  showed field-level merging works, conflicts arrive as schema-validation errors, a conflicted branch
  cannot be repaired in place, and landings need an application-side merge queue. Soft-flag-versus-hard-
  block for cycles stays open, deferred to The Validation Gate.
- **[Data Model](data-model.md)** (Proposed). The concrete node, edge/claim, grounding, review, and
  objection schema implied by the policy essays, the one-claim-per-document storage decision Editing
  Model depends on, reviews bound to a content hash instead of a commit ID, and a table of which rules
  the store enforces and which the validation gate must. Cluster membership is confirmed as computed,
  never stored, apart from a thin pinned-cluster record.
- **Computed Values** (Open). Blast radius, the computed anchor stage, the review-count requirement,
  claim status, and clusters are all derived from the graph rather than edited directly. When each is
  computed (on write, cached, or on read) and how it is invalidated as the graph changes. The prototype
  computed every node's blast radius over a 300-node graph in 17 milliseconds, and it also stores
  `status` as an ordinary field, which conflicts with status being computed.

## Integrity and history

- **The Validation Gate** (Open). Where the cycle, dangling-edge, orphan, basis-fit, and (proposed)
  premise-dependency checks run against the merged graph, and whether a detected cycle hard-blocks a
  merge or is flagged for human review, per Governance and Moderation's open question. Prototype
  findings: the store accepts cycles, self-loops, and duplicate claims, so the gate is required, and
  script-level cycle and self-loop checks worked. It will most likely sit inside the merge queue
  described in Editing Model.
- **Versioning and Reviews** (Open). How a review binds to a specific version of a claim, how a
  "substantive change" is computed from a diff rather than self-flagged by an editor, and how a
  redirect that re-points an edge interacts with the reviews already on it. Data Model has fixed the
  starting point: bind to a content hash, since rebase rewrites a branch's own commit IDs.

## Wiki mechanics

- **[Prose Merging](prose-merging.md)** (Proposed). How long-form prose is merged, given that the store
  does not merge text inside a field. Build an application-level three-way merge first, with explicit
  conflict regions; defer block-level storage until real editing patterns justify it.
- **Accounts, Permissions, and Bots** (Open). How the permission tiers described in Governance and
  Moderation are enforced, how bot accounts and their declared operator of record are modeled, and how
  far the API is exposed to other operators.
- **Talk Pages and Argument Pages** (Open). Where open-ended discussion and the planned structured
  Argument Page Format live, and whether they share a store with the graph or sit in the conventional
  side of the split. Constraint already fixed: one document per talk-page comment.
- **Content Sourcing** (Open). How node descriptions borrowed from an existing encyclopedia (with
  attribution) are pulled in, snapshotted, and kept compliant with the source's license.
- **Search** (Open). Full-text search across node and claim content.

## Presentation

- **Graph Rendering** (Open). The rendering library and layout approach (layered tech-tree layout
  against force-directed layout), and how the schema's collapse rules are built: parallel edges drawn
  as a single line, the inspector panel for stored detail behind a click, and a collapsed anchor node
  for a stage-divided subject.
- **Node and Edge Pages** (Open). The dedicated card and page for each node and edge, and the status
  shapes and labels required by the sourcing policy, including its accessibility requirement that
  shape (not color alone) carries the meaning.
- **Text Editor** (Open). The rich-text editor for long-form content. ProseMirror and Lexical are both
  serious candidates, with a lean toward ProseMirror; the choice is independent of how prose is stored
  and merged, with the constraint that stored content is markdown. Open questions include stable block
  identity in each, and how well each round-trips markdown.
- **Achievements and Spotlight** (Open). Whether achievements and the planned Spotlight / Feed
  Mechanism need a separate presentation layer, and where their data is stored relative to the graph.
- **Cluster Rendering** (Open). Where the clustering algorithm runs, and how a pinned cluster's name,
  slug, and drift flag are shown to editors.

## Delivery

- **Application Framework** (Open). Language, server framework, and API style connecting the
  presentation layer to the data layer(s). Includes the merge queue Editing Model requires.
- **Bot Infrastructure** (Open). How verification agents retrieve source text themselves, how the
  project defends against injection through untrusted source text, and how model-family independence
  is enforced in the reviewer tally, per the sourcing policy's bot rules.
- **Seeding and Import** (Open). Manual seed sets against bulk import, and how import is kept from
  reintroducing the scope creep the project set out to avoid.
- **Hosting and Operations** (Open). Deployment, backups, and scaling.
- **The Essays Themselves** (Open). Whether the policy essays (and these tech essays) stay a markdown
  repository or move to MediaWiki or another platform, a question deferred once already. The answer
  also decides how much long-form prose the store ever holds, which bears on Prose Merging.

## Suggested drafting order

Several essays depend on positions taken earlier. A reasonable order for a first pass, aimed at
getting a prototype running:

1. ~~Architecture Overview~~ — drafted, revised after the prototype's prose-merge result
2. ~~Editing Model~~ — drafted and revised; now tested against the prototype in the cases listed in it, though not yet under real concurrent editors
3. ~~Database Choice~~ — drafted and revised; the prose-merge test has been run, server stability is the remaining question
4. ~~Data Model~~ — drafted and revised; review binding changed to a content hash
5. ~~Prose Merging~~ — drafted, pending a working application-level merge
6. The Validation Gate
7. Computed Values
8. Graph Rendering

Everything else can follow once the prototype produces real data to test against, in the same spirit
as the policy essays' own open questions.

## Prototype test backlog

The prototype's suite (`src/scripts/concurrent-suite.ts`) ran 37 scenarios once, against TerminusDB
12.0.7, and produced the findings recorded in the essays above. The following were identified but not
yet run, or need fixing before the result can be trusted. They are collected here so nothing is lost.

**Stability**

1. **Repeated runs of the failing scenarios.** Add a repeat option to the suite and run the merge-after-
   main-moved case, the race case, and the two-logical-necessity-edge case about twenty times each, to
   get a failure rate for the intermittent server error, and capture the TerminusDB server log
   alongside. Editing Model and Database Choice both depend on this.
2. **Retest after a TerminusDB upgrade** past 12.0.7, to see whether the errors are version-specific.
3. **Merge-queue behavior under parallel load.** The queue is a design position, not yet code. Once
   written, test it against concurrent landings, forced failures, and retry caps.

**Merge semantics**

4. **Concurrent appends to nested list fields.** Two branches each appending a different entry to the
   same claim's groundings or objections. This decides whether they can stay nested in the claim or must
   become their own documents (Data Model).
5. **A proper test of the second logical-necessity edge for one pair.** The original test hit a server
   error before it could answer, so whether the store accepts it is unknown.
6. **Fractional-position block inserts**, and **block edit against block delete**, for the deferred block
   storage option (Prose Merging).
7. **Edit against delete, explained.** One test left main with the deleted claim still present after
   the delete had landed. Add an assertion immediately after the delete lands to tell a real behavior
   from a flaw in the test's timing.

**History**

8. **Reading a document as of a past commit.** Needed to fetch the merge base for application-level
   prose merging, if the base is not stored with the editing session (Prose Merging).
9. **Confirm that rebase rewrites only a branch's own commits.** The 88-of-90 result is consistent
   with that but did not check it directly.

**Harness fixes**

10. **Blast-radius check.** The root blast-radius assertion failed because inserted document IDs come
    back as full IRIs while reads return short IDs. Normalize before comparing.
11. **Error classification.** The blocked delete of a node with dependents was labeled as a cardinality
    conflict. It should have its own label.
12. **Commit counting.** Count only the branch's own commits when checking whether IDs survive a rebase.
13. **Conflict-catching in the original concurrent-edit test.** Its catch block treats any error as a
    conflict, so a server error would be reported as one. Assert on the error type.
14. **Move the tested field off `status`.** Use `statement` or `relationship_kind`, since status is
    meant to be computed.

**Application-level work the tests point to**

15. **A working three-way merge** with conflict regions on markdown, to exercise Prose Merging's
    position on real text.
16. **The validation gate's first checks,** starting from the prototype's script-level cycle and
    self-loop detection.

## What this page does not decide

- The content of any individual tech essay.
- The relationship between this index and essay-index.md, including whether they are ever merged or
  cross-referenced beyond simple links.
- The final directory layout. These essays are assumed to live under a path such as `wiki/tech/`, with
  the existing policy essays possibly moving to a sibling path later, but neither move is made yet.
