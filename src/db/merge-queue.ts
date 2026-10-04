import { RebaseResult } from './rebase';
import { branchExists, getCommitLog } from './log';
import { landViaStaging, ValidationFailure } from './staged-landing';
import { Violation } from './validation-gate';

/**
 * The merge queue from Editing Model: landing on main is a single-writer
 * operation. Edits happen on branches in parallel, but the step that moves
 * main goes through this queue, which
 *
 *   - serializes landings (one in flight at a time),
 *   - spaces them (a minimum gap after the previous landing finishes),
 *   - checks the source branch exists first (using database branch metadata),
 *   - translates errors into a small closed set of outcomes,
 *   - retries transient failures with a growing pause and a cap,
 *   - never retries a conflict or an unrecognized error.
 *
 * The sync step is deliberately absent: it made no difference to the
 * server-error rate and added rebase calls that could themselves fail.
 */

export type LandingOutcome =
  | 'landed'
  | 'conflict' // two edits collided; resolve on a fresh branch
  | 'deleted_reference' // a node this edit refers to was deleted
  | 'validation_failed' // landed on staging but the gate blocked it; main unchanged
  | 'missing_branch' // source branch does not exist (preflight)
  | 'transient_failed' // 5xx persisted through every retry
  | 'unrecognized'; // surfaced, never retried

export interface LandingRequest {
  sourceBranch: string;
  targetBranch?: string; // default 'main'
  message: string;
  /** Apply mode only: the commit the source branch was cut from. Derived from the logs when absent. */
  baseCommit?: string;
  /** Apply mode only: the editor to record as the landing commit's author. */
  author?: string;
}

/** A request once the default target has been filled in. */
export type ResolvedRequest = LandingRequest & { targetBranch: string };

export interface LandingResult {
  outcome: LandingOutcome;
  attempts: number;
  request: LandingRequest;
  result?: RebaseResult;
  /** Duration of each land call, excluding spacing and retry pauses. */
  landMs: number[];
  /** Raw error body for anything that did not land. */
  detail?: string;
  /** Set when outcome is 'validation_failed'. */
  violations?: Violation[];
}

export interface QueueOptions {
  /** Minimum gap between the end of one landing and the start of the next. */
  minGapMs: number;
  /** Retries after the first attempt, for transient failures only. */
  maxRetries: number;
  /** Pause before retry n (1-based) is retryBaseMs * 2^(n-1). */
  retryBaseMs: number;
}

export const DEFAULT_OPTIONS: QueueOptions = {
  minGapMs: 1000,
  maxRetries: 3,
  retryBaseMs: 500,
};

/** Injection points so the queue can be tested without a server. */
export interface QueueDeps {
  land: (req: ResolvedRequest) => Promise<RebaseResult>;
  branchExists: (branch: string) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export const REAL_DEPS: QueueDeps = {
  land: (r) => landViaStaging(r),
  branchExists: (b) => branchExists(b),
  sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
  now: () => Date.now(),
};

function bodyOf(err: any): string {
  try {
    return JSON.stringify(err?.response ?? err?.data ?? err?.message ?? String(err));
  } catch {
    return String(err);
  }
}

/** Map a thrown rebase error to a queue outcome, or 'transient'. */
export function translateError(err: any): LandingOutcome | 'transient' {
  if (err instanceof ValidationFailure) return 'validation_failed';
  const status = err?.status ?? err?.response?.status;
  const body = bodyOf(err);
  if (/cardinality|subject_has_no_type/i.test(body)) return 'conflict';
  if (/api:conflict/i.test(body)) return 'conflict'; // apply's 409
  if (/instance_not_of_class/i.test(body)) return 'deleted_reference';
  if (typeof status === 'number' && status >= 500) return 'transient';
  return 'unrecognized';
}

/**
 * Landing with apply as the replay (see Editing Model, "Apply as a three-way merge"). Sequential
 * applies showed no server errors even with no pause, so the spacing between landings is off by
 * default here. The final step from staging to the target is still a rebase fast-forward.
 */
export const APPLY_DEPS: QueueDeps = { ...REAL_DEPS, land: (r) => landViaStaging(r, 'apply') };
export const APPLY_OPTIONS: QueueOptions = { ...DEFAULT_OPTIONS, minGapMs: 0 };

/**
 * A queue for the live scripts. Rebase by default; apply when the script is run with
 * `--apply` or LANDING_MODE=apply. MIN_GAP_MS overrides the spacing in either mode.
 */
export function queueFromEnv(): MergeQueue {
  const apply = process.argv.includes('--apply') || process.env.LANDING_MODE === 'apply';
  const base = apply ? APPLY_OPTIONS : DEFAULT_OPTIONS;
  const gap = process.env.MIN_GAP_MS !== undefined ? Number(process.env.MIN_GAP_MS) : base.minGapMs;
  return new MergeQueue({ ...base, minGapMs: gap }, apply ? APPLY_DEPS : REAL_DEPS);
}

interface Job {
  req: LandingRequest;
  resolve: (r: LandingResult) => void;
}

export class MergeQueue {
  private jobs: Job[] = [];
  private running = false;
  private lastFinished = -Infinity;

  constructor(
    private opts: QueueOptions = DEFAULT_OPTIONS,
    private deps: QueueDeps = REAL_DEPS,
  ) {}

  enqueue(req: LandingRequest): Promise<LandingResult> {
    return new Promise((resolve) => {
      this.jobs.push({ req, resolve });
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.jobs.length > 0) {
        const job = this.jobs.shift()!;
        try {
          job.resolve(await this.process(job.req));
        } catch (err) {
          // Anything that escapes process() must still settle the job and keep the queue moving.
          job.resolve({
            outcome: 'unrecognized',
            attempts: 0,
            request: job.req,
            detail: bodyOf(err),
            landMs: [],
          });
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async spaceOut(): Promise<void> {
    const wait = this.lastFinished + this.opts.minGapMs - this.deps.now();
    if (wait > 0) await this.deps.sleep(wait);
  }

  private async process(req: LandingRequest): Promise<LandingResult> {
    const full: ResolvedRequest = { targetBranch: 'main', ...req };

    // Preflight. A failed check is retried like a transient landing failure if it was
    // a 5xx, and otherwise surfaced. Either way no landing was attempted, so attempts is 0.
    for (let tries = 1; ; tries++) {
      try {
        if (!(await this.deps.branchExists(full.sourceBranch))) {
          return { outcome: 'missing_branch', attempts: 0, request: req, landMs: [] };
        }
        break;
      } catch (err) {
        const kind = translateError(err);
        const detail = bodyOf(err);
        if (kind !== 'transient') {
          return { outcome: 'unrecognized', attempts: 0, request: req, detail, landMs: [] };
        }
        if (tries > this.opts.maxRetries) {
          return { outcome: 'transient_failed', attempts: 0, request: req, detail, landMs: [] };
        }
        await this.deps.sleep(this.opts.retryBaseMs * 2 ** (tries - 1));
      }
    }

    let attempts = 0;
    let detail = '';
    const landMs: number[] = [];
    for (;;) {
      await this.spaceOut();
      attempts++;
      const started = this.deps.now();
      try {
        const result = await this.deps.land(full);
        this.lastFinished = this.deps.now();
        landMs.push(this.lastFinished - started);
        return { outcome: 'landed', attempts, request: req, result, landMs };
      } catch (err) {
        this.lastFinished = this.deps.now();
        landMs.push(this.lastFinished - started);
        detail = bodyOf(err);
        const kind = translateError(err);
        if (kind !== 'transient') {
          return {
            outcome: kind,
            attempts,
            request: req,
            detail,
            landMs,
            violations: err instanceof ValidationFailure ? err.violations : undefined,
          };
        }
        if (attempts > this.opts.maxRetries) {
          return { outcome: 'transient_failed', attempts, request: req, detail, landMs };
        }
        await this.deps.sleep(this.opts.retryBaseMs * 2 ** (attempts - 1));
      }
    }
  }
}
