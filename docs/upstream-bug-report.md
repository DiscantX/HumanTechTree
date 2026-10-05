# TerminusDB 12.0.7: Rebase Landing Failures and Status-Code Mismatches

Draft upstream report. Not yet submitted. The minimal reproductions (`npm run repro-rebase` and
`npm run repro-apply`) were run live on 2026-10-05, and each section below says what they showed. Counts
marked "recorded" come from earlier prototype runs, not from the minimal scripts. Section 4 has not been
re-run.

## Environment

- TerminusDB server 12.0.7, Docker container, single node, default `admin` / `root`.
- JavaScript client `terminusdb` 12.0.5.
- API reference: `docs/openapi.yaml` (label 12.0.5).

## Summary

What the minimal reproductions showed:

1. **Back-to-back rebase 500: reproduced, at a rate that varies.** Rebase returned 500 for 3 of 20 landings
   made directly after another landing, and 1 of 180 in a longer sequence. Apply returned none in 400 landings
   across the same kinds of setup. The body is a generic "Unexpected failure in request handler".
2. **Concurrent landings onto one branch fail with HTTP 500: reproduced, for both rebase and apply.** Apply's
   body names the cause (transaction retry count exceeded), and the target was left consistent.
3. **A missing branch returns 500 only for rebase: reproduced and narrowed.** Apply and log return a
   structured 400 for the same condition.
4. **Rebase replays an edge addition onto a state where its target was deleted, and succeeds: not
   re-run.** The reverse order is rejected, and so is the same edge when it is applied.
5. **A string size limit: not reproduced** up to 2,000,000 characters.

## 1. HTTP 500 on a rebase right after another landing

**Observed (recorded).** About one in seven sequential rebases that landed immediately after another landing
returned HTTP 500. With a one-second wait before each landing the count was zero. Fast-forwards never failed.
Retrying after a pause always succeeded. The server log adds nothing.

**Minimal reproductions, run 2026-10-05: reproduced, with a lower and unstable rate.**

- **Pairs onto `main`.** Twenty cycles of two back-to-back rebases, with both branches cut from `main`: 3 of
  the 40 returned 500. All three were the second landing of a pair, so 3 of 20 landings made directly after
  another and 0 of 20 first landings. The same sequence through apply returned no errors in 40.
- **A longer sequence onto a throwaway branch.** Thirty one-node branches cut from one snapshot and landed one
  after another, at pauses of 0, 0, 100, 250, 500 and 1000 ms, 30 landings each: rebase had 1 first-attempt 500
  in 180 (at 0 ms, so 1 of 60 there) and it landed on retry. Apply had 0 of 180. The one failure returned this
  body:

  ```json
  {"api:message":"Unexpected failure in request handler","api:status":"api:failure"}
  ```

The rate is not stable. The recorded run of the same sequence had 7 of 50 at 0 ms, and this one had 1 of 60.
One failure cannot show whether the pause matters, so the pause table below rests on the recorded run alone.
The cause is unknown. The pair runs land onto a large `main` and the sequential runs onto a branch cut from
a snapshot, which may matter. The numbers are small.

**Setup the report intends.**

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

All 180 applies landed on the first attempt (recorded). The measurement used one-commit branches and a small
database. The minimal scripts added 220 more applies with no errors (40 in the pair setup, 180 in the
sequential one). Apply has now landed 400 branches across these setups without a server error, while rebase
returned one in the same sequence and three in the pair runs. The difference suggests the failure is specific
to rebase's replay, not to landing twice in quick succession.

### Landing time

In the sequential runs a rebase of one one-node branch took 6.2 to 8.1 seconds on average (about 7.3 s across
the six pause settings), and an apply of the same branch took 0.16 to 0.25 seconds (about 0.21 s), roughly 34
times faster. The database was small and the server ran in an Alpine VM under VirtualBox, so the absolute
times are not meaningful, but the ratio was consistent across all six runs.

The pair runs were far quicker. Whole cycles of two rebases plus branch creation took roughly one second,
judging by the timestamps in the branch names (the script does not time them). In the pair runs a branch is
at most one commit behind its target. In the sequential runs a source can be up to 29 commits behind, so
the replay may scale with the distance. That was not tested.

## 2. Parallel landings onto one branch

**Observed (recorded).** With five rebases issued at once onto `main`, four failed with HTTP 500 in every
run. The failure rate falls to zero when the calls are serialized.

**Minimal reproduction, run 2026-10-05: reproduced.**

- Rebase, one round of five: one landed and four returned HTTP 500. The first run cut the five branches in a
  chain, since the script created each from the previous one. After the script was fixed to cut every branch
  from `main`, the result was the same, one landed and four returned 500. The script prints statuses only, so
  the rebase bodies were not sampled.
- Apply, ten rounds of five: 26 of 50 landed and 24 returned HTTP 500, with this body each time:

  ```json
  {"api:message":"Transaction retry count exceeded in internal operation","api:status":"api:server_error"}
  ```

- Consistency after the ten apply rounds: main held exactly 26 of the section's nodes, one for each apply
  that reported success. The failed applies left nothing behind.

The apply failures are transaction retries running out under contention, reported as a server error.

**Setup.** Create five branches with one unrelated commit each. Fire five landing calls onto `main` together
(`Promise.all`), one per branch, and count statuses. Repeat with `apply`.

**Expected.** One landing wins and the others either queue or return a conflict-type or retryable status the
client can act on.

## 3. Missing branch returns 500 from rebase

**Observed, run 2026-10-05.**

| Request | Status | Body |
| --- | --- | --- |
| `GET /api/log/.../branch/<missing>` | 400 | Structured `api:LogErrorResponse` with `api:UnresolvableAbsoluteDescriptor`, saying the branch does not exist |
| `POST /api/apply/...` with a missing source branch | 400 | Structured `api:ApplyErrorResponse` with `api:NotValidRefError` naming the reference |
| `POST /api/rebase/...` with `rebase_from` set to a missing branch | 500 | Not captured |

The earlier recorded finding, that a request naming a nonexistent branch returns 500, was too broad. Log and
apply handle the same condition with a structured 400. Only rebase returns a 500.

**What the spec says.** The wording matters here and an earlier draft overstated it.

- `DELETE /branch/{path}` documents 404 "Branch not found".
- `POST /rebase/{path}` and `GET /log/{path}` document 404 only as "Database not found".

So the spec does not promise 404 for a missing branch on rebase or log, and the 400 that log returns is not
in the spec either. The report should ask for rebase to match apply and log, and for the status to be
documented, rather than claim the spec is violated.

**Setup.** `rebase` with `rebase_from` pointing at a missing branch. Record the status and the body, which
the script does not yet print.

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

**Not reproduced.** A developer in the project's Discord said string values are limited to roughly 100 KB.
The minimal script wrote one `Node` document per size, with the string in its `subject` field, to a
throwaway branch through the document API. Every size from 10,000 to 2,000,000 characters (10,000, 50,000,
90,000, 100,000, 110,000, 150,000, 500,000, 2,000,000) returned HTTP 200, and a read-back found the document
each time. The script checked that the document was stored, not that its length survived the round trip.

The limit the Discord remark describes may apply to another field type, another endpoint, or another
version. Unless the condition is found, this item is dropped from the report. The prototype's own 2 MB
article limit is an application setting and does not depend on it.

## What we would like

- A retryable or conflict-type status, with a structured body, for contended landings. Apply already names the
  cause in its body; the status code should say it too.
- For rebase from a missing branch, the structured 400 that apply and log already return, and a documented
  status for the case.
- For the back-to-back rebase 500: a structured error body and a retryable status, or a fix, since apply
  does not show it.
- A statement, or a fix, for how replayed commits are validated against the target state.
