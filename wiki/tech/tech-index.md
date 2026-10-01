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
other tech essay is still Open. A prototype exists (`src/`) and its test suite has run in several rounds,
including repeated runs with and without the sync step. Beyond the tests, the official documentation, the
OpenAPI spec, and the client packages have been read against the essays, which changed several positions;
those results are folded into the essays, and what remains untested is listed under "Prototype test
backlog" below. The database questions that were open through the first rounds are now answered, and the
data layer is settled enough to build the application on. Drafting proceeds roughly in the order
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
  store. The prose-merge test has been run and native merging failed. The remaining gates are a working
  application-level merge and a report to the maintainers about the store's intermittent server errors,
  whose pattern is now characterized (they fade when landings are spaced about a second apart and retried)
  but whose cause is unknown.
- **[Editing Model](editing-model.md)** (Proposed). Branch-and-merge, with rebase as the merge operation
  (it is the documented one; the server has no merge endpoint), called through the official client, and
  one claim per document to keep unrelated edits apart. Testing showed field-level merging works,
  conflicts are always reported (40 of 40 repeated same-paragraph runs) as schema-validation errors the API
  does not document, a conflicted branch cannot be repaired in place, and landings need an
  application-side merge queue that serializes, spaces them about a second apart, retries with a pause, and
  lands each edit through a staging branch and the validation gate. Apply is documented but unverified as an alternative. Soft-flag-versus-hard-block for cycles stays open, deferred to The
  Validation Gate.
- **[Data Model](data-model.md)** (Proposed). The concrete node, edge/claim, grounding, review, and
  objection schema implied by the policy essays, the one-claim-per-document storage decision Editing
  Model depends on, reviews bound to a content hash instead of a commit ID (supported by the
  documentation and by testing), a composite edge key over pair, basis, and origin that makes the store
  enforce the multiplicity rules, `Set` collections for groundings and objections (`Array` is never
  safe), and a table of which rules the store enforces and which the validation gate must. Cluster
  membership is confirmed as computed, never stored, apart from a thin pinned-cluster
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
  findings: the store accepts cycles and self-loops, lets an edge land after its target was deleted on another
  branch, and it cannot require an origin to be empty on a
  logical-necessity edge, so the gate is required for those. Duplicate claims and the one-per-pair and
  one-per-origin rules are enforced by the store under the composite edge key in Data Model. Script-level
  cycle and self-loop checks worked. The gate runs on a staging branch inside the merge queue described in
  Editing Model, before main moves.
- **Versioning and Reviews** (Open). How a review binds to a specific version of a claim, how a
  "substantive change" is computed from a diff rather than self-flagged by an editor, and how a
  redirect that re-points an edge interacts with the reviews already on it. Data Model has fixed the
  starting point: bind to a content hash, since rebase rewrites a branch's own commit IDs and no merge
  operation preserves them. It also notes that a physical re-pointing of an edge is a new document under
  the composite key, while a display-time redirect leaves the stored edge untouched.

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
2. ~~Editing Model~~ — drafted and revised; tested under repeated runs, still to be tested against a real merge queue and concurrent editors
3. ~~Database Choice~~ — drafted and revised; the server-error cause is the one remaining question
4. ~~Data Model~~ — drafted and revised; reviews bind to a content hash, edges use a composite key, groundings are Sets
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

- **The concurrency suite** (`src/scripts/concurrent-suite.ts`, 50 scenarios). Supports repeating
  scenarios, running without the sync step, and failure-rate tables for rebase calls by stage; logs every
  error body with the failing commit the server reports; and includes probes for key strategies and for
  collection appends, plus Q1 (sequential rebases by pause length, selectable with `Q_N`, `Q_PAUSE_MS`,
  and `Q_ARMS`), K4 and K5 (the composite edge key, and the same claim added on two branches), and L2 (a Set of
  sub-documents). Nothing it creates in the probes touches main.
- **The experiment runner** (`tools/run-experiments.js`). Runs the probe scenarios once and the flaky
  scenarios repeated with sync on and again with sync off, resetting the database between the repeated
  runs, capturing the server's log over ssh with each line stamped by the local clock, and bundling the
  results.
- **The spec renderer** (`tools/gen_openapi_md.py`). Turns the OpenAPI YAML into a markdown reference.

## Prototype test backlog

The prototype's suite ran 37 scenarios twice, then, rewritten, ran the probe set once and the scenarios
that had failed intermittently 20 times each with and without the sync step, followed by targeted runs on
the server errors, composite keys, and collection appends. The results are folded into the essays. This
section lists what those runs settled, so it is not repeated, and what remains.

**Settled**

- **The same-paragraph result.** Two edits to one text field were reported as a conflict in 40 of 40 runs,
  and the first editor's text stayed on main. The earlier silent landing did not reproduce.
- **Edit against delete.** The apparent surviving document was a flaw in the test, which read a 404 body as
  a document. The helper is fixed, and the delete works.
- **The sync step.** It makes no difference to the server-error rate. It happens to fail in one dangling-edge
  case, but a passing sync guarantees nothing, so the queue does not use it.
- **Dangling edges across branches.** An edge added on one branch landed on main after another branch had
  deleted its target, and the rebase report called the replay valid. Replaying the deletion onto the edge
  branch fails with `instance_not_of_class`. The gate checks for dangling edges, and the queue lands through
  a staging branch.
- **The server errors, characterized.** Parallel landings onto one branch fail four in five, and sequential
  replays fail about one in seven when issued immediately, falling to none at one second. A fast-forward
  never fails. Retries after a pause succeeded in every case.
- **Key strategies.** Optional and reference key fields work, an enum can be a key field, a duplicate is
  rejected, editing a key field in place is rejected, and a composite key over pair, basis, and origin
  enforces both multiplicity rules. The same claim on two branches conflicts at merge or converges.
- **Collection fields.** `Set` and a `Set` of sub-documents merge concurrent appends, `List` conflicts, and
  `Array` silently produces a wrong result.
- **The second logical-necessity edge for one pair.** Accepted under random keys, rejected under the
  composite key.
- **Rebase and commit IDs.** A branch's own commits did not survive a rebase in the third round either, and
  the rebase report was empty.

**Server and merge queue**

1. **Report the server errors upstream.** Include the minimal reproduction (a replay landed immediately
   after another landing on main), the parallel-landing result, the missing-branch 500, which
   contradicts the spec's 404, and the dangling-edge landing, which is reported as a valid commit although the
   reverse replay is rejected.
2. **Server version.** Retesting after an upgrade is not currently possible, since 12.0.7 is the latest
   release. Confirm what the running server reports as its version, and check whether the specification's
   12.0.5 label is simply behind.
3. **The merge queue, live.** The queue, the staged landing, and the gate's first four checks are written, and
   their logic is tested without a server. Live runs passed concurrent landings, same-field conflicts,
   fresh-branch resolution, the missing-branch check, and composite-key duplicates. The refusal of a dangling
   edge (Q3) and of an edge that closes a cycle (Q7) through the staged path are written but not yet run.
   Still to test: forced server failures, the retry caps, the effect of staging on landing time, and a
   growing database.

**Merge semantics**

4. **Apply as a merge.** Test apply with the target's current tip as `before` after main has moved, to see
   whether it reverts newer changes, and, if a merge base can be obtained, with that base. Also
   confirm what a conflicting rebase returns through the client, in full.
5. **Nested collections beyond the tested case.** Two branches editing the same sub-document, reviews
   nested inside a grounding, and a `List` of sub-documents for an argument's premises.
6. **Fractional-position block inserts**, and **block edit against block delete**, for the deferred block
   storage option (Prose Merging).

**History**

7. **Reading a document as of a past commit.** Documented, untested. Needed to fetch the merge base for
   application-level prose merging, if the base is not stored with the editing session (Prose Merging).
8. **The per-document history endpoint.** Reported to list the commits that touched a document; read what
   it returns and whether it helps with review binding or with the base text.
9. **Confirm that the commit-log helper is not paginated.** The rewritten suite asks for a large count,
   but the server's limit is unchecked.

**Harness fixes** (made in the rewritten suite; the scenarios that exercise them have not been run again)

10. **Blast-radius check.** IDs are normalized before comparing.
11. **Error classification.** The blocked delete of a node with dependents is still labeled as a
    cardinality conflict; the rewritten test records its body so it can get its own label.
12. **Commit counting.** Count only the branch's own commits when checking whether IDs survive a rebase.

**Application-level work the tests point to**

13. **A working three-way merge** with conflict regions on markdown, to exercise Prose Merging's
    position on real text.
14. **The validation gate's first checks.** Dangling edges, self-loops, logical-necessity cycles, and an origin
    on a logical-necessity edge are written (`src/db/validation-gate.ts`) and tested on in-memory graphs. They
    have yet to be run against a real branch.
15. **WOQL path queries** for cycle detection and blast radius. Check the correct syntax for traversing
    edges stored as documents, and compare with the client-side computation that already takes about
    15 to 17 milliseconds at 300 nodes.

## What this page does not decide

- The content of any individual tech essay.
- The relationship between this index and essay-index.md, including whether they are ever merged or
  cross-referenced beyond simple links.
- The final directory layout. These essays are assumed to live under a path such as `wiki/tech/`, with
  the existing policy essays possibly moving to a sibling path later, but neither move is made yet.
