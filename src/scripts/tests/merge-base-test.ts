import { CommitInfo } from '../../db/log';
import { findMergeBase, resolveBase, baseIsOnBranch, verifyRecordedBase, InvalidBase, FetchLog } from '../../db/merge-base';
import { createBranchWithBase, BranchDeps } from '../../db/branch';
import { translateError } from '../../db/merge-queue';

/**
 * Offline tests (no server) for the merge-base finder and the queue's reading of apply's
 * errors.   npm run merge-base-test
 */
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

/** Fake logs, newest first, served in pages like the real endpoint. */
const logs = (m: Record<string, string[]>): FetchLog => async (branch, { start = 0, count = 10 }) => {
  const all = m[branch];
  if (!all) return null;
  return all.slice(start, start + count).map((identifier): CommitInfo => ({ identifier }));
};

async function main() {
  // main: c5 c4 c3 c2 c1; a was cut at c3 and has two commits of its own.
  const basic = logs({ main: ['c5', 'c4', 'c3', 'c2', 'c1'], a: ['a2', 'a1', 'c3', 'c2', 'c1'] });
  check('base is the commit the source was cut from', (await findMergeBase('a', 'main', {}, basic)) === 'c3');

  // Target has not moved since the cut: the base is the target's head.
  const unmoved = logs({ main: ['c3', 'c2', 'c1'], a: ['a1', 'c3', 'c2', 'c1'] });
  check('target unmoved: base is the target head', (await findMergeBase('a', 'main', {}, unmoved)) === 'c3');

  // Source already contained in the target: its head is the base.
  const merged = logs({ main: ['a1', 'c3', 'c2', 'c1'], a: ['a1', 'c3', 'c2', 'c1'] });
  check('source already in the target: base is the source head', (await findMergeBase('a', 'main', {}, merged)) === 'a1');

  // Paging: small pages, the base is several pages deep on both sides.
  const deepMain = ['m9', 'm8', 'm7', 'm6', 'm5', 'm4', 'base', 'o2', 'o1'];
  const deepSrc = ['s5', 's4', 's3', 's2', 's1', 'base', 'o2', 'o1'];
  const deep = logs({ main: deepMain, a: deepSrc });
  check('found across several pages', (await findMergeBase('a', 'main', { pageSize: 2 }, deep)) === 'base');

  // Unrelated histories.
  const none = logs({ main: ['x2', 'x1'], a: ['y2', 'y1'] });
  check('no common commit returns null', (await findMergeBase('a', 'main', { pageSize: 1 }, none)) === null);

  // The limit stops the search.
  const capped = logs({ main: ['m3', 'm2', 'm1', 'base'], a: ['s1', 'base'] });
  check('the commit limit stops the search', (await findMergeBase('a', 'main', { pageSize: 1, maxCommits: 2 }, capped)) === null);

  // An unreadable log is an error, not a silent null.
  let threw = false;
  try {
    await findMergeBase('missing', 'main', {}, basic);
  } catch {
    threw = true;
  }
  check('an unreadable log throws', threw);

  // Apply's conflict body is read as a conflict, and a bad ref is not.
  const conflict = { status: 409, response: { '@type': 'api:ApplyError', 'api:status': 'api:conflict', 'api:witnesses': [] } };
  check("apply's 409 is a conflict", translateError(conflict) === 'conflict');
  const badRef = { status: 400, response: { '@type': 'api:ApplyErrorResponse', 'api:error': { '@type': 'api:NotValidRefError' } } };
  check('an invalid ref is unrecognized, never retried', translateError(badRef) === 'unrecognized');
  const dangling = { status: 400, response: { 'api:message': 'Schema check failure', 'system:witnesses': [{ '@type': 'references_untyped_object', object: 'terminusdb:///data/Node/x' }] } };
  check("apply's refusal of an edge to a deleted node is a deleted reference", translateError(dangling) === 'deleted_reference');
  check('a 500 is still transient', translateError({ status: 500, response: {} }) === 'transient');

  // A recorded base is used as it is, with no log reads. Without one, the finder is called.
  {
    let finds = 0;
    const find = async () => {
      finds++;
      return 'derived-base';
    };
    const rec = await resolveBase('recorded-base', 'a', 'stage', find);
    check('a recorded base is used as given', rec.base === 'recorded-base' && rec.via === 'recorded');
    check('a recorded base makes no log reads', finds === 0);
    const der = await resolveBase(undefined, 'a', 'stage', find);
    check('no record: the base is derived from the logs', der.base === 'derived-base' && der.via === 'derived' && finds === 1);
    const none = await resolveBase(undefined, 'a', 'stage', async () => null);
    check('no record and nothing found: the base is null', none.base === null && none.via === 'derived');
  }

  // The recorded base is read from the new branch, so a parent that moves during creation does not matter.
  {
    const heads: Record<string, string | null> = { main: 'c9', fresh: 'c3' };
    const created: string[] = [];
    const deps: BranchDeps = {
      create: async (parent, name) => {
        created.push(`${parent}>${name}`);
      },
      head: async (b) => heads[b] ?? null,
    };
    const r = await createBranchWithBase('main', 'fresh', deps);
    check('the base is the new branch head, not the parent head', r.baseCommit === 'c3' && r.branch === 'fresh');
    check('the branch is created off the parent', created[0] === 'main>fresh');
    let threw = false;
    try {
      await createBranchWithBase('main', 'unreadable', deps);
    } catch {
      threw = true;
    }
    check('an unreadable new branch head throws, not a null base', threw);
  }

  // The check that a recorded base belongs to the branch.
  {
    const lg = logs({ a: ['a2', 'a1', 'c3', 'c2', 'c1'], main: ['c5', 'c4', 'c3', 'c2', 'c1'] });
    check('a base on the branch is accepted', (await baseIsOnBranch('c3', 'a', {}, lg)) === true);
    check('a base found only on the next page is accepted', (await baseIsOnBranch('c1', 'a', { pageSize: 2 }, lg)) === true);
    check('a base from the target that is not on the branch is refused', (await baseIsOnBranch('c5', 'a', {}, lg)) === false);
    check('the commit limit stops the check', (await baseIsOnBranch('c1', 'a', { pageSize: 1, maxCommits: 2 }, lg)) === false);
    let threw = false;
    try {
      await baseIsOnBranch('c3', 'missing', {}, lg);
    } catch {
      threw = true;
    }
    check('an unreadable log throws', threw);
  }

  // Verification of a recorded base: a wrong base halts, with the reason and the way forward.
  {
    const lg = logs({ a: ['a2', 'a1', 'c3', 'c2', 'c1'], main: ['c5', 'c4', 'c3', 'c2', 'c1'] });
    let ok = true;
    try {
      await verifyRecordedBase('c3', 'a', {}, lg);
    } catch {
      ok = false;
    }
    check('a recorded base on the branch passes verification', ok);
    let invalid: InvalidBase | undefined;
    try {
      await verifyRecordedBase('c5', 'a', {}, lg);
    } catch (e) {
      if (e instanceof InvalidBase) invalid = e;
    }
    check('a recorded base not on the branch is refused as InvalidBase', invalid !== undefined);
    check('the refusal names the base and the branch', !!invalid && invalid.message.includes('c5') && invalid.message.includes('a'), invalid?.message ?? '');
    check('the refusal says how to proceed', !!invalid && /fresh branch/.test(invalid.guidance) && /without a recorded base/.test(invalid.guidance));
    let other: unknown;
    try {
      await verifyRecordedBase('c3', 'missing', {}, lg);
    } catch (e) {
      other = e;
    }
    check('an unreadable log halts as an ordinary error, not as a pass', other instanceof Error && !(other instanceof InvalidBase));
    check('InvalidBase is translated to the invalid_base outcome', translateError(new InvalidBase('c5', 'a')) === 'invalid_base');
  }

  console.log(failures === 0 ? '\nAll passed.' : `\n${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
