import { config } from '../../config';
import { createClient } from '../../db/client';
import { applyBranch } from '../../db/apply';
import { rebaseBranch } from '../../db/rebase';

/**
 * Live reproduction for section 1 of docs/upstream-bug-report.md, in the structure that
 * produced the recorded counts (apply-experiments.ts, A2): many one-node branches cut from
 * one snapshot are landed one after another onto a target branch that keeps moving, with an
 * optional pause before each landing. Rebase and apply run on identical setups so the two
 * can be compared. Recorded for rebase: first-attempt server errors 7 of 50 with no pause,
 * 3 of 30 at 100 ms, 1 of 30 at 250 ms, 1 of 30 at 500 ms and 0 of 30 at 1 s. Apply had 0
 * of 180.
 *
 *   npm run repro-sequential
 *   npm run repro-sequential -- --pauses 0,0,100,250,500,1000 --trials 30 --ops rebase,apply
 *
 * Needs the server; the sandbox cannot reach it, so this is run on the developer's machine.
 * Everything is written to throwaway branches, never to main. Set KEEP_BRANCHES=1 to keep them.
 */
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PAUSES = arg('pauses', '0,0').split(',').map(Number);
const TRIALS = Number(arg('trials', '30'));
const OPS = arg('ops', 'rebase,apply').split(',');
const RUN = Date.now().toString(36);
let seq = 0;
const uid = (p: string) => `${p}_${RUN}_${seq++}`;
const made: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function client(branch: string): any {
  const c: any = createClient();
  c.db(config.db);
  c.checkout(branch);
  return c;
}

/** A new branch cut from `base`. The client is checked out on `base` first, since the SDK cuts from the current branch. */
async function branchOff(base: string, prefix: string): Promise<string> {
  const name = uid(prefix);
  await client(base).branch(name);
  made.push(name);
  return name;
}

async function addNode(branch: string, subject: string): Promise<void> {
  await client(branch).addDocument({ '@type': 'Node', subject, category: 'Invention' });
}

async function countNodes(branch: string): Promise<number> {
  const r = await client(branch).getDocument({ type: 'Node', as_list: true, count: 100000 });
  return Array.isArray(r) ? r.length : 0;
}

interface Attempt {
  ok: boolean;
  status?: number;
  ms: number;
  text?: string;
}

async function land(op: string, source: string, target: string, snap: string, message: string): Promise<Attempt> {
  const t0 = Date.now();
  try {
    if (op === 'rebase') await rebaseBranch({ sourceBranch: source, targetBranch: target, message });
    else await applyBranch({ sourceBranch: source, targetBranch: target, baseCommit: snap, message });
    return { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    const body = e?.data ?? e?.response ?? e?.message ?? String(e);
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return { ok: false, status: e?.status ?? e?.response?.status, ms: Date.now() - t0, text: text.slice(0, 300) };
  }
}

async function trial(op: string, pauseMs: number): Promise<void> {
  const snap = await branchOff('main', 'sq_snap');
  const target = await branchOff(snap, 'sq_target');
  const sources: string[] = [];
  for (let i = 0; i < TRIALS; i++) {
    const s = await branchOff(snap, 'sq_src');
    await addNode(s, `SEQ ${op} ${pauseMs} ${RUN} ${i}`);
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
    const a = await land(op, s, target, snap, `SEQ ${op} ${s}`);
    totalMs += a.ms;
    if (a.ok) continue;
    if (a.status === 409) conflicts++;
    else if (a.status !== undefined && a.status >= 500) firstErrors++;
    else other++;
    if (samples.length < 2) samples.push(`${a.status} ${a.text}`);
    await sleep(1500);
    const again = await land(op, s, target, snap, `SEQ ${op} retry ${s}`);
    if (again.ok) recovered++;
  }
  const landed = (await countNodes(target)) - start;
  console.log(
    `${op.padEnd(6)} pause ${String(pauseMs).padStart(4)} ms: ${TRIALS} landings, first-attempt 5xx ${firstErrors}, ` +
      `409 ${conflicts}, other ${other}, recovered on retry ${recovered}, landed ${landed}/${TRIALS}, ` +
      `mean ${Math.round(totalMs / TRIALS)} ms`,
  );
  for (const t of samples) console.log(`    sample error: ${t}`);
}

async function main(): Promise<void> {
  console.log(`--- Sequential landings: ops ${OPS.join(', ')}; pauses ${PAUSES.join(', ')} ms; ${TRIALS} trials each ---`);
  console.log('Recorded for rebase: 7/50 at 0 ms, 3/30 at 100, 1/30 at 250, 1/30 at 500, 0/30 at 1000. Apply: 0/180.\n');
  try {
    for (const pause of PAUSES) {
      for (const op of OPS) await trial(op, pause);
    }
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
  console.log('\n--- Sequential repro complete ---');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
