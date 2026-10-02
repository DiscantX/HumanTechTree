import axios from 'axios';

import { config } from '../config';

/**
 * Commit log for a branch, over plain HTTP with pagination support.
 *
 * The SDK has no method for this. The OpenAPI spec marks GET /api/log
 * as `x-js-client: not_implemented`. Response fields follow the spec.
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

/**
 * Retrieves the commit log for a branch with optional pagination parameters.
 *
 * Args:
 *     branch: Name of the target branch.
 *     options: Pagination options containing start index and count limit.
 *
 * Returns:
 *     Array of CommitInfo objects or null if unavailable.
 */
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

/**
 * Checks unambiguously whether a branch exists by querying database metadata.
 *
 * Uses `GET /api/db/{org}/{db}?branches=true` per OpenAPI spec to avoid
 * log-based heuristics or 500 errors on missing branches.
 *
 * Args:
 *     branch: Name of the branch to check.
 *
 * Returns:
 *     True if the branch exists in the database, false otherwise.
 */
export async function branchExists(branch: string): Promise<boolean> {
  try {
    const r = await axios.get(
      `${config.endpoint}/api/db/${config.organization}/${config.db}`,
      {
        params: { branches: true },
        auth: { username: config.user, password: config.key },
        validateStatus: () => true,
      },
    );
    if (r.status >= 400 || !r.data || !Array.isArray(r.data.branches)) {
      return false;
    }
    return r.data.branches.includes(branch);
  } catch {
    return false;
  }
}

/** Commit identifiers for a branch, or null if the log is unavailable. */
export async function commitIds(branch: string): Promise<string[] | null> {
  const log = await getCommitLog(branch, { count: 100000 });
  if (!log) return null;
  return log.map((x) => x.identifier ?? x['@id'] ?? JSON.stringify(x));
}
