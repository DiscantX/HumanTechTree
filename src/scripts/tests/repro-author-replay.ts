import axios from 'axios';
import { config } from '../../config';
import { createClient } from '../../db/client';
import { applyBranch } from '../../db/apply';
import { createBranchWithBase } from '../../db/branch';
import { commitIds, getCommitLog } from '../../db/log';
import { rebaseBranch } from '../../db/rebase';

/**
 * Live check for issue #74. The Editing Model's "Who made an edit" section reports that a commit
 * authored by an editor keeps that author when a rebase replays it onto a main that has moved.
 * The final-step run (issue #72) replayed a staged commit onto a moved target and the author
 * became the service account in 5 of 5 runs. The two differ in how the commit got its author:
 *
 *   http   written over plain HTTP with the author parameter (what author-check.ts does)
 *   apply  applied from another branch with the author in the commit information (what the queue does)
 *
 * Each is then landed four ways onto a throwaway target branch:
 *
 *   fast-forward   rebase, target unmoved
 *   replay         rebase, target moved by a foreign commit authored by bob
 *   apply-author   apply from the branch's recorded base, with the editor passed as author
 *   apply-plain    apply from the recorded base, with no author passed
 *
 *   npm run repro-author-replay
 *   npm run repro-author-replay -- --trials 5
 *
 * The script reports what it observes and does not assert. Expected if the author survives: alice.
 * The service account is shown for comparison. Needs the server, so it is run on the developer's
 * machine. Everything is written to throwaway branches. Set KEEP_BRANCHES=1 to keep them.
 */
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const TRIALS = Number(arg('trials', '5'));
const EDITOR = 'alice';
const FOREIGN = 'bob';
const RUN = Date.now().toString(36);
let seq = 0;
const uid = (p: string) => `${p}_${RUN}_${seq++}`;
const made: string[] = [];

const AUTHORING = ['http', 'apply'] as const;
const LANDINGS = ['fast-forward', 'replay', 'apply-author', 'apply-plain'] as const;
type Authoring = (typeof AUTHORING)[number];
type Landing = (typeof LANDINGS)[number];

function client(branch: string): any {
  const c: any = createClient();
  c.db(config.db);
  c.checkout(branch);
  return c;
}

async function branchOff(base: string, prefix: string): Promise<{ name: string; baseCommit: string }> {
  const name = uid(prefix);
  const r = await createBranchWithBase(base, name);
  made.push(name);
  return { name, baseCommit: r.baseCommit };
}

const branchPath = (b: string) => `${config.organization}/${config.db}/local/branch/${b}`;

/** One node committed to `branch` over plain HTTP with an explicit author and message. */
async function commitAs(branch: string, author: string, subject: string, message: string): Promise<void> {
  const r = await axios.post(
    `${config.endpoint}/api/document/${branchPath(branch)}`,
    [{ '@type': 'Node', subject, category: 'Invention' }],
    {
      params: { graph_type: 'instance', author, message },
      auth: { username: config.user, password: config.key },
      validateStatus: () => true,
    },
  );
  if (r.status >= 400) throw new Error(`write as ${author} failed: ${r.status} ${JSON.stringify(r.data)}`);
}

/** Puts one commit authored by EDITOR on `staging`, either over HTTP or by applying another branch with the author set. */
async function authorCommit(how: Authoring, snap: string, staging: string, marker: string): Promise<void> {
  if (how === 'http') {
    await commitAs(staging, EDITOR, `${marker} node`, marker);
    return;
  }
  const src = await branchOff(snap, 'ar_src');
  await client(src.name).addDocument({ '@type': 'Node', subject: `${marker} node`, category: 'Invention' });
  await applyBranch({
    sourceBranch: src.name,
    targetBranch: staging,
    baseCommit: src.baseCommit,
    message: marker,
    author: EDITOR,
  });
}

interface Observation {
  ok: boolean;
  status?: number;
  text?: string;
  headAuthor?: string;
  markerAuthors?: string;
  added?: number;
}

async function land(how: Authoring, landing: Landing, i: number): Promise<Observation> {
  const marker = `AR ${how} ${landing} ${RUN} ${i}`;
  const snap = (await branchOff('main', 'ar_snap')).name;
  const target = (await branchOff(snap, 'ar_tgt')).name;
  const staging = await branchOff(target, 'ar_stg');
  await authorCommit(how, snap, staging.name, marker);
  if (landing !== 'fast-forward') await commitAs(target, FOREIGN, `${marker} foreign`, `${marker} foreign`);

  const before = (await commitIds(target))?.length ?? -1;
  try {
    if (landing === 'fast-forward' || landing === 'replay') {
      await rebaseBranch({ sourceBranch: staging.name, targetBranch: target, message: `${marker} land` });
    } else {
      await applyBranch({
        sourceBranch: staging.name,
        targetBranch: target,
        baseCommit: staging.baseCommit,
        message: `${marker} land`,
        author: landing === 'apply-author' ? EDITOR : undefined,
      });
    }
  } catch (e: any) {
    const body = e?.data ?? e?.response ?? e?.message ?? String(e);
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return { ok: false, status: e?.status ?? e?.response?.status, text: text.slice(0, 300) };
  }
  const log = (await getCommitLog(target, { count: 200 })) ?? [];
  const after = (await commitIds(target))?.length ?? -1;
  const mine = log.filter((e) => typeof e.message === 'string' && e.message.includes(marker) && !e.message.includes('foreign'));
  return {
    ok: true,
    headAuthor: log[0]?.author,
    markerAuthors: [...new Set(mine.map((e) => e.author))].join('+') || '(none found)',
    added: before >= 0 && after >= 0 ? after - before : undefined,
  };
}

const distinct = (xs: (string | number | undefined)[]) => [...new Set(xs.map((x) => (x === undefined ? 'unknown' : String(x))))].join(', ');

async function main(): Promise<void> {
  console.log(`--- Author through replay (issue #74); service account ${config.user}; editor ${EDITOR}; ${TRIALS} trials per cell ---`);
  try {
    for (const how of AUTHORING) {
      for (const landing of LANDINGS) {
        const obs: Observation[] = [];
        for (let i = 0; i < TRIALS; i++) obs.push(await land(how, landing, i));
        const ok = obs.filter((o) => o.ok);
        const failed = obs.filter((o) => !o.ok);
        console.log(
          `commit authored by ${how.padEnd(5)} | landed by ${landing.padEnd(12)} | ${obs.length} runs, failed ${failed.length}` +
            `${failed.length ? ` (${distinct(failed.map((f) => f.status))})` : ''}` +
            ` | head author: ${distinct(ok.map((o) => o.headAuthor))}` +
            ` | author of the edit's commit: ${distinct(ok.map((o) => o.markerAuthors))}` +
            ` | commits added: ${distinct(ok.map((o) => o.added))}`,
        );
        for (const f of failed.slice(0, 1)) console.log(`    sample error: ${f.status} ${f.text}`);
      }
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
  console.log('\n--- Author check complete ---');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
