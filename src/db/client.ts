// The client library ships as CommonJS with no default-export types file,
// so it's pulled in with require() rather than an ES import.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TerminusClient = require('@terminusdb/terminusdb-client');

import { config } from '../config';

/**
 * Returns a fresh WOQLClient pointed at the configured server, but not
 * yet scoped to a database. Scripts call `.db(config.db)` themselves
 * once the database is known to exist, which keeps this factory usable
 * both for admin-level calls (createDatabase) and for ordinary
 * document/query calls against a specific db.
 */
export function createClient() {
  return new TerminusClient.WOQLClient(config.endpoint, {
    user: config.user,
    organization: config.organization,
    key: config.key,
  });
}
