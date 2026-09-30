import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { commitIds } from '../db/log';
import { createClient } from '../db/client';
import { rebaseBranch } from '../db/rebase';

/**
 * Broad test suite for TerminusDB's branch-and-merge behavior, written to
 * answer many open questions in ONE run instead of editing code per test.
 *
 * Verdicts:
 *   PASS      - a hypothesis we hold (from Editing Model, Data Model, or
 *               incident-summary.md) was confirmed.
 *   FAIL      - that hypothesis was NOT confirmed. This means "our
 *               assumption is wrong or the DB behaves differently", not
 *               necessarily "bug". Read the detail.
 *   OBSERVED  - purely informational; we recorded what happened.
 *   ERROR     - the scenario itself crashed (harness problem or an
 *               unexpected exception). Only these set a non-zero exit code.
 *
 * Usage (add an npm script mirroring your others, e.g.
 * "concurrent-suite": "ts-node src/scripts/concurrent-suite.ts"):
 *   npm run concurrent-suite
 *   npm run concurrent-suite -- --only=C,P        (id prefixes)
 *   npm run concurrent-suite -- --skip-slow       (skips the X* scale tests)
 *
 * Every branch/doc name carries a run ID, so re-running is safe. Output:
 * console log plus test-results/concurrent-suite-<runid>.{json,md}. Paste
 * the .md back into chat for analysis.
 *
 * Note: newBranch() uses the same client.branch(name, 'main') call as
 * concurrent-edit-test.ts. Scenario M0 checks the new branch actually
 * inherits main's documents, in case that second argument is misread by
 * the client.
 */

const RUN_ID = Date.now();
let seq = 0;
const uid = (p: string) => `${p}-${RUN_ID}-${++seq}`;

// ---------------------------------------------------------------- findings

type Verdict = 'PASS' | 'FAIL' | 'OBSERVED' | 'ERROR';
interface Finding {
  scenario: string;
  label: string;
  verdict: Verdict;
  detail: string;
}
const findings: Finding[] = [];
let currentScenario = '';

function record(verdict: Verdict, label: string, detail = '') {
  findings.push({ scenario: currentScenario, label, verdict, detail });
  console.log(`  [${verdict}] ${label}${detail ? ` — ${detail}` : ''}`);
}
const expectThat = (label: string, cond: boolean, detail = '') =>
  record(cond ? 'PASS' : 'FAIL', label, detail);
const observe = (label: string, detail = '') =>
  record('OBSERVED', label, detail);

// ---------------------------------------------------------------- helpers

function shorten(err: any): string {
  let s: string;
  try {
    s = JSON.stringify(err?.response ?? err?.data ?? err?.message ?? String(err));
  } catch {
    s = String(err);
  }
  return (s ?? '').slice(0, 400);
}

function classify(err: any): string {
  const status = err?.status ?? err?.response?.status;
  const body = shorten(err);
  if (/cardinality/i.test(body)) return 'CARDINALITY_CONFLICT';
  if (typeof status === 'number' && status >= 500) return `HTTP_${status}`;
  if (/dangling|referenc|not_a_valid_document_id|unknown_document/i.test(body))
    return 'REFERENTIAL_INTEGRITY';
  if (/schema|type_error|not_a_valid|unknown_property|required|missing/i.test(body))
    return 'SCHEMA_VALIDATION';
  if (status === 409) return 'HTTP_409_CONFLICT';
  return status ? `HTTP_${status}` : 'OTHER';
}

interface Attempt<T> {
  ok: boolean;
  value?: T;
  kind?: string;
  body?: string;
}
async function attempt<T>(fn: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err: any) {
    return { ok: false, kind: classify(err), body: shorten(err) };
  }
}
const desc = (a: { ok: boolean; kind?: string; body?: string }) =>
  a.ok ? 'ok' : `${a.kind} ${a.body ?? ''}`.trim();

const sync = (b: string) =>
  attempt(() =>
    rebaseBranch({
      sourceBranch: 'main',
      targetBranch: b,
      message: `sync main into ${b}`,
    }),
  );
const land = (b: string) =>
  attempt(() =>
    rebaseBranch({
      sourceBranch: b,
      targetBranch: 'main',
      message: `merge ${b}`,
    }),
  );
async function mergeWithSync(
  b: string,
): Promise<{ ok: boolean; stage: string; kind?: string; body?: string }> {
  const s = await sync(b);
  if (!s.ok) return { ok: false, stage: 'sync', kind: s.kind, body: s.body };
  const l = await land(b);
  return { ok: l.ok, stage: 'land', kind: l.kind, body: l.body };
}

async function newBranch(c: any, name: string): Promise<string> {
  c.checkout('main');
  await c.branch(name, 'main');
  return name;
}
async function insertOn(c: any, branch: string, docs: any[]): Promise<string[]> {
  c.checkout(branch);
  return c.addDocument(docs);
}
async function getOn(c: any, branch: string, id: string): Promise<any | null> {
  c.checkout(branch);
  const r = await attempt(() => c.getDocument({ id }));
  return r.ok ? r.value : null;
}
async function updateOn(c: any, branch: string, id: string, patch: any) {
  c.checkout(branch);
  const d = await c.getDocument({ id });
  await c.updateDocument({ ...d, ...patch });
}
async function deleteOn(c: any, branch: string, id: string) {
  c.checkout(branch);
  await c.deleteDocument({ id });
}
async function listDocs(c: any, branch: string, type: string): Promise<any[]> {
  c.checkout(branch);
  const r = await attempt(() => c.getDocument({ type, as_list: true, count: 100000 }));
  return r.ok && Array.isArray(r.value) ? r.value : [];
}

const nodeDoc = (subject: string, extra: any = {}) => ({
  '@type': 'Node',
  subject,
  category: 'Invention',
  ...extra,
});
const edgeDoc = (s: string, t: string, extra: any = {}) => ({
  '@type': 'Edge',
  source_node: s,
  target_node: t,
  statement: 'baseline',
  relationship_kind: 'Unspecified',
  status: 'Ungrounded',
  ...extra,
});

async function seedPair(c: any, tag: string, withEdge = true, edgeExtra: any = {}) {
  const [s, t] = await insertOn(c, 'main', [
    nodeDoc(`${tag} source`),
    nodeDoc(`${tag} target`),
  ]);
  let e = '';
  if (withEdge) {
    [e] = await insertOn(c, 'main', [
      edgeDoc(s, t, { statement: `${tag} baseline`, ...edgeExtra }),
    ]);
  }
  return { s, t, e };
}

/** Two branches edit the same doc; A lands first; B is merged (with or without sync). */
async function twoBranchEdit(
  c: any,
  id: string,
  patchA: any,
  patchB: any,
  syncB: boolean,
) {
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await updateOn(c, a, id, patchA);
  await updateOn(c, b, id, patchB);
  const ra = await land(a);
  const rb = syncB ? await mergeWithSync(b) : { ...(await land(b)), stage: 'land' };
  const mainDoc = await getOn(c, 'main', id);
  const bDoc = await getOn(c, b, id);
  return { a, b, ra, rb, mainDoc, bDoc };
}

// --------------------------------------------------- mini validation gate

const refId = (x: any): string => (typeof x === 'string' ? x : x?.['@id']);

function analyze(edges: any[]) {
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  let selfLoops = 0;
  for (const e of edges) {
    const s = refId(e.source_node);
    const t = refId(e.target_node);
    if (s === t) selfLoops++;
    if (!adj.has(s)) adj.set(s, []);
    adj.get(s)!.push(t);
    indeg.set(t, (indeg.get(t) ?? 0) + 1);
    if (!indeg.has(s)) indeg.set(s, 0);
  }
  // Kahn's algorithm: anything left over is on or downstream of a cycle.
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([n]) => n);
  let seen = 0;
  const deg = new Map(indeg);
  while (queue.length) {
    const n = queue.pop()!;
    seen++;
    for (const m of adj.get(n) ?? []) {
      deg.set(m, deg.get(m)! - 1);
      if (deg.get(m) === 0) queue.push(m);
    }
  }
  return { hasCycle: seen < indeg.size, selfLoops };
}

function blastRadii(edges: any[]): Map<string, number> {
  const adj = new Map<string, string[]>();
  const nodes = new Set<string>();
  for (const e of edges) {
    const s = refId(e.source_node);
    const t = refId(e.target_node);
    nodes.add(s);
    nodes.add(t);
    if (!adj.has(s)) adj.set(s, []);
    adj.get(s)!.push(t);
  }
  const out = new Map<string, number>();
  for (const n of nodes) {
    const seen = new Set<string>();
    const stack = [...(adj.get(n) ?? [])];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...(adj.get(x) ?? []));
    }
    seen.delete(n);
    out.set(n, seen.size);
  }
  return out;
}

const paragraphs = (n: number, marker = '') =>
  Array.from({ length: n }, (_, i) => `Paragraph ${i + 1}${marker && i === 0 ? ' ' + marker : ''}. ` + 'Lorem ipsum dolor sit amet. '.repeat(5)).join('\n\n');

// ---------------------------------------------------------------- scenarios

interface Scenario {
  id: string;
  name: string;
  slow?: boolean;
  fn: (c: any, tag: string) => Promise<void>;
}
const scenarios: Scenario[] = [];
const add = (id: string, name: string, fn: Scenario['fn'], slow = false) =>
  scenarios.push({ id, name, fn, slow });

// ===== M: merge mechanics =====

add('M0', 'sanity: new branch inherits main documents', async (c, tag) => {
  const [id] = await insertOn(c, 'main', [nodeDoc(`${tag} seed`)]);
  const b = await newBranch(c, uid('m0'));
  const seen = await getOn(c, b, id);
  expectThat('new branch sees documents that existed on main at branch time', !!seen,
    seen ? '' : 'branch() may be creating EMPTY branches: every later result is suspect');
});

add('M1', 'unrelated inserts merge cleanly (with sync)', async (c, tag) => {
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  const [na] = await insertOn(c, a, [nodeDoc(`${tag} A`)]);
  const [nb] = await insertOn(c, b, [nodeDoc(`${tag} B`)]);
  const ra = await land(a);
  const rb = await mergeWithSync(b);
  expectThat('A lands', ra.ok, desc(ra));
  expectThat('B syncs then lands', rb.ok, `${rb.stage} ${desc(rb)}`);
  expectThat('both nodes present on main', !!(await getOn(c, 'main', na)) && !!(await getOn(c, 'main', nb)));
});

add('M2', 'unrelated inserts WITHOUT sync (does the 500 reproduce?)', async (c, tag) => {
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await insertOn(c, a, [nodeDoc(`${tag} A`)]);
  const [nb] = await insertOn(c, b, [nodeDoc(`${tag} B`)]);
  await land(a);
  const rb = await land(b);
  observe('direct land of B after main moved', desc(rb));
  expectThat('summary theory: direct rebase after main moved gives HTTP 500', rb.kind === 'HTTP_500',
    rb.ok ? 'it SUCCEEDED, so the ordering theory is wrong or version-dependent' : `got ${rb.kind}`);
  if (!rb.ok) {
    expectThat('failed merge left main untouched', !(await getOn(c, 'main', nb)));
    const rec = await mergeWithSync(b);
    expectThat('recovery via sync then land works', rec.ok, `${rec.stage} ${desc(rec)}`);
  }
});

add('M3', 'no-op sync and fast-forward when main has not moved', async (c, tag) => {
  const a = await newBranch(c, uid('a'));
  await insertOn(c, a, [nodeDoc(`${tag} A`)]);
  const s = await sync(a);
  observe('sync when main has not moved', desc(s));
  const l = await land(a);
  expectThat('land after no-op sync', l.ok, desc(l));
  const b = await newBranch(c, uid('b'));
  await insertOn(c, b, [nodeDoc(`${tag} B`)]);
  const l2 = await land(b);
  expectThat('land without any sync when main has not moved since branching', l2.ok, desc(l2));
});

add('M4', 'multi-commit branch lands intact', async (c, tag) => {
  const a = await newBranch(c, uid('a'));
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) ids.push((await insertOn(c, a, [nodeDoc(`${tag} commit${i}`)]))[0]);
  const l = await land(a);
  expectThat('multi-commit branch lands', l.ok, desc(l));
  const present = await Promise.all(ids.map((id) => getOn(c, 'main', id)));
  expectThat('all three documents on main', present.every(Boolean));
});

add('M5', 'empty branch (no new commits) lands', async (c) => {
  const a = await newBranch(c, uid('empty'));
  const l = await land(a);
  observe('landing a branch with no commits', desc(l));
});

add('M6', 'landing the same branch twice', async (c, tag) => {
  const a = await newBranch(c, uid('a'));
  await insertOn(c, a, [nodeDoc(`${tag} A`)]);
  const first = await land(a);
  const second = await land(a);
  observe('second land of an already-merged branch', desc(second));
  expectThat('first land ok', first.ok, desc(first));
  const before = (await listDocs(c, 'main', 'Node')).filter((n) => String(n.subject).startsWith(tag)).length;
  expectThat('node not duplicated on main by second land', before === 1, `${before} matching nodes`);
});

add('M7', 'error shape for nonexistent branches', async () => {
  const bad1 = await land(uid('does-not-exist'));
  const bad2 = await attempt(() =>
    rebaseBranch({ sourceBranch: 'main', targetBranch: uid('nope'), message: 'x' }),
  );
  observe('nonexistent source branch', desc(bad1));
  observe('nonexistent target branch', desc(bad2));
  expectThat('missing source is a 4xx, not a 5xx', !!bad1.kind && !/^HTTP_5/.test(bad1.kind));
  expectThat('missing target is a 4xx, not a 5xx', !!bad2.kind && !/^HTTP_5/.test(bad2.kind));
});

add('M8', 'race: main moves between sync and land; then retry', async (c, tag) => {
  const b = await newBranch(c, uid('b'));
  const cc = await newBranch(c, uid('c'));
  const [nb] = await insertOn(c, b, [nodeDoc(`${tag} B`)]);
  await insertOn(c, cc, [nodeDoc(`${tag} C`)]);
  const s1 = await sync(b);
  observe('initial sync of B', desc(s1));
  const lc = await land(cc);
  expectThat('C lands while B is synced but not landed', lc.ok, desc(lc));
  const lb = await land(b);
  observe('B lands directly after main moved past its sync', desc(lb));
  expectThat('a stale sync is enough (no 5xx after main moved again)', lb.ok, desc(lb));
  if (!lb.ok) {
    const retry = await mergeWithSync(b);
    expectThat('retry with fresh sync succeeds (a retry loop is viable)', retry.ok, `${retry.stage} ${desc(retry)}`);
  }
  expectThat('B eventually on main', !!(await getOn(c, 'main', nb)));
});

add('M9', 'parallel lands of 5 branches (lost-write check)', async (c, tag) => {
  const N = 5;
  const branches: string[] = [];
  const subjects: string[] = [];
  for (let i = 0; i < N; i++) {
    const b = await newBranch(c, uid(`p${i}`));
    branches.push(b);
    subjects.push(`${tag} par${i}`);
    await insertOn(c, b, [nodeDoc(subjects[i])]);
  }
  const results = await Promise.all(branches.map((b) => land(b)));
  observe('parallel land outcomes', results.map((r) => (r.ok ? 'ok' : r.kind)).join(', '));
  const onMain = (await listDocs(c, 'main', 'Node')).filter((n) => String(n.subject).startsWith(`${tag} par`));
  const okCount = results.filter((r) => r.ok).length;
  expectThat('no lost writes: every reported success is actually on main', onMain.length >= okCount,
    `${okCount} reported ok, ${onMain.length} on main`);
  expectThat('no phantom writes: nothing on main that was reported failed', onMain.length <= okCount,
    `${okCount} reported ok, ${onMain.length} on main`);
  for (let i = 0; i < N; i++) {
    if (!results[i].ok) await mergeWithSync(branches[i]);
  }
  const after = (await listDocs(c, 'main', 'Node')).filter((n) => String(n.subject).startsWith(`${tag} par`));
  expectThat('sequential retries land the rest', after.length === N, `${after.length}/${N} on main`);
});

add('M10', 'three branches from one base, sync+land in sequence', async (c, tag) => {
  const bs: string[] = [];
  for (let i = 0; i < 3; i++) {
    const b = await newBranch(c, uid(`s${i}`));
    bs.push(b);
    await insertOn(c, b, [nodeDoc(`${tag} seq${i}`)]);
  }
  const outs = [];
  for (const b of bs) outs.push(await mergeWithSync(b));
  expectThat('all three merge', outs.every((o) => o.ok), outs.map(desc).join(' | '));
});

// ===== C: same-document conflicts =====

add('C1', 'same field (string) conflict, with sync', async (c, tag) => {
  const { e } = await seedPair(c, tag);
  const r = await twoBranchEdit(c, e, { statement: `${tag} from A` }, { statement: `${tag} from B` }, true);
  observe('B merge outcome', `${r.rb.stage}: ${desc(r.rb)}`);
  expectThat('surfaces as cardinality error (summary claim)', r.rb.kind === 'CARDINALITY_CONFLICT', `got ${r.rb.kind}`);
  expectThat('main kept A value (failed merge is atomic)', r.mainDoc?.statement === `${tag} from A`);
  expectThat('B branch still has its own value (not corrupted)', r.bDoc?.statement === `${tag} from B`);
});

add('C2', 'same field conflict, WITHOUT sync', async (c, tag) => {
  const { e } = await seedPair(c, tag);
  const r = await twoBranchEdit(c, e, { statement: `${tag} from A` }, { statement: `${tag} from B` }, false);
  observe('B direct-land outcome', desc(r.rb));
  observe('error kind differs from the synced variant?', `no-sync kind = ${r.rb.kind}`);
  expectThat('main kept A value', r.mainDoc?.statement === `${tag} from A`);
});

add('C3', 'same enum field conflict (relationship_kind)', async (c, tag) => {
  const { e } = await seedPair(c, tag);
  const r = await twoBranchEdit(c, e, { relationship_kind: 'MaterialNecessity' }, { relationship_kind: 'ConceptualEnablement' }, true);
  observe('outcome', `${r.rb.stage}: ${desc(r.rb)}`);
  expectThat('enum conflict also surfaces as cardinality error', r.rb.kind === 'CARDINALITY_CONFLICT', `got ${r.rb.kind}`);
});

add('C4', 'same field, same new value (convergent edit)', async (c, tag) => {
  const { e } = await seedPair(c, tag);
  const same = { statement: `${tag} identical` };
  const r = await twoBranchEdit(c, e, same, same, true);
  observe('outcome', `${r.rb.stage}: ${desc(r.rb)}`);
  expectThat('identical concurrent edits do not conflict', r.rb.ok, desc(r.rb));
});

add('C5', 'different fields of the same document', async (c, tag) => {
  const { e } = await seedPair(c, tag);
  const r = await twoBranchEdit(c, e, { statement: `${tag} A statement` }, { relationship_kind: 'MaterialNecessity' }, true);
  expectThat('field-level merge: no conflict', r.rb.ok, desc(r.rb));
  if (r.rb.ok) {
    expectThat('main has BOTH changes', r.mainDoc?.statement === `${tag} A statement` && r.mainDoc?.relationship_kind === 'MaterialNecessity',
      JSON.stringify(r.mainDoc));
  }
});

add('C6', 'different claims on the same node pair (collision-reduction, real case)', async (c, tag) => {
  const { s, t, e } = await seedPair(c, tag);
  const [e2] = await insertOn(c, 'main', [edgeDoc(s, t, { statement: `${tag} second claim`, basis: 'HistoricalAttestation', origin: 'Region X' })]);
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await updateOn(c, a, e, { statement: `${tag} edited claim 1` });
  await updateOn(c, b, e2, { statement: `${tag} edited claim 2` });
  const ra = await land(a);
  const rb = await mergeWithSync(b);
  expectThat('A lands', ra.ok, desc(ra));
  expectThat('B merges with no conflict', rb.ok, `${rb.stage} ${desc(rb)}`);
});

add('C7', 'edit vs delete of the same document', async (c, tag) => {
  const { e } = await seedPair(c, tag);
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await deleteOn(c, a, e);
  await updateOn(c, b, e, { statement: `${tag} edited` });
  const ra = await land(a);
  const rb = await mergeWithSync(b);
  observe('delete lands', desc(ra));
  observe('edit-after-delete merge', `${rb.stage}: ${desc(rb)}`);
  const final = await getOn(c, 'main', e);
  observe('main afterwards', final ? 'document still exists (edit resurrected it?)' : 'document gone');
});

add('C8', 'delete vs delete of the same document', async (c, tag) => {
  const { e } = await seedPair(c, tag);
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await deleteOn(c, a, e);
  await deleteOn(c, b, e);
  await land(a);
  const rb = await mergeWithSync(b);
  expectThat('double delete merges without error', rb.ok, `${rb.stage} ${desc(rb)}`);
});

add('C9', 'node edited on A, its edge edited on B', async (c, tag) => {
  const { s, e } = await seedPair(c, tag);
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await updateOn(c, a, s, { description: `${tag} new description` });
  await updateOn(c, b, e, { statement: `${tag} new statement` });
  await land(a);
  const rb = await mergeWithSync(b);
  expectThat('node edit and claim edit do not collide', rb.ok, `${rb.stage} ${desc(rb)}`);
});

add('C10', 'conflict resolution path: replay the losing edit on a fresh branch', async (c, tag) => {
  const { e } = await seedPair(c, tag);
  const r = await twoBranchEdit(c, e, { statement: `${tag} A` }, { statement: `${tag} B` }, true);
  expectThat('precondition: B conflicted', !r.rb.ok, desc(r.rb));
  // Application-level resolution: throw away B's branch, replay B's intended edit on a fresh branch.
  const fresh = await newBranch(c, uid('resolved'));
  await updateOn(c, fresh, e, { statement: `${tag} B (replayed)` });
  const rf = await land(fresh);
  expectThat('replayed edit lands cleanly (a viable "resolve conflict" UX)', rf.ok, desc(rf));
  expectThat('main shows the replayed value', (await getOn(c, 'main', e))?.statement === `${tag} B (replayed)`);
  // Can the ORIGINAL conflicted branch be repaired in place?
  await updateOn(c, r.b, e, { statement: `${tag} A` }); // set to main's current-ish value
  const rr = await mergeWithSync(r.b);
  observe('can the conflicted branch be fixed in place by matching main?', `${rr.stage}: ${desc(rr)}`);
});

// ===== P: prose merging (the Database Choice blocker) =====

add('P1', 'prose: different paragraphs of one field', async (c, tag) => {
  const [id] = await insertOn(c, 'main', [nodeDoc(`${tag} prose`, { description: paragraphs(5) })]);
  const base = paragraphs(5);
  const editA = base.replace('Paragraph 1.', 'Paragraph 1 (edited by A).');
  const editB = base.replace('Paragraph 5.', 'Paragraph 5 (edited by B).');
  const r = await twoBranchEdit(c, id, { description: editA }, { description: editB }, true);
  observe('non-overlapping paragraph edits', `${r.rb.stage}: ${desc(r.rb)}`);
  expectThat('text-level auto-merge of non-overlapping paragraphs', r.rb.ok,
    r.rb.ok ? '' : 'string fields are atomic: no line-level merge (bad sign for folding talk pages into TerminusDB)');
});

add('P2', 'prose: same paragraph edited twice', async (c, tag) => {
  const [id] = await insertOn(c, 'main', [nodeDoc(`${tag} prose`, { description: paragraphs(3) })]);
  const base = paragraphs(3);
  const r = await twoBranchEdit(c, id, { description: base.replace('Paragraph 2.', 'Paragraph 2 by A.') }, { description: base.replace('Paragraph 2.', 'Paragraph 2 by B.') }, true);
  observe('overlapping paragraph edits', `${r.rb.stage}: ${desc(r.rb)}`);
  expectThat('overlapping edit is reported as a conflict', !r.rb.ok);
});

add('P3', 'large prose field round trip (200 KB)', async (c, tag) => {
  const big = 'x'.repeat(200_000);
  const t0 = Date.now();
  const [id] = await insertOn(c, 'main', [nodeDoc(`${tag} big`, { description: big })]);
  const back = await getOn(c, 'main', id);
  expectThat('200 KB string round-trips exactly', back?.description === big, `${Date.now() - t0} ms`);
});

// ===== E: emergent invalidity and integrity =====

add('E1', 'two independent edges form a cycle after both merge', async (c, tag) => {
  const { s, t } = await seedPair(c, tag, false);
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await insertOn(c, a, [edgeDoc(s, t, { statement: `${tag} X to Y`, basis: 'LogicalNecessity' })]);
  await insertOn(c, b, [edgeDoc(t, s, { statement: `${tag} Y to X`, basis: 'LogicalNecessity' })]);
  const ra = await land(a);
  const rb = await mergeWithSync(b);
  expectThat('DB itself accepts both (so a post-merge validation gate is required)', ra.ok && rb.ok, `${desc(ra)} | ${rb.stage} ${desc(rb)}`);
  const edges = (await listDocs(c, 'main', 'Edge')).filter((e) => String(e.statement).startsWith(tag));
  const g = analyze(edges);
  expectThat('script-level cycle check detects the cycle', g.hasCycle);
});

add('E2', 'delete node on A while B adds an edge to it', async (c, tag) => {
  const { s, t } = await seedPair(c, tag, false);
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await deleteOn(c, a, t);
  const [eb] = await insertOn(c, b, [edgeDoc(s, t, { statement: `${tag} to be dangling` })]);
  const ra = await land(a);
  const rb = await mergeWithSync(b);
  observe('delete lands', desc(ra));
  observe('edge-to-deleted-node merge', `${rb.stage}: ${desc(rb)}`);
  const edge = await getOn(c, 'main', eb);
  const node = await getOn(c, 'main', t);
  expectThat('main never ends up with an edge pointing at a missing node', !(edge && !node),
    edge && !node ? 'DANGLING EDGE on main: dangling-edge check is essential' : 'DB enforced referential integrity');
});

add('E3', 'direct delete of a node that still has a dependent edge', async (c, tag) => {
  const { t } = await seedPair(c, tag);
  const r = await attempt(() => deleteOn(c, 'main', t));
  expectThat('DB refuses to delete a node with dependents (matches Governance rule)', !r.ok,
    r.ok ? 'deleted anyway: the rule must be enforced by application code' : r.kind);
});

add('E4', 'two logical-necessity edges for one pair from different branches', async (c, tag) => {
  const { s, t } = await seedPair(c, tag, false);
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await insertOn(c, a, [edgeDoc(s, t, { statement: `${tag} LN A`, basis: 'LogicalNecessity' })]);
  await insertOn(c, b, [edgeDoc(s, t, { statement: `${tag} LN B`, basis: 'LogicalNecessity' })]);
  await land(a);
  const rb = await mergeWithSync(b);
  const n = (await listDocs(c, 'main', 'Edge')).filter((e) => String(e.statement).startsWith(`${tag} LN`)).length;
  expectThat('DB does not enforce one-LN-edge-per-pair (validation gate must)', rb.ok && n === 2, `merge ${desc(rb)}, ${n} LN edges on main`);
});

add('E5', 'duplicate identical claims', async (c, tag) => {
  const { s, t } = await seedPair(c, tag, false);
  const r = await insertOn(c, 'main', [
    edgeDoc(s, t, { statement: `${tag} dup` }),
    edgeDoc(s, t, { statement: `${tag} dup` }),
  ]);
  expectThat('random keys allow exact duplicates (gate/uniqueness needed)', new Set(r).size === 2, r.join(', '));
});

add('E6', 'self-loop edge', async (c, tag) => {
  const { s } = await seedPair(c, tag, false);
  const r = await attempt(() => insertOn(c, 'main', [edgeDoc(s, s, { statement: `${tag} self` })]));
  expectThat('DB accepts a self-loop (gate must reject)', r.ok, r.ok ? '' : desc(r));
  const edges = (await listDocs(c, 'main', 'Edge')).filter((e) => String(e.statement).startsWith(`${tag} self`));
  if (edges.length) expectThat('script check finds the self-loop', analyze(edges).selfLoops === 1);
});

// ===== S: schema enforcement =====

add('S1', 'edge missing required field (statement)', async (c) => {
  const [s, t] = await insertOn(c, 'main', [nodeDoc('S1 a'), nodeDoc('S1 b')]);
  const r = await attempt(() => insertOn(c, 'main', [{ '@type': 'Edge', source_node: s, target_node: t, relationship_kind: 'Unspecified', status: 'Ungrounded' }]));
  expectThat('rejected', !r.ok, r.ok ? 'accepted!' : `${r.kind}`);
});

add('S2', 'invalid enum value', async (c) => {
  const [s, t] = await insertOn(c, 'main', [nodeDoc('S2 a'), nodeDoc('S2 b')]);
  const r = await attempt(() => insertOn(c, 'main', [edgeDoc(s, t, { relationship_kind: 'Bogus' })]));
  expectThat('rejected', !r.ok, r.ok ? 'accepted!' : `${r.kind}`);
});

add('S3', 'edge referencing a nonexistent node', async (c) => {
  const [s] = await insertOn(c, 'main', [nodeDoc('S3 a')]);
  const r = await attempt(() => insertOn(c, 'main', [edgeDoc(s, 'Node/does-not-exist-xyz')]));
  expectThat('rejected', !r.ok, r.ok ? 'accepted (dangling on insert!)' : `${r.kind}`);
});

add('S4', 'bare edge: optional fields absent', async (c) => {
  const [s, t] = await insertOn(c, 'main', [nodeDoc('S4 a'), nodeDoc('S4 b')]);
  const [e] = await insertOn(c, 'main', [edgeDoc(s, t)]);
  const back = await getOn(c, 'main', e);
  expectThat('round-trips without basis/origin', !!back && back.basis === undefined && back.origin === undefined, JSON.stringify(back));
});

add('S5', 'unicode, newlines, quotes in text', async (c, tag) => {
  const txt = `${tag} é–漢字 🔥 "quoted" 'single' \\ backslash\nline2\n\tTabbed <b>html</b> {"json": true}`;
  const [id] = await insertOn(c, 'main', [nodeDoc(txt, { description: txt })]);
  const back = await getOn(c, 'main', id);
  expectThat('text round-trips exactly', back?.subject === txt && back?.description === txt);
});

add('S6', 'unknown property on a document', async (c, tag) => {
  const r = await attempt(() => insertOn(c, 'main', [nodeDoc(`${tag} extra`, { not_in_schema: 'x' })]));
  expectThat('rejected', !r.ok, r.ok ? 'accepted: schema is open to extra fields' : `${r.kind}`);
});

add('S7', 'invalid stage enum', async (c, tag) => {
  const r = await attempt(() => insertOn(c, 'main', [nodeDoc(`${tag} stage`, { stage: 'Bogus' })]));
  expectThat('rejected', !r.ok, r.ok ? 'accepted!' : `${r.kind}`);
});

// ===== H: history =====

add('H1', 'are commit IDs stable across a rebase-merge?', async (c, tag) => {
  const a = await newBranch(c, uid('a'));
  await insertOn(c, a, [nodeDoc(`${tag} h1a`)]);
  await insertOn(c, a, [nodeDoc(`${tag} h1b`)]);
  const before = await commitIds(a);
  const b = await newBranch(c, uid('b'));
  await insertOn(c, b, [nodeDoc(`${tag} h1c`)]);
  await land(b); // main moves so A's merge is a true replay
  await mergeWithSync(a);
  const mainLog = await commitIds('main');
  if (!before || !mainLog) {
    observe('commit log endpoint unavailable or unexpected shape', 'adjust commitIds() path; needed to decide how reviews bind to versions');
    return;
  }
  const kept = before.filter((id) => mainLog.includes(id)).length;
  observe('branch commit IDs that survive on main', `${kept}/${before.length}`);
  expectThat('commit IDs are stable (reviews could bind to them)', kept === before.length,
    'if false: bind reviews to a content hash of the claim, not a commit ID');
});

add('H2', 'app-level revert of a bad edit that others built on', async (c, tag) => {
  const { e } = await seedPair(c, tag);
  const a = await newBranch(c, uid('bad'));
  await updateOn(c, a, e, { statement: `${tag} VANDALISM` });
  await land(a);
  const b = await newBranch(c, uid('good'));
  await updateOn(c, b, e, { relationship_kind: 'MaterialNecessity' });
  const rb = await land(b);
  expectThat('good-faith edit on a different field lands on top of the bad one', rb.ok, desc(rb));
  const fix = await newBranch(c, uid('revert'));
  await updateOn(c, fix, e, { statement: `${tag} baseline` });
  const rf = await land(fix);
  expectThat('field-level revert lands', rf.ok, desc(rf));
  const d = await getOn(c, 'main', e);
  expectThat('revert restored statement without losing the later good edit',
    d?.statement === `${tag} baseline` && d?.relationship_kind === 'MaterialNecessity', JSON.stringify(d));
});

// ===== X: scale =====

add('X1', 'bulk insert 300 nodes / ~600 edges, read back, cycle check, blast radius', async (c, tag) => {
  const N = 300;
  let t0 = Date.now();
  const ids = await insertOn(c, 'main', Array.from({ length: N }, (_, i) => nodeDoc(`${tag}-n${i}`)));
  const tNodes = Date.now() - t0;
  const edges: any[] = [];
  for (let i = 1; i < N; i++) {
    edges.push(edgeDoc(ids[i - 1], ids[i], { statement: `${tag}-e${i}-a` }));
    const j = Math.floor(Math.random() * (i - 1));
    if (j !== i - 1) edges.push(edgeDoc(ids[j], ids[i], { statement: `${tag}-e${i}-b` }));
  }
  t0 = Date.now();
  await insertOn(c, 'main', edges);
  const tEdges = Date.now() - t0;
  t0 = Date.now();
  const read = (await listDocs(c, 'main', 'Edge')).filter((e) => String(e.statement).startsWith(tag));
  const tRead = Date.now() - t0;
  observe('timings (ms)', `insert nodes ${tNodes}, insert ${edges.length} edges ${tEdges}, read edges ${tRead}`);
  expectThat('all edges read back', read.length === edges.length, `${read.length}/${edges.length}`);
  t0 = Date.now();
  const g = analyze(read);
  const radii = blastRadii(read);
  const tCalc = Date.now() - t0;
  expectThat('generated DAG has no cycle', !g.hasCycle);
  expectThat('root blast radius = N-1', radii.get(ids[0]) === N - 1, `${radii.get(ids[0])}`);
  observe('client-side cycle check + all blast radii (ms)', `${tCalc}`);
}, true);

add('X2', '15 branches merged sequentially with sync (does sync cost grow?)', async (c, tag) => {
  const bs: string[] = [];
  for (let i = 0; i < 15; i++) {
    const b = await newBranch(c, uid(`x${i}`));
    bs.push(b);
    await insertOn(c, b, [nodeDoc(`${tag} many${i}`)]);
  }
  const times: number[] = [];
  let fails = 0;
  for (const b of bs) {
    const t0 = Date.now();
    const r = await mergeWithSync(b);
    times.push(Date.now() - t0);
    if (!r.ok) fails++;
  }
  observe('per-merge ms', times.join(', '));
  expectThat('all 15 merged', fails === 0, `${fails} failed`);
}, true);

add('X3', 'large branch (200 docs) merges after main has moved', async (c, tag) => {
  const big = await newBranch(c, uid('big'));
  const small = await newBranch(c, uid('small'));
  await insertOn(c, big, Array.from({ length: 200 }, (_, i) => nodeDoc(`${tag}-big${i}`)));
  await insertOn(c, small, [nodeDoc(`${tag} small`)]);
  await land(small);
  const t0 = Date.now();
  const r = await mergeWithSync(big);
  expectThat('large branch merges', r.ok, `${r.stage} ${desc(r)} in ${Date.now() - t0} ms`);
}, true);

// ---------------------------------------------------------------- runner

async function main() {
  const args = process.argv.slice(2);
  const only = (args.find((a) => a.startsWith('--only=')) ?? '').replace('--only=', '').split(',').filter(Boolean);
  const skipSlow = args.includes('--skip-slow');

  const c = createClient();
  c.db(config.db);

  const selected = scenarios.filter(
    (s) => (only.length === 0 || only.some((p) => s.id.startsWith(p))) && !(skipSlow && s.slow),
  );
  console.log(`Running ${selected.length} scenarios (run ${RUN_ID})`);

  const timings: Record<string, number> = {};
  for (const s of selected) {
    currentScenario = s.id;
    console.log(`\n=== ${s.id}: ${s.name} ===`);
    const t0 = Date.now();
    try {
      await s.fn(c, `${s.id}-${RUN_ID}`);
    } catch (err: any) {
      record('ERROR', 'scenario crashed', shorten(err) + ' ' + String(err?.stack ?? '').split('\n').slice(0, 3).join(' | '));
    }
    timings[s.id] = Date.now() - t0;
  }

  const count = (v: Verdict) => findings.filter((f) => f.verdict === v).length;
  console.log(`\n=== SUMMARY: ${count('PASS')} pass, ${count('FAIL')} fail (hypothesis not confirmed), ${count('OBSERVED')} observed, ${count('ERROR')} error ===`);
  for (const f of findings.filter((f) => f.verdict === 'FAIL' || f.verdict === 'ERROR')) {
    console.log(`  [${f.verdict}] ${f.scenario}: ${f.label}${f.detail ? ` — ${f.detail}` : ''}`);
  }

  const dir = path.resolve(process.cwd(), 'test-results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `concurrent-suite-${RUN_ID}.json`), JSON.stringify({ runId: RUN_ID, timings, findings }, null, 2));
  const names = new Map(scenarios.map((s) => [s.id, s.name]));
  const md = [
    `# Concurrent suite run ${RUN_ID}`,
    '',
    `${count('PASS')} pass, ${count('FAIL')} fail, ${count('OBSERVED')} observed, ${count('ERROR')} error. Server: ${config.endpoint}`,
    '',
    '| Scenario | Verdict | Check | Detail |',
    '| --- | --- | --- | --- |',
    ...findings.map((f) => `| ${f.scenario} ${names.get(f.scenario) ?? ''} | ${f.verdict} | ${f.label.replace(/\|/g, '/')} | ${f.detail.replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 300)} |`),
  ].join('\n');
  fs.writeFileSync(path.join(dir, `concurrent-suite-${RUN_ID}.md`), md);
  console.log(`\nReport written to test-results/concurrent-suite-${RUN_ID}.md`);

  process.exit(count('ERROR') > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('concurrent-suite failed:');
  console.error(err);
  process.exit(1);
});
