# Database Choice

**Status:** Proposed

Every tech essay downstream of [Architecture Overview](architecture-overview.md) assumes a data layer
already exists to build on. This essay picks it, and records why five real alternatives were
considered and set aside before settling on the sixth.

## What the data layer has to do

Restated from Architecture Overview: store nodes and edges with real data attached to each, version
that data (both prose and graph structure) with commits, branches, diffs, merges, and cheap reverts,
and, under the current direction, also hold talk pages, policy pages, and argument pages as documents
sharing that same version history. It also has to answer bulk, graph-shaped queries ("these thousands
of nodes and the edges between them") as an ordinary access pattern, not an exceptional one.

## The position

> **TerminusDB is the data layer, for the graph and, conditional on application-level prose merging
> (see [Prose Merging](prose-merging.md)), for talk pages, policy pages, and argument pages as well. A
> small side-store, outside TerminusDB, handles accounts and, later, search indexing.**

TerminusDB is a version-controlled document-graph database: every write is a commit, branching and
merging work roughly the way they do in git, and it is queryable through GraphQL or its own
Datalog-based query language, WOQL. Nodes, edges, and now wiki-mechanic content are all schema'd
JSON-LD documents in the same store, which is what lets a single commit log serve as the version
history for the whole project rather than one history for the graph and a second, separate one for
everything else.

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

## Search capability, checked directly

Because the current direction folds wiki-mechanic content into TerminusDB, its native search
capability was checked rather than assumed. TerminusDB offers regex matching, a fuzzy string-similarity
comparison, and ordinary substring queries through WOQL, all evaluated at query time. It has no
inverted index, no tokenization, no stemming, and no relevance ranking, nothing that amounts to
indexed full-text search. Given that node content is deliberately light (a short borrowed description,
structured fields for stage, category, and dates), this is treated as sufficient for the graph itself.
It is a real, acknowledged gap for the higher-volume prose that talk, policy, and argument pages will
eventually carry, and is tracked as a deferred question rather than solved here; see the tech index's
Search entry.

## What the prototype has shown

A prototype (`src/scripts/`) runs against TerminusDB 12.0.7, and a broad test suite has exercised the
store's behavior twice. The editing-related findings are in [Editing Model](editing-model.md). The ones
that bear on this choice are these.

- **Schema enforcement is strong.** Missing required fields, invalid enum values, unknown properties,
  and edges pointing at nonexistent nodes were all rejected, and the store refused to delete a node that
  still had dependent edges. This is the kind of guarantee a generic triple store would have left to the
  application.
- **The store does not catch everything.** Cycles, self-loops, and duplicate claims were all accepted,
  so the validation gate remains necessary. The duplicates are a consequence of the prototype's random
  key strategy, not of the store: the documented deterministic strategies could prevent them, at a cost
  discussed in [Data Model](data-model.md).
- **Prose does not merge natively.** See the open question below and [Prose Merging](prose-merging.md).
- **Performance is comfortable at prototype scale.** Bulk inserts of 300 nodes and about 600 edges took
  between one and three seconds across the two runs, and reading all edges back took under 0.3 seconds.
  The second run was slower than the first for reasons not yet identified.
- **The server fails intermittently, and the failure is not explained by our usage.** A generic server
  error (an HTTP 500 with the message "Unexpected failure in request handler") appears on rebase
  operations in several scenarios, on syncs, on merges, and in three of five parallel landings, and it
  persisted after the prototype moved from a hand-written HTTP call to the official client. A second,
  differently worded 500 is returned for requests that name a nonexistent branch, where the API
  specification says 404. No data was lost or duplicated in any case, but the cause is unknown and the
  documentation does not mention it.

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

- Whether the eventual side-store for accounts is Postgres, SQLite, or something else, and whether it
  later doubles as a search index. That belongs to Accounts, Permissions, and Bots and to Search.
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
  application-level merge, and, if block storage is ever adopted, the untested collection-field
  behavior. One further observation belongs here: in the second run, two edits to the *same* paragraph
  landed without a conflict where the first run reported one. Until that is explained, the claim that
  same-field conflicts are always reported is not safe to rely on (see Editing Model).
- **Server stability.** The intermittent server errors need characterizing before the store is treated
  as production-ready. Planned: repeated runs with and without the sync step to get failure rates, the
  server's own log for the same window, and, if the errors persist, a report to the maintainers together
  with the missing-branch 500. The project is already on the latest server release (12.0.7), so a retest
  after an upgrade is not currently possible. If the errors turn out to be a defect in this version, a
  fix or a workaround is probably enough. If they turn out to be structural, this choice needs revisiting.
- **QLever as a future secondary index.** Whether a fast, purpose-built query or search layer is ever
  worth adding alongside TerminusDB, once real content volume makes the current search position
  insufficient, is left open rather than decided now.
- **TerminusDB's own long-run health.** Its stewardship changed hands (now under DFRNT) and it is
  actively releasing, which is why it was treated as viable at all, but it does not have Wikipedia- or
  Wikidata-scale institutional backing. The official documentation is now published from a DFRNT
  repository that GitHub shows as 299 commits ahead of an older copy under a different organization, which
  fits that picture and suggests the prose docs are maintained more actively than the code they describe. This is worth
  periodically re-checking rather than assumed permanently settled.
