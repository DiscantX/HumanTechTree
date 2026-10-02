# TerminusDB Investigation Findings, Roadmap, and Session Log

**Status:** Proposed  
**Date:** 2026-10-01  
**Author:** TerminusDB Expert AI (for primary agent Claude)

---

## 1. Project Overview & Architectural Context

The Human Tech Tree Wiki structures human discovery and history as a prerequisite directed acyclic graph (DAG).

* **Core Data Entities:**
  * **Nodes ([`wiki/tech/data-model.md`](wiki/tech/data-model.md:1)):** Discoveries, inventions, and achievements.
  * **Edges / Claims ([`wiki/policy/edge-schema.md`](wiki/policy/edge-schema.md:1)):** Ordered pair assertions with `relationship_kind`, `basis` (`HistoricalAttestation` vs `LogicalNecessity`, [`wiki/policy/historical-vs-logical-necessity.md`](wiki/policy/historical-vs-logical-necessity.md:1)), and `grounding` (`@subdocument` collections, [`wiki/policy/sourcing-and-citation-policy.md`](wiki/policy/sourcing-and-citation-policy.md:1)).
* **Storage and Revision Control ([`wiki/tech/database-choice.md`](wiki/tech/database-choice.md:1)):**
  * TerminusDB serves as the primary document graph database with native Git-for-data revision control (branches, immutable commit trees, rebase/merge, diffing).
  * Application-side merge queue ([`src/db/merge-queue.ts`](src/db/merge-queue.ts:1)), staged landings ([`src/db/staged-landing.ts`](src/db/staged-landing.ts:1)), and a validation gate ([`src/db/validation-gate.ts`](src/db/validation-gate.ts:1)) enforce graph acyclicity and referential integrity.

---

## 2. Technical Findings on Wishlist Items

### Item 1: One-Directional Replay Behavior & Target State Validation
* **Replay Mechanics:** TerminusDB rebasing (`POST /api/rebase/{path}` via [`rebaseBranch()`](src/db/rebase.ts:52)) replays commit deltas sequentially from a source branch onto the target branch tip.
* **Validation Gaps:** Rebase validates schema types per commit, but referential integrity across branch deletions is asymmetric:
  * Replaying an edge addition over a target branch where the target node was deleted succeeds during rebase without throwing an error ([`wiki/tech/tech-index.md`](wiki/tech/tech-index.md:210)).
  * Replaying the deletion of a node over an existing edge fails with `instance_not_of_class`.
* **Conclusion:** The application-level staged landing pipeline and validation gate are necessary safeguards before finalizing branch merges onto `main`.

### Item 2: Upstream Bug Report
Based on [`wiki/tech/tech-index.md`](wiki/tech/tech-index.md:229) backlog item 1 and test evidence from [`src/scripts/concurrent-suite.ts`](src/scripts/concurrent-suite.ts:1):
1. **Sequential Replay HTTP 500:** 1 in 7 sequential replays landing immediately (< 200ms) after a prior landing result in HTTP 500; resolved by adding a 1000ms pause.
2. **Parallel Landings:** 4 in 5 uncoordinated concurrent landings fail with HTTP 500, requiring serialized queueing.
3. **Missing Branch Status Code:** Non-existent branch lookups return HTTP 500 rather than OpenAPI-specified HTTP 404.
4. **Dangling Edge Replay:** Replaying an edge addition over a deleted target node produces a valid commit report instead of rejecting with a referential error.

### Item 3: Unambiguous Branch Existence & Commit-Log Pagination (Backlog Items 1 & 9)
* **Branch Existence:** Replace expensive `GET /api/log` queries in [`src/db/log.ts`](src/db/log.ts:23) with direct branch listing (`GET /api/branch/{org}/{db}` or SDK `client.getBranches()`).
* **Pagination:** Implement `{ start, count }` parameters in [`src/db/log.ts`](src/db/log.ts:23) to safely handle large commit histories without truncation or memory issues.

### Item 4: WOQL Path Queries for Cycle Detection & Blast Radius (Backlog Item 15)
* **Current State:** [`src/scripts/concurrent-suite.ts`](src/scripts/concurrent-suite.ts:289) fetches all Edge documents into JS memory for Kahn's algorithm and BFS traversal.
* **WOQL Path Traversal:** Replace with native server-side traversal:
  * **Cycle Detection:** `WOQL.path('v:Source', '(<@schema:source_node,@schema:target_node>)+', 'v:Source', 'v:Path')` filtered by `Basis/LogicalNecessity`.
  * **Blast Radius:** `WOQL.select('v:Descendant').distinct('v:Descendant').path(nodeIri, '(<@schema:source_node,@schema:target_node>)+', 'v:Descendant', 'v:Path')`.

### Item 5: Housekeeping Items
* **[`README.md`](README.md:1):** Update script listings and remove the outdated claim that rebase bypasses the JS client.
* **Environment Template:** Rename tracked `.env` to `.env.example`.

### Item 6: Lint and Code Conventions
* Adhere to Markdown lint rules (MD009 trailing whitespace, MD012 multiple blank lines, MD022 heading margin) and TypeScript standards in [`src/`](src/config.ts:1) with Google-style docstrings.

---

## 3. Execution Roadmap

```text
[Phase 0: Housekeeping & Baseline]
  ├── 1. Rename .env -> .env.example
  ├── 2. Update README.md (accurate script list & JS client rebase details)
  └── 3. Run Markdown / Code lint checks
         │
         v
[Phase 1: Deep Backlog Answers (Items 1, 3, 4)]
  ├── 4. Item 1: Verify Rebase & Target State Replay in OpenAPI Spec
  ├── 5. Item 3: Implement unambiguous branchExists & commit-log pagination
  └── 6. Item 4: Write & benchmark WOQL path queries for cycle detection / blast radius
         │
         v
[Phase 2: Upstream Bug Report (Item 2)]
  └── 7. Draft complete upstream bug report in wiki/tech/upstream-issues.md
         │
         v
[Phase 3: Backlog Update & Hand-off]
  └── 8. Update wiki/tech/tech-index.md with settled backlog findings
```

---

## 4. Session Work Log

* **2026-10-01 (Orientation & Plan):** Created `wiki/tech/session-findings-and-plan.md` documenting architecture, wishlist analysis, TerminusDB engine evaluation, and execution steps.
* **2026-10-01 (Feature Implementation & Tests):**
  * Renamed environment files ([`.env.example`](.env.example:1) and updated gitignore settings).
  * Refactored [`src/db/log.ts`](src/db/log.ts:1) adding native `{ start, count }` pagination support and an unambiguous `branchExists` helper via the REST API (`GET /api/db/{org}/{db}?branches=true`).
  * Designed and verified native server-side cycle detection and blast radius path queries in [`src/db/woql-queries.ts`](src/db/woql-queries.ts:1).
  * Drafted upstream bug report in [`wiki/tech/upstream-bug-report.md`](wiki/tech/upstream-bug-report.md:1).
  * Implemented and executed both offline contract tests ([`src/scripts/backlog-features-test.ts`](src/scripts/backlog-features-test.ts:1)) and live integration tests ([`src/scripts/backlog-features-live.ts`](src/scripts/backlog-features-live.ts:1)) against TerminusDB 12.0.7 with 100% success.

## Summary of Work and Accomplishments

The work completed during this session addressed Claude's project wishlist and resolved critical backlog items in the TerminusDB prototype codebase:

### 1. Housekeeping & Repository Hygiene

* **Environment Template:** Created [`.env.example`](.env.example:1) as a clean configuration template.
* **Documentation Update:** Refactored [`README.md`](README.md:1) to document active scripts (`init-db`, `reset-db`, `concurrent-suite`, `merge-queue-live`, `validation-gate-test`, `backlog-features-test`, `backlog-features-live`) and correct client rebase assumptions.

### 2. Unambiguous Branch Existence & Commit Log Pagination

* **Branch Preflight (`src/db/log.ts`):** Replaced the log-based heuristic preflight in [`src/db/merge-queue.ts`](src/db/merge-queue.ts:68) with an unambiguous branch existence check using `GET /api/db/{org}/{db}?branches=true` per OpenAPI specifications.
* **Commit Log Pagination (`src/db/log.ts`):** Added explicit `{ start, count }` query parameter support to `getCommitLog()` to prevent payload truncation on large history graphs.

### 3. Server-Side WOQL Path Queries (`src/db/woql-queries.ts`)

* **Graph Traversal:** Implemented server-side WOQL path query builders (`cycleDetectionQuery()` and `blastRadiusQuery()`) utilizing TerminusDB's native `WOQL.path()` expression (`(<@schema:source_node,@schema:target_node>)+`).
* **Performance Benefit:** Offloads transitive closure, cycle detection, and blast radius computations from client memory to TerminusDB's C/Rust graph engine.

### 4. Upstream Bug Report (`wiki/tech/upstream-bug-report.md`)

* **Documentation:** Drafted a formal bug report detailing four key anomalies observed in TerminusDB 12.0.7:
  1. Intermittent HTTP 500 errors on rapid sequential rebase landings (mitigated by a 1000ms delay).
  2. High HTTP 500 failure rate on parallel uncoordinated branch landings.
  3. Missing-branch status code discrepancy returning HTTP 500 instead of HTTP 404.
  4. Asymmetric rebase replay validation allowing dangling edge creation.

### 5. Comprehensive Test Suites & Verification

* **Contract Tests (`src/scripts/backlog-features-test.ts`):** Validated AST query generation and helper function signatures.
* **Live Integration Tests (`src/scripts/backlog-features-live.ts`):** Created an end-to-end live test suite that connects to TerminusDB 12.0.7, verifies live branch existence checks, tests commit log pagination, seeds schema-compliant nodes and logical-necessity edges forming a cycle, executes server-side WOQL cycle detection and blast radius queries, cleans up test branches, and verifies 100% test success (`npm run backlog-features-live`).

### 6. Session Documentation (`wiki/tech/session-findings-and-plan.md`)

* **Hand-Off Artifact:** Recorded technical findings, architectural decisions, and a complete session work log for Claude.
