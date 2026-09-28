# Historical Attestation vs. Logical Necessity

**Status:** Proposed

Every [edge](essay-00-about-the-project.md#glossary) on the graph makes one of two kinds of claim,
called its *basis*.

- **Historical attestation** is a dated, regionally located claim that one thing preceded and enabled
  another in the actual historical record.
- **Logical necessity** is a timeless claim that one thing cannot exist, for any civilization, human or
  not, unless the other has been achieved first.

Neither implies the other. Where both apply to a pair of nodes, the pair carries two edges. Where
neither applies, there is no edge. A technology that arose independently in several places is one node,
with one historical-attestation edge for each origin and at most one logical-necessity edge. In this
way the graph can record both what actually happened and what had to be so, without merging the two
into a single claim.

## Why the graph needs both

The question can be put as an either/or: does the graph track actual human history, or the timeless
logic of what depends on what, regardless of how humanity happened to discover things? Taken alone,
each answer fails in its own way.

Tracking only history is easy to source, since it is simply what happened, in what order, per the
record. But it describes accident and not necessity. It cannot tell "X happened before Y" from "Y truly
required X." It also handles independent discovery awkwardly. If agriculture arose several times, a
purely historical graph must either pick one lineage arbitrarily or hold several separate claims with
no clean way to say they are the same underlying technology.

Tracking only logic is closer to what a tech-tree reader most wants to know, which is what any
civilization would need before what. But it is largely uncitable by construction. Nobody has published
a paper proving that fire is logically necessary before smelting. That inference would be the wiki's
own, dressed up as if it were reported fact.

The resolution is to keep both, as separate claims about the same pair.

## Two bases, one claim each

> **An edge's basis is single-valued: either historical attestation or logical necessity. Where both
> claims apply between a pair of nodes, they are two independent edges, each true or false on its own.**

**Historical attestation** is a specific claim, backed by ordinary historical sourcing, that X preceded
and enabled Y in the real causal record. It can be false in one region and true in another for the same
pair of nodes, and it can appear more than once per pair. To keep several apart, each historical edge
carries an *origin* attribute naming its region or instance.

**Logical necessity** is a general proposition that Y cannot exist without X having been achieved
first, whatever order any actual civilization discovered them in. It does not multiply. There is
exactly one such claim per pair, contested and revised in place and never duplicated, as set out in the
[Edge Schema](essay-06-edge-schema.md).

The combinations are expressed entirely by which edges exist.

- **Both edges.** The pair records the actual sequence and the necessary dependency. This is the
  strongest case.
- **Historical attestation only.** An accident of sequence: it happened in this order, but nothing
  prevented a different order in principle.
- **Logical necessity only.** A physical or logical constraint argued on its own terms, where fine-grained
  dating evidence does not exist or has not been added yet.
- **Neither.** There is no edge.

"Neither" means that no claim of either kind is being made. It is different from an edge whose basis is
left unspecified, which the Edge Schema allows: that is a claim that one node was a prerequisite of
another without saying on which basis.

## The two bases are sourced differently

Historical-attestation claims are usually directly citable, since dating and sequencing is what
archaeology and history routinely produce. Logical-necessity claims range across a spectrum. Some are
directly citable physical facts. That smelting copper requires sustained temperatures achievable only
through controlled combustion or an equivalent heat source is a checkable metallurgical claim. Others
are much larger inferential leaps for which the wiki has no citation at all, such as the fully general
"any conceivable civilization would need this" version of a claim.

The wiki must show where a given claim sits on that spectrum and not hide it. The sourcing policy does
this by allowing a claim to rest on an argument whose premises are each sourced, and by displaying
exactly which premises lack support. That policy also treats the two bases differently in one respect:
a logical-necessity claim resting only on an argument is normal, while a historical-attestation claim
resting only on an argument is flagged as suspect, since history is an external fact the wiki should
not be inventing. See [Sourcing and Citation Policy for Edges](essay-09-sourcing-and-citation-policy.md).
Disputes follow the same split: historical claims lean on ordinary verifiability, and necessity claims
lean on argued soundness, as described in
[Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md).

## Independent discovery without new machinery

The general capacity is one thing even where its instances are many. This is the same move
[Founding Axioms](essay-01-founding-axioms.md) and
[The Culture / Social-Systems Layer](essay-08-culture-social-systems-layer.md) make for language and
other institutions. A technology with several independent origins is **one node**, with **one
logical-necessity edge** to a given prerequisite, if any, and **one historical-attestation edge per
independently attested origin**.

- **Agriculture** is one node. Historical-attestation edges from wild-cereal exploitation to
  agriculture exist separately for the Fertile Crescent, China, Mesoamerica, New Guinea, and sub-Saharan
  Africa, each dated, sourced, and given its own origin attribute. One logical-necessity edge, that
  agriculture requires a domesticable plant or animal population and settled observation of its cycle,
  sits beside all of them without having to pick one region as *the* true origin.
- **Writing** is one node, with independent historical-attestation edges from cuneiform, Chinese
  script, and Mesoamerican glyphs.

This also resolves what earlier discussion called *islands*. A node whose only edges are
historical-attestation edges, with no connection to another region's parallel development, is not a
defect to be patched by inventing a causal link that never existed. It is the graph correctly
representing convergent invention. Mesoamerican technology before contact with the Old World may remain
permanently disconnected from a parallel lineage if no contact or diffusion ever occurred.

## When to split a node instead

Independent origin alone is never a reason to split a node. It is a reason to add a
historical-attestation edge. A split requires the further conditions in
[Node Granularity](essay-02-node-granularity.md): that the mechanisms themselves differ, and that each
side has decomposable history of its own. Where a specific lineage does have such history, the
subdivision is triggered by that history and not by the fact of independent origin. Oracle-bone
script's evolution genuinely differs from cuneiform's, for example. The Culture / Social-Systems Layer
applies the same test to democracy and concludes that Athenian and modern democracy are two separate
subjects.

## Claims that later prove incomplete

Because historical-attestation claims describe the record as sources report it, a well-sourced claim
can later be shown incomplete through no fault of anyone. The classic case is public-key cryptography,
where the work of Ellis and Cocks at GCHQ in the early 1970s was classified and declassified only in
1997, decades after Diffie-Hellman and RSA were publicly credited. The governance policy handles this
as an ordinary correction, not as an emergency.

## What this policy does not decide

- The vocabulary of relationship-kinds, which belongs to the Edge Schema.
- The citation standard for either basis, which belongs to the sourcing policy.
- Who may create or dispute a logical-necessity claim, or how a dispute resolves, which belongs to the
  governance policy.

## Open questions

- **"Any civilization, human or not."** The phrasing is deliberately general. It interacts with the
  point in Founding Axioms that part of the floor may depend on which species is building the tree. If
  that dependence is real, some logical-necessity claims made today would need revisiting, and the
  question of whether the floor should be recorded in two layers bears directly on how those claims are
  phrased.
- **Few tested cases.** The two-basis model has mostly been tried on fire and smelting, agriculture,
  writing, and democracy. More concrete edge pairs are needed.
- **Multiple origins and stages.** If a subject such as money or agriculture is also divided into stages
  (see [What Constitutes a Discovery?](essay-03-what-constitutes-a-discovery.md)), does each
  independently attested origin need its own stage chain, or should multi-origin subjects be left
  undivided? This is left open until the graph is populated.
