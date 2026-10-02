# TerminusDB Upstream Bug Report & Concurrency Findings

**Status:** Proposed  
**Target TerminusDB Version:** 12.0.7  
**API Specification Version:** OpenAPI 12.0.5  
**Evidence Source:** Prototype test suite ([`src/scripts/concurrent-suite.ts`](src/scripts/concurrent-suite.ts:1)) and execution runs recorded in [`wiki/tech/tech-index.md`](wiki/tech/tech-index.md:214).

---

## Summary

This report documents four critical behavioral anomalies and specification discrepancies observed during concurrency and version-control stress testing of TerminusDB 12.0.7 for the Human Tech Tree Wiki project.

---

## Bug 1: Intermittent HTTP 500 on Sequential Rebase Landings

### Description
When sequential rebase landings (`POST /api/rebase/{path}`) are executed against a single branch (`main`) with zero delay between requests, approximately 1 in 7 requests (14%) fails with an internal server error (HTTP 500) containing no descriptive error body or stack trace.

### Minimal Reproduction
```typescript
for (let i = 0; i < 20; i++) {
  const branch = `feature-${i}`;
  await client.branch(branch);
  client.checkout(branch);
  await client.addDocument([/* valid node doc */]);
  // Immediate rebase onto main without delay
  await client.rebase({
    rebase_from: `admin/tech_tree_dev/local/branch/${branch}`,
    author: 'admin',
    message: `Landing ${i}`
  });
}
```

### Workaround
Introducing a minimum 1000ms delay (`minGapMs`) between landing operations reduces the failure rate to 0%.

---

## Bug 2: High HTTP 500 Failure Rate on Parallel Branch Landings

### Description
When multiple branches attempt to land (rebase onto `main`) concurrently without serialization, 4 out of 5 requests fail with HTTP 500 internal server errors rather than returning a structured HTTP 409 conflict or optimistic concurrency retry response.

### Impact
Forces the implementation of an application-level single-writer serialized merge queue ([`src/db/merge-queue.ts`](src/db/merge-queue.ts:1)).

---

## Bug 3: Missing Branch Error Code Mismatch (HTTP 500 vs HTTP 404)

### Description
When attempting a rebase or commit log retrieval on a branch name that does not exist in the database, the server responds with HTTP 500 (`{"api:status": "An error occurred"}`).

### Specification Violation
The OpenAPI specification for TerminusDB explicitly defines HTTP 404 (`Not Found`) for non-existent branch or resource paths. Returning 500 conflates missing resources with server crashes.

---

## Bug 4: Asymmetric Referential Integrity Validation in Rebase Replay

### Description
During branch rebase replay:
1. If Branch A deletes Node $N_1$, and Branch B adds Edge $E(N_1 \to N_2)$, replaying Branch B onto Branch A succeeds and inserts the dangling edge without raising a schema or foreign key violation during the rebase operation.
2. Conversely, replaying the deletion of $N_1$ when an edge already references it correctly rejects with `instance_not_of_class`.

### Expected Behavior
Rebase replay should validate referential integrity against the target branch's graph state and reject dangling edge creation.
