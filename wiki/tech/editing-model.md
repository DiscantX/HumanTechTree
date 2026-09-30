# Editing Model

**Status:** Proposed

[Governance and Moderation for a Living Graph](../policy/graph-governance-and-moderation.md) left one
question open from the start: should the graph stay branch-and-merge, or move toward a model closer to
Wikidata's, where each statement is independently addressable and contested claims coexist without a
resolved merge? [Database Choice](database-choice.md) did not settle this directly, but it removed one
of the two live options from serious contention, which is where this essay picks up. A prototype now
exists (`src/scripts/concurrent-suite.ts`) and has been run twice, and the official documentation, the
OpenAPI spec, and the client package have since been read for what they actually say. This revision
keeps three things apart: what was assumed, what was observed, and what the documentation states.

## The position

> **Branch-and-merge is adopted as the concurrency and versioning mechanic, using TerminusDB's native
> commit/branch model, with one claim per document so that unrelated edits do not collide. The merge
> operation is rebase, called through the official client (`client.rebase`), because rebase is what
> the documentation itself calls merging and the server has no separate merge endpoint. Because the
> store reports rebase conflicts in a form its API does not document, and fails intermittently with
> opaque server errors, every merge goes through an application-side merge queue that serializes
> landings, translates errors, retries transient failures, and resolves conflicts on a fresh branch.**

This is a narrower conclusion than it looks. It does not resolve every open question Governance and
Moderation left on the table (soft-flag versus hard-block for cycles, for instance, stays open below).
It resolves which concurrency mechanic the graph runs on and what the application must build around it.

## Why the fork narrowed

[Database Choice](database-choice.md) rejected Wikibase as the data layer, for reasons independent of
this question: its schema has no native concept of basis, grounding, or claim-level review, and its
primary storage is not built for the bulk graph reads this project needs as an ordinary access pattern.
TerminusDB was adopted instead, and TerminusDB's whole identity as a store is its git-like
commit/branch model. Adopting the atomic-statement model on top of it would mean either fighting the
tool (suppressing the branch machinery TerminusDB is built around, to simulate Wikidata's
immediate-publish, statement-coexistence behavior instead) or re-deriving Wikibase's actual architecture
by hand on a store that was specifically chosen because it already solves version control natively.
Neither is a sound use of the choice already made.

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

## What the documentation says

The first version of this essay was written from inference and trial and error. The documentation, the
OpenAPI spec, and the client package were read afterwards, and several assumptions changed. The spec is
the most authoritative of these sources, followed by the client's type declarations and the docs
examples marked as tested; prose pages have proved less reliable (see the tech index).

- **The version-control operations are rebase, apply, squash, reset, diff, patch, and log.** There is no
  merge endpoint and no client method for one. The docs' own JavaScript quickstart merges with
  `client.rebase`, commented as being like a git merge, and the version-control overview describes
  merging as replaying one branch's commits onto another. Using rebase as the merge is therefore the
  documented approach, not a workaround.
- **Rebase's documented responses are 200, 400, 401, 403, and 404.** The spec shows no 409, no
  conflict shape, and no 500 for it. The conflict behavior and the server errors described below are
  observed behavior with no documented contract.
- **A successful rebase reports what it did.** The response carries the common commit, the commits that
  were forwarded unchanged, and a report mapping each replayed commit to the commit IDs it became.
- **Apply is a different operation, not a second spelling of merge.** It applies the difference between
  a `before` and an `after` state to the current branch, creates a squash commit, and returns a 409
  with structured conflict witnesses. The docs describe it as a three-way merge, but every example
  passes the target branch itself as `before`, which would make it a plain two-way diff. None of those
  examples are marked as tested, the docs give no way to obtain a merge base, and the client's typed
  signature (`before`, `after`, `message`, and optional flags, applied to the currently checked-out
  branch) does not match the argument order in the docs' examples. Its `match_final_state` option,
  which lets a conflicting patch through if it yields the same final state, is documented for apply
  only, not for rebase. Whether apply can serve as a real three-way merge is untested.
- **The commit log is plain HTTP.** The spec marks the JavaScript client's log method as not
  implemented. The docs' reset page shows a `getCommitHistory()` method, but it does not exist in either
  published client package, so the prototype keeps a small HTTP helper for it.
- **Reading a document as of a past commit is documented** as a GET on the document endpoint against a
  commit reference. It has not been tested. A per-document history endpoint also exists and is reported
  to list the commits that touched a document; that has not been verified either.
- **The docs are silent on several things the design depends on:** how concurrent appends to `Set`,
  `List`, or `Array` fields merge, whether key fields may be optional or references, and what an HTTP 500
  from rebase means.

## What testing showed

The suite has run twice against TerminusDB 12.0.7 on a local instance. The first run used direct HTTP
calls for rebase (37 scenarios: 55 checks passed, 7 did not confirm a hypothesis, 26 were observations,
none crashed). The second ran after the prototype moved to the official client package (51 passed, 11 did
not confirm, 26 observations, none crashed). Each is a single run, so everything below is "observed
once or twice", not "established". A patched suite with repeat and no-sync modes, error logging, and
new scenarios (46 in all) exists and is waiting for its first runs.

**What held up in both runs.**

- **Field-level merging works.** Two branches editing different fields of the same claim merged cleanly
  and the result carried both changes. A node edited on one branch and its edge edited on another merged
  cleanly. Identical concurrent edits to one field converged without a conflict in the first run.
- **Real conflicts are atomic.** When two branches changed the same field of a claim, the merge failed
  and left both main and the losing branch exactly as they were. There were no partial writes.
- **Reverts compose.** A bad edit that landed, followed by a good-faith edit to a different field, could
  be undone by a new field-level edit that restored the old value without discarding the later change.
- **Nothing was lost under parallel load.** Five simultaneous landings produced two successes and three
  server errors in each run, but every reported success was on main, nothing reported as failed was on
  main, and sequential retries landed all five.

**What differed from the assumption.**

- **Conflicts arrive as schema-validation errors, not as merge conflicts.** The store layers both edits
  over the graph, sees a field with two values where the schema allows one, and aborts with a
  `RebaseSchemaValidationError` whose witness names the class and instance involved. The error also
  names the commit that failed to replay (`api:their_commit`). Required fields report
  `instance_not_cardinality_one` and optional fields report `instance_has_wrong_cardinality`. The shape
  was identical through the official client, and it is undocumented (see above).
- **Edit against delete has a different signature.** An edit to a claim another branch had deleted failed
  with `subject_has_no_type`, and an edge added to a node another branch had deleted failed with
  `instance_not_of_class`. The second is the database enforcing referential integrity, which is good,
  but it is a third and fourth error shape the translation layer has to map.
- **A conflicted branch cannot be repaired in place.** Setting the losing field back to main's value
  and syncing again produced the same conflict. What worked was a fresh branch from current main with the
  intended edit replayed on it, which means the losing editor's branch history is abandoned.
- **The 500s are not explained by merge ordering, by sync, or by the raw HTTP wrapper.** The original
  theory was that landing a branch directly after main had moved caused the server error. Landing
  without a preceding sync succeeded in both runs, so the sync step is very likely unnecessary. The
  same generic error (`Unexpected failure in request handler`) then appeared in other scenarios, three
  of them at the sync step (a convergent edit and two claims on one node pair, both of which had
  succeeded in the first run, and a double delete), and it kept appearing after the move to the official client, so the client wrapper was
  not the cause. A second, distinct 500 body (`api:UnhandledErrorResponse`, "An internal server error
  occurred") is returned when a request names a nonexistent branch. The spec promises a 404 there, so
  that one is a plain server defect. The honest record is that the failure is intermittent, its cause is
  unknown, and it was seen on 12.0.7.
- **A landing that should have conflicted did not, in one run.** Two branches edited the same paragraph
  of one text field. The first run reported a conflict. In the second run the second branch landed with
  no conflict, and the test did not record what main held afterwards, so a silent overwrite of the first
  editor's text cannot be ruled out. This matters more than any of the 500s, because the atomic-conflict
  guarantee above depends on it. The patched suite records the final value. Related and also unexplained:
  in both runs one test left main holding a deleted claim after the delete had landed, which is either
  real behavior or a flaw in the test's timing.
- **Rebase rewrites a branch's own commits.** In the second run 194 of the 196 commit IDs in a branch's
  log before landing survived on main, which matches the branch's two own commits being the ones
  rewritten. Commit IDs are therefore not a stable name for "this version of a claim", which bears on
  how reviews bind (see [Data Model](data-model.md)). Apply squashes, so neither operation preserves them.

**Performance was not a concern at prototype scale.** In the first run a bulk insert of 300 nodes took
about 0.45 seconds and 597 edges about 1.1 seconds; reading all edges back took 0.15 seconds, a cycle
check plus every node's blast radius over that graph took 17 milliseconds in the client, and a 200-document
branch merged after main had moved in 0.68 seconds. The second run was slower (edges 2.3 seconds, merges
between 0.5 and 0.8 seconds each against 0.28 to 0.5 before), with no way yet to tell whether the client
change, the growing commit history, or machine load is responsible. It is worth watching, not worrying
about.

## The merge queue

The findings add up to a requirement the earlier version of this essay did not have. Landing on main is
a single-writer operation.

- **Serialize landings.** Editing on branches can happen in parallel, but the step that moves main
  goes through one queue. Parallel landings failed three times in five with no data damage, which is a
  reason to avoid them, not a reason to fear them.
- **Use the official client.** Rebase is a single `client.rebase` call on a client whose current branch
  is the target. Each landing uses a fresh client so no branch state leaks between calls.
- **Preflight.** Check that the source branch exists before calling, since a missing branch returns a
  server error indistinguishable from a real fault.
- **Translate errors.** Map cardinality and `subject_has_no_type` witnesses to a user-facing conflict,
  `instance_not_of_class` to "a node this edit refers to was deleted", and other 5xx responses to a
  transient failure. Anything unrecognized is surfaced, not retried forever.
- **Retry transient failures with a cap.** A retry succeeded in every case where an earlier attempt hit a
  server error. Whether to sync before each landing is left open: it is probably unnecessary, and three
  of the new server errors occurred at the sync step itself, so it may be harmful. The queue should be
  written so this can be changed, and the sync-on and sync-off comparison planned in the tech index will
  decide it.
- **Resolve conflicts on a fresh branch.** When the user resolves a conflict, the resolved content is
  written to a new branch off current main and landed through the same queue.
- **Verify what landed.** Given the unexplained same-paragraph result, the queue should read back a
  landed document and compare it with what was submitted, at least until that result is understood.

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
  merged cleanly. A self-loop was accepted. Two identical claims were accepted, because the current key
  strategy is random (the documented key strategies that would prevent this, and their cost, are
  discussed in [Data Model](data-model.md)). Whether a second logical-necessity edge for the same pair is
  accepted is still unknown, because both attempts to test it hit a server error.

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

- **Whether apply can be a real three-way merge.** Its conflict responses are documented and structured,
  which rebase's are not, but its examples contradict its description, it squashes commits, and there is
  no documented way to obtain a merge base. If a merge base can be found, apply might give a cleaner
  conflict contract than rebase's schema-validation errors. Untested.
- **The same-paragraph result.** Whether a conflicting edit to one text field can land silently, and
  what main holds afterwards. This is the most important unexplained result and needs repeated runs with
  the final value recorded.
- **The cause of the intermittent server errors.** Unknown, and absent from the documentation. It needs
  repeated runs with and without the sync step, the server's own log for the same window, and, if it
  persists, a report to the maintainers together with the missing-branch 500, which contradicts the spec.
  The project is already on the latest server release, so an upgrade retest is not currently available.
- **Branch workflow.** Whether low-permission editors work in individual branches merged by reviewers,
  or something closer to Wikipedia's direct-edit-with-revert model layered on top of TerminusDB's
  branches, is not decided. The fresh-branch conflict resolution path adds a consideration: an editor's
  branch is disposable when it conflicts.
- **Whether one-claim-per-document holds up under real load.** Supported in every case tried, all of
  them on small graphs and simulated edits. It has not been tested against collection fields, such as
  groundings or objections stored inside a claim, where two editors appending at the same time might
  collide even though they touch different entries. Scenarios for `Set`, `Array`, and `List` are written
  but not yet run.
- **Edit against delete.** One test left main with the deleted claim still present after the delete had
  landed, in both runs. That is either a real behavior or a flaw in the test's timing, and it is not
  understood yet.
- **This essay's own depth.** The position still follows more from a prior decision (TerminusDB) than
  from an independent debate. The prototype has stress-tested it in the ways listed above, but not yet
  under real concurrent editors.

## Tests not yet run

The full backlog is in the [tech index](tech-index.md#prototype-test-backlog). The ones that bear on
this essay are the repeated sync-on and sync-off runs of the failing scenarios with server logs, the
first run of the new probes (same-paragraph and delete outcomes recorded, collection appends, key
strategies), a test of apply with an explicit merge base, and a check of what a conflicting rebase
returns through the client.
