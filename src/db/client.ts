import { WOQLClient } from 'terminusdb';

import { config } from '../config';

/**
 * Returns a fresh WOQLClient pointed at the configured server, but not
 * yet scoped to a database. Callers scope it themselves with
 * `.db(config.db)` once the database is known to exist, and pick the
 * branch they work on with `.checkout(branch)`, so this factory works
 * for admin-level calls (createDatabase) and for ordinary document
 * calls alike.
 *
 * The `terminusdb` package (not `@terminusdb/terminusdb-client`) is the
 * one the official docs install. It ships its own TypeScript types and
 * exports WOQLClient by name, so no `require()` workaround is needed.
 * Most methods are still typed `Promise<any>`, so responses are only
 * lightly type-checked.
 */
export function createClient(): WOQLClient {
  return new WOQLClient(config.endpoint, {
    user: config.user,
    organization: config.organization,
    key: config.key,
  });
}
