# Essay 7 — Historical Attestation vs. Logical Necessity (the Alien Civilization Question)

**Status:** Proposed

**Depends on:** Essay 1 (Founding Axioms), Essay 6 (Edge Schema — this essay assigns values to the
*basis* field that essay defines)

**Gates:** Essay 2 (interacts with the node-splitting decision for independently-discovered
technologies), Essay 9, and
loosens the constraint the original index placed on Essay 8

## 1. The problem

The index originally posed this as a single either/or question: does the graph track actual human
history, or timeless logical necessity independent of how humanity happened to discover things?
Both readings, taken alone, fail differently.

Pure historical tracking is easy to source — it is simply "what happened, in what order, per the
record" — but it is an account of accident, not necessity, and it cannot distinguish "X happened
before Y" from "Y truly required X." It also handles independent discovery awkwardly: if agriculture
arose seven times, a purely historical graph either has to pick one lineage arbitrarily or represent
seven separate claims with no clean way to say they are the same underlying technology.

Pure logical tracking — "any civilization would need X before Y, regardless of when either was
achieved" — is closer to what a tech-tree audience actually wants to know, but it is largely
uncitable by construction. Nobody has published a paper proving fire is logically necessary before
smelting; that is an inference this wiki itself would be making, dressed up as if it were reported
fact.

## 2. The resolution: single-valued basis and the two-edge treatment of "both"

> **An edge's basis is single-valued, taking either historical-attestation or logical-necessity as its value. Where both claims apply between a node pair, they are represented by two independent edges — one historical-attestation edge and one logical-necessity edge (Essay 9), true or false independently of each other.**

**Historical-attestation** is a specific, dated, regionally-located claim that X preceded and
enabled Y in the actual causal record, evidenced by ordinary historical sourcing. It carries an origin attribute to distinguish multiple independent historical origins (Section 4). It can be false in one region and true in another for the same node pair, and it can appear more than once per pair.

**Logical-necessity** is a general, timeless proposition that Y cannot exist — for any civilization,
human or not — without X having been achieved first, independent of the order in which any actual
civilization discovered them. It does not multiply; there is exactly one such claim per node pair,
contested and revised in place rather than duplicated (Essay 6, Section 4).

Neither implies the other, and their presence is modeled purely through independent edges:
- **Both present:** Represented by two separate edges between the pair (one historical-attestation, one logical-necessity), capturing both actual temporal sequence and necessary dependency.
- **Historical-attestation only:** An accident of sequence: it happened in this order, but no necessary constraint prevented a different order in principle.
- **Logical-necessity only:** A physical or logical constraint argued on its own terms, where fine-grained dating evidence for the actual historical sequence does not exist or has not been added yet.
- **Neither:** No edge present.

## 3. The citability asymmetry between the two bases

Historical-attestation claims are usually directly citable: dating and sequencing is what
archaeology and history routinely produce. Logical-necessity claims range across a spectrum —
some are directly citable physical facts (smelting copper requires sustained temperatures achievable
only through controlled combustion or an equivalent heat source, which is a checkable metallurgical
claim), while others are much larger inferential leaps this wiki has no citation for at all (the
fully general "any conceivable civilization would need this" version of the claim). Essay 9 will
need to reflect this spectrum rather than treating all logical-necessity
claims uniformly — this essay only establishes that the spectrum exists and that the wiki
must disclose, not obscure, where a given claim sits on it.

## 4. Multiple independent discovery, resolved without new machinery

This is the same move Essay 1 already made for language: the general faculty is one thing even
though specific instances are many. Applied here — a technology with several independent origins
is **one node**, carrying **one logical-necessity edge** (if any) to a given prerequisite, and
**one historical-attestation edge per independently-attested origin**.

- **Agriculture**: one node. Historical-attestation edges from wild-cereal exploitation to
  agriculture exist separately for the Fertile Crescent, China, Mesoamerica, New Guinea, and
  sub-Saharan Africa, each dated and sourced to its own region and carrying an origin attribute that distinguishes it (Essay 9). A single logical-necessity edge
  ("agriculture requires a domesticable plant or animal population and settled observation of its
  cycle") can sit alongside all of them without needing to pick one region as *the* true origin.
- **Writing**: one node, with independent historical-attestation edges from cuneiform,
  Chinese script, and Mesoamerican glyphs. Where a specific lineage has enough distinct
  sub-history to be worth decomposing on its own terms — oracle-bone script's evolution genuinely
  differs from cuneiform's — that decomposition is a job for Essay 2's granularity checklist,
  triggered by the sub-history itself, not by the fact of independent origin.

This also resolves what earlier discussion called "islands": a node whose only edges are
historical-attestation edges with no connection to another region's parallel development is not a
defect to be patched by inventing a causal link that never existed. It is the graph correctly
representing convergent invention, and it may remain permanently disconnected from a parallel
lineage if no contact or diffusion ever occurred.

## 5. What decides a node split instead of an added attestation

Deferred entirely to Essay 2. This essay's only claim is that independent origin, by itself, is
never sufficient reason to split a node — it is sufficient reason to add a historical-attestation
edge. A split additionally requires the kind of decomposable, culturally-variable sub-history Essay
2 already looks for in any candidate node.

## 6. What this essay is not

This essay defines the two basis values and how they combine. It deliberately does not:

- define the relationship-kind vocabulary (Essay 6),
- set citation standards for either basis value (Essay 9),
- decide who may create or dispute a logical-necessity claim, or how that dispute resolves (Essay
  10).

## 7. Status and open threads

This essay is **Proposed**. Two threads are flagged rather than resolved here:

- The "any civilization, human or not" phrasing in the logical-necessity definition is
  deliberately general, per the original alien-civilization framing in the index. It interacts with
  Essay 1, Section 5's point that the floor itself is contingent on which species is building the
  tree — if a future biological change altered what counts as an endowment, some logical-necessity
  claims made today might need to be revisited, not just historical ones. This interaction is
  noted, not resolved.
- This resolution has so far only been stress-tested against fire/smelting, agriculture, and
  writing. Further debate against additional concrete edge pairs is expected before ratification.
- Essay 3's stress-testing surfaced a possible tension with Section 4's multi-origin handling: if a subject like money or agriculture is also stage-decomposed (Essay 3), it is unresolved whether each independently-attested regional origin needs its own stage chain, or whether multi-origin subjects are better left undecomposed. Left open until the graph is actually populated and the interaction can be observed.
- A new failure mode distinct from ordinary citation-updating: public-key cryptography's GCHQ precedent (Ellis 1970, Cocks 1973) was classified and only declassified in 1997, decades after Diffie-Hellman/RSA were publicly credited. This is a historical-attestation claim that was true all along and became verifiably incomplete only through declassification, not through new discovery or editorial error — a case Essay 9 and Essay 10's revert model should both be aware of.
