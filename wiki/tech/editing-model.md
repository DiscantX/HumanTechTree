# Editing Model

**Status:** Proposed

[Governance and Moderation for a Living Graph](../policy/graph-governance-and-moderation.md) left one
question open from the start: should the graph stay branch-and-merge, or move toward a model closer to
Wikidata's, where each statement is independently addressable and contested claims coexist without a
resolved merge? [Database Choice](database-choice.md) did not settle this directly, but it removed one
of the two live options from serious contention, which is where this essay picks up.

## The position

> **Branch-and-merge is adopted as the concurrency and versioning mechanic, using TerminusDB's native
> commit/branch/diff/merge model. The atomic-statement model's real advantage, low collision between
> unrelated edits, is captured separately, by keeping the stored unit as fine-grained as the Edge
> Schema and Sourcing policy already require: one claim is one document.**

This is a narrower conclusion than it looks. It does not resolve every open question Governance and
Moderation left on the table (soft-flag versus hard-block for cycles, for instance, stays open below).
It resolves specifically which concurrency mechanic the graph runs on.

## Why the fork narrowed

[Database Choice](database-choice.md) rejected Wikibase as the data layer, for reasons independent of
this question: its schema has no native concept of basis, grounding, or claim-level review, and its
primary storage is not built for the bulk graph reads this project needs as an ordinary access pattern.
TerminusDB was adopted instead, and TerminusDB's whole identity as a store is its git-like
commit/branch/diff/merge model. Adopting the atomic-statement model on top of it would mean either
fighting the tool (suppressing the branch/merge machinery TerminusDB is built around, to simulate
Wikidata's immediate-publish, statement-coexistence behavior instead) or re-deriving Wikibase's actual
architecture by hand on a store that was specifically chosen because it already solves version control
natively. Neither is a sound use of the choice already made.

So the real question this essay answers is narrower than "branch-and-merge or atomic statements,
considered fresh." It is: given TerminusDB, does anything about the atomic-statement model's appeal
still need capturing, and if so, how, without abandoning the store's native mechanic?

## What atomic statements were actually solving

Wikidata's model is attractive for a specific reason, not for atomicity as an end in itself: a large,
loosely coordinated editor population makes many small, mostly-unrelated edits, and a model where each
statement is independently addressable means most of those edits never contend with each other at all.
Two editors adding unrelated facts about different subjects never see a merge conflict, because there
was never a shared unit of storage for their edits to collide inside.

That property does not require abandoning branch-and-merge. It requires the *unit* being merged to be
fine-grained enough that unrelated edits land in different documents. This project already has that
unit, independent of this essay: [Edge Schema](../policy/edge-schema.md) establishes that an edge is a
single claim, and [Sourcing and Citation Policy for Edges](../policy/sourcing-and-citation-policy.md)
treats each claim as the thing that is grounded, reviewed, and disputed on its own. Storing each edge
as its own TerminusDB document, rather than as an entry in some parent node's array field, means two
editors working on different claims, even different claims about the same pair of nodes, rarely touch
the same document. The collision-reduction benefit is captured at the storage-granularity level, not
at the concurrency-model level.

## Where real conflicts still happen, and how they resolve

Fine granularity does not eliminate conflicts, it narrows what counts as one. Two editors changing the
same field of the same claim, such as both proposing a different basis for the same edge, is a genuine
field-level collision, and it resolves exactly the way TerminusDB already handles it: an ordinary merge
conflict, surfaced to whoever is merging the branches, with no new machinery needed.

What fine granularity does not touch at all is **emergent invalidity**: two edits, each individually
valid, on different documents, that combine into an invalid graph, such as two logical-necessity edges
formed independently that together produce a cycle. Governance and Moderation already assigns this to a
post-merge validation gate rather than to the merge mechanism itself, and nothing here changes that
division of labor. Fine-grained storage reduces how often editors fight over the same object; it says
nothing about whether the union of everyone's edits is a coherent graph, which stays the Validation
Gate's job regardless of storage granularity.

## Branch-and-merge also fits the protection-tier model already adopted

Governance and Moderation's protection tiers require that structural edits to high-blast-radius items
get more review before landing, and that low-permission accounts may propose structural edits but not
land them directly. That requirement maps naturally onto branch-and-merge: a proposed edit is a branch,
review happens before a merge to the main line, and the amount of required review scales with the
target's blast radius exactly as already specified. Wikidata's model publishes a statement immediately
and flags problems after the fact through constraint-violation reports, which is a coherent design on
its own terms but does not have a native pre-publication review gate to retrofit the protection-tier
requirement onto. This is a second, independent reason branch-and-merge fits better with decisions this
project has already made, not just a consequence of the database choice.

## What this essay does not decide

- Whether cycle detection hard-blocks a merge or soft-flags it for human attention. Left open in
  Governance and Moderation and not resolved here; branch-and-merge with post-merge validation supports
  either policy equally, so this choice does not force that one.
- The specific checks the validation gate runs, or when they run relative to a merge. That belongs to
  the tech index's Validation Gate essay.
- The concrete review-tier thresholds (how many reviewers, what blast radius triggers what tier). That
  belongs to Sourcing and Citation Policy for Edges and Governance and Moderation.
- The exact branch workflow (personal branches per editor, feature branches per proposed change, or
  something else). See open questions.

## Open questions

- **Branch workflow.** Whether low-permission editors work in individual branches merged by reviewers,
  or something closer to Wikipedia's direct-edit-with-revert model layered on top of TerminusDB's
  branches, is not decided. This has real UX consequences (how a casual editor experiences "proposing a
  change") that have not been worked through.
- **Whether one-claim-per-document actually delivers the assumed collision reduction.** This essay's
  central move rests on an assumption about real editing patterns that has not been tested against
  actual concurrent edits. It is a natural companion to the prose-merge test already planned for
  [Database Choice](database-choice.md), and should probably be tested alongside it rather than
  separately.
- **Whether this reasoning extends cleanly to wiki-mechanic content.** The collision-reduction argument
  depends on the graph's claims already being naturally fine-grained, one edge per document. Talk-page
  and policy-page prose has no equivalent natural unit smaller than "the page" or "the section," so
  this essay's argument applies cleanly to graph data and only weakly, if at all, to prose. That gap is
  the same one Architecture Overview flags between the data layer and wiki mechanics, and it is not
  resolved here.
- **This essay's own depth.** Unlike Database Choice, this position follows more from a prior decision
  (TerminusDB) than from its own independently worked debate. It is worth deliberately stress-testing
  before treating it as equally settled.
