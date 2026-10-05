import { config } from '../../config';
import { createClient } from '../../db/client';
import { applyBranch } from '../../db/apply';
import { createBranchWithBase } from '../../db/branch';

/**
 * Live reproductions for the apply sections of docs/upstream-bug-report.md (sections 1, 2, 3
 * and 5). Section numbers below follow the report. The rebase counterparts are in
 * repro-rebase.ts. Needs the server; the sandbox cannot reach it, so this is run on the
 * developer's machine.
 *
 * Every node this script lands on main has a subject starting with MARK, and they are deleted
 * at the end. The string-size section writes only to a throwaway branch.
 */
const MARK = 'REPRO-APPLY';
const RUN = Date.now();

interface Outcome {
  status: number;
  body?: unknown;
}

async function outcome(fn: () => Promise<unknown>): Promise<Outcome> {
  try {
    await fn();
    return { status: 200 };
  } catch (err: any) {
    const status = err.status ?? err.response?.status ?? err.response?.statusCode ?? 500;
    return { status, body: err.data ?? err.response?.data ?? err.response ?? err.message };
  }
}

function counts(outcomes: Outcome[]): Record<number, number> {
  return outcomes.reduce((acc: Record<number, number>, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
}

/** Prints the first body seen for each distinct failing status, cut to 400 characters. */
function sampleBodies(label: string, outcomes: Outcome[]): void {
  const seen = new Set<number>();
  for (const o of outcomes) {
    if (o.status === 200 || seen.has(o.status)) continue;
    seen.add(o.status);
    const text = typeof o.body === 'string' ? o.body : JSON.stringify(o.body);
    console.log(`${label} sample body for HTTP ${o.status}: ${(text ?? '').slice(0, 400)}`);
  }
}

function branchClient(branch: string): any {
  const c: any = createClient();
  c.db(config.db);
  c.checkout(branch);
  return c;
}

async function addNode(branch: string, subject: string): Promise<void> {
  await branchClient(branch).addDocument({ '@type': 'Node', subject, category: 'Invention' });
}

async function dropBranch(name: string): Promise<void> {
  try {
    await branchClient('main').deleteBranch(name);
  } catch {
    /* already gone */
  }
}

async function nodesOnMain(): Promise<any[]> {
  const r = await branchClient('main').getDocument({ type: 'Node', as_list: true, count: 100000 });
  return Array.isArray(r) ? r : [];
}

async function run(): Promise<void> {
  console.log('--- Upstream bug report repros: apply (sections 1, 2, 3, 5) ---');

  // --- Section 1 (apply): back-to-back landings with no pause (20 cycles) ---
  console.log('\n--- Section 1 (apply): back-to-back, no pause ---');
  const s1: Outcome[] = [];
  const N1 = 20;
  for (let i = 0; i < N1; i++) {
    const n1 = `repro_a1_b1_${RUN}_${i}`;
    const n2 = `repro_a1_b2_${RUN}_${i}`;
    try {
      // Both branches are cut from the same head of main, so each carries its own recorded base.
      const b1 = await createBranchWithBase('main', n1);
      const b2 = await createBranchWithBase('main', n2);
      await addNode(n1, `${MARK} S1 B1 ${i}`);
      await addNode(n2, `${MARK} S1 B2 ${i}`);

      const o1 = await outcome(() =>
        applyBranch({ sourceBranch: n1, targetBranch: 'main', baseCommit: b1.baseCommit, message: `apply ${n1}` }),
      );
      s1.push(o1);
      console.log(`Section 1 [${i + 1}/${N1}] apply ${n1} -> main: HTTP ${o1.status}`);

      const o2 = await outcome(() =>
        applyBranch({ sourceBranch: n2, targetBranch: 'main', baseCommit: b2.baseCommit, message: `apply ${n2}` }),
      );
      s1.push(o2);
      console.log(`Section 1 [${i + 1}/${N1}] apply ${n2} -> main: HTTP ${o2.status}`);
    } catch (e: any) {
      console.error(`Section 1 iteration ${i} setup error:`, e.message);
    } finally {
      await dropBranch(n1);
      await dropBranch(n2);
    }
  }
  console.log('Section 1 (apply) counts:', counts(s1), `of ${s1.length} applies`);
  sampleBodies('Section 1 (apply)', s1);

  // --- Section 2 (apply): five parallel applies onto main, 10 rounds ---
  console.log('\n--- Section 2 (apply): parallel, 5 at once, 10 rounds ---');
  const s2: Outcome[] = [];
  let landedClaimed = 0;
  for (let round = 0; round < 10; round++) {
    const names = [0, 1, 2, 3, 4].map((j) => `repro_a2_r${round}_b${j}_${RUN}`);
    try {
      const bases: string[] = [];
      for (const n of names) bases.push((await createBranchWithBase('main', n)).baseCommit);
      for (const n of names) await addNode(n, `${MARK} S2 ${n}`);

      const results = await Promise.all(
        names.map((n, j) =>
          outcome(() =>
            applyBranch({ sourceBranch: n, targetBranch: 'main', baseCommit: bases[j], message: `parallel apply ${n}` }),
          ),
        ),
      );
      s2.push(...results);
      const ok = results.filter((r) => r.status === 200).length;
      landedClaimed += ok;
      console.log(`Section 2 round ${round + 1}/10: ${ok} of 5 succeeded, statuses`, results.map((r) => r.status));
    } catch (e: any) {
      console.error(`Section 2 round ${round} setup error:`, e.message);
    } finally {
      for (const n of names) await dropBranch(n);
    }
  }
  console.log('Section 2 (apply) counts:', counts(s2), `of ${s2.length} applies`);
  sampleBodies('Section 2 (apply)', s2);
  // Consistency: main should hold exactly one node for every apply that reported success.
  const present = (await nodesOnMain()).filter((d) => typeof d.subject === 'string' && d.subject.startsWith(`${MARK} S2 `));
  console.log(
    `Section 2 consistency: ${landedClaimed} applies reported success, ${present.length} section-2 nodes are on main` +
      (present.length === landedClaimed ? ' (match)' : ' (MISMATCH: a failed apply may have landed, or a success may not have)'),
  );

  // --- Section 3 (apply): missing source branch ---
  console.log('\n--- Section 3 (apply): missing branch ---');
  const missing = `does_not_exist_${RUN}`;
  const headOfMain = (await createBranchWithBase('main', `repro_a3_probe_${RUN}`)).baseCommit;
  await dropBranch(`repro_a3_probe_${RUN}`);
  const s3 = await outcome(() =>
    applyBranch({ sourceBranch: missing, targetBranch: 'main', baseCommit: headOfMain, message: 'apply missing' }),
  );
  console.log(`Section 3 apply from missing branch -> main: HTTP ${s3.status}, body:`, JSON.stringify(s3.body)?.slice(0, 400));

  // --- Section 5: string value size, on a throwaway branch ---
  console.log('\n--- Section 5: string value size ---');
  const sizeBranch = `repro_5_${RUN}`;
  try {
    await createBranchWithBase('main', sizeBranch);
    const sizes = [10_000, 50_000, 90_000, 100_000, 110_000, 150_000, 500_000, 2_000_000];
    for (const size of sizes) {
      const subject = `${MARK} S5 ${size} ` + 'x'.repeat(size);
      const o = await outcome(() => addNode(sizeBranch, subject));
      let found = 0;
      try {
        const r = await branchClient(sizeBranch).getDocument({ type: 'Node', as_list: true, count: 100000 });
        found = (Array.isArray(r) ? r : []).filter((d: any) => typeof d.subject === 'string' && d.subject.startsWith(`${MARK} S5 ${size} `)).length;
      } catch (e: any) {
        console.log(`Section 5 read-back at ${size} failed: ${e.message}`);
      }
      const text = o.status === 200 ? '' : `, body: ${(typeof o.body === 'string' ? o.body : JSON.stringify(o.body) ?? '').slice(0, 300)}`;
      console.log(`Section 5 ${size} characters: HTTP ${o.status}, ${found} document(s) stored${text}`);
    }
  } finally {
    await dropBranch(sizeBranch);
  }

  // --- Cleanup: nodes this script landed on main ---
  console.log('\n--- Cleanup ---');
  const mine = (await nodesOnMain()).filter((d) => typeof d.subject === 'string' && d.subject.startsWith(`${MARK} `));
  let removed = 0;
  for (const d of mine) {
    try {
      await branchClient('main').deleteDocument({ id: d['@id'] });
      removed++;
    } catch (e: any) {
      console.log(`could not delete ${d['@id']}: ${e.message}`);
    }
  }
  console.log(`Removed ${removed} of ${mine.length} nodes from main.`);
  console.log('\n--- Apply repro suite complete ---');
}

run().catch((err) => {
  console.error('Apply repro suite failed:', err);
  process.exit(1);
});
