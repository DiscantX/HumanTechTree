import { config } from '../../config';
import { createClient } from '../../db/client';
import { graphSchema } from '../../schema/graph-schema';

async function main() {
  const client = createClient();

  console.log(`Connecting to ${config.endpoint} as ${config.user}...`);

  console.log(`Creating database "${config.db}" (if it doesn't exist yet)...`);
  try {
    await client.createDatabase(config.db, {
      label: config.db,
      comment: 'Human Tech Tree Wiki — prototype dev database',
      schema: true,
    });
    console.log('Database created.');
  } catch (err: any) {
    // TerminusDB returns an error if the database already exists; treat
    // that specific case as fine and re-throw anything else.
    const message = String(err?.message ?? err);
    if (message.toLowerCase().includes('exist')) {
      console.log(`Database "${config.db}" already exists, continuing.`);
    } else {
      throw err;
    }
  }

  // Point the client at the database before doing anything schema- or
  // document-related to it.
  client.db(config.db);

  console.log('Pushing schema (full_replace, so this is safe to re-run)...');
  const result = await client.addDocument(graphSchema, {
    graph_type: 'schema',
    full_replace: true,
  });
  console.log('Schema classes now present:', result);

  console.log('Done.');
}

main().catch((err) => {
  console.error('init-db failed:');
  console.error(err);
  process.exit(1);
});
