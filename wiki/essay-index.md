# Policy Essays: Contents and Status

The Human Tech Tree Wiki's rules are set out in a series of short essays. Each settles one question
and gives its reasoning. [About the Project](essay-00-about-the-project.md) explains what the project
is and defines the terms used throughout, and this page lists the essays, what each one decides, and
where each stands.

## Status

- **Open.** The question has been identified but no position has been written.
- **Proposed.** A position is written and awaiting testing against real cases.
- **Ratified.** The position is settled and binds the data model.

At present every written essay is Proposed. The project is still in its policy-drafting phase, and
any essay may be revised as real entries are added.

## Orientation

- **[About the Project](essay-00-about-the-project.md)** (Proposed). What the project is, how the
  graph works, how the policies are organized, and a glossary of terms.

## What belongs on the graph

- **[Founding Axioms](essay-01-founding-axioms.md)** (Proposed). A candidate becomes a node only if a
  human action is responsible for its existence and it is itself a discovery, invention, or
  achievement. Natural phenomena, and events that merely occasion a discovery, invention, or
  achievement, stay off the graph. What people came to understand about them does not.
- **[Achievement vs. Discovery vs. Invention](essay-04-achievement-discovery-invention.md)**
  (Proposed). Discovery reveals something that already existed. Invention creates something new.
  Achievement is an existing capability exercised to a superlative degree without producing a
  transferable technique. Importance is independent of category.
- **[What Constitutes a Discovery?](essay-03-what-constitutes-a-discovery.md)** (Proposed). A node may
  carry an optional stage (observation, exploitation, production, or explanation). Stages follow
  several patterns, and the anchor shown for a subject is computed from the graph.
- **Can an Achievement Become a Genuine Prerequisite?** (Proposed). Rarely, and only where doing and
  knowing are inseparable, so that no separate technique lies underneath. Not yet written up as a full
  essay.
- **[Node Granularity](essay-02-node-granularity.md)** (Proposed). A topic is divided into several
  nodes only when each part is eligible, has a history of its own, and differs in mechanism where the
  same thing arose independently. Broad open-ended topics such as "AI" are drawn as computed clusters
  and are never nodes.
- **[The Culture / Social-Systems Layer](essay-08-culture-social-systems-layer.md)** (Proposed).
  Writing, money, and political institutions belong on the graph. The general human capacity is on the
  floor, and each specific institutional form is eligible. Such subjects tend to develop by iterative
  abstraction.

## How things connect

- **[Edge Schema](essay-06-edge-schema.md)** (Proposed). Each edge is one claim with three
  independent fields: relationship-kind, basis, and grounding. Parallel edges are drawn as one line,
  and no field is ever required to be filled in.
- **[Historical Attestation vs. Logical Necessity](essay-07-historical-vs-logical-necessity.md)**
  (Proposed). An edge's basis is either a dated, regional claim about what happened or a timeless claim
  about what any civilization would need. Both can apply to a pair as two separate edges, and
  independently arising technologies are one node with an edge per origin.

## How claims are supported and kept correct

- **[Sourcing and Citation Policy for Edges](essay-09-sourcing-and-citation-policy.md)** (Proposed).
  A claim is backed by citations, arguments, or both. Every grounding is reviewed to the same standard,
  the number of reviews required grows with how much depends on the claim, and a computed status shows
  readers how well a claim is grounded.
- **[Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md)**
  (Proposed). Automatic checks run after every merge, protection scales with how much depends on an
  item, nothing with dependents is deleted outright, and disputes are objections to specific
  groundings.

## Planned policies

- **Notability / Inclusion Threshold** (Open). What makes a candidate that is eligible under the
  founding rules significant enough to warrant its own node, as opposed to being folded into a larger
  one or left out as trivial? This is similar in purpose to Wikipedia's notability guideline, though
  some of that guideline does not transfer, such as its rule about schools. Candidate material includes
  the distinction between a genuine achievement and a manufactured record. It is likely to interact
  with the sourcing and granularity policies.
- **Spotlight / Feed Mechanism** (Open). How does the wiki show that something is a big deal, such as
  a new node or a major recent event, without confusing importance with category? It is expected to be
  editor's choice and non-load-bearing. Questions include whether a spotlight expires, whether it
  applies retroactively, and how it relates to notability.
- **Bot and Automation Policy** (Open). What automated accounts may do, and under what constraints. The
  sourcing policy already fixes what the review mechanism needs from bots. Remaining questions include
  whether the API opens to other operators, defenses against fabricated sources and against injection
  through source text, and how bot permissions relate to the low-permission rule in the governance
  policy.
- **Argument Page Format** (Open). The structured page attached to a claim. Questions include which
  fields count as formal structure, so that changing them invalidates reviews, how premises refer to
  other claims, how objections are structured and resolved, and how the page relates to the open-forum
  talk page.

## Questions that cut across essays

Several unresolved questions touch more than one essay, so they are collected here.

- **Redirects and reviewed claims.** If a redirect re-points an edge to a narrower node, does that
  reset the edge's reviews? (Node Granularity, Governance and Moderation, Sourcing and Citation.)
- **Branch-and-merge or atomic statements.** Which editing model should the graph use in the long run?
  Claim-level review points toward the second. (Governance and Moderation, Sourcing and Citation.)
- **Reviewer eligibility and permission tiers.** The review rules depend on them, and they are not yet
  defined. (Governance and Moderation, Sourcing and Citation.)
- **How independent origins are handled when subjects are divided into stages.** Does each regional
  origin need its own stage chain, or should multi-origin subjects stay undivided? (What Constitutes a
  Discovery?, Historical Attestation vs. Logical Necessity.)
- **Mere influence.** Whether it needs sub-kinds or whether grounding can carry the distinction, and
  whether it should be weighted near zero when computing clusters. (Edge Schema, The Culture /
  Social-Systems Layer, Node Granularity.)
- **A two-layer floor.** Should the floor be recorded as a universal layer and a species-contingent
  layer? (Founding Axioms, Historical Attestation vs. Logical Necessity.)
- **Where cluster governance lives.** Whether the rules for pinned clusters belong in Node Granularity
  or in Governance and Moderation.
