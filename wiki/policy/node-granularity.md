# Node Granularity: What Counts as One Node

**Status:** Proposed

This policy decides how finely a topic is divided into [nodes](about-the-project.md#glossary).
It rests on three principles.

1. **A topic becomes several nodes only when each part earns it.** Each part must be eligible on its
   own, must have a history of its own, and, where the same thing arose independently in several
   places, must differ in mechanism and not merely in date and location. Otherwise it stays one node.
2. **Compound topics divide in one of two ways.** Some are a sequence of steps in mastering a
   natural phenomenon, and some are the convergence of independently developed lines. Both are
   expressed with ordinary edges, so no separate "parent" or "container" relationship is needed.
3. **Broad umbrella topics with no endpoint never become nodes.** "Artificial intelligence" is the
   standard example. Such topics are computed as clusters of real nodes when the graph is drawn, and
   nothing can depend on them directly.

## The problem: one label, many things

A single familiar word can cover very different amounts of history. "The discovery of fire" spans
hundreds of thousands of years, from noticing that wildfire behaves regularly, through capturing it,
to producing it on demand, to finally explaining why it burns. Treating that as one node hides the
fact that people mastered fire in practice for a very long time while being wrong, or simply silent,
about why it worked.

Other labels are not one thing at all. "Artificial intelligence" gathers several lines of work that
barely depend on each other, and it names a frontier that is still moving. The question this policy
answers is when a label should be one node, when it should be several, and when it should not be a
node at all.

## Two ways a compound topic divides

A compound topic divides either sequentially or compositionally, and the two need different
treatment. Neither needs a relationship type beyond those in the [Edge Schema](edge-schema.md).

**Sequential division** applies to *phenomenon-mastery* topics. These concern something that exists
in nature before anyone touches it, where the division tracks humanity's deepening relationship to
that phenomenon. Fire is the clean case: observed, then exploited, then produced on demand, then
explained. Fermentation and electricity plausibly share the shape. Each step is a separate human
action and each is a genuine prerequisite of the next. This is an ordinary chain of edges, with the
kind of each link (material necessity or conceptual enablement) decided step by step. Once the topic
is divided, nothing remains for the original label to be beyond that chain. The four stage names are
defined in [What Constitutes a Discovery?](what-constitutes-a-discovery.md).

**Compositional division** applies to topics assembled from several independently developed lines
that converge: an automobile from engine, chassis, wheels, and drivetrain, or a cryptocurrency from
public-key cryptography, proof-of-work, fault-tolerance theory, and earlier digital-cash proposals.
The Edge Schema's *combination* relationship-kind already covers this, with several prerequisite
edges converging on one real node. The compound node does not dissolve, because it is a new thing and
not merely the last link in a sequence.

## Why no container relationship is needed

It might seem that decomposition needs a parent-node relationship separate from ordinary edges. It
does not, for a reason specific to each shape.

- **Sequential division needs no container** because the compound label has no independent identity
  after the division. When a topic is split, the old identifier redirects to the new one, as
  described in [Governance and Moderation for a Living Graph](graph-governance-and-moderation.md).
  An existing edge that cited "fire" as a prerequisite resolves to the terminal node of the chain,
  which is production of fire. That is the node representing the fully realized capability, since
  "requires fire" means "requires the ability to make it," not "requires having once seen it burn."
- **Compositional division needs no container** because the compound node already exists as a real
  thing, the meeting point of the combination edges. There is nothing left for a container to hold.

Adding a container concept would create a second, competing way to express structure. The Edge Schema
exists to prevent that, so that every policy populates one shared schema and none invents a new
relationship type when a new case appears.

## The granularity checklist

Every proposed division is tested with three questions.

1. **Is each part eligible on its own?** Each proposed node must clear both rules in
   [Founding Axioms](founding-axioms.md): human action is responsible for it, and it is
   itself a discovery, invention, or achievement as defined in
   [Achievement vs. Discovery vs. Invention](achievement-discovery-invention.md). A part that
   fails is not a node. It becomes descriptive context on whichever node it explains.
2. **Does it have a history of its own?** A part is *thin* when it has no independent history or
   sourcing beyond being a phase of its parent's story, and it stays a stage of the parent subject.
   It is *thick* when it has a substantial, decomposable history and prerequisite chain in its own
   right, and it becomes a separate subject linked to the parent by an ordinary edge. Germ theory
   relative to vaccination is the clearest thick case. Germ theory's own prerequisite chain
   (microscopy, cell theory, the separate work of Pasteur and Koch) has little to do with
   vaccination's specific history, so "explanation of vaccination" is the wrong label. Germ theory is
   its own subject.
3. **For independent origins: does the mechanism differ?** When the same-named thing arises
   independently in several places, one node with a separate historical-attestation edge for each
   origin is the default. Independent origin alone is never enough to split a node. A split requires
   that the mechanisms themselves differ and that each side has enough distinct history to earn a node
   on its own terms.

Some applications:

- **Fire.** Observation, exploitation, production, and explanation are each a distinct human action
  and each is a discovery, invention, or technique in its own right. They are four legitimate nodes,
  not one artificially preserved compound.
- **Agriculture.** It arose independently in several regions by essentially the same mechanism, so it
  is one node with an attestation edge per region, as set out in
  [Historical Attestation vs. Logical Necessity](historical-vs-logical-necessity.md).
- **Democracy.** Athenian direct democracy and modern representative democracy differ in mechanism
  and each has its own decomposable lead-up, so they are two subjects joined by a mere-influence edge,
  as worked out in [The Culture / Social-Systems Layer](culture-social-systems-layer.md).
- **A bare concept with no artifact behind it.** It fails the first question and stays out of the
  graph as a node.

## Open-ended macro-topics: clusters

Artificial intelligence fits neither division. It has several lines of work, at least a
technical-capability lineage (natural language processing, neural networks, transformers) and a
compute and hardware lineage (Moore's Law, GPUs), that did not converge from one trunk the way
observation leads to exploitation in the fire case. It also has no endpoint. Fire either can or
cannot be produced reliably, but "AI" is a moving frontier whose far end is still undefined. Any
sketch drawn today ends in something like "AGI (future)."

That second property defeats redirection. A sequential topic can redirect a generic reference to its
terminal node, but "AI" has no terminal node to point at. Today the word might colloquially mean
large language models, but that pointer has already been wrong once, when it meant expert systems in
the 1980s, and it will probably be wrong again. The lineage of the *idea* of thinking machines adds
no nodes of its own. Under Founding Axioms, a bare concept, or a named event such as the 1956
Dartmouth Conference where the term was coined, does not qualify.

This is not a third kind of division to define, because more kinds would only add complexity.
Open-endedness is better understood as a property that defeats redirection. The proposed resolution
does not live in the stored graph at all.

> **A macro-topic with no terminal state and no clean single lineage is never itself a node. It is a
> computed cluster over the real nodes that do exist, produced when the graph is drawn and
> re-derivable at any time, and never something an edge can cite as a prerequisite.**

An algorithm (Louvain, Leiden, or Markov Clustering) run over the existing edges identifies densely
connected communities of real nodes. This has a clean justification under the founding rules, not just
as an engineering convenience. A computed community is not the product of any human action. Nobody
discovered or built "the AI cluster," because an algorithm noticed the edges were dense there. It
therefore fails the origin rule and can never be a node. That dissolves the redirection problem
instead of answering it: a cluster was never meant to be something a downstream edge could point at.
A node that wants to claim it "requires AI" must point at whichever real node it means, whether
transformers or natural language processing or something else. The umbrella never gets
prerequisite-citation privileges.

**How clusters behave**

- **Names and slugs.** A cluster gets a default, algorithmically generated name that is flagged for
  human review, plus a cheap, stable slug an editor can bookmark or link. Assigning the slug and a
  real name is an editorial action, not an algorithmic one.
- **Drift.** Clusters shift as edges are added, since a bridging edge can merge two clusters or a
  dense subcluster can split off. A pinned (editor-named) cluster should not silently drift out from
  under the name an editor gave it, and it should not be treated as frozen against a genuinely changed
  graph either. The proposed handling reuses the pattern of an automatic check that flags a human,
  which Governance and Moderation for a Living Graph
  already uses for cycles and orphans. The algorithm's current answer is diffed against the pinned
  membership, and the difference is shown to editors, never the public, once it crosses a variance
  threshold.
- **Merges.** When two pinned clusters merge, the existing redirect mechanism applies: one slug
  redirects to the other, or both redirect to a new merged slug.
- **Splits.** A split cannot be resolved that way, because a redirect cannot point one place to many.
  The old slug provisionally lands on whichever descendant overlaps most with the original membership,
  and the other is queued for an editor to name. That is an editorial action the algorithm can flag but
  not finish.

## Taxonomy tags are a separate feature

Cross-cutting categories used for browsing, such as "Energy," "Metallurgy," or "Agriculture-adjacent,"
are many-to-many, imply no prerequisite relationship, and exist only for discoverability. They are a
plain metadata field with no interaction with the Edge Schema, closer to Wikipedia categories than to
anything structural. They are named here only to keep them from being confused with decomposition.
They solve a different problem and should not share its mechanism.

## What this policy does not decide

- The clustering algorithm's parameters, edge weighting, and variance threshold. These are
  implementation details, though one substantive question is raised below.
- Who may name a cluster or resolve a flagged variance. That belongs to the permission tiers in
  Governance and Moderation for a Living Graph.
- The vocabulary of taxonomy tags. Only their existence and their separation from decomposition are
  fixed here.
- Whether an eligible node is significant enough to warrant inclusion, which is the planned
  Notability / Inclusion Threshold policy.

## Open questions

- **A clean compositional case.** Fire (sequential) and AI (open-ended) are the cases worked through
  so far. A compositional case with no open-endedness, such as the transistor or barbed wire, has not
  been tested. It is the natural next test, both of the compositional shape and of whether the
  checklist over-fires on ordinary nodes.
- **Weighting mere-influence edges for clustering.** Should mere-influence edges be weighted near zero
  when computing clusters, so that a weak thematic connection does not pull unrelated lineages into
  one large cluster? The answer effectively decides what "the same macro-topic" means, so it is a
  substantive question and not merely a technical one.
- **Where cluster governance lives.** The pinning, drift-flagging, and merge rules could belong in
  this policy or in Governance and Moderation for a Living Graph, which already owns the
  flag-a-human pattern. This is undecided.
- **Permanence for named clusters.** The current position is a firm no, that a named cluster never
  earns anything stronger than a bookmarkable slug. It has not been tested against a case where that
  might matter.
- **Money.** Money arose independently as weighed metal in Mesopotamia, as cowrie and bronze money in
  China, and as cacao-bean currency in Mesoamerica, and the mechanisms differ by region and not only
  in date and place. It may pass the third checklist question and warrant separate nodes where
  agriculture warrants one. This is left as a candidate case.
- **Redirects and reviewed claims.** When a redirect re-points an edge to a narrower node, whether
  that resets the edge's reviews is an open question, taken up in Governance and Moderation for a
  Living Graph.
- **Extension to institutions.** The sequential and compositional shapes are likely to apply to the
  culture and social-systems layer as well, and The Culture / Social-Systems Layer begins that work.
