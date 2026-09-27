# Essay 2 — Node Granularity: What Counts as One Node

**Status:** Proposed

**Depends on:** Essay 1 (the two founding axioms — granularity is decided by applying them
node-by-node, not by a separate checklist), Essay 6 (edge schema — decomposition is expressed
entirely through existing edges), Essay 10 (the redirect mechanism this essay leans on for
dissolved compound labels)

**Gates:** Essay 7 (the deciding factor for when an independently-discovered technology gets split
into separate nodes rather than one node with multiple historical-attestation edges), Essay 8
(culture/social-systems layer likely reuses the sequential/compositional distinction below), Essay
10 (may need to absorb cluster-pinning governance as an addendum — see Section 5)

## 1. The problem

The original framing of this essay was narrower than the problem turned out to be: "big" compound
discoveries like fire decompose into a sequence of separable capability transitions — observation,
exploitation, production, explanation — and the job of this essay was assumed to be writing the
checklist that tells an editor when a candidate warrants that kind of split.

That framing quietly generalized from a single worked example. Running a second case — artificial
intelligence — through the same assumption broke it in two separate ways at once. First, AI has no
single causal lineage to decompose in the first place: a concept/aspiration lineage (Dartmouth,
1956), a technical-capability lineage (NLP, neural networks, transformers), and a compute/hardware
lineage (Moore's Law, GPUs) all contribute, but the first barely causally connects to the other two
— they didn't converge from one trunk the way fire's observation leads to its exploitation. Second,
AI has no terminal state: fire either can or cannot be reliably produced, full stop, but "AI" is
still an open, moving frontier, ending in a currently-undefined "AGI (future)" in any sketch of it
someone draws today.

Those two failures turned out to be the actual content of this essay. Fire's decomposition was
never wrong, but it was one shape among at least two, and a third situation exists that isn't a
decomposition at all in the sense fire's is.

## 2. Two decomposition topologies, not one universal template

> **A compound topic decomposes either sequentially or compositionally, and the two require
> different treatment — neither requires a new relationship type beyond what Essay 6 already
> defines.**

**Sequential decomposition** applies to *phenomenon-mastery* topics: something that already exists
in nature, independent of human effort, before anyone touches it, where the decomposition tracks
humanity's progressively deeper relationship to that pre-existing phenomenon. Fire is the clean
case — observed, then exploited, then produced on demand, then explained — and fermentation or
electricity (static and lightning observed, then amber and eels exploited, then batteries and
generators produced it, then electromagnetism explained it) likely share the same shape. Each step
is a genuine, separate human action, and each step is a genuine prerequisite of the next — which
means this is not a new kind of structure at all. It is an ordinary chain of edges under Essay 6's
existing schema (material necessity or conceptual enablement, decided per step), and once the
decomposition happens, there is no independent thing left for the compound label to *be* other
than that chain.

**Compositional decomposition** applies to topics assembled from multiple independently-developed
lines that converge — an automobile from engine, chassis, wheels, and drivetrain; plausibly AI's
technical-capability and compute lineages relative to whatever gets built on top of both. This is
already exactly what Essay 6's **combination** relationship-kind exists for: several prerequisite
edges converging on one real, persisting node. The compound node does not dissolve here, because it
genuinely is a new thing and not merely the last link in a sequence — but again, no new relationship
type is needed, because Essay 6 already has one.

## 3. Why no container/parent relationship type is needed

The question that opened this debate was whether decomposition needs a parent-node containment
relation distinct from ordinary edges. It does not, for a reason specific to each topology:

- **Sequential** decomposition doesn't need a container because the compound label doesn't survive
  decomposition as anything with independent graph identity. Essay 10, Section 5 already commits to
  a mechanism for exactly this situation — a move, rename, or merge leaves a redirect at the old
  identifier. Any existing edge that generically cited "fire" as a prerequisite resolves through the
  redirect to the terminal node in the chain (production, in fire's case) — the node representing
  the fully realized capability, since "requires fire" means "requires the capability to make it,"
  not "requires having once observed it burn."
- **Compositional** decomposition doesn't need a container because the compound node already exists
  as a real, addressable thing — the convergence point of combination edges. There is nothing left
  for a container to hold that the node itself doesn't already represent.

Introducing a parent/container concept alongside these would be a second, competing way to express
structure, which is precisely what Essay 6, Section 3 was written to prevent — every future essay
is meant to populate one shared edge schema, not invent a new type each time a new case turns up.

## 4. The case neither topology covers: open-ended, multi-lineage macro-topics

AI does not fit cleanly into either shape above, and forcing it into one would misrepresent what it
actually is. It has multiple lineages like a compositional case, but those lineages barely relate to
each other causally — the concept lineage did not materially enable the technical lineage the way an
engine and a chassis both feed into an automobile. And unlike a sequential case, it has no terminal
node to redirect a generic reference to: today "AI" might colloquially mean transformers or large
language models, but that pointer has already been wrong once (expert systems, in the 1980s) and
will likely be wrong again.

This is not a third decomposition topology to formally define — adding topologies was explicitly
something to avoid, given the complexity cost, and open-endedness is better understood as a
property that defeats redirect resolution specifically, not a new structural category requiring its
own checklist. The resolution proposed for it doesn't live in the stored graph at all.

## 5. Resolving the open-ended case: algorithmic clustering as a render-layer device

> **A macro-topic with no terminal state and no clean single lineage is never itself a node. It is
> a computed cluster over the real nodes that do exist, produced at render time and re-derivable at
> any point, never a citable prerequisite.**

An algorithm (Louvain, Leiden, or Markov Clustering) run over the existing edge graph identifies
densely-connected communities of real nodes. This has a clean justification under Essay 1's own
terms, not just as a convenient engineering trick: a computed community is not the product of any
human action — nobody discovered or built "the AI cluster," an algorithm noticed the edges were
dense there — so it fails Axiom 1 automatically and can never be a node. That, in turn, resolves
the redirect problem from Section 4 by dissolving it rather than answering it: a cluster was never
supposed to be something a downstream edge could point at. If a new node wants to claim "requires
AI," it has to point at whatever specific real node it actually means (transformers, or NLP, or
whatever) — the umbrella never gets prerequisite-citation privileges.

This also answers, by disqualification, an open question from Essay 1's debate about whether a
bare "concept of AI" deserves its own node: it does not, under Axiom 2, unless it names a specific,
citable artifact the way the Dartmouth Conference does (and even then, per Essay 1 Section 4, the
result is an achievement leaf, not a hub with outgoing edges). A concept without that kind of
artifact becomes descriptive context on whichever real node it explains, not a node of its own.

**Cluster mechanics, provisionally:**

- A cluster gets a default algorithmically-generated name, flagged as needing human review, plus a
  cheap, stable slug an editor can bookmark or link to. Assigning the slug and the real name is an
  editorial action, not an algorithmic one.
- Clusters shift as new edges are added — a bridging edge can merge two clusters, or a dense
  subcluster can split off from a larger one. A pinned (editor-named) cluster's membership should
  not silently drift out from under the name an editor gave it, but it also shouldn't be treated as
  permanently frozen against a genuinely changed graph. The proposed handling reuses the
  automated-check-plus-human-flag pattern Essay 10 already established for cycle/orphan detection:
  compute the algorithm's current answer, diff it against the pinned membership, and surface the
  delta to editors — never the public — only once it crosses some variance threshold.
- A **merge** of two pinned clusters reuses Essay 10's existing redirect mechanism outright: one
  slug redirects to the other, or both redirect to a new merged slug. No new machinery is needed.
- A **bifurcation** cannot be resolved the same way, because a redirect cannot resolve one-to-many.
  The old slug provisionally lands on whichever descendant has higher overlap with the original
  membership, while the other is queued for an editor to name fresh — an editorial action the
  algorithm can flag but not finish on its own.

## 6. Taxonomy tags are a separate feature, not a decomposition mechanism

Cross-cutting categories for browsing — "Energy," "Metallurgy," "Agriculture-adjacent" — are
many-to-many, imply no prerequisite relationship, and exist purely for discoverability. This can be
a plain metadata field with no interaction with Essay 6's edge schema at all, closer to Wikipedia
categories than to anything structural. It is worth naming explicitly and separately here only
because the original question that opened this debate risked conflating it with decomposition —
they solve different problems and should not share a mechanism.

## 7. What this leaves the granularity checklist to actually decide

With decomposition-as-structure handled by ordinary edges and redirects (Sections 2–3), and the
anti-clutter concern that originally motivated a "checklist" handled by clustering at render time
(Section 5), the granularity question shrinks to something Essay 1 already answers: **does each
proposed sub-node clear both founding axioms independently?**

Applied to fire: observation, exploitation, production, and explanation are each a distinct human
action (Axiom 1) and each is itself a discovery, invention, or technique in Essay 4's sense (Axiom
2) — four legitimate nodes, not one artificially preserved compound. Applied to a bare concept with
no artifact behind it (Section 5): it fails Axiom 2 regardless of how real the underlying human
activity was, and stays out of the graph as a node.

This is a smaller job than the original draft thesis implied, and that is treated here as a
simplification rather than a loss: the checklist doesn't need its own anti-bloat logic once
rendering absorbs that cost, so it can stay a direct application of axioms already settled rather
than growing a parallel, harder-to-justify set of rules.

## 8. What this essay is not

This essay fixes how decomposition is structurally represented and how open-ended macro-topics are
handled at render time. It deliberately does not:

- specify the clustering algorithm's parameters, edge-weighting scheme, or variance threshold —
  these are implementation details, not content for this essay, though one substantive question is
  flagged rather than answered: whether *mere influence* edges (Essay 6) should be weighted near
  zero for clustering purposes, so a weak thematic connection (the Dartmouth Conference's link to
  the technical lineages it never materially enabled) doesn't drag unrelated lineages into one
  supercluster by connectivity alone,
- decide whether cluster-pinning governance belongs in this essay or is better treated as an
  addendum to Essay 10, which already owns the automated-check-plus-human-flag pattern being reused
  here,
- extend the sequential/compositional distinction to Essay 8's culture and social-systems layer,
  though that extension looks likely to be needed there,
- define the taxonomy tag vocabulary itself (Section 6) — only that it exists and is separate from
  decomposition,
- decide who is authorized to name a cluster or resolve a flagged variance — that is Essay 10's
  permission-tier question, not a new one this essay introduces.

## 9. Status and open threads

This essay is **Proposed**, and narrower than its original draft thesis — the fire case study
generalized into a universal decomposition template that did not survive contact with a second
case (AI). Threads flagged rather than resolved:

- The fire case study (sequential) and the AI case study (the open-ended failure case) are the only
  two cases run through this so far. A clean **compositional** case with no open-endedness (a
  single-inventor, fixed-date invention like the transistor or barbed wire) has not yet been tested
  and is the natural next stress test, both for the compositional topology in Section 2 and as a
  sanity check that the checklist in Section 7 doesn't over-fire on ordinary nodes.
- The mere-influence edge-weighting question in Section 8 is substantive, not merely technical — it
  effectively decides what "the same macro-topic" means — and is left for either this essay's
  revision or Essay 6's.
- Where cluster-pinning governance formally lives (here or Essay 10) is undecided.
- Whether a named, pinned cluster should ever be allowed to earn any form of permanence stronger
  than a bookmarkable slug is undecided; the current position is a firm no, but it has not been
  stress-tested against a case where that might matter.
