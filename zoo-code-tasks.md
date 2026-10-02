# Zoo Code Tasks

Each task is self-contained. Do exactly what is listed. Do not change anything else, and do not add
analysis or recommendations. Report results as plain output.

## Task 1: Fix `branchExists` error handling

File: `src/db/log.ts`.

The endpoint `GET /api/db/{org}/{db}?branches=true` is correct (the docs page `branch-howto` shows the
response `{"path": "...", "branches": ["feature", "main"]}`). Keep it. Change the error handling only:

1. Return `true` or `false` only when the response is a 200 with a `branches` array.
2. When the status is 404, return `false`.
3. For any other status or a network error, throw an `Error` that includes the status code.
4. Update `src/scripts/backlog-features-test.ts` so the offline test covers: 200 with the branch present,
   200 with the branch absent, 404, 401, and a thrown network error.
5. Check that `src/db/merge-queue.ts` still handles a thrown error from the dependency sensibly, and
   report what it does. Do not change it.

## Task 2: Tighten the WOQL queries

File: `src/db/woql-queries.ts` and `src/scripts/backlog-features-live.ts`.

The path pattern `(<source_node,target_node>)+` is correct. The docs define `<F` as follow backward and
`F>` as follow forward. Do not change it. Make these changes:

1. A path pattern cannot filter by property value, so `cycleDetectionQuery` currently walks every edge
   whatever its basis. Add a comment in the file saying so. Then add `cycleDetectionQueryAll` as a second
   exported function and leave the existing one in place. The gate's `cycle` check considers only
   `LogicalNecessity` edges, so a mixed-basis result must not be compared with it directly.
2. In the live test, add a graph with no cycle and assert that the cycle query returns zero bindings.
3. Add a diamond graph (A to B, A to C, B to D, C to D) and assert that the blast radius of A is exactly 3
   distinct nodes: B, C and D.
4. Add a case where an edge points from D back to A in a second branch, and report whether the blast radius
   query terminates and what it returns.

## Task 3: Documentation fixes

1. Move `wiki/tech/session-findings-and-plan.md` to `docs/session-log.md` (create `docs/` if needed), or
   delete it if `docs/` is not wanted. Ask which in your report; do not guess.
2. Replace `wiki/tech/upstream-bug-report.md` with the contents of `upstream-bug-report.md` supplied
   alongside this file, placed at `docs/upstream-bug-report.md`. Delete the old file.
3. Remove trailing whitespace from every `.md` file in the repo, including the two-space line breaks after
   `**Status:**`. Run a markdown lint for MD009, MD012 and MD022 and report the output.

## Task 4: Reproduction scripts

Create `src/scripts/repro-rebase.ts` that runs the three reproductions from section 1, 2 and 3 of
`docs/upstream-bug-report.md` against the live server. For each, print the HTTP status of every call and a
count of statuses. Add npm script `repro-rebase`. Do not draw conclusions. Report the printed counts
exactly.

## Task 5: Docs question (answer only from the docs repo)

Search the docs clone for any statement that a rebased or replayed commit is checked against the target
branch's current state (referential integrity, schema validation, or conflicts). Quote the file path and
line for each hit. If there are no hits, say "no hits" and list the search terms used.
