import { CommitInfo } from '../../db/log';
import { findMergeBase, FetchLog } from '../../db/merge-base';
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

  console.log(failures === 0 ? '\nAll passed.' : `\n${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
