import { config } from '../../config';
import { createClient } from '../../db/client';
import { applyBranch } from '../../db/apply';
import { createBranchWithBase } from '../../db/branch';
import { commitIds, getCommitLog } from '../../db/log';
import { rebaseBranch } from '../../db/rebase';

/**
 * Live comparison for issue #72: the last step of the merge queue, moving the target to a staged
 * state that has passed the gate. The queue does this with a rebase fast-forward. This script
 * runs the same step three ways on identical setups:
 *
 *   rebase        rebaseBranch(staging -> target), what the queue does now
 *   apply         applyBranch(staging -> target) with the base recorded when staging was cut
 *   apply-author  the same, with the real editor passed in as the commit's author
 *
 * Staging is built the way the queue builds it: cut from the target, then the edit applied onto
 * it with the editor as author. The target is a throwaway branch, never main.
 *
 *   npm run repro-final-step
 *   npm run repro-final-step -- --trials 30 --multi-trials 5 --moved-trials 5
 *
 * Parts: 1 timing and correctness on an unmoved target (the queue's real case); 2 staging that
 * holds three commits; 3 a target moved by a foreign write after staging was cut. Needs the
 * server, so it is run on the developer's machine. Set KEEP_BRANCHES=1 to keep the branches.
 */
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const TRIALS = Number(arg('trials', '30'));
const MULTI_TRIALS = Number(arg('multi-trials', '5'));
const MOVED_TRIALS = Number(arg('moved-trials', '5'));
const EDITOR = 'alice';
const MODES = ['rebase', 'apply', 'apply-author'] as const;
type Mode = (typeof MODES)[number];

const RUN = Date.now().toString(36);
let seq = 0;
const uid = (p: string) => `${p}_${RUN}_${seq++}`;
const made: string[] = [];

function client(branch: string): any {
  const c: any = createClient();
  c.db(config.db);
  c.checkout(branch);
  return c;
}

/** A new branch cut from `base`, with the base commit recorded. The client is on `base` first, since the SDK cuts from the current branch. */
async function branchOff(base: string, prefix: string): Promise<{ name: string; baseCommit: string }> {
  const name = uid(prefix);
  const r = await createBranchWithBase(base, name);
  made.push(name);
  return { name, baseCommit: r.baseCommit };
}

async function addNode(branch: string, subject: string): Promise<void> {
  await client(branch).addDocument({ '@type': 'Node', subject, category: 'Invention' });
}

async function contentKey(branch: string): Promise<string> {
  const r = await client(branch).getDocument({ type: 'Node', as_list: true, count: 100000 });
  const docs: any[] = Array.isArray(r) ? r : [];
  return docs.map((d) => `${d['@id']}|${d.subject}`).sort().join('\n');
}

async function head(branch: string): Promise<{ id?: string; author?: string }> {
  const log = await getCommitLog(branch, { count: 1 });
  const e = log && log[0];
  return e ? { id: e.identifier ?? e['@id'], author: e.author } : {};
}

async function commitCount(branch: string): Promise<number> {
  const ids = await commitIds(branch);
  return ids ? ids.length : -1;
}

interface Pair {
  target: string;
  staging: string;
  stagingBase: string;
}

/** A target and a staging branch built as the queue builds it: `commits` edits applied onto staging by `EDITOR`. */
async function buildPair(snap: string, commits: number, label: string): Promise<Pair> {
  const target = (await branchOff(snap, `fs_tgt_${label}`)).name;
  const staging = await branchOff(target, `fs_stg_${label}`);
  for (let i = 0; i < commits; i++) {
    const src = await branchOff(snap, `fs_src_${label}`);
    await addNode(src.name, `FINALSTEP ${label} ${RUN} ${i}`);
    await applyBranch({
      sourceBranch: src.name,
      targetBranch: staging.name,
      baseCommit: src.baseCommit,
      message: `edit ${i} ${label}`,
      author: EDITOR,
    });
  }
  return { target, staging: staging.name, stagingBase: staging.baseCommit };
}

async function finalStep(mode: Mode, p: Pair): Promise<void> {
  if (mode === 'rebase') {
    await rebaseBranch({ sourceBranch: p.staging, targetBranch: p.target, message: `final ${mode}` });
    return;
  }
  await applyBranch({
    sourceBranch: p.staging,
    targetBranch: p.target,
    baseCommit: p.stagingBase,
    message: `final ${mode}`,
    author: mode === 'apply-author' ? EDITOR : undefined,
  });
}

interface Result {
  mode: Mode;
  ok: boolean;
  status?: number;
  ms: number;
  text?: string;
  sameHead?: boolean;
  sameContent?: boolean;
  author?: string;
  added?: number;
}

async function measure(mode: Mode, p: Pair): Promise<Result> {
  const before = await commitCount(p.target);
  const t0 = Date.now();
  try {
    await finalStep(mode, p);
  } catch (e: any) {
    const body = e?.data ?? e?.response ?? e?.message ?? String(e);
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return { mode, ok: false, status: e?.status ?? e?.response?.status, ms: Date.now() - t0, text: text.slice(0, 300) };
  }
  const ms = Date.now() - t0;
  const [tHead, sHead, tContent, sContent, after] = await Promise.all([
    head(p.target),
    head(p.staging),
    contentKey(p.target),
    contentKey(p.staging),
    commitCount(p.target),
  ]);
  return {
    mode,
    ok: true,
    ms,
    sameHead: tHead.id !== undefined && tHead.id === sHead.id,
    sameContent: tContent === sContent,
    author: tHead.author,
    added: before >= 0 && after >= 0 ? after - before : undefined,
  };
}

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const p95 = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
};
const distinct = (xs: (string | number | undefined)[]) => [...new Set(xs.map((x) => (x === undefined ? 'unknown' : String(x))))].join(', ');

function summarize(title: string, results: Result[]): void {
  console.log(`\n${title}`);
  for (const mode of MODES) {
    const rs = results.filter((r) => r.mode === mode);
    const ok = rs.filter((r) => r.ok);
    const failed = rs.filter((r) => !r.ok);
    const times = ok.map((r) => r.ms);
    console.log(
      `${mode.padEnd(12)} ${rs.length} runs, failed ${failed.length}` +
        (failed.length ? ` (${distinct(failed.map((r) => r.status))})` : '') +
        `, mean ${mean(times)} ms, p95 ${p95(times)} ms, min ${times.length ? Math.min(...times) : 0}, max ${times.length ? Math.max(...times) : 0}`,
    );
    console.log(
      `${''.padEnd(12)} target head is the staged commit: ${ok.filter((r) => r.sameHead).length}/${ok.length}; ` +
        `content equal to staging: ${ok.filter((r) => r.sameContent).length}/${ok.length}; ` +
        `head author: ${distinct(ok.map((r) => r.author))}; commits added to target: ${distinct(ok.map((r) => r.added))}`,
    );
    for (const f of failed.slice(0, 2)) console.log(`${''.padEnd(12)} sample error: ${f.status} ${f.text}`);
  }
}

async function part1(): Promise<void> {
  console.log(`--- Part 1: unmoved target, one staged commit, ${TRIALS} trials per mode ---`);
  const results: Result[] = [];
  for (let i = 0; i < TRIALS; i++) {
    const snap = (await branchOff('main', 'fs_snap')).name;
    const pairs = new Map<Mode, Pair>();
    for (const mode of MODES) pairs.set(mode, await buildPair(snap, 1, `p1${mode}`));
    // The order rotates each trial, so no mode always runs first.
    for (let k = 0; k < MODES.length; k++) {
      const mode = MODES[(i + k) % MODES.length];
      results.push(await measure(mode, pairs.get(mode) as Pair));
    }
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${TRIALS} trials done`);
  }
  summarize('Part 1 summary', results);
}

async function part2(): Promise<void> {
  console.log(`\n--- Part 2: staging holds three commits, ${MULTI_TRIALS} trials per mode ---`);
  const results: Result[] = [];
  for (let i = 0; i < MULTI_TRIALS; i++) {
    const snap = (await branchOff('main', 'fs_snap')).name;
    for (const mode of MODES) {
      const pair = await buildPair(snap, 3, `p2${mode}`);
      results.push(await measure(mode, pair));
    }
  }
  summarize('Part 2 summary (the commits-added column shows the history shape: 3 means the staged commits are kept, 1 means they collapse)', results);
}

async function part3(): Promise<void> {
  console.log(`\n--- Part 3: target moved by a foreign write after staging was cut, ${MOVED_TRIALS} trials per mode ---`);
  for (let i = 0; i < MOVED_TRIALS; i++) {
    const snap = (await branchOff('main', 'fs_snap')).name;
    for (const mode of MODES) {
      const pair = await buildPair(snap, 1, `p3${mode}`);
      await addNode(pair.target, `FINALSTEP foreign ${RUN} ${i} ${mode}`);
      const r = await measure(mode, pair);
      let both = 'n/a';
      if (r.ok) {
        const key = await contentKey(pair.target);
        const foreign = key.includes(`FINALSTEP foreign ${RUN} ${i} ${mode}`);
        const staged = key.includes(`FINALSTEP p3${mode} ${RUN} 0`);
        both = `foreign node present ${foreign}, staged node present ${staged}`;
      }
      console.log(
        `trial ${i + 1} ${mode.padEnd(12)} ${r.ok ? 'landed' : `FAILED ${r.status} ${r.text}`} in ${r.ms} ms; ${both}` +
          (r.ok ? `; head author ${r.author}, commits added ${r.added}` : ''),
      );
    }
  }
}

async function main(): Promise<void> {
  console.log(`--- Final step: rebase fast-forward vs apply (issue #72); run ${RUN} ---`);
  try {
    await part1();
    await part2();
    await part3();
  } finally {
    if (!process.env.KEEP_BRANCHES) {
      for (const b of made.reverse()) {
        try {
          await client('main').deleteBranch(b);
        } catch {
          /* best effort */
        }
      }
    }
  }
  console.log('\n--- Final-step comparison complete ---');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
