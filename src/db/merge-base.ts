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

const idOf = (c: CommitInfo): string => c.identifier ?? c['@id'] ?? JSON.stringify(c);

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
