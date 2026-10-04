# Architecture Overview

**Status:** Proposed

The Human Tech Tree Wiki is a graph that must also behave like a wiki: editable, discussable, and
protectable, while presenting itself as a clean, game-like tech tree rather than a database with a
skin on it. This essay is the tech counterpart of [About the
Project](../policy/about-the-project.md), and it fixes how the problem divides into layers before any
individual tech essay picks a specific tool for one of them.

## What the system has to support

Restated from first principles, independent of any product choice:

- **A store for nodes and edges**, where both carry real data (a node's subject, stage, and category;
  an edge's relationship-kind, basis, origin, and groundings, as defined in [Edge
  Schema](../policy/edge-schema.md)).
- **Version control over that data**, covering both prose and the graph's own structure. [Governance
  and Moderation for a Living Graph](../policy/graph-governance-and-moderation.md) assumes commits,
  branches, diffs, merges, and cheap reverts exist somewhere underneath it.
- **Wiki mechanics**: talk pages, policy pages, and the structured argument pages that [Sourcing and
  Citation Policy for Edges](../policy/sourcing-and-citation-policy.md) requires for argument
  groundings.
- **Accounts and permissions**, scaled to a node or edge's blast radius per the governance essay's
  protection tiers.
- **A presentation layer** that reads like a curated, game-style tech tree and not a force-directed
  hairball, with a dedicated card or page per node and possibly per edge, and the collapse behavior
  (parallel edges as one line, an inspector panel, a computed anchor for divided subjects) that the
  Edge Schema and [What Constitutes a Discovery?](../policy/what-constitutes-a-discovery.md) both take
  for granted.
- **Search**, at whatever depth the actual content volume turns out to need.

None of this is a product recommendation yet. It is the checklist every later tech essay has to answer
to, the same way [Founding Axioms](../policy/founding-axioms.md) fixes what a node is before [Node
Granularity](../policy/node-granularity.md) argues about how finely to divide one.

## Four layers, not one stack

> **The system divides into four layers — data and version control, wiki mechanics, presentation, and
> delivery — and a tool is chosen per layer, not once for the whole project.**

Early research treated this as a single stack decision (one database, one frontend library, one
framework). Extended comparison against several concrete alternatives, recorded in [Database
Choice](database-choice.md), showed that most candidate tools are strong at one layer and weak or
actively wrong for another, and that the layers genuinely vary independently:

- **Data and version control.** What stores a node, an edge, and the history of both. This is the
  layer [Database Choice](database-choice.md) settles, and [Editing Model](editing-model.md) sets out
  what the application must build around it (a merge queue that serializes landings and translates the
  store's errors).
- **Wiki mechanics.** Talk pages, argument pages, long-form prose, accounts, and permissions. Talk-page
  comments and argument pages are structured documents in the same store as the data layer, discussed
  below. Long-form prose and accounts are the two pieces that stay outside it, each in a PostgreSQL
  database of its own. The prose needs application-level merging, covered in
  [Prose Merging](prose-merging.md).
- **Presentation.** The curated tech-tree rendering, node and edge cards, the achievement/spotlight
  treatment, and the text editor used for long-form content. This layer is still Open; see [Graph
  Rendering](tech-index.md) and Text Editor in the tech index.
- **Delivery.** The application framework serving the presentation layer against the data layer, plus
  hosting and operations. Also Open.

## Why structured wiki mechanics folded into the data layer

The naive shape of this project treats "the graph" and "the wiki around the graph" as two systems that
have to be made to cooperate — a graph database on one side, a conventional wiki engine (MediaWiki, a
git-backed wiki, or similar) on the other, with some integration layer bridging accounts, watchlists,
and diff/rollback between them.

That shape was tested seriously against MediaWiki, Wikibase, and two git-backed wiki engines (Gollum
and Wiki.js), and it did not hold up. The recurring failure, detailed in [Database
Choice](database-choice.md), is that none of these give the graph and the prose a **shared** version
history. Each keeps its own commit or revision log, so a unified watchlist has to be built as
federation across two event streams, and diff, rollback, and conflict resolution stay two genuinely
different code paths behind one UI, not one shared mechanism.

The current direction instead treats talk-page comments and argument pages as documents in the
same store as the graph itself. This is a direct consequence of picking a document-graph database
(TerminusDB, per Database Choice) rather than a pure triple store: a talk-page comment is just
another schema'd document, versioned by the same commits that version the graph. A
watchlist becomes one query over one commit log instead of a federation of two. An argument page, with
its premises, inference steps, and ungrounded-premise list, arguably fits better here than it would
have in a wikitext template, since it can be real structured data instead of simulated structure.

This was provisional on one test, and the test has now been run. The store does not merge text inside a
field: two edits to different paragraphs of one description still conflict. The fold-in survives for
structured content, which never needed text merging, since talk-page comments are separate append-only
documents and argument pages are structured data. Long-form prose is the exception and does not stay in
the graph store. Native merging fails on it, and a stress test found that the memory and disk cost of
holding it inline grows with its volume. It lives in PostgreSQL and is merged in the application, as
[Prose Merging](prose-merging.md) sets out.

## What stays outside the unified store

Three things are deliberately not folded in, for different reasons.

- **Long-form prose.** Articles and any long policy or essay pages are stored as immutable revisions in a
  PostgreSQL prose database and linked to the graph by a stable identifier. The graph store cannot merge
  text inside a field and pays for prose in proportion to its volume.
- **Accounts.** Identity, sessions, and permissions are treated as a solved problem with mature
  off-the-shelf libraries in the chosen application framework, and there is no argument for making the
  graph store also be an identity provider. This sits in a PostgreSQL database of its own, separate from the prose database, so that identity data
  has its own credentials.
- **Search, conditionally.** [Database Choice](database-choice.md) and the tech index's Search entry
  record that the graph store's native query capability (pattern and substring matching, not indexed
  full-text search) is being treated as sufficient for the graph for now, given how light node content actually is.
  Indexed full-text search over long-form prose comes with the prose database. Search over talk
  comments and argument pages, and any future embedding-based features, are deferred rather than built
  preemptively, and would sit with the prose database, not the accounts database, which stays isolated.

## Presentation is a separate concern by design

Nothing about folding wiki mechanics into the data layer collapses the presentation layer into it. The
schema's own rule that **the graph that is stored is never the graph that is shown** (Edge
Schema) already assumes a rendering layer that computes a curated, collapsed view from a richer stored
graph. That rendering layer, the library it is built on, and its layout approach remain fully open
questions, tracked separately in the tech index.

The same holds for the text editor. A rich-text editor is worth having for long-form content, and
ProseMirror and Lexical are both serious candidates, but the choice is independent of how prose is
stored and merged. The one constraint the storage side places on it is that content is stored as
markdown.

## What this essay does not decide

- Which specific database and query language fill the data layer. That is [Database
  Choice](database-choice.md).
- How concurrency and conflicts are handled on top of the store. That is [Editing
  Model](editing-model.md), which adopted branch-and-merge.
- How long-form prose is merged. That is [Prose Merging](prose-merging.md).
- The rendering library, layout approach, text editor, and application framework. All remain Open in
  the tech index.
- How accounts and permissions are implemented, beyond the position that they sit outside the unified
  store.

## Open questions

- **The application-level prose merge.** The store's own merge model was tested and does not merge
  prose, so the remaining gate is a working three-way merge in the application, over the prose store. That
  has not been built.
- **Where the line between "data layer" and "wiki mechanics" actually falls.** Argument pages lean
  structured enough to belong unambiguously with the graph. Talk pages are separate append-only
  comments and behave like structured data too. Only long-form text behaves like prose, and it now lives
  in the prose database. Whether policy and essay pages are held by the wiki at all depends on the open
  question of whether they stay a markdown repository.
- **How much of the presentation layer's needs should feed back into the data-layer choice.** A
  rendering library's appetite for bulk reads has not been tested against real query patterns yet. The
  prototype's bulk reads were fast at small scale (all edges of a 300-node graph in 0.15 seconds), but
  that is not the rendering layer's own access pattern.
- **Server stability.** The intermittent server errors seen in the prototype have a characterized pattern
  and a workaround in the merge queue, but an unknown cause, and they bear on every layer that sits on the
  data layer. See Database Choice.
