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

### 6. Edge Schema — one claim, three orthogonal fields

- **Thesis (draft):** an edge is a claim, carrying a relationship-kind, a basis, and a grounding — three independent fields on one schema (amended by Essay 9: the third field was originally a proof-tier, and the edge was originally treated as a bundle of claims rather than a single one). This essay owns and fixes the relationship-kind vocabulary (material necessity, conceptual enablement, combination, mere influence) and assigns ownership of the other two fields elsewhere, so future essays populate one shared schema instead of each inventing "edge type" separately. Also fixes multiplicity rules (historical claims may multiply per independent origin; logical-necessity claims are capped at one per node pair) and a hard render-time rule: the stored graph is never the displayed graph, and multi-edges always collapse to one line. The "mere influence" relationship-kind has a first concrete candidate use — the AI concept/aspiration lineage's weak, indirect connection to the technical lineages it never materially enabled (Essay 2 debate) — worth stress-testing this essay against once drafted further.
- **Depends on:** #1, #2.
- **Gates:** #7 (basis values), #9 (grounding), #10 (governance acts on these fields).
- **Status:** Proposed — drafted, not yet stress-tested against many concrete edges the way #1 was tested against many nodes. Amendments pending from Essay 9: define an edge as a single claim, replace proof-tier with grounding, and rework the basis-multiplicity section for single-valued basis.

### 7. The Alien Civilization Question — historical attestation vs. logical necessity

- **Thesis (draft):** an edge's basis is historical-attestation (a dated, sourced, regional claim that X preceded Y in the record) or logical-necessity (a timeless claim that any civilization would need X before Y) — two independent kinds of claim about the same node pair, not one merged question (amended by Essay 9: basis is single-valued, so "both" is now two edges and "neither" is no edge). This resolves the original historical-vs-timeless framing directly: the graph tracks both, as separate edges. It also resolves independent/convergent discovery (agriculture, writing) without new machinery, via the same faculty/instantiation split Essay 1 used for language — one node, one logical-necessity edge if any, one historical-attestation edge per independently-attested origin. A node's disconnected historical-attestation edges (an "island," e.g. Mesoamerican technology with no link to Old World technology pre-contact) are not a defect to be patched.
- **Depends on:** #1, #6.
- **Gates:** interacts with #2 (node-split decision), #9 (grounding standards differ by basis value).
- **Status:** Proposed — previously flagged as possibly needing resolution before other essays finalize; now drafted, still pending stress-testing against more edge pairs before ratification. Also carries forward Essay 1 Section 5's point that the floor's contingency (on species) may eventually bear on logical-necessity claims too — noted, not resolved. Amendments pending from Essay 9: single-valued basis, the two-edge treatment of "both," and an origin attribute on historical-attestation edges.

## Tier 3 — Scope Boundaries

### 8. The Culture / Social-Systems Layer

- **Question:** do abstract systems (writing, law, money, democracy) belong in a "technology" tree, and if so, under what edge semantics?
- **Note:** Essay 1's faculty/instantiation split (the capacity for language vs. any specific language) is expected to be load-bearing here, and Essay 7 has now used the same split for independently-discovered technologies generally — likely a reusable pattern for this essay too.
- **Depends on:** #1, #6, #7.
- **Status:** Open — not yet substantively discussed.

## Tier 4 — Editorial / Operational Policy (how the wiki *functions*, not what's true)

### 9. Sourcing & Citation Policy for Edges

- **Thesis (draft):** an edge is a claim, and a claim is backed by grounding of two types, citation and argument, in any mixture. A citation is used when a text states the exact claim. An argument is a deductive derivation — not strictly a syllogism — whose premises are each grounded by citations (which need not be about the relationship between the two nodes) or by sub-arguments, and whose ungrounded premises are permitted but always listed by name. Neither type outranks the other, and the proof-tier field from Essay 6 is retired. Both types go through the same review, a deliberate deviation from Wikipedia's practice of letting citations stand unchecked: reviews attest that each inference step is valid and each premise (or the claim itself, for a citation) is supported by its source, bind to a version, and are invalidated by any substantive change, computed from the difference rather than self-declared. The number of independent reviews required is computed from blast radius (with a human floor that rises with it) rather than fixed, and a computed status — ungrounded, red, yellow, green, shown with a shape and a label — discloses how well a claim is grounded and reviewed. Sourcing follows a pinned snapshot of Wikipedia's verifiability and reliable-sources policies until the project writes its own, and Wikipedia is never a source for a claim. Bots may author and review under independence and human-floor constraints.
- **Resolves into:** the claim/grounding/review schema, the status computation, and a review-independence rule; resolves the overturned-source case (the GCHQ precedent) as ordinary supersession and the external-ruling case (CRISPR) as a citable but non-deferential source; states pseudonymous attribution as general policy.
- **Depends on:** #6, #7, #10.
- **Gates:** interacts with #8 (a possible resolution of the "mere influence" sub-value question via grounding), #11 (notability), #13 (bot policy), #14 (argument page format).
- **Status:** Proposed — drafted after debate; not yet stress-tested against real edges. Requires cross-essay amendments to #6, #7, and #10, listed in the essay itself.

### 10. Governance and Moderation for a Living Graph

- **Thesis (draft):** two problems a text wiki never faces: emergent invalidity (two individually-valid edits on different nodes jointly produce a cycle, uncatchable by field-level merge conflict detection) and catastrophic blast radius (a handful of extremely central nodes can do far more damage than any single page if deleted or corrupted). Resolves into: a post-merge validation gate (cycle/dangling-edge/orphan checks) as application code, not something inherited from the database; node protection tiers computed automatically from blast radius (transitive descendant count); a deletion policy requiring forced re-parenting of dependents before any deletion, with hard deletion reserved for zero-dependent nodes and most "delete" requests routed to merge/rename instead (#2); stable node identifiers with redirects on move; and dispute resolution via this project's own debate/consensus process, grounded per Essay 7's basis distinction. Explicitly does *not* resolve whether the long-run edit model should stay branch-and-merge or move toward a Wikidata-style atomic, independently-addressable-statement model — flagged as its own open architectural fork. Newly relevant to #2: the redirect mechanism here is proposed as the general answer to what a decomposed compound label ("fire") resolves to, and this essay may need to absorb cluster-pinning governance (algorithmic clustering drift on open-ended macro-topics) as a further addendum once #2 is written up.
- **Depends on:** #1, #6, #7.
- **Gates:** interacts with #9 (dispute grounding standard) and #2 (deletion-vs-merge default).
- **Status:** Proposed — drafted; the branch-vs-atomic-statement fork, the exact number and assignment of permission tiers, hard-block-vs-soft-flag for cycle detection, and now the cluster-pinning governance question raised by #2 are flagged as separate future debate threads rather than resolved. Amendments pending from Essay 9: reword dispute resolution as argument plus objection, extend blast radius to edges, and resolve the overturned-source and external-ruling stress cases by reference.

### 11. Notability / Inclusion Threshold

- **Question:** what makes a candidate that clears both of Essay 1's axioms significant enough to warrant its own node, as opposed to being folded into a larger one or excluded as trivial (the "someone's garage invention made of duct tape and sticks" problem)? Structurally similar to Wikipedia's notability guideline, distinct from Essay 1's category test, and applies at every level of the graph.
- **Note:** some Wikipedia notability policies do not transfer to this project at all (a school-outcomes rule, for instance). Candidate material carried over from Essay 4: the Guinness-record heuristic — a genuine achievement pushes against a dimension already meaningfully constraining before someone beat it, while a manufactured record invents an arbitrary contest category. Likely entangled with #9 (whether having enough grounding is part of notability) and #2 (granularity).
- **Depends on:** #1, #2, #9.
- **Status:** Open — not yet substantively discussed.

### 12. Spotlight / Feed Mechanism

- **Question:** how does the wiki surface "this is a big deal" — a newly added node, or a recent event like Navier–Stokes being solved lighting up in gold — without conflating magnitude with category? Editor's choice and non-load-bearing by nature: nothing structural depends on it.
- **Open questions:** whether a spotlight is expiring or permanent metadata, whether it applies retroactively to older nodes, and how it relates to the notability threshold (#11).
- **Depends on:** #4.
- **Status:** Open — spun off from Essay 4, deferred entirely.

### 13. Bot and Automation Policy

- **Question:** what may automated accounts do in the wiki, and under what constraints? Essay 9 establishes that bots are allowed and may author arguments, verify citations, and review, and fixes only what the review mechanism needs: labeled and reasoned bot reviews, independence by instance and model rather than by operator, all bots of one model family counting as one reviewer, verification that retrieves the source itself, a human floor that rises with blast radius, and a declared operator of record. This essay owns everything beyond that.
- **Open questions:** whether and how the API opens beyond the project's own bots (initially only the project operates them); defenses against fabricated sources and against injection through source text; bot permission tiers relative to Essay 10's low-permission-account rule; bulk import of new claims; the scope of bot patrol on high-blast-radius nodes.
- **Depends on:** #9, #10.
- **Status:** Open — not yet substantively discussed.

### 14. Argument Page Format

- **Question:** what is the structured page attached to a claim? Essay 9 defines what an argument is (a deductive derivation with grounded premises) and that it can be modified by others, but not its concrete structure.
- **Open questions:** which fields are formal structure (a change to which invalidates reviews) versus free text; how premises reference other claims in the graph, and whether a premise-dependency check is needed when a referenced claim is overturned; how objections are structured and resolved; how the page relates to the general talk page, which remains an open-forum space.
- **Depends on:** #9.
- **Status:** Open — spun off from Essay 9, deferred.

---
*New topics get added here as they surface — this index itself is expected to grow.*
