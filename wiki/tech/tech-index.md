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
those results are folded into the essays, and what remains untested is tracked as repository issues
(see "Prototype test backlog" below). The database questions that were open through the first rounds are now answered, and the
data layer is settled enough to build the application on. Drafting proceeds roughly in the order
listed under "Suggested drafting order", since several later essays depend on positions taken in earlier
ones.

## Architecture and data

- **[Architecture Overview](architecture-overview.md)** (Proposed). What the system is, what it must
  support, and how the problem divides into four layers: data and version control, wiki mechanics,
  presentation, and delivery. Structured wiki mechanics fold into the data layer under the current direction, with
  long-form prose and accounts as the exceptions, each in its own PostgreSQL database; presentation stays
  a separate, still-open concern.
- **[Database Choice](database-choice.md)** (Proposed). TerminusDB for the graph, talk-page comments, and
  argument pages. Long-form prose lives in PostgreSQL, and accounts in a separate PostgreSQL database.
  Records the stress test that decided this, and the
  rejection of MediaWiki alongside TerminusDB, Wikibase alone, Blazegraph, QLever, and two git-backed
  wiki engines (Gollum, Wiki.js), each for a distinct reason, and what the prototype has shown about the
  store. The prose-merge test has been run and native merging failed. The remaining gates are a working
  application-level merge and a report to the maintainers about the store's intermittent server errors,
  whose pattern is now characterized (they fade when landings are spaced about a second apart and retried)
  but whose cause is unknown.
- **[Editing Model](editing-model.md)** (Proposed). Branch-and-merge, with apply (given an explicit merge
  base) as the merge operation, called through the official client, rebase kept for the final fast-forward
  from staging to the target, and one claim per document to keep unrelated edits apart. Testing showed field-level merging works,
  conflicts are always reported (40 of 40 repeated same-paragraph runs) as schema-validation errors the API
  does not document, a conflicted branch cannot be repaired in place, and landings need an
  application-side merge queue that serializes landings, retries with a pause, and lands each edit through a
  staging branch and the validation gate. Rebase landings needed spacing about a second apart, and apply
  did not. Where the merge base comes from stays open. Soft-flag-versus-hard-block for cycles stays open, deferred to The
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

- **[Prose Merging](prose-merging.md)** (Proposed). How long-form prose is stored and merged, given that the graph store
  does not merge text inside a field and charges memory in proportion to prose volume. Prose is kept as
  immutable full-text revisions in PostgreSQL, merged in the application with a three-way merge that
  reports explicit conflict regions; block-level storage is deferred until real editing patterns justify
  it.
- **Accounts, Permissions, and Bots** (Open). How the permission tiers described in Governance and
  Moderation are enforced, how bot accounts and their declared operator of record are modeled, and how
  far the API is exposed to other operators. Accounts live in their own PostgreSQL database.
- **Talk Pages and Argument Pages** (Open). Where open-ended discussion and the planned structured
  Argument Page Format live, and whether they stay in the graph store, which is the current expectation.
  Constraint already fixed: one document per talk-page comment.
- **Content Sourcing** (Open). How node descriptions borrowed from an existing encyclopedia (with
  attribution) are pulled in, snapshotted, and kept compliant with the source's license.
- **Search** (Open). Full-text search across node and claim content. Search over long-form prose comes with
  the PostgreSQL prose database.

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
5. ~~Prose Merging~~ — drafted, revised for the PostgreSQL prose store; pending a working application-level merge
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

- **The concurrency suite** (`src/scripts/tests/concurrent-suite.ts`, 50 scenarios). Supports repeating
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
section lists what those runs settled, so it is not repeated. What remains untested or unbuilt is tracked
as [GitHub issues](https://github.com/DiscantX/HumanTechTree/issues) in the repository rather than here.

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
- **Staged refusals.** Through the queue, an edge to a node another branch had deleted and an edge that
  closed a cycle were each refused by the gate, with the first change landed and no staging branch left.
- **Reading at a past commit.** A document read against an older commit returned the older version. The
  per-document history endpoint listed the commits for one document on a small database.
- **Apply as a three-way merge.** With a snapshot of the common ancestor as `before`, apply merged edits to
  different fields and returned a structured 409 for the same field. A bare branch name and a bare commit ID
  both work as `before`. Apply replaced rebase as the merge in Editing Model.
- **Apply under the server-error conditions.** An author passed in the commit information overrides the
  SDK's default. Sequential applies onto a moved target had no server errors in 180 runs, including 60 with
  no pause, where rebase failed about one in seven. Parallel applies onto one target still failed half the
  time. Apply is now the queue's default.
- **Apply in the queue.** Through an apply mode, the live scenarios (concurrent landings, conflicts, a
  fresh-branch resolution, duplicate claims, the missing-branch preflight, and both gate refusals) all
  passed with no retries and no spacing. Apply itself refuses an edge to a deleted node on the staging
  branch, which rebase let through to the gate.
- **Nested collections.** Different fields of one sub-document merge across branches and the same field
  conflicts. Reviews nested in a grounding's `Set` merge, and a `List` of sub-documents conflicts on any
  concurrent edit.
- **Rebase and commit IDs.** A branch's own commits did not survive a rebase in the third round either, and
  the rebase report was empty.
- **Commit authors.** The SDK stamps every document write with the login user, but an HTTP write can carry a
  chosen author, and that author survives a rewriting rebase, a fast-forward, and the staged landing. The
  queue does not need to pass it through. The store does not authenticate the value.

## What this page does not decide

- The content of any individual tech essay.
- The relationship between this index and essay-index.md, including whether they are ever merged or
  cross-referenced beyond simple links.
- The final directory layout. These essays are assumed to live under a path such as `wiki/tech/`, with
  the existing policy essays possibly moving to a sibling path later, but neither move is made yet.
