import axios from 'axios';
import { config } from '../config';

/**
 * TerminusDB merges by rebase, not by a three-way merge commit: the
 * source branch's commits are replayed on top of the target branch
 * (this is what Editing Model means by "using TerminusDB's native
 * commit/branch/diff/merge model").
 *
 * This talks to the REST endpoint directly — POST
 * /api/rebase/{org}/{db}/local/branch/{target}, body
 * { rebase_from, author, message } — rather than through the JS
 * client's own wrapper. I could confirm the REST endpoint's shape from
 * TerminusDB's own API and from the official Elixir client's source
 * (which documents itself as "wrapping the /api/rebase endpoint" in
 * exactly this shape), but couldn't confirm the JS client's own method
 * name for it with the same confidence, so this avoids guessing at
 * that. If a client-level equivalent turns out to exist, swapping this
 * out for it is a contained change — nothing else in the codebase calls
 * this function's internals, only its return shape.
 */
export interface RebaseResult {
  '@type'?: string;
  'api:status'?: string;
  'api:forwarded_commits'?: string[];
  'api:common_commit'?: string;
  [key: string]: unknown;
}

export interface RebaseConflictError extends Error {
  response?: unknown;
  status?: number;
}

export async function rebaseBranch(params: {
  sourceBranch: string;
  targetBranch: string;
  message: string;
}): Promise<RebaseResult> {
  const { sourceBranch, targetBranch, message } = params;

  const url = `${config.endpoint}/api/rebase/${config.organization}/${config.db}/local/branch/${targetBranch}`;
  const rebaseFrom = `${config.organization}/${config.db}/local/branch/${sourceBranch}`;

  const response = await axios.post(
    url,
    {
      rebase_from: rebaseFrom,
      author: config.user,
      message,
    },
    {
      auth: { username: config.user, password: config.key },
      // We want to inspect a conflict response ourselves rather than
      // have axios throw a generic HTTP error for it.
      validateStatus: () => true,
    },
  );

  if (response.status >= 400) {
    const err: RebaseConflictError = new Error(
      `Rebase of "${sourceBranch}" onto "${targetBranch}" failed ` +
        `(HTTP ${response.status}): ${JSON.stringify(response.data)}`,
    );
    err.response = response.data;
    err.status = response.status;
    throw err;
  }

  return response.data;
}
