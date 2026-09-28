# Essay 3 — What Constitutes a Discovery? Stages, Shapes, and the Chicken-and-Egg Problem

**Status:** Proposed

**Depends on:** Essay 1 (Founding Axioms — the origin test's own language already names several kinds
of action), Essay 2 (Node Granularity — this essay's thin/thick threshold is a direct reuse of that
essay's checklist, not a new one)

**Gates:** Essay 4 (achievement/discovery/invention depends on having a settled notion of what a
discovery-event is); interacts with Essay 6 (the _Stage_ field defined here is a new node-level
field, distinct from and orthogonal to that essay's edge-level relationship-kind), Essay 7 (basis
claims are about order and necessity between two subjects; this essay is about internal structure
within one subject), Essay 9 (grounding and pseudonymous attribution), and Essay 10 (two new
governance stress cases surfaced below); opens ground that Essay 8 will need to finish

## 1. The problem

The index posed this as a chicken-and-egg question: practical exploitation of a phenomenon routinely
precedes its theoretical explanation, sometimes by an enormous margin. Fire was controlled roughly
400,000 years before combustion chemistry existed to explain why it worked. Treating "the discovery
of fire" as one event flattens a span longer than all of recorded history into a single node, and
obscures a genuinely interesting fact: humans mastered fire in fact and used it for millennia while
being wrong, or simply silent, about why it worked.

But stress-testing this question against cases well outside fire's own domain — vaccination,
electricity, the laser, metallurgy, CRISPR, public-key cryptography, writing, money, democracy, and
cryptocurrency — showed the chicken-and-egg framing is itself too narrow. It presumes practical
mastery always comes first. Often it doesn't. The real problem is broader: **"discovery" is not one
kind of event, and the graph needs a way to represent that without turning every candidate node into
a mandatory multi-stage production.**

## 2. The resolution: an optional field, not a mandatory decomposition

> **A node has a required Subject and an optional Stage, drawn from a small, closed vocabulary. Most
> nodes carry no Stage at all. Stage decomposition is earned per Essay 2's existing granularity
> checklist, never owed by default.**

This mirrors the optionality principle Essay 6 established for edges (Section 7 there): richness is
available, not mandatory. A "discovery" is a single, undecomposed node in the overwhelming majority
of cases. Only when a subject's history genuinely contains multiple separable, datable actions —
exactly what Essay 2's checklist already looks for — does it become worth splitting into a stage
chain.

## 3. The stage vocabulary

Four stages, inherited from Essay 2's own fire case study and confirmed against several other
physical-phenomenon cases (metallurgy, electricity):

- **Observation** — a phenomenon is noticed and its regularity recognized, with no attempt yet to
    control or use it.
- **Exploitation** — the phenomenon is used or harnessed opportunistically (capturing wildfire,
    using naturally-occurring copper), without the ability to reliably produce it on demand.
- **Production** — the phenomenon can be reliably initiated or manufactured at will.
- **Explanation** — the underlying mechanism is correctly understood, independent of whether that
    understanding was needed to reach Production.

A node's display title and slug are _derived_ from the Subject/Stage pair (e.g., "Production of
Fire"), never the reverse — Stage is real structured data, not a string convention, per Essay 10's
existing precedent of identifiers being separate from display titles (Essay 10, Section 5).

**Boundary condition.** This vocabulary presumes a natural phenomenon is being mastered. Purely
conceptual or formal subjects — public-key cryptography, mathematical results generally — may have
no meaningful Observation stage at all, since there is no phenomenon to notice prior to constructing
the idea. Editors should not force a phenomenon-mastery template onto a subject that never had a
phenomenon to begin with; a formal subject may simply carry no Stage, or only Production and
Explanation, without that being an incomplete application of the vocabulary.

## 4. Shapes: how stages actually order themselves

Stress-testing found that even where all four stages meaningfully apply, they do not arrive in one
canonical order. At least four distinct shapes emerged, and they are explicitly **non-exhaustive** —
a documented set of patterns for editor intuition, not a classification an editor is required to
assign:

| Shape | Pattern | Examples |
| --- | --- | --- |
| Empirical-lag | Production precedes Explanation, often by a long span | Fire, metallurgy, vaccination/germ theory, quinine, fermentation |
| Theory-first | Explanation precedes Production, deliberately | The laser, nuclear fission, the transistor |
| Interleaved | Explanation and Production advance in alternating small steps with no clean stage boundary | Electricity |
| Iterative abstraction | No Explanation stage at all; the technique itself improves through successive generalization, each step immediately usable | Writing, money |

Two further findings sit alongside the shape list rather than inside it:

- **Shapes are not mutually exclusive.** Money is iterative-abstraction (barter → commodity →
    coinage → fiat) _and_ empirical-lag layered on top (coherent monetary theory explaining why fiat
    currency holds value arrives centuries after fiat currency was already in wide use). A subject can
    exhibit more than one shape on different axes simultaneously; editors should not feel forced to
    pick exactly one.
- **Historical era plausibly predicts shape more than the technology's nature does.** Theory-first
    looks like the default once the scientific method is itself an available, established prerequisite;
    empirical-lag looks like the default before it. This is a testable claim, not a settled one, and is
    flagged here rather than argued to conclusion.

A fifth pattern, **repurposing** — CRISPR's mechanism was observed and explained as bacterial immune
function for its own sake, then later repurposed for gene editing with no continuous line of intent
between the two — is deliberately **not** listed as a shape above. A shape describes stages _within_
one continuous subject. Repurposing describes two subjects (bacterial CRISPR immunity; CRISPR gene
editing) connected by an ordinary edge, because the observing/explaining work was never in service of
the eventual application. This is a Section 7 (thin/thick) call, not a shape question — see below.

## 5. Combination is an orthogonal axis, not a shape

Cryptocurrency showed a pattern distinct from all of the above: four mature, independently-developed
lines (public-key cryptography, Hashcash proof-of-work, Byzantine fault tolerance theory, and prior
unbuilt digital-cash proposals such as bit gold and b-money) converge into one node in a single
synthesis event, with no stage-chain internal to any of them being relevant to the convergence
itself. This is Essay 6's **combination** relationship-kind, getting its first fully worked example.
Shape answers "what happened along one line;" combination answers "how many prior lines feed this
node." The two schemas do not compete for the same cases, and an editor should not try to express
combination as a Stage.

## 6. The thin/thick threshold

Whether a candidate stage becomes its own Stage-tagged node under an existing Subject, or instead
becomes an entirely separate, independently-named Subject connected by an edge, is decided by Essay
2's granularity checklist directly — **reused verbatim, not recalibrated for this use case.** A stage
is thin (stays a modifier) when it has no independent sub-history or sourcing of its own beyond being
a phase of the parent subject's story. A stage is thick (earns its own Subject) when it has
substantial decomposable history in its own right — germ theory relative to vaccination being the
clearest case: germ theory's own prerequisite chain (microscopy, cell theory, Pasteur's and Koch's
independent work) has nothing to do with vaccination's specific history, so "Explanation of
Vaccination" is the wrong label entirely; germ theory is its own Subject, linked to vaccination by an
ordinary edge.

## 7. Rendering: a computed anchor, not a new mechanism

A stage-decomposed subject with a large internal gap (fire's ~400,000 years between Exploitation and
Explanation) does not need a new spatial or zoom-tier rendering mechanism. It is handled by the
mechanism Essay 6 already established: the stored graph is never the shown graph (Essay 6, Section
6). At default zoom, a decomposed subject displays as a single collapsed node; the underlying stage
chain, with real dates, sits behind the same inspector-panel click already used for multi-origin
attestation and stacked citations.

Which single stage node is shown as that collapsed anchor is **computed**, not editor-assigned: the
stage that actually carries the subject's downstream prerequisite edges (i.e., the stage other nodes
cite as their prerequisite) is the one rendered by default — for fire, this is expected to be
Production, since smelting requires the _capability_ to start fire, not an understanding of why it
works. This follows the same principle Essay 10 already uses for protection tier (computed from
blast radius, not hand-assigned) and is deliberately extended here: importance should fall out of the
graph's own edge structure wherever possible, rather than requiring an editor's judgment call on
every node.

An override mechanism, letting editors pin a different anchor against the computed default (parallel
to a cluster-pin feature), is deliberately **not specified here**. It should wait until real graph
data surfaces an actual case where the computed default is wrong, rather than being designed against
a hypothetical.

## 8. What this essay is not

This essay defines the Stage field, the stage vocabulary, the shapes found so far, and the rendering
rule for decomposed subjects. It deliberately does not:

- decide whether an eligible candidate is a discovery, invention, or achievement (Essay 4),
- extend this vocabulary or its shapes into the culture/social-systems layer, despite writing, money,
    and democracy all being stress-tested here — that synthesis belongs to Essay 8,
- set a citation standard for stage claims, or resolve pseudonymous attribution generally beyond the
    single case noted below (Essay 9),
- resolve the regional-lineage interaction with Essay 7, or the two new governance stress cases
    below (Essay 10).

## 9. Status and open threads

This essay is **Proposed**. The stage vocabulary and shape list have been stress-tested against
eleven subjects spanning physical phenomena, biotechnology, pure mathematics, social institutions,
and a combination case, but not yet run through this project's own debate-and-consensus process to
ratification. Several threads are flagged rather than resolved:

- **Regional-lineage interaction with Essay 7.** Unresolved whether a subject with multiple
    independent historical-attestation edges (money, agriculture) needs a separate stage chain per
    region, or whether multi-origin subjects should simply not be stage-decomposed. Left open until the
    database is populated and the interaction can be observed directly, rather than decided in the
    abstract.
- **Anchor override timing.** A pin-style override for the computed anchor stage is anticipated but
    deliberately unbuilt until a real case demonstrates the computed default is insufficient.
- **A new revert/recovery scenario for Essay 10.** Essay 9, Section 11 proposes ordinary supersession; pending adoption in Essay 10. Public-key cryptography's GCHQ precedent (Ellis
    1970, Cocks 1973) was classified and declassified only in 1997, decades after Diffie-Hellman and
    RSA were publicly credited. A historical-attestation claim can therefore be maximally well-sourced
    at the time and still be shown incomplete later through no fault of editorial process — a case
    distinct from vandalism, honest error, or ordinary contested consensus, which Essay 10's recovery
    model does not yet address.
- **A litigated-dispute stress case for Essay 10.** Essay 9, Section 12 proposes that a ruling is citable for what it decided but not deferred to; pending adoption in Essay 10. CRISPR's Broad Institute vs. UC Berkeley priority
    dispute has a binding external legal outcome. Whether this wiki's consensus process defers to that
    ruling, runs independently, or discloses a divergence is undecided.
- **Pseudonymous attribution, officially resolved.** Where a pseudonym is the commonly-credited
    attribution in mainstream literature (cryptocurrency's "Satoshi Nakamoto"), this wiki follows that
    convention per Essay 9's general policy.
- **Forward pointer to Essay 8.** Writing, money, and democracy are culture/social-systems subjects
    and this essay's use of them is exploratory, not a claim on Essay 8's territory. Two findings are
    flagged for Essay 8 specifically to take up: iterative abstraction as the apparent default shape
    for institutions with no physical phenomenon behind them, and Athenian-to-modern democracy as a
    live candidate exercise of Essay 6's "mere influence" relationship-kind, which also strains Essay
    1's non-transmissibility diagnostic (forgotten as a practiced institution for roughly two
    millennia, then independently reconstructed from historical record rather than transmitted by
    direct contact) in a way that essay's existing edge cases do not cover.
