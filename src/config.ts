import * as dotenv from 'dotenv';

dotenv.config();

function readVar(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/**
 * All connection settings in one place. Every script imports this instead
 * of reading process.env directly, so there's exactly one place to change
 * when dev/prod configuration diverges later.
 */
export const config = {
  endpoint: readVar('TERMINUSDB_ENDPOINT', 'http://localhost:6363'),
  user: readVar('TERMINUSDB_USER', 'admin'),
  key: readVar('TERMINUSDB_KEY', 'root'),
  organization: readVar('TERMINUSDB_ORG', 'admin'),
  db: readVar('TERMINUSDB_DB', 'tech_tree_dev'),
  sshHost: readVar('SSH_HOST', 'localhost'),
  sshPort: readVar('SSH_PORT', '22'),
  sshUser: readVar('SSH_USER', 'root'),
  sshPassword: process.env.SSH_PASSWORD,
  sshKeyPath: process.env.SSH_KEY_PATH,
};
