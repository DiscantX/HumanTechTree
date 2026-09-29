# Editing Model

**Status:** Proposed

[Governance and Moderation for a Living Graph](../policy/graph-governance-and-moderation.md) left one
question open from the start: should the graph stay branch-and-merge, or move toward a model closer to
Wikidata's, where each statement is independently addressable and contested claims coexist without a
resolved merge? [Database Choice](database-choice.md) did not settle this directly, but it removed one
of the two live options from serious contention, which is where this essay picks up. A prototype now
exists (`src/scripts/concurrent-suite.ts`), and its first full run tested most of the claims below, so
this revision separates what was assumed from what was observed.

## The position

> **Branch-and-merge is adopted as the concurrency and versioning mechanic, using TerminusDB's native
> commit/branch/diff/merge model, with one claim per document so that unrelated edits do not collide.
> Because the store reports conflicts as schema-validation errors and fails intermittently with opaque
> server errors, every merge goes through an application-side merge queue that serializes landings,
> translates errors, retries transient failures, and resolves conflicts on a fresh branch.**

This is a narrower conclusion than it looks. It does not resolve every open question Governance and
Moderation left on the table (soft-flag versus hard-block for cycles, for instance, stays open below).
It resolves which concurrency mechanic the graph runs on and what the application must build around it.

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

## What testing showed

The prototype's suite ran 37 scenarios against TerminusDB 12.0.7 on a local instance (55 checks passed,
7 did not confirm a hypothesis, 26 were recorded as observations, none crashed). It was a single run, so
everything below is "observed once", not "established".

**What held up.**

- **Field-level merging works.** Two branches editing different fields of the same claim merged cleanly
  and the result carried both changes. Two branches editing different claims about the same node pair
  merged cleanly. A node edited on one branch and its edge edited on another merged cleanly. Identical
  concurrent edits to one field converged without a conflict. These are the cases the
  one-claim-per-document argument depends on.
- **Real conflicts are atomic.** When two branches changed the same field, the merge failed and left both
  main and the losing branch exactly as they were. There were no partial writes.
- **Reverts compose.** A bad edit that landed, followed by a good-faith edit to a different field, could
  be undone by a new field-level edit that restored the old value without discarding the later change.
- **Nothing was lost under parallel load.** Five simultaneous landings produced two successes and three
  server errors, but every reported success was on main, nothing reported as failed was on main, and
  sequential retries landed all five.

**What differed from the assumption.**

- **Conflicts arrive as schema-validation errors, not as merge conflicts.** The store layers both edits
  over the graph, sees a field with two values where the schema allows one, and aborts with a
  `RebaseSchemaValidationError` whose `witness` names the class and instance involved. Required fields
  report `instance_not_cardinality_one` and optional fields report `instance_has_wrong_cardinality`.
  "No new machinery needed" was wrong: the application must recognize both and present them as
  conflicts.
- **Edit against delete has a different signature.** An edit to a claim another branch had deleted failed
  at sync with `subject_has_no_type`, and an edge added to a node another branch had deleted failed with
  `instance_not_of_class`. The second is the database enforcing referential integrity, which is good,
  but it is a third and fourth error shape the translation layer has to map.
- **A conflicted branch cannot be repaired in place.** Setting the losing field back to main's value
  and syncing again produced the same conflict. What worked was a fresh branch from current main with the
  intended edit replayed on it. That is a workable resolution path, but it means the losing editor's
  branch history is abandoned, not merged.
- **The 500 in the original incident is not explained by merge ordering.** The earlier explanation was
  that landing a branch directly after main had moved caused the server error, and that syncing main
  into the branch first was the fix. Re-running the same sequence without the sync step succeeded. The
  same generic server error then appeared where the theory does not predict it: on a sync when main
  had not moved, and on a merge of two logical-necessity edges for one pair. A request naming a
  nonexistent branch also returns a 500, with a different body. The honest record is that the failure is
  intermittent, its cause is unknown, and it was seen on 12.0.7. The sync step in the prototype is
  harmless but unproven, and it can fail in its own right.
- **Rebase rewrites a branch's own commits.** Of the 90 commit IDs in a branch's log before landing, 88
  survived on main. That is consistent with the branch's two commits being the ones rewritten, though the
  test did not check that directly. Commit IDs are therefore not a stable name for "this version of a
  claim", which bears on how reviews bind (see [Data Model](data-model.md)).

**Performance was not a concern at prototype scale.** A bulk insert of 300 nodes took about 0.45 seconds
and 597 edges about 1.1 seconds, reading all edges back took 0.15 seconds, a cycle check plus every
node's blast radius over that graph took 17 milliseconds in the client, and a 200-document branch merged
after main had moved in 0.68 seconds. Fifteen sequential sync-and-land cycles took between 281 and 499
milliseconds each, with mild upward drift that is worth watching but not worrying about yet.

## The merge queue

The findings add up to a requirement the earlier version of this essay did not have. Landing on main is
a single-writer operation.

- **Serialize landings.** Editing on branches can happen in parallel, but the step that moves main
  goes through one queue. Parallel landings failed three times in five with no data damage, which is a
  reason to avoid them, not a reason to fear them.
- **Preflight.** Check that the source branch exists before calling, since a missing branch returns a
  server error indistinguishable from a real fault.
- **Translate errors.** Map cardinality and `subject_has_no_type` witnesses to a user-facing conflict,
  `instance_not_of_class` to "a node this edit refers to was deleted", and other 5xx responses to a
  transient failure. Anything unrecognized is surfaced, not retried forever.
- **Retry transient failures with a cap.** A retry after a fresh sync succeeded in every case where an
  earlier attempt hit a server error. Whether to sync before every landing is left open: neither order
  is proven safe, and the queue should be written so that it can be changed.
- **Resolve conflicts on a fresh branch.** When the user resolves a conflict, the resolved content is
  written to a new branch off current main and landed through the same queue.

## Where real conflicts still happen, and how they resolve

Fine granularity does not eliminate conflicts, it narrows what counts as one. Two editors changing the
same field of the same claim, such as both proposing a different basis for the same edge, is a genuine
collision. It resolves through the queue described above, not through anything the store offers
directly.

What fine granularity does not touch is **emergent invalidity**: two edits, each individually valid, on
different documents, that combine into an invalid graph. The prototype sorted these into two groups.

- **The store catches some.** It refuses to delete a node that still has dependent edges, it refuses an
  edge that points at a node that does not exist, and it rejected missing required fields, invalid enum
  values, and unknown properties in every case tried.
- **The store misses the rest.** Two edges added on separate branches that together form a cycle both
  merged cleanly. A self-loop was accepted. Two identical claims were accepted, because keys are random.
  Whether a second logical-necessity edge for the same pair is accepted is unknown, because the one test
  of it hit a server error.

Governance and Moderation already assigns the second group to a post-merge validation gate, and nothing
here changes that division of labor. The prototype's script-level cycle and self-loop checks worked and
are a starting point for that gate.

## Branch-and-merge also fits the protection-tier model already adopted

Governance and Moderation's protection tiers require that structural edits to high-blast-radius items
get more review before landing, and that low-permission accounts may propose structural edits but not
land them directly. That requirement maps naturally onto branch-and-merge: a proposed edit is a branch,
review happens before a merge to the main line, and the amount of required review scales with the
target's blast radius exactly as already specified. Wikidata's model publishes a statement immediately
and flags problems after the fact through constraint-violation reports, which is a coherent design on
its own terms but does not have a native pre-publication review gate to retrofit the protection-tier
requirement onto. This is a second, independent reason branch-and-merge fits better with decisions this
project has already made, not just a consequence of the database choice. The merge queue is also the
natural place for that gate to sit.

## What this essay does not decide

- Whether cycle detection hard-blocks a merge or soft-flags it for human attention. Left open in
  Governance and Moderation and not resolved here; branch-and-merge with post-merge validation supports
  either policy equally.
- The specific checks the validation gate runs, or when they run relative to a merge. That belongs to
  the tech index's Validation Gate essay.
- The concrete review-tier thresholds. That belongs to Sourcing and Citation Policy for Edges and
  Governance and Moderation.
- How long-form prose is merged. The store does not merge text inside a field, so that is the subject of
  [Prose Merging](prose-merging.md).
- The exact branch workflow (personal branches per editor, feature branches per proposed change, or
  something else). See open questions.

## Open questions

- **Branch workflow.** Whether low-permission editors work in individual branches merged by reviewers,
  or something closer to Wikipedia's direct-edit-with-revert model layered on top of TerminusDB's
  branches, is not decided. The fresh-branch conflict resolution path adds a consideration: an editor's
  branch is disposable when it conflicts.
- **The cause of the intermittent server error.** Unknown. It needs repeated runs and the server's own
  log to characterize a failure rate before the retry cap and the sync policy can be set with any
  confidence, and it should be re-checked after any TerminusDB upgrade.
- **Whether one-claim-per-document holds up under real load.** Supported in every case tried, all of
  them on small graphs and simulated edits. It has not been tested against nested list fields, such as
  groundings or objections stored inside a claim, where two editors appending at the same time might
  collide even though they touch different entries.
- **Edit against delete.** One test left main with the deleted claim still present after the delete had
  landed. That is either a real behavior or a flaw in the test's timing, and it is not understood yet.
- **This essay's own depth.** The position still follows more from a prior decision (TerminusDB) than
  from an independent debate. The prototype has stress-tested it in the ways listed above, but not yet
  under real concurrent editors.

## Tests not yet run

The full backlog is in the [tech index](tech-index.md#prototype-test-backlog). The ones that bear on
this essay are repeated runs of the failing scenarios with server logs, concurrent appends to nested
list fields, merge-queue behavior under parallel load, a proper test of the second logical-necessity
edge, and a retest after a TerminusDB upgrade.
