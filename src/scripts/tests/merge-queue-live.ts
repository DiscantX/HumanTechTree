import { config } from '../../config';
import { createClient } from '../../db/client';
import { queueFromEnv, landingModeFromEnv, LandingResult } from '../../db/merge-queue';

/**
 * Live test of the merge queue against a running TerminusDB. Needs the dev
 * database to exist with the graph schema pushed (npm run init-db). Branches
 * are created with unique names, and main gains a handful of test documents,
 * so run reset-db and init-db afterward if you want a clean slate.
 *
 *   npx ts-node src/scripts/tests/merge-queue-live.ts
 */
const c: any = createClient();
c.db(config.db);

const run = Date.now().toString(36);
let n = 0;
const uid = (p: string) => `${p}_${run}_${n++}`;
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};
const observe = (name: string, detail: string) => console.log(`NOTE  ${name}  ${detail}`);
const brief = (r: LandingResult) => `${r.outcome} (attempts ${r.attempts})`;

async function branchOff(base: string): Promise<string> {
  const name = uid('q');
  c.checkout(base);
  await c.branch(name);
  return name;
}
async function insert(branch: string, docs: any[]): Promise<string[]> {
  c.checkout(branch);
  return c.addDocument(docs);
}
async function list(branch: string, type: string): Promise<any[]> {
  c.checkout(branch);
  const r = await c.getDocument({ type, as_list: true, count: 100000 });
  return Array.isArray(r) ? r : [];
}
const node = (subject: string) => ({ '@type': 'Node', subject, category: 'Invention' });
const edge = (s: string, t: string, statement: string) => ({
  '@type': 'Edge',
  source_node: s,
  target_node: t,
  statement,
  relationship_kind: 'Unspecified',
  status: 'Ungrounded',
});

async function main() {
  const q = queueFromEnv();
  console.log(`landing mode: ${landingModeFromEnv()}`);

  // Q1: many branches enqueued at once all land, one at a time.
  {
    const branches: string[] = [];
    for (let i = 0; i < 6; i++) {
      const b = await branchOff('main');
      await insert(b, [node(`Q1 ${run} node ${i}`)]);
      branches.push(b);
    }
    const t0 = Date.now();
    const rs = await Promise.all(branches.map((b) => q.enqueue({ sourceBranch: b, message: 'Q1 landing' })));
    const secs = (Date.now() - t0) / 1000;
    check('Q1: six simultaneous landings all land', rs.every((r) => r.outcome === 'landed'), rs.map(brief).join('; '));
    const onMain = (await list('main', 'Node')).filter((d) => String(d.subject).startsWith(`Q1 ${run}`));
    check('Q1: six nodes on main', onMain.length === 6, `${onMain.length} found`);
    observe('Q1: wall time and retries', `${secs.toFixed(1)} s, ${rs.reduce((a, r) => a + r.attempts - 1, 0)} retries`);
    observe('Q1: land-call duration per landing (ms)', rs.map((r) => r.landMs.join('+')).join(', '));
  }

  // Q2: two edits to one field of one claim. One lands, the other is a conflict, first text survives.
  let q2: { s: string; t: string; e: string } | undefined;
  {
    const [s, t] = await insert('main', [node(`Q2 ${run} s`), node(`Q2 ${run} t`)]);
    const [e] = await insert('main', [edge(s, t, 'baseline')]);
    q2 = { s, t, e };
    const a = await branchOff('main');
    const b = await branchOff('main');
    for (const [br, text] of [[a, 'text from A'], [b, 'text from B']] as const) {
      c.checkout(br);
      const d = await c.getDocument({ id: e });
      await c.updateDocument({ ...d, statement: text });
    }
    const [ra, rb] = await Promise.all([
      q.enqueue({ sourceBranch: a, message: 'Q2 A' }),
      q.enqueue({ sourceBranch: b, message: 'Q2 B' }),
    ]);
    check('Q2: first lands', ra.outcome === 'landed', brief(ra));
    check('Q2: second reported as conflict, not retried', rb.outcome === 'conflict' && rb.attempts === 1, brief(rb));
    c.checkout('main');
    const now = await c.getDocument({ id: e });
    check("Q2: first editor's text stays on main", now.statement === 'text from A', String(now.statement));

    // Q6: resolve on a fresh branch off current main and land through the same queue.
    const fresh = await branchOff('main');
    c.checkout(fresh);
    const d = await c.getDocument({ id: e });
    await c.updateDocument({ ...d, statement: 'resolved: A and B merged' });
    const rr = await q.enqueue({ sourceBranch: fresh, message: 'Q6 resolution' });
    c.checkout('main');
    const after = await c.getDocument({ id: e });
    check('Q6: resolution on a fresh branch lands', rr.outcome === 'landed' && after.statement === 'resolved: A and B merged', brief(rr));
  }

  // Q3: delete of a node on one branch, edge to it added on another. The plain rebase let
  // this land and left a dangling edge on main (earlier run). The queue now lands through a
  // staging branch and the validation gate, so the edge must not reach main.
  {
    const label = 'Q3';
    const [s, t] = await insert('main', [node(`${label} ${run} s`), node(`${label} ${run} t`)]);
    const del = await branchOff('main');
    const add = await branchOff('main');
    c.checkout(del);
    await c.deleteDocument({ id: t });
    await insert(add, [edge(s, t, `${label} ${run} edge to a deleted node`)]);
    const rd = await q.enqueue({ sourceBranch: del, message: `${label} delete` });
    const ra = await q.enqueue({ sourceBranch: add, message: `${label} add edge` });
    // Match by content, not id: ids come back as full IRIs from addDocument and short from a read.
    const edges = (await list('main', 'Edge')).filter((d) => String(d.statement).includes(`${label} ${run} edge`));
    check('Q3: delete lands first', rd.outcome === 'landed', brief(rd));
    check('Q3: the edge to the deleted node is refused', ra.outcome !== 'landed', brief(ra));
    check('Q3: main has no dangling edge', edges.length === 0, `${edges.length} such edges on main`);
    observe('Q3: outcome and violations', `${ra.outcome} ${JSON.stringify(ra.violations ?? ra.detail?.slice(0, 200) ?? '')}`);
  }

  // Q4: missing branch is caught by the preflight, with no server call.
  {
    const r = await q.enqueue({ sourceBranch: uid('nope'), message: 'Q4' });
    check('Q4: missing branch is reported by preflight', r.outcome === 'missing_branch' && r.attempts === 0, brief(r));
  }

  // Q5: duplicate claim under a composite key, added on two branches.
  {
    const base = await branchOff('main');
    c.checkout(base);
    await c.addDocument(
      [
        { '@type': 'Enum', '@id': `PB${run}`, '@value': ['Historical', 'Logical'] },
        {
          '@type': 'Class',
          '@id': `PC${run}`,
          '@key': { '@type': 'Lexical', '@fields': ['src', 'dst', 'basis', 'origin'] },
          src: 'Node',
          dst: 'Node',
          basis: `PB${run}`,
          origin: { '@type': 'Optional', '@class': 'xsd:string' },
          statement: { '@type': 'Optional', '@class': 'xsd:string' },
        },
      ],
      { graph_type: 'schema' },
    );
    const [s, t] = await insert(base, [node(`Q5 ${run} s`), node(`Q5 ${run} t`)]);
    const a = await branchOff(base);
    const b = await branchOff(base);
    await insert(a, [{ '@type': `PC${run}`, src: s, dst: t, basis: 'Logical', statement: 'from a' }]);
    await insert(b, [{ '@type': `PC${run}`, src: s, dst: t, basis: 'Logical', statement: 'from b' }]);
    const qb = queueFromEnv();
    const [ra, rb] = await Promise.all([
      qb.enqueue({ sourceBranch: a, targetBranch: base, message: 'Q5 A' }),
      qb.enqueue({ sourceBranch: b, targetBranch: base, message: 'Q5 B' }),
    ]);
    const onBase = await list(base, `PC${run}`);
    check('Q5: at most one claim for the pair ends up on the target', onBase.length <= 1, `${onBase.length} found; A ${brief(ra)}, B ${brief(rb)}`);
    check('Q5: the second is reported as a conflict', rb.outcome === 'conflict' || ra.outcome === 'conflict', `${ra.outcome} / ${rb.outcome}`);
  }

  // Q7: two branches each add an edge; together they close a cycle. The second must be refused.
  {
    const [x, y] = await insert('main', [node(`Q7 ${run} x`), node(`Q7 ${run} y`)]);
    const a = await branchOff('main');
    const b = await branchOff('main');
    const logical = (s: string, t: string, st: string) => ({ ...edge(s, t, st), basis: 'LogicalNecessity' });
    await insert(a, [logical(x, y, `Q7 ${run} x to y`)]);
    await insert(b, [logical(y, x, `Q7 ${run} y to x`)]);
    const ra = await q.enqueue({ sourceBranch: a, message: 'Q7 A' });
    const rb = await q.enqueue({ sourceBranch: b, message: 'Q7 B' });
    const onMain = (await list('main', 'Edge')).filter((d) => String(d.statement).startsWith(`Q7 ${run}`));
    check('Q7: first edge lands', ra.outcome === 'landed', brief(ra));
    check('Q7: the edge that closes the cycle is refused', rb.outcome === 'validation_failed', brief(rb));
    check('Q7: main holds one edge, no cycle', onMain.length === 1, `${onMain.length} on main`);
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('merge-queue-live failed:', e);
  process.exit(2);
});
