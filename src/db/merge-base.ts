import { CommitInfo, getCommitLog } from './log';

/**
 * The most recent commit that two branches share, which is the base apply needs for a
 * three-way merge. The server does not supply one (see Editing Model, "Apply as a
 * three-way merge"). The application can record the commit a branch was cut from when it
 * creates the branch and pass that instead, which is cheaper; this derives it from the
 * logs when it was not recorded.
 *
 * Both logs are read newest first, a page at a time, until one commit appears in both.
 * Shared history appears in the same relative order in both logs, so the first source
 * commit found in the target's log is the nearest common one. Returns null when the
 * limit is reached without finding one.
 */
export type FetchLog = (branch: string, options: { count?: number; start?: number }) => Promise<CommitInfo[] | null>;

export interface MergeBaseOptions {
  pageSize?: number;
  /** Stop after reading this many commits from each branch. */
  maxCommits?: number;
}

export const idOf = (c: CommitInfo): string => c.identifier ?? c['@id'] ?? JSON.stringify(c);

export async function findMergeBase(
  source: string,
  target: string,
  options: MergeBaseOptions = {},
  fetchLog: FetchLog = getCommitLog,
): Promise<string | null> {
  const pageSize = options.pageSize ?? 200;
  const maxCommits = options.maxCommits ?? 20000;
  const sourceIds: string[] = [];
  const targetIds = new Set<string>();
  let sourceStart = 0;
  let targetStart = 0;
  let sourceDone = false;
  let targetDone = false;

  const read = async (branch: string, start: number): Promise<string[]> => {
    const page = await fetchLog(branch, { start, count: pageSize });
    if (page === null) throw new Error(`could not read the commit log of ${branch}`);
    return page.map(idOf);
  };

  while (!(sourceDone && targetDone)) {
    if (!sourceDone) {
      const ids = await read(source, sourceStart);
      sourceIds.push(...ids);
      sourceStart += ids.length;
      if (ids.length < pageSize || sourceStart >= maxCommits) sourceDone = true;
    }
    if (!targetDone) {
      const ids = await read(target, targetStart);
      for (const id of ids) targetIds.add(id);
      targetStart += ids.length;
      if (ids.length < pageSize || targetStart >= maxCommits) targetDone = true;
    }
    const hit = sourceIds.find((id) => targetIds.has(id));
    if (hit !== undefined) return hit;
  }
  return null;
}

/**
 * Which base a landing uses: the one recorded when the branch was created, or, when there is
 * none, the one derived from the logs. A recorded base costs no log reads at all. The recorded
 * base is not checked here; `baseIsOnBranch` is the check, and the queue does not run it by
 * default (see Editing Model, "Where the merge base comes from").
 */
export interface ResolvedBase {
  base: string | null;
  via: 'recorded' | 'derived';
}

export async function resolveBase(
  recorded: string | undefined,
  source: string,
  staging: string,
  find: (source: string, target: string) => Promise<string | null> = (s, t) => findMergeBase(s, t),
): Promise<ResolvedBase> {
  if (recorded) return { base: recorded, via: 'recorded' };
  return { base: await find(source, staging), via: 'derived' };
}

/**
 * Whether `base` is one of the commits on `branch`, which any valid merge base for that branch
 * must be. A branch's own commits come first in its log, so for a recently cut branch the base
 * is found in the first page. Throws when the log cannot be read, and returns false when the
 * limit is reached without finding it.
 */
export async function baseIsOnBranch(
  base: string,
  branch: string,
  options: MergeBaseOptions = {},
  fetchLog: FetchLog = getCommitLog,
): Promise<boolean> {
  const pageSize = options.pageSize ?? 200;
  const maxCommits = options.maxCommits ?? 20000;
  for (let start = 0; start < maxCommits; start += pageSize) {
    const page = await fetchLog(branch, { start, count: pageSize });
    if (page === null) throw new Error(`could not read the commit log of ${branch}`);
    if (page.some((c) => idOf(c) === base)) return true;
    if (page.length < pageSize) return false;
  }
  return false;
}

/**
 * Thrown when a recorded base is not one of the source branch's own commits. Applying it could
 * silently undo changes other people already landed (a base that is too new makes apply treat
 * their changes as part of the editor's diff), so the landing is refused instead.
 */
export const INVALID_BASE_GUIDANCE =
  'The landing was refused and nothing was changed. The base recorded for this branch is not one of its ' +
  'own commits, so applying it could silently undo changes that others already landed. To proceed, create a ' +
  'fresh branch from the current target and replay the edit on it. If the record is known to be wrong, land ' +
  'the branch again without a recorded base, and one will be derived from the commit logs.';

export class InvalidBase extends Error {
  guidance = INVALID_BASE_GUIDANCE;

  constructor(
    public base: string,
    public branch: string,
  ) {
    super(`the recorded merge base ${base} is not one of the commits on ${branch}`);
    this.name = 'InvalidBase';
  }
}

/**
 * Refuses a recorded base that is not on the source branch. An unreadable log throws an ordinary
 * error, which the queue surfaces as unrecognized and never retries, so doubt halts the landing.
 */
export async function verifyRecordedBase(
  base: string,
  source: string,
  options: MergeBaseOptions = {},
  fetchLog: FetchLog = getCommitLog,
): Promise<void> {
  if (!(await baseIsOnBranch(base, source, options, fetchLog))) throw new InvalidBase(base, source);
}
