# TerminusDB 12.0.7: Rebase Landing Failures and Status-Code Mismatches

Draft upstream report. Not yet submitted. Every reproduction below must be re-run against the live
server before filing, and the counts marked "recorded" come from the prototype's own test log, not from
the minimal scripts. The apply figures come from the prototype's apply-experiments run (2026-10-04) and are
recorded the same way.

## Environment

- TerminusDB server 12.0.7, Docker container, single node, default `admin` / `root`.
- JavaScript client `terminusdb` 12.0.5.
- API reference: `docs/openapi.yaml` (label 12.0.5).

## Summary

Five issues, in rough order of impact. The cleanest reproduction is that one sequence of back-to-back
landings fails intermittently with `rebase` and never fails with `apply`, which points at the replay that
rebase performs.

1. `POST /api/rebase/{path}` returns an HTTP 500 with no error detail when it runs shortly after another
   landing on the same branch. The same sequence through `POST /api/apply/{path}` did not fail.
2. Concurrent landings onto one branch mostly fail with HTTP 500 rather than a retryable or conflict status,
   with both rebase and apply.
3. A request naming a branch that does not exist returns HTTP 500.
4. Rebase replays an edge addition onto a state where its target document was deleted, and succeeds. The
   reverse order is rejected, and so is the same edge when it is applied.
5. A limit on the size of a string value, reported by a maintainer in the project's Discord and not yet
   reproduced by us.

## 1. HTTP 500 on a rebase right after another landing

**Observed.** About one in seven sequential replays that landed immediately after another landing returned
HTTP 500 (recorded). With a one-second wait before each landing the count was zero. Fast-forwards never
failed. Retrying after a pause always succeeded. The response carries only the status code and the server
log adds nothing.

**Minimal reproduction (to be confirmed).**

1. Create a database with the document class used by the prototype.
2. Create branches `b1` and `b2` from `main`, and add one unrelated document on each.
3. Check out `main`, then call `rebase` with `rebase_from` set to `b1`.
4. Immediately, with no wait, call `rebase` with `rebase_from` set to `b2`.
5. Repeat the cycle at least 20 times with fresh branches and count the 500s.

**Expected.** Both rebases succeed, or the second returns a documented, retryable status.

### The same sequence with apply

Branches that each added one node were applied one after another onto one target, with a snapshot of the
common ancestor as `before`, so every apply landed on a target that had already moved. Each pause length had
30 applies, and the no-pause case was run twice.

| Pause before the landing | Server errors with apply | Server errors with rebase |
| --- | --- | --- |
| none | 0 of 60 | 7 of 50 |
| 100 ms | 0 of 30 | 3 of 30 |
| 250 ms | 0 of 30 | 1 of 30 |
| 500 ms | 0 of 30 | 1 of 30 |
| 1 second | 0 of 30 | 0 of 30 |

All 180 applies landed on the first attempt. The measurement used one-commit branches and a small database,
the same conditions as the rebase counts. The difference suggests the failure is specific to rebase's replay,
not to landing twice in quick succession.

## 2. Parallel landings onto one branch

**Observed.** With five rebases issued at once onto `main`, four failed with HTTP 500 in every run
(recorded). The failure rate falls to zero when the calls are serialized.

Apply fails the same way. In ten rounds of five simultaneous applies onto one target, 25 of 50 succeeded
and 25 returned server errors (recorded). The bodies of the failed applies were not sampled, and whether the
failures left the target consistent was not checked.

**Minimal reproduction (to be confirmed).** Create five branches with one unrelated commit each. Fire five
`rebase` calls onto `main` together (`Promise.all`), one per branch. Count statuses. Repeat with `apply`.

**Expected.** One landing wins and the others either queue or return a conflict-type status the client can
retry on.

## 3. Missing branch returns 500

**Observed.** A request that names a nonexistent branch returns HTTP 500 with a generic error body
(recorded).

**What the spec says.** The wording matters here and an earlier draft overstated it.

- `DELETE /branch/{path}` documents 404 "Branch not found".
- `POST /rebase/{path}` and `GET /log/{path}` document 404 only as "Database not found".

So the spec does not promise 404 for a missing branch on rebase or log. The report should ask for a
documented 404 (or 400) rather than claim the spec is violated.

**Minimal reproduction (to be confirmed).** `GET /api/log/admin/<db>/local/branch/does-not-exist`, and a
`rebase` call with `rebase_from` pointing at a missing branch. Record the status and body for each. Apply
with a missing branch has not been checked.

## 4. Rebase does not check replayed edits against the target's state

**Observed.**

- Branch A deletes node N1. Branch B adds an edge whose target is N1. When the history ends up with the
  deletion first and the edge addition replayed after it, the rebase succeeds and leaves a dangling
  reference.
- When the edge exists first and the deletion is replayed after it, the rebase fails with
  `instance_not_of_class`.

Apply does not behave like rebase here. On a staging branch where the target node had been deleted, apply's
own schema check refused the edge (`references_untyped_object`), while rebase let it through and only the
prototype's validation gate caught it.

**Documentation.** The OpenAPI description of rebase says only that it finds the most recent common commit
and reapplies the source's commits, then the branch's. A search of the docs repository found no statement
that a replayed commit is validated against the state it lands on. That silence is the finding: the
behavior is neither documented nor ruled out.

**Minimal reproduction.** Take the dangling-edge scenario from the prototype suite and reduce it to two
nodes, one edge, and one deletion. Run it in both orders.

**Expected.** Either the replay is rejected like the reverse order, or the docs state that referential
integrity is not checked during replay.

## 5. String value size limit

**Reported, not reproduced.** A developer in the project's Discord said string values are limited to roughly
100 KB. We have not tested it, and we do not know the exact limit, the status code, or whether the failure
is a clean rejection. The prototype keeps long-form prose out of the graph store partly for other reasons,
so this has not been hit in practice.

**Minimal reproduction (to be written).** Add a document with one string field at increasing sizes (for
example 50 KB, 100 KB, 500 KB, 2 MB) and record the status and body of each write, and whether a write that
fails leaves anything behind.

**Expected.** A documented maximum, and a distinct, structured error when it is exceeded.

## What we would like

- A structured error body and a retryable status for concurrent or back-to-back rebases, and for
  concurrent applies.
- A documented status for a missing branch.
- A statement, or a fix, for how replayed commits are validated against the target state.
- A documented maximum string size, with a distinct status when it is exceeded.
