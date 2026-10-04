import axios from 'axios';

import { config } from '../../config';
import { createClient } from '../../db/client';
import { getCommitLog, CommitInfo } from '../../db/log';
import { MergeQueue } from '../../db/merge-queue';
import { rebaseBranch } from '../../db/rebase';

/**
 * Issue #25: does a commit's per-user `author` survive rebase and the staged
 * landing path, given that the app talks to TerminusDB through one service
 * account? Needs the dev database with the graph schema pushed (npm run init-db).
 * Creates uniquely named branches and adds a few test nodes to main.
 *
 *   npm run author-check
 *
 * The SDK stamps every document write with the login user (`docParams.author =
 * this.author()` in woqlClient.js), so commits with a chosen author are written
 * over plain HTTP here. The script reports what it observes and does not assert,
 * since the answer decides what the queue has to do.
 */
const c: any = createClient();
c.db(config.db);

const run = Date.now().toString(36);
let n = 0;
const uid = (p: string) => `${p}_${run}_${n++}`;
const note = (name: string, detail: string) => console.log(`${name.padEnd(46)} ${detail}`);

const branchPath = (b: string) => `${config.organization}/${config.db}/local/branch/${b}`;

async function branchOff(base: string): Promise<string> {
  const name = uid('a');
  c.checkout(base);
  await c.branch(name);
  return name;
}

/** Commit one node to `branch` with an explicit author, over plain HTTP. */
async function commitAs(branch: string, author: string, marker: string): Promise<void> {
  const r = await axios.post(
    `${config.endpoint}/api/document/${branchPath(branch)}`,
    [{ '@type': 'Node', subject: `${marker} ${run} ${n++}`, category: 'Invention' }],
    {
      params: { graph_type: 'instance', author, message: marker },
      auth: { username: config.user, password: config.key },
      validateStatus: () => true,
    },
  );
  if (r.status >= 400) throw new Error(`write as ${author} failed: ${r.status} ${JSON.stringify(r.data)}`);
}

/** Authors of the commits on `branch` whose message is exactly `marker`. */
async function authorsOf(branch: string, marker: string): Promise<string> {
  const log = (await getCommitLog(branch, { count: 200 })) as CommitInfo[] | null;
  if (!log) return '(log unavailable)';
  const hits = log.filter((e) => e.message === marker).map((e) => e.author);
  return hits.length ? hits.join(', ') : '(no commit with that message)';
}

async function main() {
  note('service account (config.user)', config.user);

  // Control: the SDK's own write path.
  {
    const b = await branchOff('main');
    c.checkout(b);
    await c.addDocument([{ '@type': 'Node', subject: `S0 ${run}`, category: 'Invention' }], undefined, undefined, `S0 ${run}`);
    note('S0 SDK write: author on branch', await authorsOf(b, `S0 ${run}`));
  }

  // Can a write over HTTP carry a chosen author at all?
  {
    const b = await branchOff('main');
    await commitAs(b, 'alice', `S1 ${run}`);
    note('S1 HTTP write as alice: author on branch', await authorsOf(b, `S1 ${run}`));
  }

  // Rebase that rewrites commits: main moves after the branch is cut.
  {
    const b = await branchOff('main');
    await commitAs(b, 'alice', `S2 ${run}`);
    await commitAs('main', 'bob', `S2-main ${run}`);
    const res = await rebaseBranch({ sourceBranch: b, targetBranch: 'main', message: `S2 rebase ${run}` });
    note('S2 rebase, main moved: author on main', await authorsOf('main', `S2 ${run}`));
    note('S2 rebase status / report entries', `${res['api:status']} / ${res['api:rebase_report']?.length ?? 0}`);
  }

  // Fast-forward: main has not moved.
  {
    const b = await branchOff('main');
    await commitAs(b, 'alice', `S3 ${run}`);
    const res = await rebaseBranch({ sourceBranch: b, targetBranch: 'main', message: `S3 rebase ${run}` });
    note('S3 fast-forward: author on main', await authorsOf('main', `S3 ${run}`));
    note('S3 forwarded commits', String(res['api:forwarded_commits']?.length ?? 0));
  }

  // The merge queue's staged landing, with main moved so the first replay rewrites.
  {
    const q = new MergeQueue();
    const b = await branchOff('main');
    await commitAs(b, 'alice', `S4 ${run}`);
    await commitAs('main', 'bob', `S4-main ${run}`);
    const r = await q.enqueue({ sourceBranch: b, message: `S4 land ${run}` });
    note('S4 queue outcome', r.outcome);
    note('S4 staged landing, main moved: author on main', await authorsOf('main', `S4 ${run}`));
  }

  // The history endpoint, which has timed out in earlier runs.
  {
    const r = await axios.get(`${config.endpoint}/api/history/${config.organization}/${config.db}`, {
      params: { id: 'Node' },
      auth: { username: config.user, password: config.key },
      timeout: 20000,
      validateStatus: () => true,
    }).catch((e) => ({ status: e.code ?? 'error', data: undefined as unknown }));
    note('history endpoint status', String(r.status));
  }

  console.log('\nExpected if authors survive: alice on S1 to S4. If they are overwritten: ' + config.user + ' on S2 to S4.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
