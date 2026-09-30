import axios from 'axios';

import { config } from '../config';

/**
 * Commit log for a branch, over plain HTTP.
 *
 * The SDK has no method for this. The OpenAPI spec marks GET /api/log
 * as `x-js-client: not_implemented`, and neither published client
 * package contains `getCommitHistory`, even though the docs' reset
 * page shows it. Response fields follow the spec.
 */
export interface CommitInfo {
  '@id'?: string;
  '@type'?: string;
  author?: string;
  identifier?: string;
  message?: string;
  schema?: string;
  timestamp?: number;
}

export async function getCommitLog(
  branch: string,
  options: { count?: number; start?: number } = {},
): Promise<CommitInfo[] | null> {
  try {
    const r = await axios.get(
      `${config.endpoint}/api/log/${config.organization}/${config.db}/local/branch/${branch}`,
      {
        params: options,
        auth: { username: config.user, password: config.key },
        validateStatus: () => true,
      },
    );
    if (r.status >= 400 || !Array.isArray(r.data)) return null;
    return r.data as CommitInfo[];
  } catch {
    return null;
  }
}

/** Commit identifiers for a branch, or null if the log is unavailable. */
export async function commitIds(branch: string): Promise<string[] | null> {
  const log = await getCommitLog(branch);
  if (!log) return null;
  return log.map((x) => x.identifier ?? x['@id'] ?? JSON.stringify(x));
}
