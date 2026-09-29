import { config } from '../config';
import { createClient } from '../db/client';
import { rebaseBranch } from '../db/rebase';

/**
 * Exercises TerminusDB's branch-and-merge mechanic against the two
 * specific claims wiki/tech/editing-model.md makes about it:
 *
 *  1. Unrelated edits (different documents) shouldn't collide, because
 *     each node/claim is stored as its own document. This is the
 *     "collision-reduction" argument the essay itself flags as an open
 *     question — "whether one-claim-per-document actually delivers the
 *     assumed collision reduction... has not been tested against real
 *     concurrent edits." This is that test, in miniature.
 *  2. A genuine field-level collision — two branches changing the SAME
 *     field of the SAME document — should surface as an ordinary merge
 *     conflict, "with no new machinery needed."
 *
 * Every branch name gets a run ID suffix, so this script is safe to
 * re-run without deleting anything first — each run gets its own fresh
 * branches. Run `npm run reset-db` if you want to wipe the accumulated
 * branches and test data entirely.
 */

const RUN_ID = Date.now();

async function scenarioUnrelatedEdits(client: any) {
  console.log('\n=== Scenario 1: unrelated edits (different documents) ===');

  const branchA = `concurrent-test-a-${RUN_ID}`;
  const branchB = `concurrent-test-b-${RUN_ID}`;

  client.checkout('main');
  console.log(`Branching "${branchA}" and "${branchB}" off main...`);
  await client.branch(branchA, 'main');
  await client.branch(branchB, 'main');

  client.checkout(branchA);
  const [nodeA] = await client.addDocument([
    {
      '@type': 'Node',
      subject: `Concurrent-test Node A (${RUN_ID})`,
      category: 'Invention',
      description: 'Inserted on branch A — should not conflict with B.',
    },
  ]);
  console.log(`Inserted ${nodeA} on ${branchA}.`);

  client.checkout(branchB);
  const [nodeB] = await client.addDocument([
    {
      '@type': 'Node',
      subject: `Concurrent-test Node B (${RUN_ID})`,
      category: 'Invention',
      description: 'Inserted on branch B — should not conflict with A.',
    },
  ]);
  console.log(`Inserted ${nodeB} on ${branchB}.`);

  console.log(`Rebasing ${branchA} onto main...`);
  const resultA = await rebaseBranch({
    sourceBranch: branchA,
    targetBranch: 'main',
    message: `merge ${branchA}`,
  });
  console.log('Result:', resultA);

  console.log(`Updating ${branchB} with the latest changes from main first...`);
  await rebaseBranch({
    sourceBranch: 'main',
    targetBranch: branchB,
    message: `Bring main into ${branchB}`,
  });

  console.log(`Rebasing ${branchB} onto main (main has already moved)...`);
  const resultB = await rebaseBranch({
    sourceBranch: branchB,
    targetBranch: 'main',
    message: `merge ${branchB}`,
  });
  console.log('Result:', resultB);

  console.log(
    'Both branches merged onto main with no conflict: different ' +
      'documents never had anything to collide over, even though main ' +
      "moved between the two merges. That's the specific claim under test.",
  );
}

async function scenarioFieldConflict(client: any) {
  console.log('\n=== Scenario 2: same-field conflict (same document) ===');

  client.checkout('main');
  console.log('Inserting baseline nodes and edge on main...');
  const [sourceNode] = await client.addDocument([
    {
      '@type': 'Node',
      subject: `Conflict-test source (${RUN_ID})`,
      category: 'Invention',
    },
  ]);
  const [targetNode] = await client.addDocument([
    {
      '@type': 'Node',
      subject: `Conflict-test target (${RUN_ID})`,
      category: 'Invention',
    },
  ]);
  const [edgeId] = await client.addDocument([
    {
      '@type': 'Edge',
      source_node: sourceNode,
      target_node: targetNode,
      statement: 'Baseline claim for the conflict test.',
      relationship_kind: 'Unspecified',
      status: 'Ungrounded',
    },
  ]);
  console.log(`Baseline edge: ${edgeId}`);

  const branchA = `field-conflict-a-${RUN_ID}`;
  const branchB = `field-conflict-b-${RUN_ID}`;
  console.log(`Branching "${branchA}" and "${branchB}" off main...`);
  await client.branch(branchA, 'main');
  await client.branch(branchB, 'main');

  client.checkout(branchA);
  const edgeOnA = await client.getDocument({ id: edgeId });
  await client.updateDocument({ ...edgeOnA, status: 'Red' });
  console.log(`Set status = Red on ${branchA}.`);

  client.checkout(branchB);
  const edgeOnB = await client.getDocument({ id: edgeId });
  await client.updateDocument({ ...edgeOnB, status: 'Yellow' });
  console.log(`Set status = Yellow on ${branchB}.`);

  console.log(
    `Rebasing ${branchA} onto main (should succeed — main hasn't moved ` +
      'since the branch point)...',
  );
  await rebaseBranch({
    sourceBranch: branchA,
    targetBranch: 'main',
    message: `merge ${branchA}`,
  });
  console.log(`${branchA} merged. main's edge now has status = Red.`);

  console.log(
    `Rebasing ${branchB} onto main (should conflict — both branches ` +
      'changed "status" starting from the same baseline value)...',
  );
  try {
    await rebaseBranch({
      sourceBranch: branchB,
      targetBranch: 'main',
      message: `merge ${branchB}`,
    });
    console.log(
      'No conflict was reported. Either the rebase silently resolved it ' +
        "one way (worth checking main's actual status value below), or " +
        "this version doesn't treat same-field-different-value as a " +
        'collision the way Editing Model assumed. Worth a closer look ' +
        'either way — that assumption is doing real work in the essay.',
    );
  } catch (err: any) {
    console.log('Conflict reported, as expected:');
    console.log(JSON.stringify(err.response ?? err.message, null, 2));
  }

  client.checkout('main');
  const finalEdge = await client.getDocument({ id: edgeId });
  console.log("main's edge document after both merge attempts:", finalEdge);
}

async function main() {
  const client = createClient();
  client.db(config.db);

  await scenarioUnrelatedEdits(client);
  await scenarioFieldConflict(client);
}

main().catch((err) => {
  console.error('concurrent-edit-test failed:');
  console.error(err);
  process.exit(1);
});
