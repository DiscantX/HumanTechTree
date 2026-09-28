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

At present every tech essay is Open. Drafting will proceed roughly in the order listed under
"Suggested drafting order" below, since several later essays depend on positions taken in earlier
ones.

## Architecture and data

- **Architecture Overview** (Open). What the system is, what it must support, and how the problem
  divides into layers (data, version control, wiki mechanics, presentation). The tech counterpart of
  About the Project; holds the glossary and cross-references for this set of essays.
- **Database Choice** (Open). TerminusDB against Postgres with a graph extension (or another graph
  store), and whether the project needs one store or two — a graph-and-history store versus a
  conventional store for accounts, talk pages, and search.
- **Editing Model** (Open). Branch-and-merge against Wikidata-style atomic, independently addressable
  statements. Left open by Governance and Moderation for a Living Graph; the sourcing policy's
  claim-level reviews, each bound to one version of one claim, sit more naturally with the atomic
  model, but the two trade off editing friction against consistency guarantees differently.
- **Data Model** (Open). How nodes, claims (edges), groundings, reviews, objections, stages,
  categories, and origins are represented, including stable identifiers separate from display titles,
  and how redirects work. The schema the policy essays imply but do not themselves specify as data.
- **Computed Values** (Open). Blast radius, the computed anchor stage, the review-count requirement,
  claim status, and clusters are all derived from the graph rather than edited directly. When each is
  computed (on write, cached, or on read) and how it is invalidated as the graph changes.

## Integrity and history

- **The Validation Gate** (Open). Where the cycle, dangling-edge, orphan, basis-fit, and (proposed)
  premise-dependency checks run against the merged graph, and whether a detected cycle hard-blocks a
  merge or is flagged for human review, per Governance and Moderation's open question.
- **Versioning and Reviews** (Open). How a review binds to a specific version of a claim, how a
  "substantive change" is computed from a diff rather than self-flagged by an editor, and how a
  redirect that re-points an edge interacts with the reviews already on it.

## Wiki mechanics

- **Accounts, Permissions, and Bots** (Open). How the permission tiers described in Governance and
  Moderation are enforced, how bot accounts and their declared operator of record are modeled, and how
  far the API is exposed to other operators.
- **Talk Pages and Argument Pages** (Open). Where open-ended discussion and the planned structured
  Argument Page Format live, and whether they share a store with the graph or sit in the conventional
  side of the split.
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
- **Achievements and Spotlight** (Open). Whether achievements and the planned Spotlight / Feed
  Mechanism need a separate presentation layer, and where their data is stored relative to the graph.
- **Cluster Rendering** (Open). Where the clustering algorithm runs, and how a pinned cluster's name,
  slug, and drift flag are shown to editors.

## Delivery

- **Application Framework** (Open). Language, server framework, and API style connecting the
  presentation layer to the data layer(s).
- **Bot Infrastructure** (Open). How verification agents retrieve source text themselves, how the
  project defends against injection through untrusted source text, and how model-family independence
  is enforced in the reviewer tally, per the sourcing policy's bot rules.
- **Seeding and Import** (Open). Manual seed sets against bulk import, and how import is kept from
  reintroducing the scope creep the project set out to avoid.
- **Hosting and Operations** (Open). Deployment, backups, and scaling.
- **The Essays Themselves** (Open). Whether the policy essays (and these tech essays) stay a markdown
  repository or move to MediaWiki or another platform, a question deferred once already.

## Suggested drafting order

Several essays depend on positions taken earlier. A reasonable order for a first pass, aimed at
getting a prototype running:

1. Architecture Overview
2. Editing Model
3. Database Choice
4. Data Model
5. The Validation Gate
6. Computed Values
7. Graph Rendering

Everything else can follow once the prototype produces real data to test against, in the same spirit
as the policy essays' own open questions.

## What this page does not decide

- The content of any individual tech essay.
- The relationship between this index and essay-index.md, including whether they are ever merged or
  cross-referenced beyond simple links.
- The final directory layout. These essays are assumed to live under a path such as `wiki/tech/`, with
  the existing policy essays possibly moving to a sibling path later, but neither move is made yet.
