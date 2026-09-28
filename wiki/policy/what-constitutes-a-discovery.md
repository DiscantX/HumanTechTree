# What Constitutes a Discovery?

**Status:** Proposed

The history of finding out about something is rarely a single event. This policy gives the graph a way
to represent that without turning every [node](about-the-project.md#glossary) into a
multi-part production. It rests on four points.

1. **Most nodes have no stage.** A node has a required *subject* and an optional *stage*. Dividing a
   subject into stages is earned by the tests in [Node Granularity](node-granularity.md) and
   is never owed by default.
2. **The stage vocabulary is small and closed.** The four stages are observation, exploitation,
   production, and explanation.
3. **Stages do not arrive in one fixed order.** Several recurring patterns, called shapes, are
   documented as guidance for editors. They are not a classification anyone must assign.
4. **The stage shown for a divided subject is computed.** At default zoom, a subject appears as one
   node, and the stage that other nodes actually depend on is the one displayed.

A note on the word "discovery." In this essay it is used in the broad, everyday sense of a subject's
history of being found out and mastered. The narrower category of that name, distinguished from
invention and achievement, is defined in
[Achievement vs. Discovery vs. Invention](achievement-discovery-invention.md).

## The problem: practice before explanation, and other orders

People controlled fire hundreds of thousands of years before combustion chemistry existed to say why it
worked. Treating "the discovery of fire" as one event flattens a span longer than all of recorded
history into a single node, and hides a real fact: humans mastered fire in practice for millennia while
being wrong, or silent, about why it worked. That is the classic chicken-and-egg question, of which
comes first, using a thing or understanding it.

The question turns out to be too narrow, because practical mastery does not always come first. The
laser and nuclear fission were predicted by theory before anyone built one. Electricity advanced in
alternating small steps of practice and explanation. Writing and money have no natural phenomenon to
explain at all. The framework here has been tried against subjects across these situations, including
vaccination, electricity, the laser, metallurgy, CRISPR, public-key cryptography, writing, money,
democracy, and cryptocurrency. The lesson is that a discovery is not one kind of event, and the graph
needs a way to say so.

## Stage is optional

> **A node has a required subject and an optional stage, drawn from a small, closed vocabulary. Most
> nodes carry no stage at all.**

This mirrors the principle in the [Edge Schema](edge-schema.md) that richness is available
but never mandatory. In the great majority of cases, a subject is a single, undivided node. Only when
its history genuinely contains several separable, datable actions does it become worth dividing into a
chain of stages.

A stage is a field on a *node*. It is separate from the relationship-kind, which is a field on an
*edge*, and it is separate from the discovery/invention/achievement category, which is another node
field (see the end of this essay).

## The four stages

The vocabulary comes from fire and has held up against other cases of mastering a natural phenomenon,
such as metallurgy and electricity.

- **Observation.** A phenomenon is noticed and its regularity recognized, with no attempt yet to
  control or use it.
- **Exploitation.** The phenomenon is used or harnessed opportunistically, as when wildfire is
  captured or naturally occurring copper is used, without the ability to produce it reliably on demand.
- **Production.** The phenomenon can be reliably started or made at will.
- **Explanation.** The underlying mechanism is correctly understood, whether or not that understanding
  was needed to reach production.

Each stage of a divided subject is a separate human action, so each is eligible under
[Founding Axioms](founding-axioms.md), while the phenomenon itself sits on the floor.

A node's display title and slug are *derived* from its subject and stage, as in "Production of Fire."
Stage is real structured data, not a naming convention, so it never has to be parsed back out of a
title. This follows the general rule in
[Governance and Moderation for a Living Graph](graph-governance-and-moderation.md) that
identifiers are separate from display titles.

**A boundary condition.** This vocabulary presumes a natural phenomenon being mastered. Purely formal
subjects, such as a public-key cryptosystem or a mathematical result, may have no observation stage at
all, since there is no phenomenon to notice before the idea is constructed. Editors should not force a
phenomenon-mastery template onto such a subject. It may simply carry no stage, or only production and
explanation, without that being an incomplete use of the vocabulary. This is a statement about stages
and not about category: a theorem is still a discovery in the technical sense, because it was always
true, but its history is usually not a chain of mastering a phenomenon.

## Shapes: how stages order themselves

Even where all four stages apply, they do not arrive in one canonical order. At least four patterns
have been found. They are **not exhaustive**. They are a documented set of examples to build editors'
intuition, and an editor is never required to assign one.

| Shape | Pattern | Examples |
| --- | --- | --- |
| Empirical-lag | Production precedes explanation, often by a long span | Fire, metallurgy, vaccination and germ theory, quinine, fermentation |
| Theory-first | Explanation precedes production, deliberately | The laser, nuclear fission, the transistor |
| Interleaved | Explanation and production advance in alternating small steps with no clean boundary | Electricity |
| Iterative abstraction | No explanation stage at all: the technique improves by successive generalization, and each step is immediately usable | Writing, money |

Two further findings sit alongside the list.

- **Shapes are not mutually exclusive.** Money is iterative abstraction (barter, then commodity money,
  then coinage, then fiat currency) with empirical lag layered on top, since a coherent theory of why
  fiat currency holds value arrived centuries after fiat currency was in wide use. A subject can show
  more than one shape on different axes, and editors need not pick exactly one.
- **Era may predict shape better than the nature of the technology does.** Theory-first looks like the
  default once the scientific method is itself an established prerequisite, and empirical lag looks like
  the default before it. This is a testable claim, and is stated here without being argued to a
  conclusion.

**Repurposing is not a shape.** CRISPR's mechanism was observed and explained as a bacterial immune
system for its own sake, and only later repurposed for gene editing, with no continuous line of intent
between the two. A shape describes stages *within one continuous subject*. Repurposing describes two
subjects, bacterial CRISPR immunity and CRISPR gene editing, connected by an ordinary edge, because the
observing and explaining were never in service of the eventual application. It is a question of
whether a part is thin or thick (below), not a question of shape.

Shapes are guidance and not a schema field. The project may later develop templates or automatic
detection of shapes, but only once there is enough real graph data to test them.

## Combination is a separate axis

Cryptocurrency shows a pattern unlike any of the shapes. Four mature, independently developed lines
converged in a single act of synthesis: public-key cryptography, Hashcash proof-of-work, Byzantine
fault-tolerance theory, and earlier unbuilt digital-cash proposals such as bit gold and b-money. None of
their internal histories is relevant to the convergence itself. This is the *combination*
relationship-kind in the Edge Schema, and cryptocurrency is its first fully worked example.

Shape describes what happened along one line of development. Combination describes how many prior lines
feed a node. The two do not compete for the same cases, and combination should never be expressed as a
stage.

## Thin or thick: when a stage becomes its own subject

Whether a candidate stage stays a stage of its parent subject or becomes an independent subject joined
by an edge is decided by the second question of the checklist in Node Granularity, applied as written
and not recalibrated for this use.

A stage is *thin* when it has no independent history or sourcing beyond being a phase of the parent's
story, and it stays a stage. It is *thick* when it has a substantial, decomposable history in its own
right, and it becomes a separate subject. Germ theory relative to vaccination is the clearest thick
case. Germ theory has its own prerequisite chain, in microscopy, cell theory, and the separate work of
Pasteur and Koch, which has little to do with vaccination's specific history. So "explanation of
vaccination" is the wrong label, and germ theory is its own subject linked to vaccination by an
ordinary edge. The CRISPR repurposing above resolves the same way.

## How a divided subject is shown

A subject with a large internal gap, such as fire's hundreds of thousands of years between exploitation
and explanation, needs no new spatial or zoom mechanism. It uses the rule from the Edge Schema that the
stored graph is never the shown graph. At default zoom, a divided subject appears as one collapsed node,
and its chain of stages, with real dates, sits behind the same inspector-panel click already used for
multiple origins and stacked citations.

Which single stage is shown as that collapsed anchor is **computed**, not chosen by an editor. It is the
stage that actually carries the subject's downstream prerequisite edges, meaning the stage that other
nodes cite. For fire that is expected to be production, since smelting requires the *ability* to start a
fire and not an understanding of why it burns. This follows the principle already used for protection
tiers in the governance policy: importance should fall out of the graph's own structure wherever
possible and not require an editor's judgment call on every node.

An override, letting editors pin a different anchor against the computed default, is deliberately not
specified. It should wait until real data shows a case where the computed default is wrong, and not be
designed against a hypothetical.

## Stage is separate from category

Stage is not the same thing as the discovery/invention/achievement category. Category is applied
independently and is not read off which stage a subject has reached. Fire shows the difference:
observation and explanation are discoveries, production is an invention, and exploitation is ambiguous.
The details are in Achievement vs. Discovery vs. Invention.

## What this policy does not decide

- Whether a candidate is a discovery, an invention, or an achievement.
- How stages apply to culture and social systems. Writing, money, and democracy were tried here only
  as exploratory cases. [The Culture / Social-Systems Layer](culture-social-systems-layer.md)
  takes them up, adopts iterative abstraction as the expected default shape for institutions with no
  physical phenomenon behind them, and treats Athenian and modern democracy as two separate subjects
  joined by a mere-influence edge.
- The citation standard for stage claims. Stages and dates are node content and not edges, so the review
  mechanism in [Sourcing and Citation Policy for Edges](sourcing-and-citation-policy.md) does
  not cover them.

## Open questions

- **Multiple origins and stages.** Where a subject has several independent historical origins, as
  agriculture and money do, does each origin need its own stage chain, or should multi-origin subjects
  simply not be divided into stages? This is left open until the graph is populated and the interaction
  can be observed directly, not decided in the abstract. See
  [Historical Attestation vs. Logical Necessity](historical-vs-logical-necessity.md).
- **Sourcing stage claims.** Since stages are node content, how they are grounded and reviewed is not
  yet settled.
- **The anchor and the redirect target.** When a divided subject replaces a compound label, old edges
  resolve through a redirect to the terminal stage, while the anchor shown by default is computed from
  which stage has the downstream edges. For fire these coincide at production. Whether they always do,
  and what should happen when they do not, has not been examined.
- **Anchor override.** Whether a pinned override is ever needed, awaiting a real case.
- **Era and shape.** Whether historical era really predicts shape, as suggested above, is a testable
  claim that has not been tested.
