import { config } from '../../config';
import { createClient } from '../../db/client';

/**
 * Deletes the prototype's dev database entirely. Useful when a schema
 * change makes more sense as a clean rebuild than a full_replace push,
 * or when smoke-test.ts has left placeholder data you want gone.
 *
 * Deliberately not wired into init-db.ts: destructive steps should be a
 * separate, explicit command, not a side effect of "set things up."
 */
async function main() {
  const client = createClient();

  console.log(`Deleting database "${config.db}"...`);
  await client.deleteDatabase(config.db);
  console.log('Deleted. Run init-db again to recreate it.');
}

main().catch((err) => {
  console.error('reset-db failed:');
  console.error(err);
  process.exit(1);
});
