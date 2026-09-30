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
other tech essay is still Open. A prototype exists (`src/`) and its test suite has run twice. Beyond
the tests, the official documentation, the OpenAPI spec, and the client packages have now been read
against the essays, which changed several positions; those results are folded into the essays, and what
remains untested is listed under "Prototype test backlog" below. Drafting proceeds roughly in the order
listed under "Suggested drafting order", since several later essays depend on positions taken in earlier
ones.

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
  application-level merge and an explanation for the store's intermittent server errors, which persisted
  through the official client and are not covered by the documentation.
- **[Editing Model](editing-model.md)** (Proposed). Branch-and-merge, with rebase as the merge operation
  (it is the documented one; the server has no merge endpoint), called through the official client, and
  one claim per document to keep unrelated edits apart. Testing showed field-level merging works,
  conflicts arrive as schema-validation errors the API does not document, a conflicted branch cannot be
  repaired in place, and landings need an application-side merge queue. One result is unexplained and
  serious: a same-paragraph edit landed without a conflict in the second run. Apply is documented but
  unverified as an alternative. Soft-flag-versus-hard-block for cycles stays open, deferred to The
  Validation Gate.
- **[Data Model](data-model.md)** (Proposed). The concrete node, edge/claim, grounding, review, and
  objection schema implied by the policy essays, the one-claim-per-document storage decision Editing
  Model depends on, reviews bound to a content hash instead of a commit ID (now supported by the
  documentation as well as by testing), a new section on deterministic keys and why the obvious one
  conflicts with the policies, and a table of which rules the store enforces and which the validation
  gate must. Cluster membership is confirmed as computed, never stored, apart from a thin pinned-cluster
  record.
- **Computed Values** (Open). Blast radius, the computed anchor stage, the review-count requirement,
  claim status, and clusters are all derived from the graph rather than edited directly. When each is
  computed (on write, cached, or on read) and how it is invalidated as the graph changes. The prototype
  computed every node's blast radius over a 300-node graph in 15 to 17 milliseconds in the client, and
  it also stores `status` as an ordinary field, which conflicts with status being computed. Computing on
  the server with WOQL path queries has been suggested as an alternative; the suggested syntax looked
  wrong on inspection and has not been checked, and the client-side numbers give no reason to hurry.

## Integrity and history

- **The Validation Gate** (Open). Where the cycle, dangling-edge, orphan, basis-fit, and (proposed)
  premise-dependency checks run against the merged graph, and whether a detected cycle hard-blocks a
  merge or is flagged for human review, per Governance and Moderation's open question. Prototype
  findings: the store accepts cycles, self-loops, and duplicate claims (the last a consequence of random
  keys), so the gate is required, and script-level cycle and self-loop checks worked. It will most likely
  sit inside the merge queue described in Editing Model, which should also read back what it landed.
- **Versioning and Reviews** (Open). How a review binds to a specific version of a claim, how a
  "substantive change" is computed from a diff rather than self-flagged by an editor, and how a
  redirect that re-points an edge interacts with the reviews already on it. Data Model has fixed the
  starting point: bind to a content hash, since rebase rewrites a branch's own commit IDs and no merge
  operation preserves them.

## Wiki mechanics

- **[Prose Merging](prose-merging.md)** (Proposed). How long-form prose is merged, given that the store
  does not merge text inside a field. Build an application-level three-way merge first, with explicit
  conflict regions; defer block-level storage until real editing patterns justify it. The documentation
  describes reading a document as of a past commit, which would supply the base text; that is untested.
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
- **Hosting and Operations** (Open). Deployment, backups, and scaling. The database currently runs in a
  Docker container inside a local virtual machine.
- **The Essays Themselves** (Open). Whether the policy essays (and these tech essays) stay a markdown
  repository or move to MediaWiki or another platform, a question deferred once already. The answer
  also decides how much long-form prose the store ever holds, which bears on Prose Merging.

## Suggested drafting order

Several essays depend on positions taken earlier. A reasonable order for a first pass, aimed at
getting a prototype running:

1. ~~Architecture Overview~~ — drafted, revised after the prototype's prose-merge result
2. ~~Editing Model~~ — drafted and revised twice; still to be tested under repeated runs and real concurrent editors
3. ~~Database Choice~~ — drafted and revised; server stability is the remaining question
4. ~~Data Model~~ — drafted and revised; review binding changed to a content hash, key strategy added as an open question
5. ~~Prose Merging~~ — drafted, pending a working application-level merge
6. The Validation Gate
7. Computed Values
8. Graph Rendering

Everything else can follow once the prototype produces real data to test against, in the same spirit
as the policy essays' own open questions.

## Reference material, and how far to trust it

The essays now rest on more than the prototype, so the sources are recorded, with what was learned about
each.

- **Order of trust.** The OpenAPI spec is the most authoritative source for what an endpoint accepts and
  returns, followed by the client package's type declarations, then documentation examples that are marked
  as tested, then the prose documentation. The spec, the client, and the prose disagreed in several
  places (the argument order of the apply example, a commit-history method that does not exist, a
  "three-way merge" description whose examples are two-way, inconsistent names for diff operations), so
  wherever they conflict, the running server is the arbiter and the test suite is how to ask it.
- **The documentation.** Published from the `dfrnt-labs/terminusdb-docs-static` repository (the pages under
  `src/app/docs`, with a `blog` directory alongside), which the docs site's own source links point to.
  Roughly 240 pages and 15 blog posts at the time of reading. A shallow, sparse clone of those two
  directories is small and quick, which makes it practical to search with grep instead of reading pages
  whole. The prose is updated more often than the released code, so it can describe things the shipped
  client lacks.
- **The API spec.** A single YAML file in the server repository that the docs site renders in a viewer.
  It carries a version label of 12.0.5, which may lag the released server (12.0.7). Its per-operation
  notes on whether the JavaScript and Python clients implement each endpoint are useful in themselves:
  fifteen endpoints have no JavaScript client method and must be called over plain HTTP. A markdown
  rendering of the whole spec, produced by script, is kept alongside the docs for search.
- **The client package.** `terminusdb` (12.0.5) is the package the docs use; `@terminusdb/terminusdb-client`
  (12.0.0) is an older build of the same client repository.
- **Automated assistance.** A docs-search assistant was used against a local copy of the documentation.
  Its answers were fast and well organized, but several were unsupported by the passages it cited or
  confused adjacent operations (it named merge methods that do not exist). Its output is treated as a
  lead to verify against the source, and claims are only recorded here once the spec, the client, a tested
  example, or the suite backs them.

## Prototype tooling

- **The concurrency suite** (`src/scripts/concurrent-suite.ts`, 46 scenarios). Now supports repeating
  scenarios, running without the sync step, and failure-rate tables for rebase calls by stage; logs every
  error body with the failing commit the server reports; and includes probes for key strategies and for
  collection appends. Nothing it creates in those probes touches main.
- **The experiment runner** (`tools/run-experiments.js`). Runs the probe scenarios once and the flaky
  scenarios repeated with sync on and again with sync off, resetting the database between the repeated
  runs, capturing the server's log over ssh with each line stamped by the local clock, and bundling the
  results.
- **The spec renderer** (`tools/gen_openapi_md.py`). Turns the OpenAPI YAML into a markdown reference.

## Prototype test backlog

The prototype's suite ran 37 scenarios once against TerminusDB 12.0.7 and produced the findings first
recorded in the essays; after the move to the official client it ran again, and its results are folded
into them too. The suite has since been rewritten (see above) but has not yet been run in its new form.
The following were identified but not yet run, or need fixing before the result can be trusted. They are
collected here so nothing is lost.

**Stability**

1. **Repeated runs of the failing scenarios, with and without the sync step.** The suite now has the
   options for this. Run the convergent-edit, two-claims-one-pair, double-delete, two-logical-necessity,
   parallel-landing, and same-paragraph cases about twenty times each in each mode, capturing the server
   log for the same window, and compare the 5xx rates by stage. Editing Model and Database Choice both
   depend on this.
2. **Server version.** Retesting after an upgrade is not currently possible, since 12.0.7 is the latest
   release. Confirm what the running server reports as its version, and check whether the specification's
   12.0.5 label is simply behind.
3. **Report the missing-branch 500 upstream.** The spec promises a 404. Include the two distinct 500
   bodies seen and the fact that they persist through the official client.
4. **Merge-queue behavior under parallel load.** The queue is a design position, not yet code. Once
   written, test it against concurrent landings, forced failures, and retry caps.

**Merge semantics**

5. **The same-paragraph result.** Run the prose scenarios repeatedly with the final value recorded, to
   find out whether a conflicting text edit can land silently. This is the most important open result.
6. **Apply as a merge.** Test apply with the target's current tip as `before` after main has moved, to see
   whether it reverts newer changes, and, if a merge base can be obtained, with that base. Also
   confirm what a conflicting rebase returns through the client, in full.
7. **Concurrent appends to `Set`, `List`, and `Array` fields.** Two branches each appending a different
   entry to the same field. This decides whether groundings and objections can stay nested in the claim
   or must become their own documents (Data Model). The scenario is written.
8. **Key strategies.** Whether a key can be optional, whether it can be node references, and what
   editing a key field does. The three probes are written.
9. **A proper test of the second logical-necessity edge for one pair.** Both attempts so far hit a server
   error before they could answer, so whether the store accepts it is unknown.
10. **Fractional-position block inserts**, and **block edit against block delete**, for the deferred block
    storage option (Prose Merging).
11. **Edit against delete, explained.** One test leaves main with the deleted claim still present after
    the delete has landed, in both runs. The rewritten test asserts immediately after the delete lands, to
    tell a real behavior from a flaw in the test's timing.

**History**

12. **Reading a document as of a past commit.** Documented, untested. Needed to fetch the merge base for
    application-level prose merging, if the base is not stored with the editing session (Prose Merging).
13. **The per-document history endpoint.** Reported to list the commits that touched a document; read what
    it returns and whether it helps with review binding or with the base text.
14. **Confirm that the commit-log helper is not paginated.** The rewritten suite asks for a large count,
    but the server's limit is unchecked. Also confirm that rebase rewrites only a branch's own commits; the
    second run's 194-of-196 result is consistent with that, and the rewritten test counts them directly.

**Harness fixes** (all made in the rewritten suite, pending its first run)

15. **Blast-radius check.** IDs are normalized before comparing.
16. **Error classification.** The blocked delete of a node with dependents is still labeled as a
    cardinality conflict; the rewritten test records its body so it can get its own label.
17. **Commit counting.** Count only the branch's own commits when checking whether IDs survive a rebase.
18. **Conflict-catching in the original concurrent-edit test.** Its catch block treats any error as a
    conflict, so a server error would be reported as one. That older script has not been changed.

**Application-level work the tests point to**

19. **A working three-way merge** with conflict regions on markdown, to exercise Prose Merging's
    position on real text.
20. **The validation gate's first checks,** starting from the prototype's script-level cycle and
    self-loop detection.
21. **WOQL path queries** for cycle detection and blast radius. Check the correct syntax for traversing
    edges stored as documents, and compare with the client-side computation that already takes about
    15 to 17 milliseconds at 300 nodes.

## What this page does not decide

- The content of any individual tech essay.
- The relationship between this index and essay-index.md, including whether they are ever merged or
  cross-referenced beyond simple links.
- The final directory layout. These essays are assumed to live under a path such as `wiki/tech/`, with
  the existing policy essays possibly moving to a sibling path later, but neither move is made yet.
