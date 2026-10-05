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
> operation is apply, called through the official client (`client.apply`) with an explicit merge base,
> because it merges at field level, reports a conflict as a structured 409, can carry the real editor as
> the commit's author, and showed no server errors in sequential landings where rebase failed about one
> time in seven. Rebase, which the documentation itself calls merging, is kept for one step only: moving
> a staging branch that has passed the gate onto the target as a fast-forward. Because parallel landings
> still fail and the store does not catch every invalid combination, every merge goes through an
> application-side merge queue that serializes landings, translates errors, retries transient failures,
> and resolves conflicts on a fresh branch.**

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
  only, not for rebase. A live test showed that apply does work as a three-way merge when given an explicit
  base (see below).
- **The commit log is plain HTTP.** The spec marks the JavaScript client's log method as not
  implemented. The docs' reset page shows a `getCommitHistory()` method, but it does not exist in either
  published client package, so the prototype keeps a small HTTP helper for it.
- **Reading a document as of a past commit works.** A GET on the document endpoint against a commit
  reference returned the first version of a document after a later commit had changed it, while the branch
  head showed the second. The per-document history endpoint, asked about one document on a small database,
  returned the commits that touched it, with each commit's author, identifier, and timestamp. Its behavior
  on a large database was not tested here.
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
- **Space landings only when replaying with rebase.** Wait about a second after a landing before replaying
  the next branch onto main. The server errors fell from about one in seven with no wait to none in 30 at
  one second. Apply showed no sequential errors at any pause, so in apply mode the spacing defaults to
  zero, and `MIN_GAP_MS` can set it in either mode.
- **Use the official client.** Apply is a single `client.apply` call, and rebase a single `client.rebase`
  call, each on a client whose current branch is the target. Each landing uses a fresh client so no branch
  state leaks between calls.
- **Land through a staging branch and the validation gate.** Branch staging off the target, replay the source
  onto it, run the gate there, and only then replay staging onto the target, which is a fast-forward when
  nothing else has written to main. Main therefore only ever moves to a state that passed the gate, and a
  failing edit never reaches it. This depends on the queue being the only writer to main. The staging
  branch is deleted afterward, and a retry starts from a fresh one. Live runs confirmed the refusals. An edge
  to a node that another branch had deleted was refused with the dangling-edge violation, and an edge that
  closed a cycle was refused with the cycle violation. In both, the first change landed, no refused edge
  reached the target, and no staging branch was left behind.
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
by the rebase itself. Apply creates a commit, and its author override is covered below.

## Apply as a three-way merge

A live test gave apply an explicit merge base: a snapshot of the common ancestor as `before`, the editor's
branch as `after`, run against the branch that had since moved. Both a bare branch name and a bare commit ID
worked as `before`. The spec asks for bare names or IDs, and full paths are rejected as invalid references.

- **Different fields merge.** Two edits to different fields of one document, one landed first and the other
  applied on top, both survived.
- **The same field is a structured 409.** The response is `api:ApplyError` with `api:status` of
  `api:conflict` and a list of witnesses. Each names the document and the field, with the expected and
  found values, which is much easier to translate than the schema-validation errors a conflicting rebase
  produces. The first edit's value stayed on the target.
- **The base has to be known.** The server does not supply one. The application records the commit a
  branch was cut from when it creates the branch (see below), where the test kept a snapshot branch at that point.
  A successful rebase does report a common commit, but only after it has already landed.
- **It squashes.** Apply makes one commit, and the SDK stamps it with the login user as author by default.
  Passing the author in the request's commit information overrides it: a commit applied with an author of
  `alice` showed `alice` in the log. Apply can therefore carry the real editor.
- **`match_final_state` defaults to true.** A conflict is waved through when both sides produce the same
  final state, which matches how identical concurrent edits already converge under rebase.

These results are the basis for the position above: apply is the merge, with rebase kept for the final
fast-forward. What is still open about it is listed below.

### Apply under the conditions that break rebase

The pause measurement made for rebase was repeated with apply. Branches that each added one node were applied
one after another onto one target, using a snapshot as the base, so every apply landed on a target that had
already moved. Each pause length had 30 applies.

| Pause before the apply | First-attempt server errors with apply | With rebase |
| --- | --- | --- |
| none (run twice) | 0 of 60 | 7 of 50 (14 percent) |
| 100 ms | 0 of 30 | 3 of 30 |
| 250 ms | 0 of 30 | 1 of 30 |
| 500 ms | 0 of 30 | 1 of 30 |
| 1 second | 0 of 30 | 0 of 30 |

All 180 applies landed on the first attempt, with no 409s, and the mean time per apply was 140 to 270
milliseconds. Parallel applies still failed: in ten rounds of five simultaneous applies onto one target, 25
of 50 succeeded and 25 returned server errors, against one success in five for rebase. The failed applies'
bodies were not sampled, and whether the failures left the target consistent was not checked here. Landings
therefore still have to be serialized, but the sequential errors that forced the one-second spacing did not
appear with apply. The measurement used one-commit branches and a small database, the same conditions as the
rebase table.

### Apply in the merge queue

The queue's apply mode is its default. Running the live scripts with `--rebase`, or setting
`LANDING_MODE=rebase`, selects the old rebase landing for comparison runs. The staging step
replays the source onto the staging branch with apply and the merge base, which is recorded when the branch is
created or, when there is no record, derived from the two branches' logs (see "Where the merge base comes from" below). The final step from staging to the target stays a rebase fast-forward (see "The last step" below), and the spacing
between landings is off. The live queue scenarios were rerun through it.

- **Concurrent landings.** Six simultaneous landings all landed with no retries and no spacing, in 6.5
  seconds in total, 0.75 to 1.9 seconds each with the staging steps included. That was not measured side by
  side with rebase.
- **Conflicts.** The second of two edits to one field was reported as a conflict, not retried, and the first
  editor's text stayed. A resolution written on a fresh branch landed. A duplicate claim under the composite
  key landed once and conflicted the second time.
- **The gate.** The missing-branch preflight and the refusal of an edge that closes a cycle behaved as with
  rebase.
- **An edge to a deleted node is refused by apply itself.** On the staging branch the store's own schema check
  rejected the edge, with a witness of `references_untyped_object`, before the gate ran. With rebase the
  same replay succeeded and only the gate caught it. The queue reads that body as a deleted reference. The
  gate's dangling-edge check stays as a backstop, since the refusal was seen in one direction only.
- **Every landing took one attempt,** about a dozen across the scenarios.

### The last step: fast-forward or apply

The last step, moving the target to a staged state that has already passed the gate, stays a rebase
fast-forward. Apply can do the same job, so the choice was measured, not assumed. Nothing in the results
argues for changing it, and the fast-forward keeps the staged commit, its author and its history as they are.

The comparison ran the step three ways on identical setups, with staging built as the queue builds it: cut
from the target, with the edit applied onto it by the editor. The three were a rebase fast-forward, an apply
from staging to the target using the base recorded when staging was cut, and the same apply with the editor
passed as the commit's author. The target was a throwaway branch.

- **None of them failed.** There were no server errors or conflicts in 120 runs across the three modes, on an
  unmoved target, with a three-commit staging branch, and with a target moved by a foreign write.
- **Time was not the deciding factor.** On an unmoved target, 30 runs per mode, the fast-forward averaged 416
  milliseconds (fastest 71, slowest 2,285), apply 751 (125 to 3,607) and apply with the editor 685 (107 to
  3,151). Every mode had occasional runs of two to four seconds, so the typical difference is under a second
  and is small against a landing that also includes the staging merge and the gate. The runs used one-node edits
  on a small database in a virtual machine, and medians were not computed.
- **The fast-forward lands the staged commit itself.** The target's head was the staged commit in 30 of 30
  runs. Apply never did, because it writes a new commit, but the content of the target equalled the staging
  branch's in every run of every mode. What the gate checked is what lands either way. Reviews bind to a
  content hash (see Data Model), so the commit identity matters for audit and not for review
  binding.
- **The editor survives the fast-forward.** The head commit kept the editor as author in 30 of 30 runs. Apply
  recorded the service account unless the author was passed in the request, in which case it recorded the editor.
  The queue already carries the author in apply mode, so apply would need no new input.
- **History collapses under apply.** A staging branch holding three commits stayed three commits on the target
  under the fast-forward and became one under apply, in 5 of 5 runs each. The queue normally lands one edit per
  staging branch, so the single-commit case was identical in all three modes.
- **A moved target landed correctly in all three modes.** With a foreign write on the target after staging was
  cut, all 15 runs landed with both the foreign and the staged change present, and a rebase replay raised no
  server errors in these five runs. The replayed commit was recorded under the service account in 5 of 5 runs,
  where apply with the author recorded the editor. This differs from what "Who made an edit" reports for a
  replay, and the two have not been reconciled (see the open questions). The queue is the only writer to main,
  so this case is not expected at the final step.

Apply with the author passed is a proven fallback. It was reliable in every run, produced the same content,
and cost about 300 milliseconds more on average. If rebase had to be removed from the path, the last step
would change to an apply from staging using the recorded staging base, with the editor as author, and the
staged history would collapse to one commit.

### Where the merge base comes from

The application records the base when it creates a branch and passes it to the queue as `baseCommit`. The
log-derived finder stays as the fallback for a branch that has no record, so a branch made by any other route
still lands. The record avoids reading two commit logs on every landing, which should matter more the further a
branch has drifted from the target. Two live runs on a small database showed no measurable difference: the
landings took between 0.8 and 4.9 seconds, and the recorded base was slower in one run (2.6 seconds against 1.9
for a derived one) and faster in the other (0.9 against 1.4). The staging, apply and gate steps dominate. The
saving is unmeasured on a large database. The
recorded and derived bases gave the same merged result, with the editor's field and the other landing's field
both surviving.

- **The base is read from the new branch.** The helper creates the branch and then reads the new branch's
  own head. A branch with no commits of its own has the commit it was cut from as its head, so the recorded
  base is exact even if the parent moved while the branch was being created.
- **The record outlives the landing.** It is written at creation, read on every attempt, so a retry after a
  transient failure reuses the same base, and kept after landing, marked landed. Apply squashes, so once the
  branch is deleted neither the landed commit nor the log says what the edit was cut from. A conflict abandons
  the branch, and the resolution gets a fresh branch with a new record. Where the record lives, and how long it
  is kept, belong to the Versioning and Reviews essay: the natural home is the application's own database,
  next to the proposal, with retention following the proposal's.
- **A wrong base is refused.** A recorded base that is not one of the source branch's own commits halts the
  landing before the staging branch is created. The outcome is `invalid_base`, nothing is changed (live run:
  the target kept the other landing's field, and no staging branch was left behind), and the
  result says why and how to proceed: create a fresh branch from the current target and replay the edit on
  it, or, if the record is known to be wrong, land again with no recorded base so one is derived. The queue
  does not fall back to the derived base on its own, because that would hide a recording bug. The refusal is
  not retried, and a log that cannot be read halts the landing as unrecognized and not as a pass.
- **Why the check exists.** In the live run, before the check was added, a landing with the target's head
  passed as the base reported `landed`, and the target lost a field another landing had added. Apply takes the
  difference from the base to the editor's branch, and a base that is too new makes that difference include
  undoing the other landing. Nothing reported an error. Passing the target's head as the base is a plausible
  application mistake.
- **What the check does not cover.** It is necessary and not sufficient. It accepts a base that is on the
  branch but older than the real cut point, which produces false conflicts and re-applies earlier edits, not
  silent loss, and it does not check that the base is on the target.
- **A branch lands once.** After a squash, a branch that keeps being edited has a derived base at its original
  cut point, so its earlier edits would be applied again. The fresh-branch rule already treats a branch as
  disposable. Whether that becomes an enforced rule is left to the Versioning and Reviews essay.

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

- **A stale record.** A record could go stale if a branch were ever re-cut onto a newer target. The check
  refuses a base that is not on the branch, but not one that is merely older than the real cut point. Whether a
  re-cut refreshes the record or retires the branch is not decided.
- **What apply's squash costs.** Apply turns a branch of several commits into one. Whether that history
  matters to reviewers, and how it interacts with reviews bound to a content hash, is not settled. A
  side-by-side timing comparison with rebase on a larger database has not been run either.
- **Whether a rebase replay keeps the editor as author.** "Who made an edit" reports that a commit replayed
  onto a moved main kept its editor. A later run replayed a staged commit, whose author had been set through
  apply's commit information, onto a moved target, and the head was the service account in 5 of 5 runs. The
  difference may lie in how the commit got its author, and it has not been checked. Until it is, the queue
  should not rely on a replay preserving the author. The final fast-forward does preserve it.
- **The cause of the intermittent server errors.** Unknown, and absent from the documentation. A new lead is
  that apply did not show the sequential errors at all, which points at the replay that rebase performs
  and not at landing onto a branch that has just moved. The pattern is characterized and the workaround is
  spacing and retrying, but a report to the maintainers
  should include the minimal reproduction (a replay landed immediately after another landing on main) and
  the missing-branch 500, which contradicts the spec. The project is already on the latest server release,
  so an upgrade retest is not currently available.
- **Branch workflow.** Whether low-permission editors work in individual branches merged by reviewers,
  or something closer to Wikipedia's direct-edit-with-revert model layered on top of TerminusDB's
  branches, is not decided. The fresh-branch conflict resolution path adds a consideration: an editor's
  branch is disposable when it conflicts.
- **Whether one-claim-per-document holds up under real load.** Supported in every case tried, including
  concurrent appends to groundings and objections nested in a claim (see [Data Model](data-model.md)). All
  of it was on small graphs with simulated edits. Two branches editing the same nested entry were tested
  and behave as described in the Data Model.
- **This essay's own depth.** The position still follows more from a prior decision (TerminusDB) than
  from an independent debate. The prototype has stress-tested it in the ways listed above, but not yet
  under real concurrent editors.

## Tests not yet run

The full list is tracked as [repository issues](https://github.com/DiscantX/HumanTechTree/issues), and the
settled results are in the [tech index](tech-index.md#prototype-test-backlog). The ones that bear on
this essay are a check of what a conflicting rebase returns
through the client in full, the staged-landing queue against the live database (the live runs covered
concurrent landings, conflicts, the missing-branch check, duplicate claims, and the refusal of a dangling edge
and of a cycle, while forced server failures and retry caps have only been exercised with fake landings), and, if the server-error pattern matters after the queue exists, a repeat of
the pause measurement and a timing run of apply against rebase, both under a realistically sized database. The
recorded merge base and the refusal of a wrong one have passed live (`npm run base-record-live`).
