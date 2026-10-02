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
}

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
  land: (req: Required<LandingRequest>) => Promise<RebaseResult>;
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
  if (/instance_not_of_class/i.test(body)) return 'deleted_reference';
  if (typeof status === 'number' && status >= 500) return 'transient';
  return 'unrecognized';
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
        job.resolve(await this.process(job.req));
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
    const full = { targetBranch: 'main', ...req } as Required<LandingRequest>;

    if (!(await this.deps.branchExists(full.sourceBranch))) {
      return { outcome: 'missing_branch', attempts: 0, request: req, landMs: [] };
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
