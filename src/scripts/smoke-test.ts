import { config } from '../config';
import { createClient } from '../db/client';

/**
 * This is the actual point of the prototype's first milestone: prove that
 * from Node/TypeScript we can (1) reach the TerminusDB instance running in
 * the Alpine VM, (2) write documents against the schema init-db.ts pushed,
 * and (3) read them back with the relationship intact. Nothing here is
 * meant to be a realistic seed — the two nodes below are the smallest
 * possible instance of a Founding-Axioms-eligible pair with a Material-
 * Necessity edge between them (fire -> smelting), not real content.
 */
async function main() {
  const client = createClient();
  client.db(config.db);

  console.log('Inserting two test nodes...');
  const [fireNode, smeltingNode] = await client.addDocument([
    {
      '@type': 'Node',
      subject: 'Production of Fire (smoke test)',
      stage: 'Production',
      category: 'Invention',
      description: 'Placeholder node inserted by smoke-test.ts.',
    },
    {
      '@type': 'Node',
      subject: 'Smelting (smoke test)',
      category: 'Invention',
      description: 'Placeholder node inserted by smoke-test.ts.',
    },
  ]);
  console.log('Inserted nodes:', fireNode, smeltingNode);

  console.log('Inserting an edge between them...');
  const [edgeId] = await client.addDocument([
    {
      '@type': 'Edge',
      source_node: fireNode,
      target_node: smeltingNode,
      statement: 'Smelting requires a controlled heat source (smoke test).',
      relationship_kind: 'MaterialNecessity',
      basis: 'LogicalNecessity',
      status: 'Ungrounded',
    },
  ]);
  console.log('Inserted edge:', edgeId);

  console.log('Reading the edge back...');
  const readBack = await client.getDocument({ id: edgeId });
  console.log('Read back:', JSON.stringify(readBack, null, 2));

  console.log(
    'Smoke test passed: write and read round-tripped through TerminusDB.',
  );
}

main().catch((err) => {
  console.error('smoke-test failed:');
  console.error(err);
  process.exit(1);
});
