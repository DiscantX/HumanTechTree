# Database Choice

**Status:** Proposed

Every tech essay downstream of [Architecture Overview](architecture-overview.md) assumes a data layer
already exists to build on. This essay picks it, and records why five real alternatives were
considered and set aside before settling on the sixth.

## What the data layer has to do

Restated from Architecture Overview: store nodes and edges with real data attached to each, version
that data with commits, branches, diffs, merges, and cheap reverts, and also hold the structured
wiki-mechanic documents (talk-page comments and argument pages) sharing that same version history.
Long-form prose and accounts have different needs and are handled by a second store, set out below. The
graph store also has to answer bulk, graph-shaped queries ("these thousands
of nodes and the edges between them") as an ordinary access pattern, not an exceptional one.

## The position

> **TerminusDB is the data layer for the graph and for the structured wiki-mechanic documents:
> talk-page comments and argument pages. Long-form prose lives in PostgreSQL, as immutable revisions
> linked to the graph by a stable identifier (see [Prose Merging](prose-merging.md)). Accounts live in a
> separate PostgreSQL database with its own credentials, so that identity data is isolated from
> everything else.**

TerminusDB is a version-controlled document-graph database: every write is a commit, branching and
merging work roughly the way they do in git, and it is queryable through GraphQL or its own
Datalog-based query language, WOQL. Nodes, edges, talk-page comments, and argument pages are all
schema'd JSON-LD documents in the same store, so a single commit log is the version history for the
graph and its structured discussion. Long-form prose keeps its own revision history in the second store,
which is the one place the project accepts two histories.

This is not the starting position. It is the surviving option after five real alternatives were
compared against it and rejected, each for a distinct reason worth keeping on record rather than
re-litigating later.

## Rejected: MediaWiki alongside TerminusDB

The first shape considered was the obvious one: TerminusDB for the graph, MediaWiki for talk pages,
policy pages, argument pages, and node prose, glued together for accounts and a unified watchlist.

MediaWiki is a genuinely strong fit for two of those four: talk pages and policy pages are ordinary
freeform text with linear revision history, which is MediaWiki's specialty. It is a weaker fit for
argument pages, which are semi-structured objects (premises, inference steps, an ungrounded-premise
list) that MediaWiki can only simulate inside wikitext templates, not represent as addressable
structure. And it is not needed at all for node text until editors are allowed to diverge from a
borrowed encyclopedia lede.

The deciding problem was integration, not per-feature fit. Accounts, a shared watchlist, and especially
diff and rollback would have to bridge two systems with no common primitive underneath. A unified
activity feed is achievable as federation across TerminusDB's commit stream and MediaWiki's own change
stream. A genuinely unified diff-and-rollback experience is not: TerminusDB's diff is a commit diff
over a graph, MediaWiki's is a line diff over a linear per-page history, and no shared object underlies
both. Standing up MediaWiki for two of four use cases, while accepting a permanently siloed
diff/rollback experience, was judged not worth the weight of a second full application (its own
accounts, permissions, skinning, and extension surface) bolted on rather than integrated.

Moving long-form prose out of TerminusDB does not reopen this choice. The deciding problem was never that
two stores would exist. It was that no shared primitive would underlie the two diff and rollback
experiences, and the graph still lives in TerminusDB. What a wiki engine would now add is its own accounts,
permission model, page model, and extension surface, none of which can see a node's blast radius, a claim's
computed status, or a content-hash review. The application-level merge has to be built whichever store
holds the text, so an engine's merge is not a saving. The prose store is therefore a plain relational
database with a thin revision layer.

## Rejected: Wikibase as the sole system

Wikibase, the MediaWiki extension behind Wikidata, was considered as a way to make the unification
problem disappear entirely rather than solve it: one system for the graph and every wiki mechanic at
once. Its item/statement/qualifier/reference model is a real precedent for atomic, independently
addressable claims, and its "influenced by" property is a working, if loosely defined, precedent for
something like the Edge Schema's mere-influence relationship-kind.

Two problems ruled it out. First, its schema is generic where this project's is not: there is no
native concept of the Edge Schema's basis field (historical attestation versus logical necessity), no
argument-grounding structure with a visible ungrounded-premise list, and no claim-level review/status
pipeline. All of that would still have to be built by this project on top of Wikibase's primitives,
the same as on any other store, so Wikibase does not actually remove that work.

Second, and more decisively, Wikibase's primary storage is MediaWiki's own page-oriented store, built
around single-item reads and writes. Bulk, graph-shaped queries depend on a separate, asynchronously
synced SPARQL query service (Blazegraph today, on Wikidata's own infrastructure), and that service's
own documentation is candid about real strain: previously fast queries now time out under load, the
query optimizer is fragile to small query changes, and there is, in the service's own words, no
guarantee a query that succeeded once will succeed again. This project's graph will be a small fraction
of Wikidata's scale, so raw congestion is not the direct risk. The architectural pattern is: primary
storage shaped for single-page edits, with bulk queries answered by a secondary index that lags behind
it, is a mismatch for a workload whose single most common query is "give me a large connected
subgraph." A native graph store treats that as its primary access pattern rather than a secondary one
built to catch up.

As a side finding from this comparison: Wikidata's own dataset was checked directly for reusable edge
data and found to contain useful node-level facts (a discoverer-or-inventor property, inception dates,
an instance-of/subclass-of taxonomy) but nothing resembling a prerequisite-edge dataset with any
notion of basis or grounding. It is a candidate source for node metadata import, tracked as a
Seeding and Import question, and not a reason to reconsider this essay's conclusion.

## Rejected: Blazegraph

Blazegraph, the RDF triple store underlying Wikibase's own SPARQL layer, was checked as a standalone
alternative to TerminusDB and ruled out on maintenance grounds alone, independent of any schema-fit
question. Amazon acquired it in 2018 and the open-source project was effectively abandoned afterward;
its GitHub organization was formally archived in March 2026, its last substantive commit dates to
2023, and Wikidata's own infrastructure team has an open initiative to migrate away from it. A store
with no security-patch path and no scaling path forward is not a viable long-term foundation for a
live, many-editor project, whatever its query performance looks like today.

## Rejected: QLever as primary store

QLever, a modern and actively maintained SPARQL engine out of the University of Freiburg, was
evaluated as QLever's answer to Blazegraph's abandonment: fast, benchmarked into the hundred-billion-
triple range, and, as of mid-2025, supporting SPARQL Update for writes. It is a live, healthy project,
unlike Blazegraph, and its query language is arguably more mature than WOQL.

It was set aside as the primary store for the same structural reason as Wikibase and Blazegraph: it is
a triple store with no native concept of a claim as a structured object, and, more importantly, no
version-control primitives at all. Adopting QLever would mean building the entire versioning layer
Governance and Moderation depends on (commits, branches, diffs, merges, reverts) from scratch, on top
of a store that has no notion any of that exists. That is a direct regression on the requirement that
motivated the original TerminusDB direction, in exchange for query performance and scale this project's
actual size does not need. It remains a plausible candidate for a narrower future role: a fast,
purpose-built secondary index for bulk analysis or full-text search, in the same relationship to
TerminusDB that WDQS has to Wikidata's primary store, if that role is ever needed.

## Rejected: Gollum and Wiki.js as the wiki layer

Two git-backed wiki engines were considered as a way to keep everything git-shaped without adopting
MediaWiki outright. Neither actually solves the problem that motivated looking at them, because
neither shares version control with TerminusDB: each keeps its own git repository (Gollum) or its own
database with git as an optional sync target (Wiki.js), so the same siloed-diff, federated-watchlist
problem identified for the MediaWiki option recurs unchanged.

Each also has a specific weakness beyond that shared one. Gollum has no built-in accounts or
permissions system; access control is whatever wraps it externally, a poor match for a project that
explicitly expects editing to be restricted for some content. Its own ecosystem is fading: the original
GitHub fork has been archived since 2019, and GitLab, a production user of Gollum at real scale, has
stated an intention to move away from it entirely. Wiki.js has real accounts and permissions, and
remains actively released, but its git storage is a backup and sync target rather than its source of
truth, so its own revision history is unrelated to git commits; its more modular 3.0 rewrite has also
been in development without a release since roughly 2022, a soft signal about momentum even though 2.x
patches continue.

## The second store: PostgreSQL

Long-form prose and accounts are kept out of TerminusDB, in two PostgreSQL databases that share an engine,
a client library, and operational practice but no tables or credentials.

- **The prose database** holds long-form text as immutable revisions, keyed to the graph by a stable page
  identifier, and gives indexed full-text search over that text. Its tables and the merge that runs
  against them are set out in [Prose Merging](prose-merging.md).
- **The accounts database** holds identity, sessions, and permissions. The services that read the graph or
  the prose use credentials that cannot read it. Revisions and commits record an opaque account identifier,
  and display names are resolved by the application.

PostgreSQL was chosen over SQLite for concurrent writers (the merge queue and bots will write at the same
time), built-in full-text search and trigram matching, separate databases and roles for isolation, and the
range of managed hosting. SQLite was the serious alternative: it needs no server, and a separate file
isolates accounts just as well. It was set aside for its single writer and single host. The application
reaches both databases through a thin repository layer, so the engine can change if hosting constraints
ever require it.

The cost is that no transaction spans the two stores. The prose store is built so that it does not need
one: a save is one transaction inside PostgreSQL, and the only cross-store write is creating a page before
the node that refers to it. Recent changes and watchlists would otherwise have to read both histories, so a derived activity table in
the prose database records every change, graph and prose alike, and the feed queries that (see Prose
Merging). The graph store's commit log stays the source of truth for graph history.

## Search capability, checked directly

Because the current direction folds wiki-mechanic content into TerminusDB, its native search
capability was checked rather than assumed. TerminusDB offers regex matching, a fuzzy string-similarity
comparison, and ordinary substring queries through WOQL, all evaluated at query time. It has no
inverted index, no tokenization, no stemming, and no relevance ranking, nothing that amounts to
indexed full-text search. Given that node content is deliberately light (a short borrowed description,
structured fields for stage, category, and dates), this is treated as sufficient for the graph itself.
For long-form prose the gap closes, since the prose database provides indexed full-text search. It remains
for talk-page comments and argument pages, which stay in the graph store, and is tracked as a deferred
question rather than solved here; see the tech index's Search entry.

## What the prototype has shown

A prototype (`src/scripts/tests/`) runs against TerminusDB 12.0.7, and a broad test suite has exercised the
store's behavior in several rounds, including repeated runs. The editing-related findings are in [Editing Model](editing-model.md). The ones
that bear on this choice are these.

- **Schema enforcement is strong.** Missing required fields, invalid enum values, unknown properties,
  and directly inserted edges pointing at nonexistent nodes were all rejected, and the store refused to delete a node that
  still had dependent edges. This is the kind of guarantee a generic triple store would have left to the
  application.
- **The store does not catch everything.** Cycles and self-loops were accepted, and an edge landed on main
  after another branch had deleted its target node, so the validation gate remains necessary. Duplicate claims and the edge multiplicity rules were accepted under the prototype's
  random keys, but a deterministic composite key over an edge's pair, basis, and origin makes the store
  refuse them, at a cost set out in [Data Model](data-model.md).
- **Nested collections merge correctly if the right type is used.** A `Set` of sub-documents takes
  concurrent appends without loss. A `List` reports a conflict. An `Array` silently produces a wrong
  result and is never to be used.
- **Prose does not merge natively.** See the open question below and [Prose Merging](prose-merging.md).
- **Performance is comfortable at prototype scale.** Bulk inserts of 300 nodes and about 600 edges took
  between one and three seconds in the early runs, and reading all edges back took under 0.3 seconds.
  The second run was slower than the first for reasons not yet identified.
- **The server fails intermittently, and the pattern is now characterized.** A generic server error (an
  HTTP 500 with the message "Unexpected failure in request handler") appears when rebases are issued
  concurrently onto one branch, where four of five fail every time, and on about one in seven replays that
  land immediately after another landing. The rate falls as the wait before the replay grows, to zero at
  one second, and a fast-forward never fails. Every retry that waited succeeded, and no data was lost or
  duplicated in any case. The cause is still unknown, the server log records only the status code, and the
  documentation does not mention it. A second, differently worded 500 is returned for requests that name a
  nonexistent branch, where the API specification says 404. Details are in
  [Editing Model](editing-model.md).

### What the stress test showed

A stress test grew the graph from 1,000 to 10,000 nodes under four variants on the development VM (972 MB
of memory, one CPU, TerminusDB 12.0.7). Variant A held no prose, B held prose of about 8 KB inline on every
node, C held it on 10% of nodes, and D held it on every node as a separate document.

| | A (no prose) | B (inline, all nodes) | C (inline, 10% of nodes) | D (separate document, all nodes) |
| --- | --- | --- | --- | --- |
| Disk growth, 1,000 to 10,000 nodes | +48 MB | +196 MB | +38 MB | +198 MB |
| Memory after restart, 10,000 nodes | 79 MiB | 161 MiB | 88 MiB | 186 MiB |
| Cold start to ready, 10,000 nodes | 1.1 s | 2.6 s | 2.2 s | 3.3 s |

- **Prose volume drives the cost, not its placement.** B and D match on disk and are close on memory, and C
  is close to A. This is why the decision to hold long-form prose elsewhere does not depend on whether it
  would have been inline or separate.
- **A field edit costs about 15 to 18 KB of storage.** Every variant also showed one jump in disk use
  during the edits (23 to 105 MB, growing with database size) at roughly 230 to 300 commits. Layer
  consolidation is a guess. A run of 1,000 or more edits would show whether it repeats.
- **`optimize` reclaimed nothing,** and the history endpoint returned 408 at every checkpoint, a known
  upstream limitation.
- **Blast radius timed out as a live WOQL query,** so it is computed in application code, which is a matter
  for the Computed Values essay.
- **Timing is not comparable between runs.** Wall-clock figures varied two to three times. The disk figures
  are growth in the whole storage directory, not absolute sizes, because earlier runs had left about
  1.7 GB behind.

### What the documentation and client turned out to say

The first version of this essay leaned on the prototype alone. Reading the official documentation, the
OpenAPI spec, and the client packages afterwards changed some of what was assumed.

- **Rebase is the documented merge.** The server has no merge endpoint. Its version-control operations
  are rebase, apply, squash, reset, diff, patch, and log, and the docs' own quickstart merges with
  rebase. The details, including apply's unresolved status, are in [Editing Model](editing-model.md).
- **Rebase's error behavior is undocumented.** The spec lists no conflict or server-error response for
  it, so the conflict shape and the 500s seen so far have no documented contract to check them against.
- **The official client package is `terminusdb`, not the one the prototype started with.** The docs
  install `terminusdb` (12.0.5), which is built from the same repository as `@terminusdb/terminusdb-client`
  (12.0.0) but is newer, and which the docs site badges as its JavaScript SDK version. The package ships
  its own type declarations and exports the client class by name, so the `require()` and untyped
  workaround was unnecessary. Both packages already had a rebase method, so the raw HTTP wrapper was
  never needed either. Most client methods are still typed loosely (`Promise<any>`), so the types help
  less than they might.
- **Some documented methods do not exist.** The commit-history method shown on the docs' reset page is
  absent from both packages, and the spec marks the log endpoint as not implemented in the JavaScript
  client. The prototype keeps a small HTTP helper for it.

## What this essay does not decide

- The design of accounts, sessions, and permissions inside the accounts database. That belongs to
  Accounts, Permissions, and Bots.
- Hosting, backup, and operation of the two PostgreSQL databases. That belongs to Hosting and Operations.
- The concrete editing workflow on top of TerminusDB. Editing Model has since adopted branch-and-merge
  and set out what the application must build around it.
- The rendering and application-framework layers, which do not depend on this choice beyond needing a
  client that can query TerminusDB's GraphQL or WOQL interface.

## Open questions

- **The prose-merge test, now run.** Native merging fails on prose: string fields are atomic, so two
  edits to different paragraphs of one field still conflict. This was the specific gate before this
  essay could move from Proposed to Ratified. It does not overturn the choice, because the merge can be
  done in the application (see [Prose Merging](prose-merging.md)), and most wiki-mechanic content is
  either append-only comments or structured data that never needed it. The remaining gate is a working
  application-level merge. An earlier concern, that two edits to the same paragraph once landed without a
  conflict, did not reproduce in 40 repeated runs: every one was reported as a conflict and kept the first
  editor's text.
- **Server stability.** The intermittent server errors are characterized and have a workaround, which is
  spacing and retrying landings in the merge queue, but their cause is unknown. Remaining: report them to
  the maintainers with a minimal reproduction and the missing-branch 500. The project is already on the
  latest server release (12.0.7), so a retest after an upgrade is not currently possible. Because spacing
  and retrying fully mask the errors in every test, a fix or a workaround is probably enough. If the
  errors turn out to be structural, or to worsen with a larger database, this choice needs revisiting.
- **QLever as a future secondary index.** Whether a fast, purpose-built query or search layer is ever
  worth adding alongside TerminusDB, once real content volume makes the current search position
  insufficient, is left open rather than decided now.
- **TerminusDB's own long-run health.** Its stewardship changed hands (now under DFRNT) and it is
  actively releasing, which is why it was treated as viable at all, but it does not have Wikipedia- or
  Wikidata-scale institutional backing. The official documentation is now published from a DFRNT
  repository that GitHub shows as 299 commits ahead of an older copy under a different organization, which
  fits that picture and suggests the prose docs are maintained more actively than the code they describe. This is worth
  periodically re-checking rather than assumed permanently settled.
- **Whether talk-page comments stay in the graph store.** Each comment is a small separate document and
  never needs text merging, so they stay for now. If comments grow long or numerous, they are the content
  most likely to move to the prose database.
