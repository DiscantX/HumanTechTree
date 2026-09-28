# Edge Schema

**Status:** Proposed

Every line on the graph is an [edge](essay-00-about-the-project.md#glossary), and every edge is a
single claim about an ordered pair of nodes: that one was a prerequisite of, or an influence on, the
other. Each edge is described by three independent fields.

- **Relationship-kind:** what sort of connection it is (material necessity, conceptual enablement,
  combination, or mere influence).
- **Basis:** whether the claim is about what actually happened in history or about what was
  necessary for any civilization.
- **Grounding:** what supports the claim, whether citations, arguments, or nothing yet.

None of the three predicts the others, so each can vary without affecting the rest. This essay fixes
the schema and defines the relationship-kind field. The other two fields are defined in
[Historical Attestation vs. Logical Necessity](essay-07-historical-vs-logical-necessity.md) and
[Sourcing and Citation Policy for Edges](essay-09-sourcing-and-citation-policy.md). Two further rules
apply throughout. However many edges join a pair of nodes, they are drawn as a single line, and no
field ever has to be filled in for an edge to be valid.

## Why one edge is three questions

It is tempting to treat "prerequisite" as one relationship with one truth value: either fire was a
prerequisite of smelting, or it was not. In practice, at least three separate questions get asked of
any candidate edge, and none of them determines the answers to the other two.

- **What kind of relationship is it?** Something physically required, an idea that made the next
  step possible, several lines of work converging, or a real but weaker influence.
- **On what basis is the claim made?** Did one thing actually precede and enable the other in the
  historical record, or would the second have been impossible without the first for any civilization,
  regardless of when either was achieved?
- **What backs the claim?** A source that states it directly, a deduction from sourced premises, or
  nothing yet.

A single merged edge object cannot let these vary independently, and they need to. A claim can be
well supported on one axis while genuinely contested on another. The historical sequence of fire and
smelting can rest on solid archaeology while the claim that smelting *necessarily* required fire
stays open to challenge on physical grounds.

## An edge is a claim

An edge is one proposition about an ordered node pair, running from the earlier or more basic node to
the later one. It carries a statement, which is the claim itself, and three fields: one
relationship-kind, one basis, and a list of groundings. The statement is what gets grounded, reviewed,
and disputed. See Sourcing and Citation Policy for Edges
for how groundings work and how the resulting status is shown to readers.

Because an edge is one claim, a compound statement is more than one edge. "X requires Y and Z as
components" is two claims, Y to X and Z to X, and is stored as two edges.

## Relationship-kind

Relationship-kind is the one field this essay defines. It has four values.

| Kind | Meaning | Example |
| --- | --- | --- |
| Material necessity | The downstream node physically requires the upstream one | Smelting copper requires a controlled heat source |
| Conceptual enablement | The downstream node depends on knowledge or an idea from the upstream one | Germ theory enabled antiseptic surgery |
| Combination | Several independently developed lines converge on one node, each contributing a component | A cryptocurrency draws on public-key cryptography, proof-of-work, fault-tolerance theory, and earlier digital-cash proposals |
| Mere influence | A real connection that falls short of necessity: the downstream node could have arisen without it | Modern representative democracy and its Athenian predecessor |

Relationship-kind is a single value per edge. An edge is never both "material necessity" and "mere
influence" at once. If a real case seems to need two kinds, that is a sign the pair needs two edges,
each making its own claim. A generic "requires" is also allowed as a default when the kind has not
been settled.

Combination deserves a note. It describes several prerequisite edges converging on one node. Each
component is its own edge, so combination does not need a separate container structure. That is what
lets [Node Granularity](essay-02-node-granularity.md) treat compositional topics without any
parent-node concept. Mere influence is explored in
[The Culture / Social-Systems Layer](essay-08-culture-social-systems-layer.md), where the link from
Athenian to modern democracy is its first fully worked case.

## Who defines what

Each field has one owner, so that later policies fill in a shared schema and do not each invent their
own idea of an edge type.

- **Relationship-kind** is defined here.
- **Basis** is defined in Historical Attestation vs. Logical Necessity.
  It takes one of two values, historical attestation (a dated, regionally located claim about what
  happened) or logical necessity (a timeless claim that the downstream node cannot exist without the
  upstream one).
- **Grounding** is defined in Sourcing and Citation Policy for Edges.
  It is a disclosure of what supports a claim, not a ranking of kinds of support.

Any later proposal to change how edges are classified should revise the *values* of one of these
three fields, not add a fourth system beside them.

## Multiplicity rules

The rules for how many edges may join a pair are simple, because each edge is one claim.

- **One claim per edge.** Compound statements split into separate edges, as above.
- **One kind and one basis per edge.** Where both bases apply to a pair, that is two edges, one
  historical-attestation and one logical-necessity. Having both is the strongest case. Having either
  alone is a legitimate, permanent state.
- **Logical necessity is capped at one edge per pair.** It is a general, timeless proposition, not an
  instance of anything. Disagreement about it is handled by contesting and revising that single claim
  through the dispute process in
  [Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md), never
  by adding a competing edge.
- **Historical attestation may multiply, once per independent origin.** Each such edge carries an
  origin attribute (a region or instance) that distinguishes it. Agriculture arising separately in
  several regions is the standard example.
- **More evidence is not a new edge.** A second source behind an existing claim is added to that
  edge's groundings. A new edge is warranted only when the *proposition* is different: a different
  historical instance, or a different relationship-kind.
- **A bare edge is allowed.** An edge may leave its basis unspecified. It is then excluded from the
  cycle check and the basis-fit check described in
  Governance and Moderation for a Living Graph, and it
  shows the neutral "ungrounded" marker unless it has groundings.

## Splitting a node versus adding an edge

When a technology has several independent historical origins, such as agriculture, writing, or copper
smelting, the default is one node carrying several historical-attestation edges. The general capacity
is one thing even where specific instances are many.

Splitting into separate nodes, for example Fertile Crescent agriculture as distinct from Mesoamerican
agriculture, is justified only when the granularity checklist in
Node Granularity independently finds enough decomposable history on
each side. Independent origin alone is never sufficient. It is grounds for an additional edge on the
shared node.

## What is stored is not what is shown

> **The graph that is stored is never the graph that is shown.**

Multiple edges between the same pair of nodes collapse into a single drawn line. The richness behind
that line, whether three regional origins, a contested necessity claim, or four stacked citations,
is available in an inspector panel opened by clicking it, and is not drawn on the graph itself.

This is a hard rule, not a style preference. Most graph layout engines handle true parallel edges
between one pair of nodes poorly, producing overlapping lines or ones that must be bundled by hand,
which breaks the intended clean tech-tree look. Collapsing at draw time also spares human patrollers
from visually parsing every parallel edge, so the rule serves moderation as well as appearance.

## Optionality

No field on this schema ever has to reach a settled state for an edge to be valid. A bare edge, with
its kind generic, its basis unspecified, and no groundings, is a complete and permanent state, not a
stub waiting to be finished. Richer detail is added when an editor chooses to add it or when a dispute
forces it, and is never owed by default across the whole graph.

This is a property of the schema itself, but it carries weight elsewhere.
Governance and Moderation for a Living Graph depends on
it to keep moderation effort proportional to genuine disputes and not to the total size of the graph.

## What this essay does not decide

- What counts as historical attestation or logical necessity, or how they interact.
- What backs a claim, how it is reviewed, or how status is displayed.
- Who may create, edit, or dispute an edge, or how disputes are resolved.

## Open questions

- **The relationship-kind vocabulary.** The four kinds have been tried on a small number of concrete
  edges, chiefly fire and smelting, agriculture, writing, cryptocurrency, and the two democracies. It
  is not settled that four is the right number, or that a kind can never be split into finer
  sub-kinds.
- **Sub-kinds of mere influence.** A founder who demonstrably read Cleisthenes and ambient,
  undocumented cultural diffusion feel like different strengths of one kind. The sourcing essay
  proposes that the grounding, not a sub-kind, can carry this distinction: documented influence is
  citation-grounded, and ambient influence can only be argued. This is proposed, not decided.
- **Incoherent pairings.** The three fields are independent in principle, but some combinations look
  contradictory. A mere-influence edge with a logical-necessity basis, for instance, claims that
  something was both unnecessary and necessary. Whether the schema should forbid such pairings or
  leave them to review is open.
- **Bare and specific edges together.** Whether an unspecified-basis edge may exist alongside a
  basis-specific edge on the same pair, or should be retired once a basis is added, is open.
