import { config } from '../../config';
import { createClient } from '../../db/client';
import { getCommitLog } from '../../db/log';

/**
 * Two experiments on apply as the merge operation (see Editing Model, "Apply as a
 * three-way merge"). Needs the dev database with the graph schema pushed (npm run init-db).
 * Everything happens on scratch branches cut from main, and the branches are deleted at
 * the end (set KEEP_BRANCHES=1 to keep them). Nothing is written to main.
 *
 *   npm run apply-experiments
 *
 * A1  Can the commit's author be overridden through the request's commit information?
 *     The SDK stamps the login user by default.
 * A2  Server errors under apply, repeating the pause measurement made for rebase:
 *     branches that each add one node are applied one after another onto one target,
 *     with a pause between applications. The merge base is a snapshot branch cut before
 *     any of them, so each apply lands on a target that has already moved. For rebase
 *     the first-attempt server-error rate was 7 of 50 with no pause, 3 of 30 at 100 ms,
 *     1 of 30 at 250 ms, 1 of 30 at 500 ms and 0 of 30 at 1 s.
 * A3  Parallel applies onto one target (rebase failed four in five).
 *
 * Nothing here asserts. It reports counts, since the point is to compare them with rebase.
 */
const admin: any = createClient();
admin.db(config.db);

const run = Date.now().toString(36);
let n = 0;
const uid = (p: string) => `${p}_${run}_${n++}`;
const made: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const brief = (x: unknown, max = 200): string => {
  let s: string;
  try {
    s = typeof x === 'string' ? x : JSON.stringify(x);
  } catch {
    s = String(x);
  }
  return s.length > max ? s.slice(0, max) + '...' : s;
};
const errText = (e: any): string => brief(e?.response ?? e?.data ?? e?.message ?? String(e));

async function branchOff(base: string, prefix: string): Promise<string> {
  const name = uid(prefix);
  admin.checkout(base);
  await admin.branch(name);
  made.push(name);
  return name;
}
async function addNode(branch: string, subject: string): Promise<void> {
  admin.checkout(branch);
  await admin.addDocument([{ '@type': 'Node', subject, category: 'Invention' }]);
}
async function countNodes(branch: string): Promise<number> {
  admin.checkout(branch);
  const r = await admin.getDocument({ type: 'Node', as_list: true, count: 100000 });
  return Array.isArray(r) ? r.length : 0;
}

/** One apply of `after` onto `target`, with `before` as the merge base. A fresh client each time. */
async function applyOnto(target: string, before: string, after: string, message: string, options?: any): Promise<void> {
  const cl: any = createClient();
  cl.db(config.db);
  cl.checkout(target);
  await cl.apply(before, after, message, undefined, options);
}

interface Attempt {
  ok: boolean;
  status?: number;
  ms: number;
  text?: string;
}
async function tryApply(target: string, before: string, after: string, message: string): Promise<Attempt> {
  const t0 = Date.now();
  try {
    await applyOnto(target, before, after, message);
    return { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, status: e?.status, ms: Date.now() - t0, text: errText(e) };
  }
}

async function a1() {
  console.log('\n--- A1 author override through commit_info');
  const snap = await branchOff('main', 'a1snap');
  const target = await branchOff('main', 'a1target');
  const src = await branchOff(snap, 'a1src');
  await addNode(src, `A1 ${run}`);
  const src2 = await branchOff(snap, 'a1src2');
  await addNode(src2, `A1b ${run}`);

  await applyOnto(target, snap, src, `A1 default ${run}`);
  const withAuthor = async () => {
    try {
      await applyOnto(target, snap, src2, `A1 override ${run}`, { commit_info: { author: 'alice', message: `A1 override ${run}` } });
      return 'ok';
    } catch (e) {
      return `FAILED ${errText(e)}`;
    }
  };
  const r = await withAuthor();
  const log = (await getCommitLog(target, { count: 10 })) ?? [];
  const by = (m: string) => log.filter((e) => e.message === m).map((e) => e.author).join(', ') || '(not found)';
  console.log(`default apply: author ${by(`A1 default ${run}`)}`);
  console.log(`apply with commit_info author=alice: ${r}; author ${by(`A1 override ${run}`)}`);
}

async function a2(pauseMs: number, trials: number): Promise<void> {
  const snap = await branchOff('main', 'a2snap');
  const target = await branchOff(snap, 'a2target');
  const sources: string[] = [];
  for (let i = 0; i < trials; i++) {
    const s = await branchOff(snap, 'a2s');
    await addNode(s, `A2 ${pauseMs} ${run} ${i}`);
    sources.push(s);
  }
  const start = await countNodes(target);
  let firstErrors = 0;
  let conflicts = 0;
  let other = 0;
  let recovered = 0;
  let totalMs = 0;
  const samples: string[] = [];
  for (const s of sources) {
    if (pauseMs > 0) await sleep(pauseMs);
    const a = await tryApply(target, snap, s, `A2 ${s}`);
    totalMs += a.ms;
    if (a.ok) continue;
    if (a.status === 409) conflicts++;
    else if (a.status !== undefined && a.status >= 500) firstErrors++;
    else other++;
    if (samples.length < 2) samples.push(`${a.status} ${a.text}`);
    await sleep(1500);
    const again = await tryApply(target, snap, s, `A2 retry ${s}`);
    if (again.ok) recovered++;
  }
  const landed = (await countNodes(target)) - start;
  console.log(
    `pause ${String(pauseMs).padStart(4)} ms: ${trials} applies, first-attempt 5xx ${firstErrors}, 409 ${conflicts}, other ${other}, ` +
      `recovered on retry ${recovered}, landed ${landed}/${trials}, mean ${Math.round(totalMs / trials)} ms`,
  );
  for (const t of samples) console.log(`    sample error: ${t}`);
}

async function a3(repeats: number, width: number): Promise<void> {
  let ok = 0;
  let err5 = 0;
  let conf = 0;
  let other = 0;
  for (let r = 0; r < repeats; r++) {
    const snap = await branchOff('main', 'a3snap');
    const target = await branchOff(snap, 'a3target');
    const sources: string[] = [];
    for (let i = 0; i < width; i++) {
      const s = await branchOff(snap, 'a3s');
      await addNode(s, `A3 ${run} ${r} ${i}`);
      sources.push(s);
    }
    const res = await Promise.all(sources.map((s) => tryApply(target, snap, s, `A3 ${s}`)));
    for (const a of res) {
      if (a.ok) ok++;
      else if (a.status === 409) conf++;
      else if (a.status !== undefined && a.status >= 500) err5++;
      else other++;
    }
  }
  console.log(`${repeats} rounds of ${width} simultaneous applies onto one target: ok ${ok}, 5xx ${err5}, 409 ${conf}, other ${other} (of ${repeats * width})`);
}

async function main() {
  await a1();
  console.log('\n--- A2 sequential applies, first-attempt server errors by pause (rebase: 14%, 10%, 3%, 3%, 0% at 0, 100, 250, 500, 1000 ms)');
  for (const p of [0, 0, 100, 250, 500, 1000]) await a2(p, 30);
  console.log('\n--- A3 parallel applies onto one target (rebase: four in five fail)');
  await a3(10, 5);

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
