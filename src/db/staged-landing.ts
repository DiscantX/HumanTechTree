import { config } from '../config';
import { createClient } from './client';
import { applyBranch } from './apply';
import { resolveBase } from './merge-base';
import { rebaseBranch, RebaseResult } from './rebase';
import { validateBranch, blocking, Violation } from './validation-gate';

/**
 * Landing through a staging branch, so main only ever moves to a state that
 * passed the validation gate.
 *
 *   1. branch `staging` off the target (main)
 *   2. replay the source branch onto staging       (conflicts surface here; by rebase, or in
 *                                                    'apply' mode by apply with the merge base)
 *   3. run the gate on staging                      (dangling edges, cycles, ...)
 *   4. replay staging onto the target               (a fast-forward when main has
 *                                                    not moved, which never failed
 *                                                    in the prototype's runs)
 *   5. delete staging, whatever happened
 *
 * This relies on the merge queue being the only writer to the target. If anything
 * else moves main between steps 1 and 4, step 4 is no longer a fast-forward and
 * can hit the same server errors as any other replay. The queue's retry then
 * starts again from a fresh staging branch.
 */
export class ValidationFailure extends Error {
  constructor(public violations: Violation[]) {
    super(`validation failed: ${violations.map((v) => v.message).join('; ')}`);
    this.name = 'ValidationFailure';
  }
}

export type LandingMode = 'rebase' | 'apply';

export async function landViaStaging(
  req: {
    sourceBranch: string;
    targetBranch: string;
    message: string;
    /** Apply mode only: the commit the source was cut from, as recorded when the branch was created. Derived from the logs when absent. */
    baseCommit?: string;
    /** Apply mode only: the editor to record as the commit's author. */
    author?: string;
  },
  mode: LandingMode = 'rebase',
): Promise<RebaseResult> {
  const staging = `stage_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const c: any = createClient();
  c.db(config.db);
  c.checkout(req.targetBranch);
  await c.branch(staging);
  try {
    if (mode === 'apply') {
      const { base: baseCommit } = await resolveBase(req.baseCommit, req.sourceBranch, staging);
      if (!baseCommit) throw new Error(`no merge base found between ${req.sourceBranch} and ${req.targetBranch}`);
      await applyBranch({
        sourceBranch: req.sourceBranch,
        targetBranch: staging,
        baseCommit,
        message: req.message,
        author: req.author,
      });
    } else {
      await rebaseBranch({ sourceBranch: req.sourceBranch, targetBranch: staging, message: req.message });
    }
    const bad = blocking(await validateBranch(staging));
    if (bad.length > 0) throw new ValidationFailure(bad);
    return await rebaseBranch({ sourceBranch: staging, targetBranch: req.targetBranch, message: req.message });
  } finally {
    try {
      const cleaner: any = createClient();
      cleaner.db(config.db);
      await cleaner.deleteBranch(staging);
    } catch {
      // A leftover staging branch is harmless, and a failed cleanup must not mask the real result.
    }
  }
}
