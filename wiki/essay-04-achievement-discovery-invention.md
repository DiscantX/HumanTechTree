# Achievement vs. Discovery vs. Invention

**Status:** Proposed

Every [node](essay-00-about-the-project.md#glossary) on the graph is a discovery, an invention, or an
achievement, and this policy defines the three.

- **Discovery** reveals something that already existed.
- **Invention** creates something that did not exist before.
- **Achievement** is a separate category: an existing, unchanged capability exercised to a
  superlative degree, meaning fastest, highest, farthest, first, or only, without producing any
  technique or artifact that other nodes could build on.

Anything that fits none of the three is not a node. "Technology" is an everyday word for what
discoveries and inventions jointly produce, and it is not a category in this schema. A candidate's
importance is a separate matter from its category.

## Why the categories are needed

The project began with an intuition that the stratosphere jump of 2012 was something new in human
history, and that it was a different kind of thing from the discovery of fire or the invention of a
particular device. The graph needs a way to say what that difference is.

The categories also do structural work. The second rule in [Founding Axioms](essay-01-founding-axioms.md)
admits a candidate to the graph only if it is itself a discovery, invention, or achievement. That
rule is only as clear as these definitions.

## Discovery and invention: the pre-existence test

> **Discovery reveals something that already existed. Invention creates something that did not exist
> before.**

Pre-existence is the only test. What a discovery reveals, such as a natural law or a substance, sits
on the floor described in Founding Axioms, and the *act of discovering it* is what becomes the node.
Penicillin is a discovery because the antibacterial compound already existed in nature and Fleming
revealed it. The electric light bulb is an invention because no such artifact existed before Edison's
group built it.

The test applies cleanly to mathematics and other formal subjects, consistent with ordinary usage. A
mathematician *discovers* a theorem, since it was always true, while a specific proof technique or
notation system can be *invented*.

Two refinements were considered and rejected.

- **Intentionality.** One might separate accidental from deliberate results, saying Fleming's finding
  was a discovery because he was not looking for it, while Edison's was an invention because he was
  searching. Pre-existence already explains both cases without it. No case has appeared where two
  candidates are equally pre-existing or not and can be told apart only by intent, so intent is not a
  criterion.
- **"Technology" as a fourth value.** Once discovery and invention are defined, "technology" does no
  discriminating work of its own.

## Achievement

Achievement cannot be defined by where a node sits in the graph. It is tempting to say that
achievements are the leaf events, with nothing downstream, and discoveries and inventions are the
capabilities others build on. But every node, including a true discovery, has no incoming
prerequisite citations at the moment it is created, because nothing downstream exists yet to cite it.
Being a leaf cannot tell an achievement from a discovery that has simply not been cited yet. The
category needs an intrinsic test, one that can be applied on the day a candidate is created and does
not depend on how populated the surrounding graph is.

> **An achievement is an event in which an existing, unchanged capability is exercised to a
> superlative degree, producing no technique, method, or artifact that any other node could inherit.**

The key idea is that the capability is *constant*: it is identical before and after the event. This is
what separates a true achievement from the "first working instance" of a new technique, which
resembles one because both can be described as firsts.

Out-degree remains useful, but only as a standing sanity check, using the same pattern of an
automatic flag for human review that appears in
[Governance and Moderation for a Living Graph](essay-10-graph-governance-and-moderation.md). If a node
tagged as an achievement later gains an incoming prerequisite edge, that does not show the category is
broken. It signals one of two things: the node was misclassified when it was created, or it is a
genuine case where the doing and the knowing turned out to be inseparable. That exception is examined
in the policy on whether an achievement can become a genuine prerequisite.

## Worked cases

| Case | Category | Reasoning |
| --- | --- | --- |
| Four-minute mile (Bannister, 1954) | Achievement | Running, unchanged, exercised to a record |
| Moon landing (1969) | Achievement | Assembled existing technology and exercised it toward a destination |
| Stratosphere jump (Baumgartner, 2012) | Achievement | Existing technology pushed to a physical extreme |
| Sound barrier (Yeager, 1947) | Achievement, flagged | Same shape as the above, but the record suggests it fed back into supersonic aerodynamics, which is the designed exception rather than the default |
| Circumnavigation (Magellan and Elcano, 1522) | Achievement | Existing navigation and shipbuilding exercised as a journey |
| Everest (Hillary and Norgay, 1953); South Pole (Amundsen, 1911) | Achievement | Existing climbing and expedition technique |
| Kasparov vs. Deep Blue (1997) | Achievement | An existing chess-engine capability exercised as a benchmark |
| Smallpox eradication | Achievement | An existing vaccine capability exercised to an only-ever degree, with no new technique produced |
| First heart transplant (Barnard, 1967) | Invention | The technique itself was new and was reused later, so the capability is not constant across the event |
| Fusion ignition | Invention | Like the heart transplant: enormous in the everyday sense, but the capability itself is what is new |
| Settling a major open problem, such as Navier–Stokes | Discovery | Reveals a pre-existing mathematical truth. Its significance is real, and is shown by the spotlight mechanism and not by its category |
| Dartmouth Conference (1956) | None of the three | See below |

## What fits none of the three

The Dartmouth Conference exercised no capability at any degree and produced no technique. It is not a
discovery, an invention, or an achievement, and so it is not a node. Its content becomes descriptive
context on whichever real node it contributed to. This is the same treatment
[Node Granularity](essay-02-node-granularity.md) gives a bare concept with no artifact behind it.

A significant discovery or invention is never relabeled as an achievement to capture its importance.
Magnitude and category are independent. The planned Spotlight / Feed Mechanism policy is the intended
home for "this is a big deal."

## Category is separate from stage

[What Constitutes a Discovery?](essay-03-what-constitutes-a-discovery.md) defines an optional *stage*
for a subject with a phenomenon-mastery history: observation, exploitation, production, or
explanation. Category is a separate field, applied independently and not read off which stage a
subject has reached. Fire's own stage chain shows this.

| Stage | Category | Reasoning |
| --- | --- | --- |
| Observation | Discovery | Reveals that the phenomenon exists |
| Exploitation | Ambiguous | The phenomenon itself pre-exists, which is discovery-like, but capturing and tending it is arguably a created technique, which is invention-like |
| Production | Invention | A repeatable method that did not exist before |
| Explanation | Discovery | Reveals a pre-existing mechanism |

Three of the four stages resolve cleanly. Exploitation does not, and is left as an open question and
not forced to a premature answer.

## Category at the level of a subject

A compound subject that has not been divided into stages, and whose eventual stages would span more
than one category, is not forced into a single category before it is divided. Fire is the example,
with production being invention and explanation being discovery. Its subject-level category is read as
**Disambiguation**. This is a computed value, determined by whether the subject has, or would have,
stage children spanning more than one category. It is not a placeholder guessed by an editor. This
follows the principle, also used for the anchor stage in What Constitutes a Discovery?, that
classification should fall out of the graph's structure wherever possible and not require a judgment
call on every node.

The exception is the shadow node described in Founding Axioms, the node for the understanding of
something that sits on the floor. A shadow node has no stage chain to compute a category from, so its
category, discovery or invention, is assigned by an editor.

## What this policy does not decide

- The Exploitation-stage ambiguity above.
- Whether combination nodes, where several independent lines converge, default to invention or can
  also be discoveries. This is left open until there is real graph data.
- How significance is shown. That belongs to the planned Spotlight / Feed Mechanism policy, which is
  editor's choice and non-load-bearing, since nothing structural depends on it.
- Whether an achievement flagged by the sanity check is reclassified automatically or only reviewed.
  That belongs to the policy on whether an achievement can become a genuine prerequisite.
- What separates a genuine achievement from a manufactured record. A genuine achievement pushes
  against a dimension that was already meaningfully constraining before someone beat it, while a
  manufactured record invents an arbitrary contest category. This heuristic is candidate material for
  the planned Notability / Inclusion Threshold policy.

## Open questions

- **Exploitation.** Capturing and tending a natural phenomenon is ambiguous between discovery and
  invention on the one worked example so far. More stage-divided subjects are needed before a rule, if
  any, is worth writing.
- **Combination nodes.** Whether they default to invention or can be discoveries.
- **The name "Achievement."** In ordinary speech it implies magnitude, which this category
  deliberately excludes. A name such as "Feat" or "Milestone" might avoid the confusion. This is not
  urgent.
- **A clean combination case.** The categories have been tested against a range of historical and
  plausible future cases, but not yet against a combination case of the kind the Edge Schema's
  relationship-kinds still need.
