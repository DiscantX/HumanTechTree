import { config } from '../config';
import { createClient } from './client';
import { getCommitLog } from './log';
import { idOf } from './merge-base';

/**
 * Creating a branch and recording the commit it was cut from, which is the merge base apply
 * needs when the branch lands (see Editing Model, "Where the merge base comes from"). The
 * returned `baseCommit` is meant to be stored with the proposal and passed to the merge queue
 * as `baseCommit`. Without it the queue derives a base from the commit logs, which is slower.
 *
 * The base is read from the new branch's own head after it exists, not from the parent
 * beforehand. A new branch has no commits of its own, so its head is exactly the commit it was
 * cut from, even if the parent moved while the branch was being created.
 */
export interface BranchDeps {
  create: (parent: string, name: string) => Promise<void>;
  head: (branch: string) => Promise<string | null>;
}

export const REAL_BRANCH_DEPS: BranchDeps = {
  create: async (parent, name) => {
    const c: any = createClient();
    c.db(config.db);
    c.checkout(parent);
    await c.branch(name);
  },
  head: async (branch) => {
    const log = await getCommitLog(branch, { count: 1 });
    return log && log.length > 0 ? idOf(log[0]) : null;
  },
};

export interface BranchWithBase {
  branch: string;
  baseCommit: string;
}

export async function createBranchWithBase(
  parent: string,
  name: string,
  deps: BranchDeps = REAL_BRANCH_DEPS,
): Promise<BranchWithBase> {
  await deps.create(parent, name);
  const baseCommit = await deps.head(name);
  if (!baseCommit) throw new Error(`could not read the head of the new branch ${name}, cut from ${parent}`);
  return { branch: name, baseCommit };
}
