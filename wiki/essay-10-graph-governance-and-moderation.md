# Governance and Moderation for a Living Graph

**Status:** Proposed

A graph can break in ways a text encyclopedia cannot, and this essay sets out how the project keeps
its graph sound while anyone can edit it. The policy has five parts.

- **Automatic checks** run after every merge and catch problems no single edit shows.
- **Protection scales with how much depends on an item.** Central nodes and edges need more review
  than peripheral ones, and the level is computed, not assigned by hand.
- **Nothing with dependents is deleted outright.** Most requests to delete are really requests to
  merge or rename.
- **Every edit is reversible**, and later evidence that overturns a well-sourced claim is handled as
  ordinary correction, not as an emergency.
- **Disputes are objections to a specific piece of support**, not open-ended arguments about a whole
  claim.

The essay draws on the definitions in [About the Project](essay-00-about-the-project.md#glossary).

## Why a graph needs its own governance

Conflict resolution on a text wiki, with diffs, talk pages, reverts, and consensus, is a largely
solved problem. Graph editing raises two problems that text editing does not.

- **Emergent invalidity.** Two edits can each be valid, touch different nodes with no overlapping
  fields, and still produce an invalid graph. The clearest case is a cycle formed from two edges added
  independently by two editors who never saw each other's change.
- **Catastrophic blast radius.** A handful of very central nodes, such as fire or the internet, can
  do far more damage if deleted, corrupted, or quietly rewired than any single page on a text wiki,
  whether the cause is malice or an honest mistake.

## Concurrent edits and automatic checks

The graph is stored in a versioned, git-like data store. Concurrent edits are resolved by
branch-and-rebase: each editor's changes are replayed onto the target branch, and a genuine
collision, two editors changing the same field of the same node or edge, appears as an ordinary merge
conflict. The choice of a versioned store solves this part without new policy.

What the store does not catch is emergent invalidity across edits that do not overlap. That needs an
explicit validation gate, written as application code, that runs after every merge and before
publication.

- **Cycle check.** Logical-necessity edges must not form a cycle. Historical-attestation edges are
  dated and cannot form a problematic cycle in the same sense. Edges with an unspecified basis are
  excluded, as the [Edge Schema](essay-06-edge-schema.md) provides.
- **Dangling-edge check.** No edge may point at a node that no longer exists unless the identifier
  resolves through a redirect.
- **Orphan check.** Flags nodes that plausibly should have a prerequisite and do not. This goes to
  patrollers for attention and never rejects an edit automatically.
- **Basis-fit check.** Flags a historical-attestation claim supported only by an argument, since
  history is an external fact the wiki should not be inventing. It surfaces the mismatch to editors and
  never blocks the edit. See [Sourcing and Citation Policy for Edges](essay-09-sourcing-and-citation-policy.md).
- **Premise-dependency check (proposed).** An argument can cite another claim in the graph as a
  premise. If that claim is later overturned or deleted, the argument silently breaks. The proposed
  check flags dependent arguments when a claim they rely on changes, in the same way the dangling-edge
  check protects edges.

The same pattern of a computed check that flags something for a human, without blocking anyone,
recurs elsewhere in the project. An Achievement node that later gains an incoming edge is flagged for
review, as described in
[Achievement vs. Discovery vs. Invention](essay-04-achievement-discovery-invention.md). A named
cluster whose algorithmic membership drifts from what an editor pinned is flagged to editors only, as
described in [Node Granularity](essay-02-node-granularity.md). Automatic checks handle the mechanical
load, and human moderators are reserved for judgments a script cannot make, such as whether a claim
records genuine necessity or mere sequence.

## Protection scaled to blast radius

The **blast radius** of a node is the number of its transitive descendants, meaning everything that
would be affected if it were wrong. Its in-degree is a cheaper proxy. The blast radius of an edge is
the transitive descendant count of its downstream node, since that is what breaks if the claim is
wrong. Both are computed automatically and never hand-assigned.

Protection follows directly from that number.

- **Structural edits** (adding, removing, or re-pointing an edge) to a high-blast-radius item require
  higher-permission editors and more review.
- **Textual edits** to a node's description do not face the same tier, since a bad description is a
  smaller problem than a bad edge.
- **The number of independent reviews** a claim needs is computed from its blast radius, with a
  minimum number of human reviews that rises with it. The review rules themselves are defined in
  Sourcing and Citation Policy for Edges.
- **New or low-permission accounts** may propose structural edits for review but not land them
  directly, because a bad graph edit can cause quieter, farther-reaching damage than a bad text edit.

How many permission tiers exist, who is eligible to review at each, and who may grant administrator
status are not decided here (see the open questions).

## Deletion

No node with existing dependents may be hard-deleted. The requester must first re-parent or
explicitly flag every dependent edge. That is an active, forced step, not a passive block. A
mandatory impact report must be shown before a deletion or move can even be submitted, giving the
transitive descendant count and naming which high-profile nodes are among them.

In practice most legitimate "this should not exist" cases are mis-splits and should go to merge or
rename. If re-parenting forty edges shows they all belong on another node, that is usually evidence
the node should have been merged into that other one, which is a question for
Node Granularity. True hard deletion is reserved for nodes with no
legitimate dependents, which by construction describes spam and vandalism far more often than a real
technology someone got wrong.

## Stable identity and redirects

Node identifiers are stable and separate from display titles and slugs. A move, rename, or merge
leaves a redirect at the old identifier. Edges reference identifiers, never display titles, so moving
a node never requires rewriting the edges that point at it.

Redirects are also how a compound label that has been decomposed keeps working. When a broad topic
such as fire is split into a chain of stages, the old identifier redirects to the terminal node, the
one representing the capability fully realized, so existing edges that cited the compound label still
resolve. Whether such a re-pointing changes what a reviewed claim says is an open question below.

## Recovery: reverting, and what reverting cannot do

Because the store is immutable and commit-based, reverting a bad edit is technically cheap regardless
of intent. This fully answers the concern about malicious edits.

It does not answer the harder case. If a bad edit stood long enough for good-faith work to be built on
top of it, a revert now conflicts with that legitimate work, the same revert-war problem that text
wikis face on busy pages. The database does not solve this. It is mitigated by protection tiers, which
catch bad edits sooner on high-blast-radius items before anything is built on them, and by bot patrol
of those items.

A well-sourced claim that later evidence shows to be incomplete is a different case and is not
handled as a revert. Public-key cryptography's GCHQ precedent is the model. Ellis and Cocks worked out
the essentials in the early 1970s inside a classified program, but the work was declassified only in
1997, long after Diffie-Hellman and RSA were publicly credited. A claim that credited only the public
researchers was accurate to the public record and later shown incomplete, through no editorial
fault. It is corrected by ordinary supersession: the claim is edited, the substantive edit invalidates
existing reviews, and the version history preserves what was previously believed. This is distinct
from vandalism, honest error, and contested consensus. Claims of the form "first to" or "only" are the
most exposed, since they are claims of absence and the record that would refute them may not yet exist.

## Disputes

A genuine disagreement that is not vandalism, such as whether pottery is downstream of agriculture or
parallel to it, is handled as an **objection**: a specific challenge to a premise, an inference step,
or the fit between a source and the premise it is cited for. It is not an open-ended debate about a
whole claim.

- **An open objection keeps a claim from displaying above yellow** and marks it as contested until
  the objection is resolved. This follows from the review rules in
  Sourcing and Citation Policy for Edges.
- **An objection is resolved** when it is withdrawn, when the grounding is amended to answer it, or
  when eligible reviewers judge it answered. An amendment that changes the formal structure of a
  grounding invalidates existing reviews, and prior reviewers may re-attest against the difference.
  How objections are structured on the page is the job of the planned Argument Page Format policy.
- **The grounding standard depends on the basis.** Relationship-kind and historical-attestation
  disputes lean on ordinary verifiability. Logical-necessity disputes lean on argued soundness, since
  a citation frequently does not exist at all. See
  [Historical Attestation vs. Logical Necessity](essay-07-historical-vs-logical-necessity.md).
- **A resolved dispute over a logical-necessity claim is disclosed as this wiki's own argued
  position.** It is not presented as settled scholarship the literature has already agreed on. A fully
  grounded claim shows what it rests on. It does not certify that the claim is true.

**External rulings.** Some disputes have been settled outside the wiki. The priority dispute between
the Broad Institute and UC Berkeley over CRISPR has a binding legal outcome. A court ruling is a
reliable source for what the court decided, and may be cited as such. It is not automatically a source
for who invented the technology, because a legal standard of priority and a historical account of
invention are different propositions. The wiki's own claim about priority is grounded separately, by
the same means as any other claim. Where the two diverge, the divergence is disclosed in a free-text
annotation on the claim, which does not reset reviews. The wiki neither defers to the ruling nor
ignores it.

## Bots

Automated accounts are allowed, and mechanical work such as fetching a source and checking that it
says what a premise claims suits automation well. Bots follow the same rule as any low-permission
account: they may propose structural edits, and review and verification are the actions within their
authority by default. Bot patrol is used on high-blast-radius nodes in particular. The full policy,
including independence rules for bot reviewers and whether the API opens to other operators, belongs
to the planned Bot and Automation Policy. The constraints the review mechanism needs are set out in
Sourcing and Citation Policy for Edges.

## Keeping the moderation load proportional

The Edge Schema establishes that no edge field ever has to reach a settled
state to be valid. That answers the worry that a rich schema makes the graph impossible to moderate. It
does not, provided effort goes to contested and high-blast-radius items and not to pushing every edge
toward full specification. A niche, uncontested edge sitting permanently at its cheapest state is not
technical debt. It is the healthy state for most of the graph. The rule that parallel edges are drawn
as a single line also helps patrollers, who have less to parse when reviewing recent changes.

## What this essay does not decide

- The definitions of grounding, review, and status, which belong to
  Sourcing and Citation Policy for Edges.
- The long-run editing architecture (see the open questions).
- The structure of objections, or the full bot policy, each of which is a planned policy of its own.

## Open questions

- **Branch-and-merge or atomic statements.** Should the long-run editing model stay branch-and-merge,
  which suits deliberate, reviewed, chunky changes, or move toward a model closer to Wikidata's, where
  each statement is independently addressable and contested claims coexist without a resolved merge?
  The claim-level reviews and status introduced by the sourcing policy, each bound to one version of
  one claim, sit more naturally with the second model, but the two have different trade-offs in
  editing friction and consistency, and the question is deliberately left open.
- **Permission tiers.** How many protection tiers exist, who is eligible to review at each, and who may
  grant administrator status. This may turn out to be an operational and legal policy about the wiki's
  human organization and not a matter of graph structure.
- **Hard block or soft flag for cycles.** Should cycle detection reject a merge outright, or flag it
  for human attention the way Wikidata's constraint reports do? They have different editing-friction
  trade-offs.
- **Redirects and reviewed claims.** A redirect can change what an edge is about. If an edge cited
  "fire" as a prerequisite and the redirect now resolves it to the production stage, the edge is
  unchanged in storage but its meaning is narrower. Does that reset the reviews on it? It could be
  treated as a display-time resolution that leaves reviews alone, or as a substantive change that
  invalidates them.
- **Premise dependencies.** The premise-dependency check above is proposed, not adopted, and needs
  the argument page format to be settled first.
- **Where cluster governance lives.** The flag-and-review handling of named clusters that drift is
  described in Node Granularity, but whether its governance rules
  belong there or here has not been decided.
- **Reviewer eligibility.** The review rules depend on it, so it is load-bearing, and it is still
  undecided.
