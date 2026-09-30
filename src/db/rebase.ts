import { config } from '../config';
import { createClient } from './client';

/**
 * Replays the source branch's commits on top of the target branch using
 * the SDK's `client.rebase`, which wraps POST /api/rebase/{path}. The
 * OpenAPI spec and the docs quickstart both treat rebase as
 * TerminusDB's "merge" operation.
 *
 * Two things differ from calling the REST endpoint directly:
 *
 * 1. The target branch is not a parameter of the request. The SDK
 *    builds the URL from the client's current db and branch, so this
 *    function checks out `targetBranch` on a fresh client first. A new
 *    client per call means no branch state leaks between calls.
 * 2. The SDK throws for any HTTP status of 400 or above. The thrown
 *    Error carries `.status` and `.data` (the response body). `.data`
 *    is copied to `.response` so existing code that reads
 *    `err.response` keeps working.
 *
 * Response field names come from the OpenAPI spec (12.0.5). The spec
 * documents only 400, 401, 403, and 404 for this endpoint: no 409
 * conflict shape and no 500. What a conflicting rebase returns is
 * therefore observed behavior and not a documented contract.
 */
export interface RebaseReportEntry {
  '@type'?: string;
  /** The commit ID on the source branch before replay. */
  'api:origin_commit'?: string;
  /** The new commit IDs that commit turned into. */
  'api:applied'?: string[];
  'api:commit_type'?: string;
}

export interface RebaseResult {
  '@type'?: string;
  'api:status'?: string;
  /** Source commit IDs that were taken as they are (fast-forwarded). */
  'api:forwarded_commits'?: string[];
  /** Maps each replayed commit to the commit IDs it became. */
  'api:rebase_report'?: RebaseReportEntry[];
  'api:common_commit_id'?: string;
  [key: string]: unknown;
}

export interface RebaseConflictError extends Error {
  response?: unknown;
  data?: unknown;
  status?: number;
}

export async function rebaseBranch(params: {
  sourceBranch: string;
  targetBranch: string;
  message: string;
}): Promise<RebaseResult> {
  const { sourceBranch, targetBranch, message } = params;

  const client = createClient();
  client.db(config.db);
  client.checkout(targetBranch);

  const rebaseFrom = `${config.organization}/${config.db}/local/branch/${sourceBranch}`;

  try {
    const result = await client.rebase({
      rebase_from: rebaseFrom,
      author: config.user,
      message,
    });
    return result as RebaseResult;
  } catch (err) {
    const e = err as RebaseConflictError;
    if (e.response === undefined && e.data !== undefined) {
      e.response = e.data;
    }
    throw e;
  }
}
