/**
 * Live integration test suite for enhanced backlog features against TerminusDB.
 *
 * Exercises branchExists, log pagination, and server-side WOQL path queries
 * for cycle detection and blast radius against a running TerminusDB instance.
 */

import { config } from '../../config';
import { createClient } from '../../db/client';
import { branchExists, getCommitLog } from '../../db/log';
import { cycleDetectionQuery, blastRadiusQuery, executeWoqlQuery } from '../../db/woql-queries';

let failures = 0;

/**
 * Asserts that a condition is true and logs the status to the console.
 *
 * Args:
 *     name: Description of the assertion.
 *     ok: Boolean condition to evaluate.
 *     detail: Optional message to print.
 */
const check = (name: string, ok: boolean, detail = ''): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

/** Normalize full IRIs or object references to short IDs for comparison. */
const shortId = (x: string): string => x.replace(/^terminusdb:\/\/\/data\//, '');
const refId = (x: any): string => shortId(typeof x === 'string' ? x : x?.['@id']);

/** Helper to generate schema-compliant Node documents */
const nodeDoc = (subject: string) => ({
  '@type': 'Node',
  subject,
  category: 'Invention',
});

/** Helper to generate schema-compliant Edge documents */
const edgeDoc = (source: string, target: string, basis: string, statement = 'test claim') => ({
  '@type': 'Edge',
  source_node: source,
  target_node: target,
  statement,
  relationship_kind: 'MaterialNecessity',
  basis,
  status: 'Green',
});

async function run() {
  const client = createClient();
  client.db(config.db);

  console.log('--- TerminusDB Enhanced Backlog Features Live Test Suite ---\n');

  // 1. Test Live Branch Existence Check
  console.log('Testing live branch existence check...');
  const mainExists = await branchExists('main');
  check('main branch exists on database', mainExists);

  const nonExistentExists = await branchExists('non-existent-branch-xyz');
  check('non-existent branch is not reported as existing', !nonExistentExists);

  // 2. Test Live Commit Log Pagination
  console.log('\nTesting live commit log pagination...');
  const paginatedLog = await getCommitLog('main', { start: 0, count: 2 });
  check('getCommitLog returns array with pagination options', Array.isArray(paginatedLog));
  if (paginatedLog) {
    check('getCommitLog limits returned commit count to requested limit', paginatedLog.length <= 2);
  }

  // 3. Create Temporary Branch for Graph Traversal Tests
  const testBranch = `test_backlog_live_${Date.now()}`;
  console.log(`\nCreating temporary test branch "${testBranch}"...`);
  await client.branch(testBranch);
  client.checkout(testBranch);

  try {
    // 4. Populate Schema-Compliant Nodes and Edges on Test Branch
    console.log('Inserting schema-compliant Node and Edge documents...');
    const nodeRes = await client.addDocument([
      nodeDoc('Alpha Concept'),
      nodeDoc('Beta Concept'),
      nodeDoc('Gamma Concept'),
    ]);
    const [alphaId, betaId, gammaId] = nodeRes as string[];
    console.log('Inserted node IDs:', { alphaId, betaId, gammaId });

    // Create a cycle: Alpha -> Beta -> Gamma -> Alpha (all LogicalNecessity)
    const edges = [
      edgeDoc(alphaId, betaId, 'LogicalNecessity', 'Alpha enables Beta'),
      edgeDoc(betaId, gammaId, 'LogicalNecessity', 'Beta enables Gamma'),
      edgeDoc(gammaId, alphaId, 'LogicalNecessity', 'Gamma enables Alpha'),
    ];
    await client.addDocument(edges);
    console.log('Graph structure initialized (Alpha -> Beta -> Gamma -> Alpha).');

    // 5. Execute Live Cycle Detection WOQL Query
    console.log('\nExecuting server-side Cycle Detection query...');
    const cycleBindings = await executeWoqlQuery(client, cycleDetectionQuery(), testBranch);
    check('Cycle detection query runs and detects logical cycle', cycleBindings.length > 0);

    // 6. Execute Live Blast Radius WOQL Query
    console.log('\nExecuting server-side Blast Radius query...');
    const blastQuery = blastRadiusQuery(alphaId);
    const blastBindings = await executeWoqlQuery(client, blastQuery, testBranch);
    check('Blast radius query runs and returns descendant paths', blastBindings.length > 0);
    if (blastBindings.length > 0) {
      const descendants = Array.from(new Set(blastBindings.map((b: any) => refId(b.Descendant))));
      console.log(`Reachable Node descendants from ${alphaId}: ${descendants.join(', ')}`);
      check('Beta node is in blast radius of Alpha', descendants.includes(refId(betaId)));
      check('Gamma node is in blast radius of Alpha', descendants.includes(refId(gammaId)));
    }

    // --- Additional Live Tests for Task 2 ---
    // Test 2: Graph with no cycle
    console.log('\nTesting graph with no cycle returns zero cycle bindings...');
    const noCycleBranch = `test_nocycles_${Date.now()}`;
    await client.branch(noCycleBranch);
    client.checkout(noCycleBranch);
    try {
      const nRes = await client.addDocument([nodeDoc('N1'), nodeDoc('N2'), nodeDoc('N3')]);
      const [n1, n2, n3] = nRes as string[];
      await client.addDocument([
        edgeDoc(n1, n2, 'LogicalNecessity', 'N1->N2'),
        edgeDoc(n2, n3, 'LogicalNecessity', 'N2->N3'),
      ]);
      const noCycleBindings = await executeWoqlQuery(client, cycleDetectionQuery(), noCycleBranch);
      check('Graph with no cycle returns zero bindings for cycle detection', noCycleBindings.length === 0);
    } finally {
      client.checkout('main');
      await client.deleteBranch(noCycleBranch);
    }

    // Test 3: Diamond graph (A->B, A->C, B->D, C->D)
    console.log('\nTesting diamond graph blast radius...');
    const diamondBranch = `test_diamond_${Date.now()}`;
    await client.branch(diamondBranch);
    client.checkout(diamondBranch);
    try {
      const dRes = await client.addDocument([
        nodeDoc('Node A'),
        nodeDoc('Node B'),
        nodeDoc('Node C'),
        nodeDoc('Node D'),
      ]);
      const [aId, bId, cId, dId] = dRes as string[];
      await client.addDocument([
        edgeDoc(aId, bId, 'LogicalNecessity', 'A->B'),
        edgeDoc(aId, cId, 'LogicalNecessity', 'A->C'),
        edgeDoc(bId, dId, 'LogicalNecessity', 'B->D'),
        edgeDoc(cId, dId, 'LogicalNecessity', 'C->D'),
      ]);
      const blastQ = blastRadiusQuery(aId);
      const blastB = await executeWoqlQuery(client, blastQ, diamondBranch);
      const desc = Array.from(new Set(blastB.map((b: any) => refId(b.Descendant))));
      console.log(`Diamond graph blast radius from A: ${desc.join(', ')}`);
      check('Blast radius of A in diamond graph is exactly 3 distinct nodes (B, C, D)',
        desc.length === 3 && desc.includes(refId(bId)) && desc.includes(refId(cId)) && desc.includes(refId(dId))
      );

      // Test 4: Edge from D back to A in a second branch / cyclic diamond
      console.log('\nTesting blast radius with edge from D back to A...');
      await client.addDocument([
        edgeDoc(dId, aId, 'LogicalNecessity', 'D->A'),
      ]);
      const cyclicBlastQ = blastRadiusQuery(aId);
      const startedAt = Date.now();
      const cyclicBlastB = await executeWoqlQuery(client, cyclicBlastQ, diamondBranch);
      const elapsed = Date.now() - startedAt;
      const cyclicDesc = Array.from(new Set(cyclicBlastB.map((b: any) => refId(b.Descendant))));
      console.log(`Cyclic diamond blast radius from A (took ${elapsed}ms): ${cyclicDesc.join(', ')}`);
      check('Blast radius query terminates even with cycle from D back to A', true, `Terminated in ${elapsed}ms, returned ${cyclicDesc.length} nodes (${cyclicDesc.join(', ')})`);
    } finally {
      client.checkout('main');
      await client.deleteBranch(diamondBranch);
    }

  } finally {
    // 7. Cleanup Test Branch
    console.log(`\nCleaning up test branch "${testBranch}"...`);
    client.checkout('main');
    await client.deleteBranch(testBranch);
    console.log('Cleanup completed.');
  }

  console.log('\n--- Live Test Result Summary ---');
  console.log(failures === 0 ? 'All live backlog feature tests passed successfully!' : `${failures} test(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('\nLive test run encountered a fatal error:', err);
  process.exit(1);
});
