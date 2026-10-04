import { config } from '../config';
import { createClient } from './client';

/**
 * Applies the difference between `baseCommit` and `sourceBranch` onto `targetBranch`, as one
 * squash commit, using the SDK's `client.apply` (POST /api/apply/{path}). With the common
 * ancestor as the base this is a three-way merge: different fields of one document merge, and
 * the same field on both sides is a 409 with structured witnesses (see Editing Model,
 * "Apply as a three-way merge").
 *
 * The spec takes a bare commit ID or branch name for the base and the source, not a path.
 * The SDK applies onto the client's current branch, so the target is checked out on a fresh
 * client, the same as for rebase. The SDK stamps the login user as the commit's author, so an
 * editor's identifier goes in `author`, which is passed through the request's commit
 * information (the override was checked live).
 */
export interface ApplyRequest {
  sourceBranch: string;
  targetBranch: string;
  baseCommit: string;
  message: string;
  author?: string;
}

export interface ApplyError extends Error {
  response?: unknown;
  data?: unknown;
  status?: number;
}

export async function applyBranch(req: ApplyRequest): Promise<unknown> {
  const client: any = createClient();
  client.db(config.db);
  client.checkout(req.targetBranch);
  const options = req.author ? { commit_info: { author: req.author, message: req.message } } : undefined;
  try {
    return await client.apply(req.baseCommit, req.sourceBranch, req.message, undefined, options);
  } catch (err) {
    const e = err as ApplyError;
    if (e.response === undefined && e.data !== undefined) e.response = e.data;
    throw e;
  }
}
