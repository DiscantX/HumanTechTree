# Essay 10 — Governance and Moderation for a Living Graph

**Status:** Proposed

**Depends on:** Essay 1 (Founding Axioms), Essay 6 (Edge Schema — governance acts on these fields),
Essay 7 (Basis values — disputes over them follow different grounding rules)

**Gates:** interacts with Essay 9 (grounding, review, and the objection process this essay's dispute
resolution operates on) and Essay 2 (deletion defaults to
merge, which is a granularity question)

## 1. The problem

Text-wiki conflict resolution — diffs, talk pages, revert, consensus — is a solved problem. Graph-
structure conflicts are not, for two reasons that are genuinely different from anything a text wiki
has to handle:

- **Emergent invalidity.** Two edits can each be individually valid, touch different nodes with no
  field-level overlap, and still produce a jointly invalid graph — most concretely, a cycle formed
  from two edges added on separate branches by separate editors who never saw each other's change.
- **Catastrophic blast radius.** A small number of extremely central nodes (fire, "the internet")
  can do far more damage if deleted, corrupted, or quietly rewired than any single page on a text
  wiki ever could, whether the cause is malice or an honest mistake.

## 2. Concurrency and the merge model

A git-like versioned graph store resolves concurrent edits through branch-and-rebase: each writer's
commits are replayed onto the target branch, and a genuine field-level collision (two editors
changing the same field of the same node or edge) surfaces as a normal merge conflict. This part is
mechanically solved by the choice of a versioned data store and needs no new policy here.

What that mechanism does **not** catch is emergent invalidity across non-overlapping edits (Section
1). This requires an explicit, application-level validation gate that runs after every merge, before
publish:

- a cycle check across logical-necessity edges (Essay 7) — historical-attestation edges are dated
  and cannot form a problematic cycle in the same sense, but logical-necessity edges can and must be
  checked,
- a dangling-edge check (no edge may reference a node that no longer exists without resolving to a
  redirect),
- an orphan check flagging nodes that plausibly should have a prerequisite and do not, for
  patrol rather than automatic rejection.

**Left open:** whether the long-run editing model should stay branch-and-merge (suited to
deliberate, reviewed, chunky changes) or move toward an atomic-statement model closer to Wikidata's
— where each edge is independently addressable and contested claims coexist rather than requiring a
resolved merge before either counts. This is a genuine architectural fork with different editing-
friction and consistency trade-offs, and it is deliberately **not resolved in this essay**. It is
flagged as its own future debate thread rather than decided by default.

## 3. Node protection scaled to blast radius

A node's blast radius — the count of its transitive descendants, or in-degree as a cheaper proxy —
is computed automatically, not hand-assigned. Protection tier follows directly from that number:
higher-blast-radius nodes require higher-permission editors and more review before a *structural*
edit (adding, removing, or re-pointing an edge) lands. Textual edits to a node's description are not
subject to the same tier, since a bad description is not the same order of problem as a bad edge.

New or low-permission accounts should be limited to *proposing* structural edits for review rather
than landing them directly, given that a bad graph edit can do quieter, farther-reaching damage than
a bad text edit (per the emergent-invalidity problem in Section 2).

Essay 9 extends blast radius to edges: an edge's blast radius is proposed as the transitive
descendant count of its downstream node, and the number of independent reviews an edge requires is
computed from it. Reviewer eligibility and permission tiers are therefore now load-bearing for
Essay 9, and are still left open here (Section 11).

## 4. Deletion policy

No node with existing dependents may be hard-deleted. Deletion requires the requester to first
re-parent or explicitly flag every dependent edge — an active, forced step, not a passive block —
and a mandatory impact report (transitive descendant count, and which high-profile nodes are among
them) must be shown before a deletion or move can even be submitted.

In practice, most legitimate "this shouldn't exist" cases are actually mis-splits, and should route
to merge or rename rather than deletion (an interaction with Essay 2's granularity logic: if
re-parenting forty edges reveals they all belong somewhere else, that is usually evidence the node
should have been merged into that other node, not deleted). True hard deletion should be reserved
for nodes with zero legitimate dependents — which, by construction, describes spam and vandalism far
more often than it describes a real technology someone got wrong.

## 5. Stable identity for moves

Node identifiers are stable and separate from display title or slug. A move, rename, or merge leaves
a redirect at the old identifier. Edges reference identifiers, never display titles, so a move never
requires rewriting the edges that point at the moved node.

## 6. Recovery, and the limits of "just revert"

Because the underlying store is immutable and commit-based, reverting a bad edit is technically
cheap regardless of intent — this is a direct benefit of the version-control choice made for the
database layer, and it fully answers the "what if it's malicious" half of the original question.

It does not answer the harder half: if a bad edit stood long enough for good-faith work to be built
on top of it, a revert now conflicts with that legitimate downstream work, the same revert-war
problem text wikis face on high-traffic pages.

A related case, a well-sourced claim later shown incomplete by new evidence such as a declassified
precedent, is handled in Essay 9, Section 11 as ordinary supersession rather than as revert. This is not solved by the database — it is mitigated
by the protection tiers in Section 3 (higher tiers get bad edits caught faster, before anything gets
built on them) and by bot-driven patrol on high-blast-radius nodes specifically, not by any
mechanism this essay can guarantee outright.

## 7. Dispute resolution for genuine disagreement

Content disputes that are not vandalism — "is pottery downstream of agriculture or parallel to it"
— are resolved by debate followed by consensus, the same process this project already uses for its
own essays, scoped down to a single edge rather than a whole policy. The grounding standard for that
debate depends on which field is disputed: relationship-kind and historical-attestation claims lean
on ordinary verifiability (Essay 9, forthcoming); logical-necessity claims lean on argued soundness,
since a citation frequently does not exist at all (Essay 7, Section 3). Either way, a resolved
dispute over a logical-necessity claim must be disclosed as this wiki's own argued position, not
presented as if it were settled scholarship the literature itself has already agreed on.

## 8. The optionality principle, restated for moderators

Essay 6, Section 7 establishes that no edge field is ever required to reach a settled state to be
valid. This is restated here because it is the direct answer to the concern that this schema's
richness makes the graph impossible to actually moderate: it does not, provided moderation effort
concentrates on genuinely contested or high-blast-radius items rather than on driving every edge in
the graph toward full specification. A niche, uncontested edge sitting permanently at its cheapest
default state is not technical debt — it is the expected, healthy state for the overwhelming
majority of the graph. Automated checks (cycle detection, orphan flagging, dangling-edge detection)
should handle the mechanical load; human moderators should be reserved for judgment calls a script
cannot make, such as whether a claim is genuinely necessity or merely sequence.

## 9. Rendering discipline as a moderation aid

Essay 6, Section 6's collapse-by-default rendering rule also reduces what a human patroller has to
visually parse when reviewing recent changes — this is a moderation benefit, not only an aesthetic
one, and the two should not be designed separately.

## 10. What this essay is not

This essay does not define grounding, review, or status (Essay 9), and it does not resolve the
branch-and-merge versus atomic-statement architecture fork raised in Section 2 — that is deliberately
left as a distinct, unresolved thread.

## 11. Status and open threads

This essay is **Proposed**. Six threads are flagged for future debate rather than resolved here:

- The merge-model fork in Section 2.
- How many protection tiers exist and who is authorized to grant admin-level permissions — this may
  turn out to be an operational/legal policy document rather than content for this essay, since it
  concerns the wiki's human organization rather than the graph's structure.
- Whether cycle detection specifically should hard-block a merge outright, or soft-flag it the way
  Wikidata's constraint-report system flags contradictory statements for human attention without
  blocking the edit — these have different editing-friction trade-offs and have not been decided.
- A revert/recovery scenario not covered by Section 6: a well-sourced historical-attestation claim that later evidence (e.g., a declassification, as in public-key cryptography's GCHQ precedent) shows was incomplete all along, through no fault of the original editor and no available citation at the time. Essay 9, Section 11 proposes ordinary supersession; pending adoption here.
- A stress case for Section 7's dispute-resolution process: CRISPR's Broad Institute vs. UC Berkeley priority dispute has been litigated externally, with a binding legal outcome. Essay 9, Section 12 proposes that a ruling is citable for what it decided but not deferred to, with any divergence disclosed on the claim; pending adoption here.
- Reviewer eligibility and permission tiers are now load-bearing for Essay 9.
- Bots (index item 13) follow this essay's low-permission-account rule.
- A premise-dependency check may be needed when an argument cites another claim (index item 14).
- Edge-level blast radius needs a definition (Essay 9, Section 8 proposes one).
