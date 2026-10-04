# Editing Model

**Status:** Proposed

[Governance and Moderation for a Living Graph](../policy/graph-governance-and-moderation.md) left one
question open from the start: should the graph stay branch-and-merge, or move toward a model closer to
Wikidata's, where each statement is independently addressable and contested claims coexist without a
resolved merge? [Database Choice](database-choice.md) did not settle this directly, but it removed one
of the two live options from serious contention, which is where this essay picks up. A prototype now
exists (`src/scripts/tests/concurrent-suite.ts`) and has been run in several rounds, including repeated runs
with and without the sync step, and the official documentation, the OpenAPI spec, and the client package
have been read for what they actually say. This revision keeps three things apart: what was assumed, what
was observed, and what the documentation states.

## The position

> **Branch-and-merge is adopted as the concurrency and versioning mechanic, using TerminusDB's native
> commit/branch model, with one claim per document so that unrelated edits do not collide. The merge
> operation is rebase, called through the official client (`client.rebase`), because rebase is what
> the documentation itself calls merging and the server has no separate merge endpoint. Because the
> store reports rebase conflicts in a form its API does not document, and fails intermittently with
> opaque server errors that fade when landings are spaced out, every merge goes through an
> application-side merge queue that serializes landings, spaces them, translates errors, retries
> transient failures, and resolves conflicts on a fresh branch.**

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

The suite has run in several rounds against TerminusDB 12.0.7 on a local instance. The first two were
single passes of 37 scenarios, the first with direct HTTP calls for rebase and the second after the
prototype moved to the official client package. The third round used the rewritten suite, which repeats
scenarios, can skip the sync step, logs every error body, and now has 50 scenarios. It ran the probe set
once, then the scenarios that had failed intermittently 20 times each with sync and 20 times without, and
then targeted runs on the server errors, the key strategy, and concurrent appends to collections. Repeated
results below are counted as such. Everything else is one or two observations.

**What held up in every round.**

- **Field-level merging works.** Two branches editing different fields of the same claim merged cleanly
  and the result carried both changes. A node edited on one branch and its edge edited on another merged
  cleanly. Identical concurrent edits to one field converged without a conflict in every run that reached the
  merge, and identical concurrent additions of the same claim converged to a single document.
- **Real conflicts are atomic, and always reported.** When two branches changed the same field of a
  claim, the merge failed and left both main and the losing branch exactly as they were. There were no
  partial writes. Two branches editing the same paragraph of one text field were reported as a conflict
  in 40 of 40 repeated runs, with and without the sync step, and in every one of them the first editor's
  text was still on main afterwards. A conflict never produced a server error.
- **Reverts compose.** A bad edit that landed, followed by a good-faith edit to a different field, could
  be undone by a new field-level edit that restored the old value without discarding the later change.
- **Nothing was lost under parallel load.** Five simultaneous landings onto one branch produced exactly
  one success and four server errors in each of 40 repeated runs. Every reported success was on main and
  nothing reported as failed was on main, so the failures are clean refusals.

**What differed from the assumption.**

- **Conflicts arrive as schema-validation errors, not as merge conflicts.** The store layers both edits
  over the graph, sees a field with two values where the schema allows one, and aborts with a
  `RebaseSchemaValidationError` whose witness names the class and instance involved. The error also
  names the commit that failed to replay (`api:their_commit`). Required fields report
  `instance_not_cardinality_one` and optional fields report `instance_has_wrong_cardinality`. The shape
  was identical through the official client, and it is undocumented (see above).
- **Edit against delete has a different signature.** An edit to a claim another branch had deleted failed
  with `subject_has_no_type`. Replaying a node's deletion onto a branch that had added an edge to that node
  failed with `instance_not_of_class`, which is a third error shape for the translation layer to map. This
  enforcement runs in one direction only. Landing the edge branch onto main after the deletion succeeded, the
  rebase report called the replay a valid commit, and main was left with an edge whose target did not exist.
  The failing direction can be mistaken for the store protecting main, which it does not.
- **A conflicted branch cannot be repaired in place.** Setting the losing field back to main's value
  and syncing again produced the same conflict. What worked was a fresh branch from current main with the
  intended edit replayed on it, which means the losing editor's branch history is abandoned.
- **Edit against delete behaves correctly.** The apparent oddity, where a test left main holding a
  deleted claim after the delete had landed, was a flaw in the test: the client returns a 404 body as a
  string instead of throwing, and the helper read it as "present". The delete works.
- **The 500s are real, intermittent, and tied to replaying onto a branch that has just changed.** They are
  not caused by the sync step, the raw HTTP wrapper, or conflicts. The evidence:
  - **Sync is irrelevant to the server errors.** Across 20 repeats of the flaky scenarios, 17 scenario runs outside the parallel
    case hit a server error with the sync step and 17 without it, and the landing step's error rate was
    24.5 percent with sync and 26.9 percent without, both dominated by the parallel case.
  - **Parallel landings onto one branch always fail four in five.** This is write contention, and the
    clean refusals above show it does no damage.
  - **Sequential replays fail less often, and less the longer the wait.** Landing a branch that had fallen
    behind main, straight after another landing, failed on its first attempt about one time in seven. A
    branch created after the previous landing, which merges as a fast-forward with nothing to replay,
    never failed.

    | Pause before the replay lands | First-attempt server errors |
    | --- | --- |
    | none (measured twice) | 7 of 50 (14 percent) |
    | 100 ms | 3 of 30 (10 percent) |
    | 250 ms | 1 of 30 (3 percent) |
    | 500 ms | 1 of 30 (3 percent) |
    | 1 second | 0 of 30 |
    | 3 seconds | 0 of 20 |
    | fast-forward, no replay | 0 of 20 |

  - **Retries work when they wait.** Every branch that hit an error landed on its second attempt, 12 of 12,
    with half a second between attempts, and nothing was duplicated or lost. Back-to-back retries in the
    parallel scenario did not always work: 4 to 6 runs in 20 still left a branch unlanded.
  - **The cause is unknown.** The server's log records only the status code. The pattern fits background
    work on main that finishes within about a second of a landing, and the only related log lines are two
    `Optimization ... failed: database_not_finalized` errors seen right after a database was recreated.
    That is a lead and not a finding.
  - **A second, distinct 500** (`api:UnhandledErrorResponse`, "An internal server error occurred") is
    returned when a request names a nonexistent branch. The spec promises a 404 there, so that one is a
    plain server defect.
- **Rebase rewrites a branch's own commits.** In the second run 194 of the 196 commit IDs in a branch's
  log before landing survived on main, which matches the branch's two own commits being the ones
  rewritten, and in the third round none of a branch's two own commits were found on main after landing.
  Commit IDs are therefore not a stable name for "this version of a claim", which bears on how reviews
  bind (see [Data Model](data-model.md)). Apply squashes, so neither operation preserves them.

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
  goes through one queue. Parallel landings succeed one in five and fail cleanly, which is a reason to
  avoid them, not a reason to fear them.
- **Space landings.** Wait about a second after a landing before replaying the next branch onto main. The
  server errors fell from about one in seven with no wait to none in 30 at one second. A queue that lands
  at most about once a second costs little for a wiki that edits by review.
- **Use the official client.** Rebase is a single `client.rebase` call on a client whose current branch
  is the target. Each landing uses a fresh client so no branch state leaks between calls.
- **Land through a staging branch and the validation gate.** Branch staging off the target, replay the source
  onto it, run the gate there, and only then replay staging onto the target, which is a fast-forward when
  nothing else has written to main. Main therefore only ever moves to a state that passed the gate, and a
  failing edit never reaches it. This depends on the queue being the only writer to main. The staging
  branch is deleted afterward, and a retry starts from a fresh one.
- **Preflight.** Check that the source branch exists before calling, since a missing branch returns a
  server error indistinguishable from a real fault.
- **Translate errors.** Map cardinality and `subject_has_no_type` witnesses to a user-facing conflict,
  `instance_not_of_class` to "a node this edit refers to was deleted", and other 5xx responses to a
  transient failure. A duplicate claim added on two branches arrives as an ordinary cardinality conflict
  on the statement (see [Data Model](data-model.md)). Anything unrecognized is surfaced, not retried
  forever. A failure of the gate is reported with its violations and is never retried.
- **Retry transient failures with a pause and a cap.** Retry a 5xx up to three times with at least half a
  second before each attempt, growing on each try. Every retry that waited succeeded, and back-to-back
  retries did not always.
- **Do not rely on the sync step.** Landing without a preceding sync succeeded as often as landing with one,
  and sync added rebase calls that could themselves fail. A sync that fails with `instance_not_of_class`
  catches one kind of dangling edge by accident, but a sync that passes proves nothing, so the queue does
  not use it as a guard. The validation gate does that job.
- **Resolve conflicts on a fresh branch.** When the user resolves a conflict, the resolved content is
  written to a new branch off current main and landed through the same queue.
- **Reading back what landed is optional.** The same-paragraph result that motivated it did not
  reproduce, so it is no longer required. It remains a cheap safeguard.

## Who made an edit

[Accounts](tech-index.md) are kept outside the graph store, and the application reaches the store through
one service account. Attribution therefore rests on the `author` recorded on each commit, which the
application sets to the editor's account identifier. A check (`src/scripts/tests/author-check.ts`) asked
whether that author survives the landing path.

- **The SDK cannot set it.** The client stamps every document write with the login user: its add, update,
  and delete methods overwrite the `author` parameter with the current user. A commit written through them
  carries the service account. Attribution needs the write itself to carry the editor, either as a plain HTTP
  request with the `author` parameter, which the server accepted with an arbitrary value, or a client per
  editor.
- **A rebase keeps it.** A commit authored by one editor, replayed onto a main that had moved, kept that
  editor as its author after landing, although the rebase call passed the service account as its own
  `author`. The rebase report showed the commit was replayed, not forwarded. A fast-forward kept it too.
- **So does the staged landing.** The same edit landed through the merge queue, with main moved so that the
  replay onto the staging branch rewrote the commit, and main showed the original author. The queue does
  not have to pass the author through.
- **The store does not authenticate it.** The author is a string the writer supplies, so anyone holding the
  service credentials can write any value. That is acceptable while the application is the only writer, but
  attribution is then the application's assertion, not something the store proves.
- **Use the account identifier, not the display name.** The identifier is stable across renames, and the
  display name is resolved when the history is shown.

Each of these was observed once, on a small database, so they carry the same standing as the other single
observations here. A first run against a development database that had not been reset was refused by the
validation gate, with main unchanged, so the queue's refusal works, and the run was repeated on a clean
database. What a rebase's own `author` parameter applies to was not observed, because no commit was created
by the rebase itself, and apply, which squashes, was not tried.

## Where real conflicts still happen, and how they resolve

Fine granularity does not eliminate conflicts, it narrows what counts as one. Two editors changing the
same field of the same claim, such as both proposing a different basis for the same edge, is a genuine
collision. It resolves through the queue described above, not through anything the store offers
directly.

What fine granularity does not touch is **emergent invalidity**: two edits, each individually valid, on
different documents, that combine into an invalid graph. The prototype sorted these into two groups.

- **The store catches some.** It refuses to delete a node that still has dependent edges, it refuses a directly
  inserted edge that points at a node that does not exist, and it rejected missing required fields, invalid enum
  values, and unknown properties in every case tried.
- **The store catches the multiplicity rules when edges are keyed deterministically.** With the
  composite edge key set out in [Data Model](data-model.md), a second logical-necessity edge for a pair, or
  a second historical-attestation edge repeating an origin, is refused, and the same claim added on two
  branches fails at merge as a conflict. Under random keys, two edges for one pair both merged.
- **The store misses the rest.** Two edges added on separate branches that together form a cycle both
  merged cleanly. A self-loop was accepted. Nothing stops an origin being set on a logical-necessity edge,
  which would escape the one-per-pair rule. An edge added on one branch landed on main after another
  branch had deleted its target, leaving a dangling edge, even though the reverse replay fails.

Governance and Moderation already assigns the second group to a validation gate, and nothing here changes
that division of labor. The queue runs the gate on a staging branch before main moves, which also removes
the window in which main would hold an invalid graph. The prototype's script-level cycle and self-loop checks worked and
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
- **The cause of the intermittent server errors.** Unknown, and absent from the documentation. The
  pattern is characterized and the workaround is spacing and retrying, but a report to the maintainers
  should include the minimal reproduction (a replay landed immediately after another landing on main) and
  the missing-branch 500, which contradicts the spec. The project is already on the latest server release,
  so an upgrade retest is not currently available.
- **Branch workflow.** Whether low-permission editors work in individual branches merged by reviewers,
  or something closer to Wikipedia's direct-edit-with-revert model layered on top of TerminusDB's
  branches, is not decided. The fresh-branch conflict resolution path adds a consideration: an editor's
  branch is disposable when it conflicts.
- **Whether one-claim-per-document holds up under real load.** Supported in every case tried, including
  concurrent appends to groundings and objections nested in a claim (see [Data Model](data-model.md)). All
  of it was on small graphs with simulated edits, and two branches editing the same nested entry have not
  been tested.
- **This essay's own depth.** The position still follows more from a prior decision (TerminusDB) than
  from an independent debate. The prototype has stress-tested it in the ways listed above, but not yet
  under real concurrent editors.

## Tests not yet run

The full list is tracked as [repository issues](https://github.com/DiscantX/HumanTechTree/issues), and the
settled results are in the [tech index](tech-index.md#prototype-test-backlog). The ones that bear on
this essay are a test of apply with an explicit merge base, a check of what a conflicting rebase returns
through the client in full, the staged-landing queue against the live database (the first live run covered
concurrent landings, conflicts, the missing-branch check, and duplicate claims, while forced server failures
and retry caps have only been exercised with fake landings), and, if the server-error pattern matters after the queue exists, a repeat of
the pause measurement under a realistically sized database.
