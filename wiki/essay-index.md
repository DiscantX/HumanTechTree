# Human Tech Tree Wiki — Essay / Policy Index

Each essay resolves into a concrete policy or data-model rule.

Status:

**Open** (unresolved)

**Proposed** (draft position exists, untested)

**Ratified** (settled, binds the data model).

## Tier 0 — Foundational (gate almost everything else)

### 1. Founding Axioms — what never becomes a node

- **Thesis (draft):** the graph's floor is a growing set of axioms, not one. Axiom 1 (origin,
  previously the whole essay, previously Ratified): a candidate is excluded from the graph unless
  some human action is responsible for its existence — everything that exists because someone
  discovered, tried, built, or formalized something is eligible at whatever granularity that
  action occurred; a standing fact about what a human is, independent of any action, is not. Axiom
  2 (candidate category, newly added): a candidate that clears Axiom 1 still requires no node
  unless it is itself a technology, discovery, invention, or achievement per Essay 4's taxonomy —
  a conference, announcement, or publication venue that merely occasions one of those four does
  not itself receive a node (stress-tested once, against the 1956 Dartmouth Conference, which
  lands as an achievement leaf rather than a node with its own edges).
- **Resolves into:** the Founding Axiom Gate, now a two-step sequential check (origin, then
  category) rather than a single question, plus three diagnostics — endowment,
  non-transmissibility, non-decomposability — for recognizing the absence of action under Axiom 1
  when it isn't obvious on inspection.
- **Status:** Proposed. Axiom 1 was previously Ratified and stress-tested against puberty,
  language, color vision, and thumbs; the essay was reopened to Proposed when Axiom 2 was added,
  consistent with treating all essays as works in progress during this planning phase. More axioms
  may be added as more candidates are tested.
- **Gates:** eligibility for every candidate entry — decides what's allowed into the graph at all.
  Explicitly does not decide significance/scale, granularity, or sourcing for entries that clear
  both axioms — see #2, #9, #11.

### 2. Node Granularity — what counts as one node

- **Thesis (draft):** compound "big" discoveries (fire, agriculture) likely decompose into a
  sequence of separable capability transitions, each its own node — but this is one topology among
  several, not a universal template. Debate surfaced at least two distinct decomposition shapes:
  a **sequential** chain for phenomenon-mastery topics that pre-exist in nature and are
  progressively mastered (fire: observation → exploitation → production → explanation), and a
  **compositional** convergence for topics built from independently-developed lines that combine
  (already covered by Essay 6's "combination" relationship-kind). Neither shape requires a new
  parent/container relationship type alongside Essay 6's edge schema: sequential decomposition
  resolves via Essay 10's existing redirect mechanism (the old label points to the terminal node),
  and compositional decomposition resolves via ordinary combination edges. A third case —
  open-ended, multi-lineage macro-topics with no terminal state (e.g. "AI," which spans a
  concept/aspiration lineage, a technical-capability lineage, and a compute/hardware lineage that
  barely relate to each other) — cannot be resolved to a stable redirect target at all, and is
  instead proposed to be handled entirely outside the stored graph via algorithmic clustering
  (Louvain/Leiden/Markov) at render time, with clusters explicitly barred from ever being edge
  endpoints and a pin/diff/editor-flag mechanism (reusing Essay 10's automated-check pattern) for
  when a pinned cluster's algorithmic membership drifts. Clustering absorbs the anti-clutter
  concern that originally motivated this essay's decomposition question, leaving the granularity
  checklist free to ask a purely origin/category-based question (per Essay 1's two axioms) without
  needing its own complexity carve-out.
- **Case study:** fire (sequential) — observation → exploitation → production → explanation; AI
  (open-ended convergence, not a clean case study for sequential decomposition).
- **Resolves into:** the granularity checklist every candidate entry gets run through (now
  understood as node-by-node application of Essay 1's two axioms rather than a topology-matching
  exercise); a redirect rule for dissolved compound labels; a cluster-pinning governance addendum
  that may belong partly to Essay 10.
- **Status:** Proposed — narrower in scope than originally drafted; now written up as a full essay
  text, pending stress-testing against a clean compositional case (transistor, barbed wire) before
  ratification.
- **Gates:** discovery essay, edge-type essay, zoom/UI behavior. Also the deciding factor (per
  Essay 7) for when an independently-discovered technology gets split into separate nodes rather
  than represented as one node with multiple historical-attestation edges.

## Tier 1 — Taxonomy (what a thing *is*)

### 3. What Constitutes a Discovery? (chicken-and-egg)

- **Thesis (draft):** practical exploitation of a phenomenon routinely precedes its theoretical explanation (fire used long before combustion was understood) — "discovery" needs to be split into distinct transition types rather than treated as one event.
- **Depends on:** #1, #2.
- **Status:** Open.

### 4. Achievement vs. Discovery vs. Invention

- **Thesis (draft):** discoveries/inventions are capability-*producing* (other nodes can cite them as prerequisites); achievements are capability-*consuming* (leaf events, not prerequisites for anything). "Achievement" also does double duty as a spotlight/feed mechanism for newly-added nodes, independent of category. A single Achievements category houses both capability-demonstration events (four-minute mile, Moon landing, stratosphere jump, circumnavigation) and institutional/symbolic milestone events (the Dartmouth Conference) — no separate milestone subtype, since nothing downstream would treat them differently. Now also load-bearing for Essay 1's Axiom 2, which cites this essay's taxonomy directly.
- **Depends on:** #3.
- **Status:** Proposed.

### 5. Can an Achievement Become a Genuine Prerequisite?

- **Thesis (draft):** rare, but real when the *doing* and the *knowing* are inseparable — no separable technique/node exists underneath (four-minute mile; breaking the sound barrier as empirical validation).
- **Depends on:** #4.
- **Status:** Proposed.

## Tier 2 — Graph Mechanics (how things *relate*)

### 6. Edge Schema — three orthogonal fields, one relationship

- **Thesis (draft):** an edge is a relationship-kind, a basis, and a proof-tier — three independent fields on one schema. This essay owns and fixes the relationship-kind vocabulary (material necessity, conceptual enablement, combination, mere influence) and assigns ownership of the other two fields elsewhere, so future essays populate one shared schema instead of each inventing "edge type" separately. Also fixes multiplicity rules (historical claims may multiply per independent origin; logical-necessity claims are capped at one per node pair) and a hard render-time rule: the stored graph is never the displayed graph, and multi-edges always collapse to one line. The "mere influence" relationship-kind has a first concrete candidate use — the AI concept/aspiration lineage's weak, indirect connection to the technical lineages it never materially enabled (Essay 2 debate) — worth stress-testing this essay against once drafted further.
- **Depends on:** #1, #2.
- **Gates:** #7 (basis values), #9 (proof-tier values), #10 (governance acts on these fields).
- **Status:** Proposed — drafted, not yet stress-tested against many concrete edges the way #1 was tested against many nodes.

### 7. The Alien Civilization Question — historical attestation vs. logical necessity

- **Thesis (draft):** an edge's basis is historical-attestation (a dated, sourced, regional claim that X preceded Y in the record), logical-necessity (a timeless claim that any civilization would need X before Y), both, or neither — two independent claims, not one merged question. This resolves the original historical-vs-timeless framing directly: the graph tracks both, as separate fields. It also resolves independent/convergent discovery (agriculture, writing) without new machinery, via the same faculty/instantiation split Essay 1 used for language — one node, one logical-necessity edge if any, one historical-attestation edge per independently-attested origin. A node's disconnected historical-attestation edges (an "island," e.g. Mesoamerican technology with no link to Old World technology pre-contact) are not a defect to be patched.
- **Depends on:** #1, #6.
- **Gates:** interacts with #2 (node-split decision), #9 (citation standards differ by basis value).
- **Status:** Proposed — previously flagged as possibly needing resolution before other essays finalize; now drafted, still pending stress-testing against more edge pairs before ratification. Also carries forward Essay 1 Section 5's point that the floor's contingency (on species) may eventually bear on logical-necessity claims too — noted, not resolved.

## Tier 3 — Scope Boundaries

### 8. The Culture / Social-Systems Layer

- **Question:** do abstract systems (writing, law, money, democracy) belong in a "technology" tree, and if so, under what edge semantics?
- **Note:** Essay 1's faculty/instantiation split (the capacity for language vs. any specific language) is expected to be load-bearing here, and Essay 7 has now used the same split for independently-discovered technologies generally — likely a reusable pattern for this essay too.
- **Depends on:** #1, #6, #7.
- **Status:** Open — not yet substantively discussed.

## Tier 4 — Editorial / Operational Policy (how the wiki *functions*, not what's true)

### 9. Sourcing & Citation Policy for Edges

- **Question:** Wikipedia ledes suffice for describing a node; what justifies a *prerequisite claim* (an edge), which is usually original synthesis rather than one citable sentence? Additional concern raised: unlike Wikipedia's citation-as-ground-truth model, there may not be enough citation coverage in the literature for every prerequisite claim across all of human technology, particularly for logical-necessity claims (#7), which are frequently this wiki's own synthesis rather than reported fact.
- **New scope added:** this essay now also owns the *proof-tier* field from Essay 6's schema — expected values along the lines of directly-cited, synthesized-from-citations, and argued-consensus — and needs to define a distinct grounding standard for historical-attestation claims (ordinary verifiability) versus logical-necessity claims (argued soundness via this project's own debate process), rather than one citation standard for both.
- **Depends on:** #6, #7.
- **Status:** Open.

### 10. Governance and Moderation for a Living Graph

- **Thesis (draft):** two problems a text wiki never faces: emergent invalidity (two individually-valid edits on different nodes jointly produce a cycle, uncatchable by field-level merge conflict detection) and catastrophic blast radius (a handful of extremely central nodes can do far more damage than any single page if deleted or corrupted). Resolves into: a post-merge validation gate (cycle/dangling-edge/orphan checks) as application code, not something inherited from the database; node protection tiers computed automatically from blast radius (transitive descendant count); a deletion policy requiring forced re-parenting of dependents before any deletion, with hard deletion reserved for zero-dependent nodes and most "delete" requests routed to merge/rename instead (#2); stable node identifiers with redirects on move; and dispute resolution via this project's own debate/consensus process, grounded per Essay 7's basis distinction. Explicitly does *not* resolve whether the long-run edit model should stay branch-and-merge or move toward a Wikidata-style atomic, independently-addressable-statement model — flagged as its own open architectural fork. Newly relevant to #2: the redirect mechanism here is proposed as the general answer to what a decomposed compound label ("fire") resolves to, and this essay may need to absorb cluster-pinning governance (algorithmic clustering drift on open-ended macro-topics) as a further addendum once #2 is written up.
- **Depends on:** #1, #6, #7.
- **Gates:** interacts with #9 (dispute grounding standard) and #2 (deletion-vs-merge default).
- **Status:** Proposed — drafted; the branch-vs-atomic-statement fork, the exact number and assignment of permission tiers, hard-block-vs-soft-flag for cycle detection, and now the cluster-pinning governance question raised by #2 are flagged as separate future debate threads rather than resolved.

---
*New topics get added here as they surface — this index itself is expected to grow.*
