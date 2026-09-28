# Sourcing and Citation Policy for Edges

**Status:** Proposed

An [edge](essay-00-about-the-project.md#glossary) on the graph is a claim, and a claim needs support.
This policy sets out how support works and how readers can see how much of it a claim has. It rests on
four points.

1. **An edge is a claim, and a claim is backed by grounding.** Grounding is either a *citation* or an
   *argument*, and a claim may have any number of either. Neither type outranks the other.
2. **Every grounding is reviewed to the same standard.** A review attests that the grounding does what
   it says. Reviews bind to a version and are invalidated by any substantive change.
3. **The number of independent reviews a claim needs is computed** from how much depends on it, with a
   minimum number of human reviews that rises as that dependence grows.
4. **Readers see a computed status**, either ungrounded, red, yellow, or green. It shows how well a claim
   is supported and reviewed. It does not certify that the claim is true.

## The problem

An encyclopedia's lead paragraph is enough to describe a node. It is not enough to justify a
prerequisite claim, because an edge is usually original synthesis. No single sentence in the literature
says "smelting required controlled fire." Wikipedia's model, in which every statement traces to a source
that makes it, assumes something that fails for much of this graph. That is especially true of
logical-necessity claims (see
[Historical Attestation vs. Logical Necessity](essay-07-historical-vs-logical-necessity.md)), where
nobody has published the argument at all.

A schema that ranks kinds of support would not fit this graph either, for two reasons.

- **An edge is one claim, not a bundle.** A pair of nodes can carry a dated regional claim, a second
  regional claim, and a timeless necessity claim, each with completely different support. One tier
  attached to a whole edge could not describe that honestly.
- **Kinds of support do not form a ladder.** Ranking a citation above a wiki-generated argument would
  make the argued half of the graph, the logical-necessity half, second class by construction, since
  many such claims can never have a citation.

There is a third concern behind the standard set below. Wikipedia often lets a citation stand that does
not actually support the statement it is attached to. This project is smaller in scope and can hold
itself to a stricter standard of verification, especially with automated help.

## Terms

| Term | Meaning |
| --- | --- |
| **Claim** | A single proposition about the relationship between two nodes, capable of being true or false and of being sourced or challenged on its own. |
| **Edge** | The stored form of a claim. An edge *is* a claim. |
| **Grounding** | What backs a claim: either a citation or an argument. A claim can have any number of groundings, of mixed types. |
| **Citation** | A grounding in which a text states the claim itself. |
| **Argument** | A grounding in which the claim is derived by a deductive chain whose premises are each grounded in turn. |
| **Review** | An attestation by an independent party that a grounding does what it says. |
| **Status** | A computed disclosure of how well a claim is grounded and reviewed. |

## An edge is a claim, and a claim is backed by grounding

> **An edge is a claim. A claim is backed by zero or more groundings, each a citation or an argument.
> Neither type outranks the other. What a reader sees is a computed status, never an editor-assigned
> rank.**

Because an edge is a single claim, the schema stays flat, as the [Edge Schema](essay-06-edge-schema.md)
sets out.

- **Basis is single-valued.** An edge is either historical attestation or logical necessity. Both is
  simply two edges between the same pair, and neither is no edge.
- **Compound claims split.** "X requires Y and Z as components" is two claims and two edges, typically
  of the combination kind. Both may share a grounding, such as one argument that supports both.
- **Multiplicity rules are uniqueness constraints.** At most one logical-necessity edge per pair. At most
  one historical-attestation edge per pair per independent origin, which is why such an edge carries an
  origin attribute.
- **Every claim has a statement.** The statement is the claim. It is what is grounded, reviewed, and
  disputed.
- **More sourcing is not a new edge.** A second source behind an existing claim is an added grounding.

Parallel edges between the same pair are still drawn as a single line. Nothing here changes what is
shown on the graph.

## Citation grounding

A citation is used when a text states the claim itself. If a history book says that discovery X led to
invention Y, that citation alone is sufficient grounding for the claim "X led to Y." No argument is
needed.

**The exact-claim standard.** A citation grounds a claim directly only when the source asserts the
relationship the claim asserts, between these two subjects, on this basis. A source that mentions both
subjects without asserting the relationship does not ground the claim directly. It may still ground a
premise of an argument.

**The verification standard.** Wikipedia leaves the question "does this citation support this
statement" to ordinary editing. This project deliberately deviates. A direct citation goes through the
same review as an argument, and a review of a citation attests that the source states the claim.

**What counts as a source.** Until the project writes its own standard, it follows Wikipedia's policies
on verifiability and reliable sources, with these constraints.

- **Pinned, not live.** The adopted policy is a dated snapshot. Later changes to Wikipedia's policy do
  not take effect here until reviewed and deliberately adopted, since Wikipedia's needs may diverge from
  this project's.
- **Scoped.** Only the parts about verifiability and source reliability are adopted. Policies that
  concern other questions, the notability guidelines in particular, are not, and some of them, such as a
  rule about school outcomes, do not apply to this project at all.
- **A placeholder.** The snapshot stands in until the project has a standard of its own.
- **Wikipedia is not a source for a claim.** It may be a source *of* content, where text is literally
  borrowed and attributed, such as a node's lead. It never grounds an edge.

**A deliberate departure from "no original research."** Wikipedia forbids editors' own synthesis.
Arguments exist precisely to permit it. The departure is bounded: synthesis is allowed only as a
deductive argument whose premises are each grounded under the standard above.

## Argument grounding

An argument is used when no source states the exact claim but the claim can be derived from sources that
support its premises, together with logic.

> **An argument is a deductive derivation: an explicit sequence of premises and inference steps in which
> the conclusion follows necessarily if the premises are true. A syllogism is one valid shape an
> argument can take, not the only one.**

Strict syllogisms are too narrow for this work. Necessity claims about technology usually have more than
two premises, chain through intermediate conclusions, and are often conditional and not categorical.
What the definition preserves is the property that matters. Because the conclusion follows necessarily,
a reviewer has only two questions to answer (see Review below).

**A worked example.** The claim is "smelting requires a controlled heat source."

1. Smelting copper requires sustained temperatures above some threshold. *(cited to a metallurgy
   source)*
2. Sustained temperatures above that threshold require controlled combustion or an equivalent source.
   *(cited to a physics source)*
3. Therefore smelting requires a controlled heat source.

Neither cited source mentions the relationship between fire and smelting. The citations support
premises, and the argument does the connecting. A premise's citation only has to support that premise.
It does not have to meet the exact-claim standard for the conclusion.

**Rules for arguments**

- **Anyone may author one, and one author is enough.** Others may modify it. What makes it count as more
  than one person's assertion is review, not the number of authors.
- **Minimal.** No premise may be idle. Every premise is load-bearing, which is what makes the list of
  ungrounded premises below meaningful.
- **Premises are grounded by citation or by a sub-argument.** A sub-argument's premises are grounded the
  same way, and the leaves of the whole structure must be citations.
- **Ungrounded premises are allowed, and always listed.** A premise with no grounding is a visible hole,
  named individually. It is never averaged into a score, because in a minimal deductive argument the
  conclusion is exactly as strong as its weakest premise.
- **No inductive leaps of the wiki's own.** If a step is inductive or causal-historical, meaning no set
  of facts deductively proves that one thing caused another, it must enter as a premise cited to a
  source that argues it. Otherwise it shows as an ungrounded premise.

**Grounded is not true.** A fully grounded argument is only as good as its sources and the fit between
each source and its premise. The status system discloses what a claim rests on. It does not certify
correctness, and the interface should not imply that it does.

**The basis-fit check.** The two grounding types are equal in standing but not equally appropriate for
every basis. A logical-necessity claim grounded only by an argument is normal. A historical-attestation
claim grounded only by an argument is a warning sign, since history is an external fact and the wiki
should not be inventing it. This check surfaces the mismatch to editors and never blocks the edit,
following the flag-a-human pattern in
[Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md).

## Review

Both grounding types are reviewed to the same standard.

**What a review attests to.**

- For an **argument**: every inference step is valid, and every premise is actually supported by the
  source cited for it.
- For a **citation**: the source states the claim.

A review is not a vote on whether the conclusion is popular or likable.

**Reviews bind to a version.** Because arguments can be modified by others, a review applies to exactly
the version that was reviewed. Whether an edit is substantive is **computed from the difference**, not
declared by the editor. There is no self-flagged "minor edit" option, since a small change to a premise
can matter far more here than in a text article.

- Any change to a claim's statement, a premise, an inference step, or a cited source invalidates existing
  reviews.
- Changes to free-text fields outside the formal structure, such as commentary, annotations, and
  formatting, do not.
- Prior reviewers may re-attest against the difference in a single action instead of reviewing from
  scratch, so a reset costs little when the change is small and correct.

Editors remain free to edit anything. Which fields count as formal structure is settled by the planned
Argument Page Format policy.

**Independence.** An author cannot review their own grounding, and reviews must come from distinct
accounts. Who is eligible to review, and at what permission tier, is a question for the governance
policy, which has not yet fixed the number and assignment of tiers. This policy depends on that answer
without deciding it.

**Objections override the count.** An objection is a specific challenge to a premise, an inference step,
or the fit of a source. A claim with an open objection cannot show a status above yellow and carries a
contested marker until the objection is resolved through the dispute process in the governance policy.
That process operates on objections to a specific grounding, not on open-ended debate.

## How many reviews: computed, not fixed

A fixed number fails in both directions. At launch the reviewer pool may be a handful of people, so
requiring several independent reviews per claim could be unachievable. At scale, a few coordinated
accounts are cheap to arrange on exactly the claims that matter most.

The required number of independent reviews is therefore **computed from the claim's blast radius**,
following the principle the governance policy uses for protection tiers: importance falls out of the
graph and not out of an editor's judgment.

- **Edge-level blast radius** is the transitive descendant count of the edge's downstream node, since
  that is what breaks if the claim is wrong. The governance policy defines it.
- **The requirement rises with blast radius**, between a floor and a ceiling. The constants (floor,
  ceiling, and slope) are operational settings the project tunes as its reviewer pool grows. They are
  deliberately not fixed here. The floor is set so that all three review states below are reachable.
- **A human floor rises with blast radius.** Reviews by bots count toward the requirement but never
  satisfy all of it, and the minimum number of human reviews grows with the claim's blast radius.
- **There is no manually maintained category.** A list of high-impact edges kept by editors would be
  stale by construction, since an edge becomes high-impact as the graph grows. The computed rule updates
  itself.

## Status and display

Status is computed from a claim's groundings, reviews, and objections. Nothing about it is assigned by
an editor.

| State | Meaning |
| --- | --- |
| **Ungrounded** | No grounding, or only arguments none of whose premises are grounded. Shown with a neutral marker, distinct from red. |
| **Red** | Grounded, but no independent review yet. |
| **Yellow** | At least one independent review, but the requirement is not met, or the requirement is met but capped by an open objection or an ungrounded premise. |
| **Green** | The requirement is met, including the human floor, with no open objection, and any argument relied on is fully grounded. |

At the baseline requirement of two independent reviews, red means none, yellow means one, and green means
two.

**Grounding completeness caps the color.** Reviewers attest that premises are supported by their
sources, and an ungrounded premise has nothing to attest. An argument with any ungrounded premise
therefore cannot display above yellow, however many reviews it has. The ungrounded premises are listed
by name in the inspector.

**Claims with several groundings** display the status of their strongest grounding, since one adequate
grounding is enough to support a claim. The others are visible in the inspector. Strength here is a
matter of computed status only, never of grounding type.

**Presentation.** Status is shown with both a shape and a label. Red uses a stop-like shape (an octagon
or square, fixed at design time), yellow a triangle, and green a circle. The shape carries the meaning on
its own. The label may be limited to hover or click, but hover must never be the only way to read a
status, since touch devices have no hover and color alone excludes colorblind readers.

**Consequence: everything starts red.** A newly added, well-cited claim is still unverified under this
standard, so a freshly populated graph is mostly red until reviewed. This is the main reason bot
verification is close to necessary.

## Bots

Bots are allowed. The governance policy already relies on bot patrol for high-blast-radius nodes, and
mechanical work such as fetching a source and checking that it says what a premise claims suits
automation well. Bots may author arguments, verify citations, and review arguments. A bot review counts
toward the requirement above, subject to the constraints below. The full policy is the planned Bot and
Automation Policy, and this section fixes only what the review mechanism needs.

- **Labeled and reasoned.** Bot reviews are displayed as bot reviews and publish their reasoning.
- **Independence by instance and model, not by operator.** While one operator, the project, runs every
  bot, an operator-based rule would forbid bot verification of bot-authored arguments entirely. Instead,
  an authoring bot and a verifying bot must be separate agents, ideally on different models. All bots on
  the same model family together count as **one** reviewer in the independence tally, since their errors
  are correlated. A bot never reviews its own output.
- **Verification retrieves the source.** A verifying bot must retrieve the cited source text itself and
  never rely on another agent's summary of it, since generated arguments can cite sources that do not
  exist or do not say what is claimed. Source text is also untrusted input to a bot, which is an
  injection risk the bot policy must address.
- **The human floor applies.** Bots can carry low-blast-radius claims a long way but cannot reach green
  alone.
- **Accountability.** Every bot account has a declared operator of record, which is initially the
  project alone. Whether and how the API opens to other operators is left to the bot policy, and nothing
  here presupposes either answer. The same rules apply to any operator.
- **Permissions.** Bots follow the rule for low-permission accounts in the governance policy: they
  propose structural edits, and only review and verification are within their authority by default.

## Sources that are later overturned

Public-key cryptography's GCHQ precedent (Ellis 1970, Cocks 1973, declassified 1997) is a well-sourced
historical-attestation claim that was true to the public record and later shown incomplete, through no
editorial fault.

This model needs no special mechanism. A grounding is a statement of what its sources say, as of when
they said it. When a new source shows a claim incomplete, the claim is edited, the substantive edit
invalidates existing reviews, and the version history preserves what was believed before. That is an
ordinary supersession, distinct from vandalism, from honest error, and from a contested consensus call.
Claims of the form "first to" or "only" are the most exposed, because they are claims of absence and
the record that would refute them may not yet exist.

## External rulings

CRISPR's priority dispute between the Broad Institute and UC Berkeley has a binding legal outcome. A
court ruling is a reliable source for what the court decided. It is not automatically a source for who
invented the technology, since a legal standard of priority and a historical account of invention are
different propositions.

- The ruling may serve as a citation for the legal outcome.
- The wiki's own claim about priority is grounded separately, by the same means as any other claim.
- Where the two diverge, the divergence is disclosed on the claim in a free-text annotation, which does
  not reset reviews. The wiki neither defers to the ruling nor ignores it.

## Pseudonymous attribution

Where a pseudonym is the commonly credited attribution in mainstream sources, as with "Satoshi
Nakamoto," the wiki follows that convention. Stated as general policy: **attribution follows the
conventions of the sources that ground the claim.** A claim about a pseudonymous originator is written
as its sources write it, and no special carve-out is needed.

## Interactions worth noting

- **Sub-kinds of mere influence.** Documented direct influence, such as a founder who demonstrably read
  Cleisthenes, and ambient, undocumented diffusion may need distinguishing, as
  [The Culture / Social-Systems Layer](essay-08-culture-social-systems-layer.md) observes. Under this
  model the grounding itself may carry that distinction, since direct influence is a citation-grounded
  claim and ambient influence can only be argued. If that holds, the relationship-kind vocabulary does
  not need sub-values. This is proposed and not decided.
- **Node facts are out of scope.** This policy grounds edges. What a node contains beyond its
  description, including dates, category assignments (see
  [Achievement vs. Discovery vs. Invention](essay-04-achievement-discovery-invention.md)), and stage
  claims (see [What Constitutes a Discovery?](essay-03-what-constitutes-a-discovery.md)), is a separate
  question about node content and is not covered by this review mechanism.
- **Notability.** Whether a candidate has enough grounding to warrant a node may overlap with the planned
  Notability / Inclusion Threshold policy. The two are treated as separate questions.

## What this policy does not decide

- What a node contains, or how node content is attributed and sourced.
- The argument page format, including which fields are formal structure and how objections are
  structured.
- The full bot policy.
- The review-requirement constants, or the number and assignment of reviewer permission tiers.
- What counts as notable, or whether grounding is part of it.
- The interface design of status markers beyond the requirements above.

## Open questions

- **Argument page format.** The structured page attached to a claim, its formal fields, and its
  objection mechanism. The rule that substantive changes are computed from the difference depends on the
  planned Argument Page Format policy defining which fields are formal structure.
- **Premise dependencies.** An argument whose premise cites another claim in the graph depends on that
  claim. If the premise edge is later overturned or deleted, the dependent argument silently breaks.
  This resembles the dangling-edge check in the governance policy and may need an equivalent
  premise-dependency check.
- **Edge-level blast radius and the requirement constants.** The definition is untested, and the
  constants are set operationally.
- **Reviewer eligibility and permission tiers**, which sit with the governance policy.
- **Redirects and reviewed claims.** Whether a redirect that changes an edge's endpoint resets the
  reviews of that claim. This is taken up in the governance policy.
- **Sourcing node facts.** How stage claims, dates, and category assignments are grounded and reviewed.
- **Bot and Automation Policy**, including whether and how the API opens beyond the project's own bots.
- **The mere-influence proposal**, pending confirmation.
- **Whether the standard holds up in practice.** It was developed by reasoning and has not been tried
  against real edges.
