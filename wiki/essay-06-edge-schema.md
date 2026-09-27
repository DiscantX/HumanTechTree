# Essay 6 — The Edge Schema: Three Orthogonal Questions, One Relationship

**Status:** Proposed

**Depends on:** Essay 1 (Founding Axioms — the floor gate), Essay 2 (Node Granularity — governs
when multiplicity becomes a node split instead)

**Gates:** Essay 7 (assigns the values the *basis* field can take), Essay 9 (assigns the values
the *proof-tier* field can take), Essay 10 (governance and moderation act on these fields, not on
some other structure)

## 1. The problem

"Prerequisite" was originally treated as one relationship with one truth value: either fire is a
prerequisite of smelting, or it isn't. Debate on this project surfaced that at least three
independent questions get asked of any candidate edge, and none of them determines the answers to
the other two:

- **What kind of relationship is this?** Material necessity, conceptual enablement, combination of
  independent lines, or mere influence — the four candidates already named in this project's
  index before this essay existed.
- **On what basis is the claim made?** Did X actually precede Y in the historical record, or is Y
  logically impossible without X regardless of when either was achieved, or both, or neither yet?
- **How well-grounded is the claim?** Is it directly stated by a source, inferred by this wiki
  from separately-sourced facts, or argued and settled by this wiki's own debate process because
  no citation covers it at all?

A single merged edge object has no way to let these vary independently — and they need to, because
a claim can be well-grounded on one axis while genuinely contested on another (the historical
sequence of fire and smelting can be solid archaeology while the *necessity* claim about fire
staying open to challenge on physical grounds).

## 2. The single edge, three orthogonal fields

> **An edge is a relationship-kind, a basis, and a proof-tier — three independent fields on one
> schema, not three competing type systems.**

None of the three predicts the other two. This essay does not resolve what values the second and
third fields take — that is Essay 7's and Essay 9's job respectively — but it fixes the schema
itself and prevents each of those essays from separately reinventing "edge type" to mean whatever
it happens to be discussing.

## 3. Ownership, stated explicitly

- **Relationship-kind** — owned by this essay. Values: material necessity, conceptual enablement,
  combination, mere influence (inherited from the original index draft; flagged for stress-testing
  in Section 9 below, since it has not yet been tested against many concrete edges the way Essay
  1's axiom was tested against many concrete nodes).
- **Basis** — owned by Essay 7. That essay defines historical-attestation and logical-necessity,
  how they interact, and what happens to independently-discovered technologies under this field.
- **Proof-tier** — owned by Essay 9 (not yet drafted). That essay will define the citation and
  grounding standard for each basis value, including the case where no citation exists at all and
  the claim rests on this wiki's own argued consensus.

Any future essay revisiting "edge types" should be revising the *values* of one of these three
fields, not proposing a fourth type system alongside them.

## 4. Multiplicity rules

Relationship-kind is a single required value per edge instance — an edge does not get to be both
"material necessity" and "mere influence" at once. If a real case seems to need two kinds
simultaneously, that is evidence the pair needs two separate historical-attestation instances
(Section 5 below), not a dual-natured single edge.

Basis multiplicity is asymmetric, and the asymmetry is deliberate rather than an oversight:

- **Historical-attestation may multiply.** A node pair can carry more than one historical-
  attestation edge when the downstream node itself has more than one independent origin — see
  Essay 7 for the full argument and the agriculture/writing examples.
- **Logical-necessity is capped at one per node pair.** It is a general, timeless proposition, not
  an instance of anything. Disagreement over it is handled by contesting and revising that single
  claim through the dispute process (Essay 10), never by adding a second, competing logical-
  necessity edge.

Neither basis value is required, and neither implies the other. A node pair with only a historical-
attestation edge is recording "this happened in this order" without claiming necessity. A pair with
only a logical-necessity edge is recording "this must be true regardless of when either was
achieved" without a dated historical claim behind it. Both present is the strongest case; either
alone is a legitimate, permanent state, not an incomplete one.

Citations are a different kind of multiplicity from edges, and should not be confused with it:
stacking a second source behind an existing claim is a citation added to that edge, not a new edge.
A new edge is warranted only when the *proposition* itself is genuinely different — a different
historical instance, or a distinct relationship-kind — not merely additional evidence for the same
proposition.

## 5. Node-splitting versus edge-multiplying

When a technology has several independent historical origins (agriculture, writing, copper
smelting), the default is one node carrying multiple historical-attestation edges — the same
faculty/instantiation move Essay 1 already used for language: the general capacity is one thing
even where specific instances are many.

Splitting into separate child nodes (Fertile Crescent agriculture as distinct from Mesoamerican
agriculture, as their own nodes) is warranted only when Essay 2's granularity checklist
independently justifies it — meaning there is enough genuinely distinct, decomposable sub-history
on each side to earn separate nodes on their own terms. Independent origin, by itself, is never
sufficient grounds for a node split; it is grounds for an additional historical-attestation edge on
the shared node.

## 6. The render layer owes nobody the underlying complexity

> **The graph that is stored is never the graph that is shown.**

Multiple edges between the same node pair collapse to a single rendered line, with any richness
(three origins, a contested necessity claim, four stacked citations) available behind a click into
an inspector panel rather than drawn on the graph itself. This is not only an aesthetic preference
— most DAG layout engines (dagre, elk, Cytoscape's built-ins) handle true parallel edges between the
same pair badly, producing overlapping or manually-bundled lines that break the intended "clean
tech tree, not a hairball" presentation on their own. Collapsing multiplicity at render time is
therefore a hard rule, not a style choice left to the frontend team's taste.

## 7. The optionality principle

No field on this schema is ever required to reach a settled or fully-specified state for an edge to
be valid. A bare edge — relationship-kind unspecified or defaulted to a generic "requires",
basis unspecified, proof-tier unreviewed — is a complete and permanent state, not a stub awaiting
completion. Richness on any of the three fields is earned when an editor chooses to add it, or when
a dispute forces it, never owed by default across the whole graph.

This principle is stated here because it is a property of the schema itself, but it is load-bearing
for Essay 10's moderation model, which depends on it directly to keep moderation load proportional
to genuine disputes rather than to the graph's total size.

## 8. What this essay is not

This essay fixes the shape of an edge — three independent fields — and assigns ownership of each.
It deliberately does not:

- define what counts as historical-attestation or logical-necessity, or how they interact (Essay
  7),
- define citation standards or the proof-tier vocabulary (Essay 9),
- decide who may create, edit, or dispute a given field, or how disputes resolve (Essay 10),
- finalize the relationship-kind vocabulary beyond restating the four candidates already in the
  index — see Section 9.

## 9. Status and open threads

This essay is **Proposed**, not Ratified: unlike Essay 1, which was stress-tested against many
concrete cases (puberty, language, color vision, thumbs) before ratification, this schema has so
far only been exercised against fire/smelting, agriculture, and writing. Two threads are flagged
rather than resolved:

- The relationship-kind vocabulary itself (material necessity, conceptual enablement, combination,
  mere influence) is inherited from the original index draft and has not been stress-tested under
  this three-field schema specifically. It may need revision once real edges are run through it.
  - Two of the four relationship-kind values got their first concrete worked examples during Essay 3's stress-testing: combination, via cryptocurrency (synthesizing public-key cryptography, Hashcash proof-of-work, Byzantine fault tolerance theory, and prior unbuilt digital-cash proposals into one node with no single stage-chain of its own); and mere influence, via a candidate case connecting Athenian democracy to modern representative democracy, pending Essay 8's resolution of how that relationship is actually modeled.
- Whether a relationship-kind value can ever be split into finer sub-kinds, or whether four is the
  right number, is left open for a future debate rather than decided here.
