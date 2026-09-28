# Essay 9 — Sourcing and Citation Policy for Edges: Claims, Grounding, and Review

**Status:** Proposed

**Depends on:** [Edge Schema](essay-06-edge-schema.md) (this essay redefines what an edge is and
replaces that essay's proof-tier field), [Historical Attestation vs. Logical Necessity](essay-07-historical-vs-logical-necessity.md)
(basis becomes single-valued here), [Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md)
(blast radius, permission tiers, and the dispute process this essay's review mechanism builds on)

**Gates:** interacts with [The Culture / Social-Systems Layer](essay-08-culture-social-systems-layer.md)
(the "mere influence" sub-value question), [What Constitutes a Discovery?](essay-03-what-constitutes-a-discovery.md)
(pseudonymous attribution, formalized here as general policy), and three essays not yet written:
Notability / Inclusion Threshold, Bot and Automation Policy, and Argument Page Format

## 1. The problem

A Wikipedia lede is enough to describe a node. It is not enough to justify a prerequisite claim,
because an edge is usually original synthesis: no single sentence in the literature says "smelting
required controlled fire." Wikipedia's citation-as-ground-truth model assumes every statement can be
traced to a source that makes it, and that assumption fails for much of this graph, above all for
logical-necessity claims (see [Historical Attestation vs. Logical Necessity](essay-07-historical-vs-logical-necessity.md),
Section 3), where nobody has published the argument at all.

[Edge Schema](essay-06-edge-schema.md) assigned this essay a third edge field, proof-tier, with
provisional values (directly-cited, synthesized-from-citations, argued-consensus). Debate found that
the field was built on two assumptions that do not hold:

- **That one edge bundles several claims.** A node pair can carry a dated regional claim, a second
  regional claim, and a timeless necessity claim, each with completely different support. A single
  tier per edge cannot describe that honestly.
- **That the types of support form a ladder.** Ranking a citation above a wiki-generated argument
  would make the argued half of the graph, the logical-necessity half, second-class by
  construction, since many such claims can never have a citation.

There is a third concern that motivates the standard set below. Wikipedia often lets a citation
stand that does not actually support the statement it is attached to. This project is smaller in
scope and can hold itself to a stricter verification standard, especially with automated help.

## 2. Terminology

| Term | Meaning |
| --- | --- |
| **Claim** | A single proposition about the relationship between two nodes, capable of being true or false and of being sourced or challenged on its own. |
| **Edge** | The stored form of a claim. An edge *is* a claim. |
| **Grounding** | What backs a claim. Either a citation or an argument. A claim can have any number of groundings, of mixed types. |
| **Citation** | A grounding in which a text states the claim itself. |
| **Argument** | A grounding in which the claim is derived by a deductive chain whose premises are each grounded in turn. |
| **Review** | An attestation by an independent party that a grounding does what it says (Section 7). |
| **Status** | A computed disclosure of how well a claim is grounded and reviewed (Section 9). |

## 3. The resolution: an edge is a claim, and a claim is backed by grounding

> **An edge is a claim. A claim is backed by zero or more groundings, each a citation or an
> argument. Neither type outranks the other. What a reader sees is a computed status, never an
> editor-assigned rank.**

Proof-tier, as a field that ranks kinds of support, is retired. Its remaining job, disclosing what
kind of support a claim has, is done by the grounding list itself and by the computed status.

## 4. Every claim is its own edge

Because an edge is a single claim, the schema becomes flat:

- **Basis is single-valued.** An edge is either historical-attestation or logical-necessity. The
  earlier value "both" is simply two edges between the same pair, and "neither" is no edge.
- **Conjunctive claims split.** "X requires Y and Z as components" is two claims and two edges
  (Y to X, Z to X), typically carrying the combination relationship-kind. Both may share a
  grounding, for example one argument that supports both.
- **Multiplicity rules become uniqueness constraints.** At most one logical-necessity edge per node
  pair, as before. At most one historical-attestation edge per node pair per independent origin,
  which means a historical-attestation edge carries an origin attribute (region or instance) that
  earlier essays implied but never named.
- **Every claim has a statement.** The statement is the claim. It is what is grounded, reviewed, and
  disputed.
- **Sourcing multiplicity is unchanged.** A second source behind an existing claim is an added
  grounding, not a new edge, exactly as [Edge Schema](essay-06-edge-schema.md), Section 4 already
  holds.

The render layer still collapses parallel edges between the same node pair into one line (see
[Edge Schema](essay-06-edge-schema.md), Section 6). Nothing here changes what is drawn.

## 5. Citation grounding

A citation is used when a text states the claim itself. If a history book says that discovery X led
to invention Y, that citation alone is sufficient grounding for the claim "X led to Y." No argument
is needed.

**The exact-claim standard.** A citation grounds a claim directly only when the source asserts the
relationship the claim asserts, between these two subjects, on this basis. A source that mentions
both subjects without asserting the relationship does not ground the claim directly. It may still
ground a premise of an argument (Section 6).

**The verification standard.** Wikipedia leaves the question "does this citation support this
statement" to ordinary editing. This project deliberately deviates: a direct citation goes through
the same review as an argument (Section 7), and a review of a citation attests that the source
states the claim.

**What counts as a source.** Until the project develops its own standard, it follows Wikipedia's
verifiability and reliable-sources policies, with these constraints:

- **Pinned, not live.** The adopted policy is a dated snapshot. Later changes to Wikipedia's policy
  do not take effect here until reviewed and deliberately adopted, since their policies may diverge
  from this project's needs.
- **Scoped.** Only the parts about verifiability and source reliability are adopted. Policies that
  concern other questions, the notability guidelines in particular, are not, and some of them (a
  school-outcomes rule, for example) do not apply to this project at all.
- **A placeholder.** The snapshot stands in until the project writes its own standard.
- **Wikipedia is not a source for a claim.** It may be a source *of* content, where text is
  literally borrowed and attributed, such as a node's lede. It never grounds an edge.

**Departure from Wikipedia's no-original-research rule.** Arguments (Section 6) exist precisely to
permit synthesis. The departure is deliberate and bounded: synthesis is allowed only as a deductive
argument whose premises are each grounded under the standard above.

## 6. Argument grounding

An argument is used when no source states the exact claim, but the claim can be derived from
sources that support its premises together with logic.

> **An argument is a deductive derivation: an explicit sequence of premises and inference steps in
> which the conclusion follows necessarily if the premises are true. A syllogism is one valid shape
> an argument can take, not the only one.**

Strict syllogisms are too narrow for this work. Necessity claims about technology usually have more
than two premises, chain through intermediate conclusions, and are often conditional rather than
categorical. What the definition preserves is the property that matters: the conclusion follows
necessarily, so a reviewer only has two questions to answer (Section 7).

**A worked example.** The claim is "smelting requires a controlled heat source."

1. Smelting copper requires sustained temperatures above some threshold. *(cited to a metallurgy
   source)*
2. Sustained temperatures above that threshold require controlled combustion or an equivalent
   source. *(cited to a physics source)*
3. Therefore smelting requires a controlled heat source.

Neither cited source mentions the relationship between fire and smelting. The citations support
premises, and the argument does the connecting. A premise citation only has to support its own
premise; it does not have to meet the exact-claim standard for the conclusion.

**Rules for arguments:**

- **Anyone may author one, and one author is enough.** Others may modify it. What makes it count as
  more than one person's assertion is review (Section 7), not the number of authors.
- **Minimal.** No premise may be idle. Every premise is load-bearing, which is what makes the list
  of ungrounded premises below meaningful.
- **Premises are grounded by citation or by a sub-argument.** A sub-argument's premises are grounded
  the same way, and the leaves of the whole structure must be citations.
- **Ungrounded premises are allowed, and are always listed.** A premise with no grounding is a
  visible hole, named individually. It is never averaged into a score, because in a minimal
  deductive argument the conclusion is exactly as strong as its weakest premise.
- **No inductive leaps of the wiki's own.** If a step is inductive or causal-historical (no set of
  facts deductively proves that one thing caused another), it must enter as a premise cited to a
  source that argues it. Otherwise it shows as an ungrounded premise.

**Grounded is not true.** A fully grounded argument is only as good as its sources and the fit
between each source and its premise. The status system discloses what a claim rests on. It does not
certify correctness, and the interface should not imply that it does.

**The basis-fit check.** The two grounding types are equal in standing, but they are not equally
appropriate for every basis. [Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md),
Section 7 already has historical-attestation claims leaning on ordinary verifiability and
logical-necessity claims leaning on argued soundness. A logical-necessity claim grounded only by an
argument is normal. A historical-attestation claim grounded only by an argument is a smell, since
history is an external fact and the wiki should not be inventing it. This is a standing sanity
check in the same pattern as the cycle and orphan checks: it surfaces the mismatch to editors and
never blocks the edit.

## 7. Review

Both grounding types are reviewed to the same standard.

**What a review attests to.**

- For an **argument**: every inference step is valid, and every premise is actually supported by the
  source cited for it.
- For a **citation**: the source states the claim.

A review is not a vote on whether the conclusion is popular or likable.

**Reviews bind to a version.** Because arguments can be modified by others, a review applies to
exactly the version that was reviewed. Whether an edit is substantive is **computed from the
difference**, not declared by the editor. There is no self-flagged "minor edit" option, since a
small change to a premise can matter far more here than in a text article:

- Any change to a claim's statement, a premise, an inference step, or a cited source invalidates
  existing reviews.
- Changes to free-text fields outside the formal structure (commentary, annotations, formatting)
  do not.
- Prior reviewers may re-attest against the difference in a single action instead of re-reviewing
  from scratch, so a reset costs little when the change is small and correct.

Editors remain free to edit anything. Which fields count as formal structure is settled by the
argument page format (see Section 16).

**Independence.**

- An author cannot review their own grounding, and reviews must come from distinct accounts.
- Who is eligible to review, and at what permission tier, is [Governance and Moderation for a Living
  Graph](essay-10-graph-governance-and-moderation.md)'s question. That essay left the number and
  assignment of tiers open, and this essay depends on the answer without deciding it.

**Objections override the count.** An objection is a specific challenge to a premise, an inference
step, or the fit of a source. A claim with an open objection cannot show a status above yellow and
carries a contested marker until the objection is resolved through the dispute process in
[Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md),
Section 7. That process now operates on objections to a specific grounding, rather than on an
open-ended debate.

## 8. How many reviews: computed, not fixed

A fixed number fails in both directions. At launch the reviewer pool may be a handful of people, so
requiring several independent reviews per claim could be unachievable. At scale, a few coordinated
accounts are cheap to arrange on exactly the claims that matter most.

The required number of independent reviews is therefore **computed from the claim's blast radius**,
following the same principle [Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md)
uses for protection tiers: importance falls out of the graph rather than out of an editor's
judgment.

- **Edge-level blast radius** is proposed as the transitive descendant count of the downstream
  node, since that is what breaks if the claim is wrong. Essay 10 defines blast radius for nodes
  only, so this is a small addition.
- **The requirement is monotonic in blast radius, with a floor and a ceiling.** The constants
  (floor, ceiling, slope) are operational settings the project tunes as its reviewer pool grows.
  They are deliberately not fixed in this essay. The floor is set so that all three review states
  in Section 9 are reachable.
- **A human floor rises with blast radius.** Reviews by bots (Section 10) count toward the
  requirement, but never satisfy all of it, and the minimum number of human reviews grows with the
  claim's blast radius.
- **No manually maintained category.** A list of high-impact edges kept by editors would be stale by
  construction, since an edge becomes high-impact as the graph grows. The computed rule updates
  itself.

## 9. Status and display

Status is computed from a claim's groundings, reviews, and objections. Nothing about it is
editor-assigned.

| State | Meaning |
| --- | --- |
| **Ungrounded** | No grounding, or only arguments none of whose premises are grounded. Shown with a neutral marker, distinct from red. |
| **Red** | Grounded, but no independent review yet. |
| **Yellow** | At least one independent review but the requirement is not met, or the requirement is met but capped by an open objection or an ungrounded premise. |
| **Green** | The requirement in Section 8 is met, including the human floor, with no open objection, and any argument relied on is fully grounded. |

At the baseline requirement of two independent reviews, this reproduces the original proposal of
one, two, and three attestations counting the author, with red meaning author-only.

**Grounding completeness caps the color.** Reviewers attest that premises are supported by their
sources, and an ungrounded premise has nothing to attest. An argument with any ungrounded premise
therefore cannot display above yellow, however many reviews it has. The ungrounded premises are
listed by name in the inspector.

**Claims with several groundings** display the status of their strongest grounding, since one
adequate grounding is enough to support a claim. The others are visible in the inspector. Strength
here is a matter of computed status only and never of grounding type.

**Presentation.** Status is shown with both a shape and a label. Red uses a stop-like shape
(octagon or square, fixed at design time), yellow a triangle, green a circle. The shape carries the
meaning on its own, and the label may be limited to hover or click, but hover must never be the
only way to read a status, since touch devices have no hover and color alone excludes colorblind
readers.

**Consequence: everything starts red.** A newly added, well-cited claim is still unverified under
this standard. A freshly populated graph is mostly red until reviewed, which is the main reason
bot verification (Section 10) is close to necessary.

## 10. Bots

Bots are allowed. [Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md)
already relies on bot patrol for high-blast-radius nodes, and mechanical work such as fetching a
source and checking that it says what a premise claims suits automation well. Bots may author
arguments, verify citations, and review arguments. A bot review counts toward the requirement in
Section 8, subject to the constraints below. The full policy is a separate essay (Bot and
Automation Policy), and this section fixes only what the review mechanism needs.

- **Labeled and reasoned.** Bot reviews are displayed as bot reviews and publish their reasoning.
- **Independence by instance and model, not by operator.** While one operator (the project) runs
  every bot, an operator-based rule would forbid bot verification of bot-authored arguments
  entirely. Instead, an authoring bot and a verifying bot must be separate agents, ideally on
  different models. All bots on the same model family together count as **one** reviewer in the
  independence tally, since their errors are correlated. A bot never reviews its own output.
- **Verification retrieves the source.** A verifying bot must retrieve the cited source text itself
  and never rely on another agent's summary of it, since generated arguments can cite sources that
  do not exist or do not say what is claimed. Source text is also untrusted input to a bot, which
  is an injection risk the bot policy must address.
- **The human floor applies** (Section 8). Bots can carry low-blast-radius claims a long way but
  cannot reach green alone.
- **Accountability.** Every bot account has a declared operator of record. Initially that is the
  project alone. Whether and how the API opens to other operators is left to the bot policy essay,
  and nothing here presupposes either answer: the same rules apply to any operator.
- **Permissions.** Bots follow the rule [Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md),
  Section 3 sets for low-permission accounts: they propose structural edits, and only review and
  verification are within their authority by default.

## 11. Sources that are later overturned

Public-key cryptography's GCHQ precedent (Ellis 1970, Cocks 1973, declassified 1997) is a
well-sourced historical-attestation claim that was true to the public record and later shown
incomplete, through no editorial fault. [Historical Attestation vs. Logical Necessity](essay-07-historical-vs-logical-necessity.md)
and [Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md)
both flagged it as a case their models did not cover.

This model needs no special mechanism. A grounding is a statement of what its sources say, as of
when they said it. When a new source shows a claim incomplete, the claim is edited, the substantive
edit invalidates existing reviews (Section 7), and the version history preserves what was believed
before. That is an ordinary supersession, distinct from vandalism, from honest error, and from a
contested consensus call. Claims of the form "first to" or "only" are the most exposed, because they
are absence claims and the record that would refute them may not yet exist.

## 12. External rulings

CRISPR's Broad Institute versus UC Berkeley priority dispute has a binding legal outcome. A court
ruling is a reliable source for what the court decided. It is not automatically a source for who
invented the technology, since a legal standard of priority and a historical account of invention
are different propositions.

- The ruling may serve as a citation for the legal outcome.
- The wiki's own claim about priority is grounded separately, by the same means as any other claim.
- Where the two diverge, the divergence is disclosed on the claim in a free-text annotation, which
  by Section 7 does not reset reviews. The wiki neither defers to the ruling nor ignores it.

## 13. Pseudonymous attribution

[What Constitutes a Discovery?](essay-03-what-constitutes-a-discovery.md) decided that where a
pseudonym is the commonly credited attribution in mainstream sources ("Satoshi Nakamoto"), this wiki
follows that convention. Stated here as general policy: **attribution follows the conventions of the
sources that ground the claim.** A claim about a pseudonymous originator is written as its sources
write it. No special carve-out is needed.

## 14. Interactions worth noting

- **"Mere influence" sub-values.** [The Culture / Social-Systems Layer](essay-08-culture-social-systems-layer.md)
  flagged that documented direct influence (a founder who demonstrably read Cleisthenes) and ambient,
  undocumented diffusion may need distinguishing. Under this model the grounding itself may carry
  that distinction: direct influence is a citation-grounded claim, and ambient influence can only
  be argued. If that holds, the relationship-kind vocabulary does not need sub-values. This is
  proposed here, not decided, and belongs to whichever essay next revisits that question.
- **Node facts are out of scope.** This essay grounds edges. What a node contains beyond its
  description, including dates, category assignments (see [Achievement vs. Discovery vs. Invention](essay-04-achievement-discovery-invention.md)),
  and stage claims (see [What Constitutes a Discovery?](essay-03-what-constitutes-a-discovery.md)),
  is a separate question about node content and is not covered by this review mechanism.
- **Notability.** Whether a candidate has enough grounding to warrant a node may overlap with the
  Notability / Inclusion Threshold essay. The two are logged as separate questions.

## 15. What this essay is not

This essay defines claims, grounding, review, and status. It deliberately does not:

- define what a node contains, or how node content is attributed,
- specify the argument page format, including which fields are formal structure and how objections
  are structured,
- write the bot policy in full,
- set the review-requirement constants, or the number and assignment of reviewer permission tiers,
- define notability, or decide whether grounding is part of it,
- specify the interface design of status markers beyond the requirements in Section 9.

## 16. Status and open threads

This essay is **Proposed**. It was developed by debate and has not been stress-tested against real
edges. Threads flagged rather than resolved:

- **Argument Page Format.** The structured page attached to a claim, its formal fields, and its
  objection mechanism. Section 7's computed-difference rule depends on this essay defining which
  fields are formal structure. Logged as a new index item.
- **Premise dependencies.** An argument whose premise cites another claim in the graph depends on
  that claim. If the premise edge is later overturned or deleted, the dependent argument silently
  breaks. This resembles the dangling-edge check in [Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md)
  and may need an equivalent premise-dependency check.
- **Edge-level blast radius and requirement constants** (Section 8): the proposed definition is
  untested, and the constants are set operationally.
- **Reviewer eligibility and permission tiers**, which sit with [Governance and Moderation for a
  Living Graph](essay-10-graph-governance-and-moderation.md).
- **Bot and Automation Policy**, logged as a new index item, including whether and how the API
  opens beyond the project's own bots.
- **Notability / Inclusion Threshold**, index item 11, to be written.
- **The "mere influence" proposal** in Section 14, pending confirmation.

**Cross-essay changes required, not performed here:**

| Essay | Change |
| --- | --- |
| [Edge Schema](essay-06-edge-schema.md) | Define an edge as a claim. Replace the proof-tier field with grounding and reassign its ownership language accordingly. Rework Section 4's basis-multiplicity text for single-valued basis and uniqueness constraints. |
| [Historical Attestation vs. Logical Necessity](essay-07-historical-vs-logical-necessity.md) | Make basis single-valued. Replace the four-row combination table with the two-edge treatment of "both." Remove proof-tier language. Note the origin attribute on historical-attestation edges. |
| [Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md) | Reword Section 7's "debate followed by consensus" as argument plus objection. Add review and bot rules or point to this essay. Resolve the overturned-source and external-ruling stress cases by reference to Sections 11 and 12. Extend blast radius to edges. |
| [The Culture / Social-Systems Layer](essay-08-culture-social-systems-layer.md) | Cross-reference the "mere influence" proposal in Section 14. |
| [What Constitutes a Discovery?](essay-03-what-constitutes-a-discovery.md) | Mark the pseudonymous-attribution thread resolved by Section 13. |
| [Essay index](essay-index.md) | Update entries 6, 7, 9, and 10. Add items 11 through 14 (Notability, Spotlight / Feed Mechanism, Bot and Automation Policy, Argument Page Format). |
