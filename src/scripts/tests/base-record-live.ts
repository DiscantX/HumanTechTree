import { config } from '../../config';
import { createClient } from '../../db/client';
import { createBranchWithBase } from '../../db/branch';
import { getCommitLog } from '../../db/log';
import { baseIsOnBranch } from '../../db/merge-base';
import { MergeQueue, APPLY_DEPS, APPLY_OPTIONS, LandingResult } from '../../db/merge-queue';

/**
 * Live checks for recording the merge base at branch creation (issue #55). Needs a running
 * TerminusDB with the dev database and graph schema (npm run init-db), and a main with no
 * leftover cycles or dangling edges, since the gate reads the whole graph.
 *
 *   B1  a landing with a recorded base gives the same result as one with a derived base
 *   B2  the recorded base is on the branch, and a base that is not on it is detected
 *   B3  a wrong (too new) recorded base is refused by the queue (issue #57): outcome invalid_base,
 *       the target unchanged, no staging branch left behind. Before the check existed, the same landing
 *       reported `landed` and the target lost the other landing's change.
 *
 * Everything works on scratch branches cut from main and nothing is written to main. The
 * scratch branches are deleted at the end (set KEEP_BRANCHES=1 to keep them).
 *
 *   npm run base-record-live
 */
const c: any = createClient();
c.db(config.db);

const run = Date.now().toString(36);
let n = 0;
const uid = (p: string) => `${p}_${run}_${n++}`;
const made: string[] = [];
let failures = 0;

const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};
const observe = (name: string, detail: string) => console.log(`SEE   ${name}  ${detail}`);
const brief = (r: LandingResult) => `${r.outcome} (attempts ${r.attempts}, land ${r.landMs.join('+')} ms)`;

async function branchOff(base: string, prefix: string): Promise<string> {
  const name = uid(prefix);
  c.checkout(base);
  await c.branch(name);
  made.push(name);
  return name;
}
async function insert(branch: string, docs: any[]): Promise<string[]> {
  c.checkout(branch);
  return c.addDocument(docs);
}
async function edit(branch: string, id: string, fields: Record<string, unknown>): Promise<void> {
  c.checkout(branch);
  await c.updateDocument({ ...(await c.getDocument({ id })), ...fields });
}
async function read(branch: string, id: string): Promise<any> {
  c.checkout(branch);
  return c.getDocument({ id });
}
const head = async (branch: string): Promise<string | undefined> => (await getCommitLog(branch, { count: 1 }))?.[0]?.identifier;

/** A scratch target holding one node, an editor branch cut from it, and a second landing that moves it. */
async function scenario(label: string, recorded: boolean) {
  const target = await branchOff('main', `b_${label}_t`);
  const [id] = await insert(target, [{ '@type': 'Node', subject: `B ${label} ${run}`, category: 'Invention' }]);

  let editor: string;
  let baseCommit: string | undefined;
  if (recorded) {
    const name = uid(`b_${label}_e`);
    made.push(name);
    ({ baseCommit } = await createBranchWithBase(target, name));
    editor = name;
  } else {
    editor = await branchOff(target, `b_${label}_e`);
  }
  await edit(editor, id, { description: `edited by the editor (${label})` });

  const mover = await branchOff(target, `b_${label}_m`);
  await edit(mover, id, { stage: 'Observation' });
  const q = new MergeQueue(APPLY_OPTIONS, APPLY_DEPS);
  const moved = await q.enqueue({ sourceBranch: mover, targetBranch: target, message: `B ${label} mover` });
  check(`${label}: the second landing moves the target`, moved.outcome === 'landed', brief(moved));

  return { target, editor, id, baseCommit, q };
}

async function main() {
  const rec = await scenario('recorded', true);
  const der = await scenario('derived', false);

  const rr = await rec.q.enqueue({ sourceBranch: rec.editor, targetBranch: rec.target, message: 'B1 recorded', baseCommit: rec.baseCommit });
  const dr = await der.q.enqueue({ sourceBranch: der.editor, targetBranch: der.target, message: 'B1 derived' });
  check('B1: the landing with a recorded base lands', rr.outcome === 'landed' && rr.attempts === 1, brief(rr));
  check('B1: the landing with a derived base lands', dr.outcome === 'landed' && dr.attempts === 1, brief(dr));

  const rd = await read(rec.target, rec.id);
  const dd = await read(der.target, der.id);
  check('B1: recorded base: the editor field and the other landing both survive',
    rd.description === 'edited by the editor (recorded)' && rd.stage === 'Observation',
    JSON.stringify({ description: rd.description, stage: rd.stage }));
  check('B1: derived base gives the same merged result',
    dd.description === 'edited by the editor (derived)' && dd.stage === 'Observation',
    JSON.stringify({ description: dd.description, stage: dd.stage }));
  observe('B1: land-call time, recorded vs derived (ms)', `${rr.landMs.join('+')} vs ${dr.landMs.join('+')}`);

  // B2 and B3 use a fresh pair, since the first pair has landed.
  const t = await scenario('wrong', true);
  check('B2: the recorded base is on the editor branch', await baseIsOnBranch(String(t.baseCommit), t.editor));
  const tooNew = await head(t.target);
  check('B2: the target head, which is not on the editor branch, is detected as a wrong base',
    tooNew !== undefined && !(await baseIsOnBranch(tooNew, t.editor)), String(tooNew));

  const stagesBefore = new Set(Object.keys(await c.getBranches()).filter((b) => b.startsWith('stage_')));
  const wr = await t.q.enqueue({ sourceBranch: t.editor, targetBranch: t.target, message: 'B3 wrong base', baseCommit: tooNew });
  const w = await read(t.target, t.id);
  check('B3: a too-new recorded base is refused, not retried', wr.outcome === 'invalid_base' && wr.attempts === 1, brief(wr));
  check('B3: the refusal says why and how to proceed', !!wr.guidance && !!wr.detail, wr.detail ?? '');
  check("B3: the target is unchanged, with the other landing's field intact and the editor's change absent",
    w.stage === 'Observation' && w.description !== 'edited by the editor (wrong)',
    JSON.stringify({ description: w.description, stage: w.stage }));
  const leftover = Object.keys(await c.getBranches()).filter((b) => b.startsWith('stage_') && !stagesBefore.has(b));
  check('B3: no staging branch left behind', leftover.length === 0, leftover.join(', '));
  observe('B3: guidance', String(wr.guidance));

  if (!process.env.KEEP_BRANCHES) {
    for (const b of made.reverse()) {
      try {
        const d: any = createClient();
        d.db(config.db);
        await d.deleteBranch(b);
      } catch {
        // best effort
      }
    }
  }
  console.log(failures === 0 ? '\nAll asserted checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error(e?.response ?? e?.message ?? e);
  process.exit(1);
});
