import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { createClient } from '../db/client';
import { rebaseBranch } from '../db/rebase';
import { getCommitLog } from '../db/log';

/**
 * Broad test suite for TerminusDB's branch-and-merge behavior.
 *
 * Verdicts:
 *   PASS      - a hypothesis we hold was confirmed.
 *   FAIL      - that hypothesis was NOT confirmed ("our assumption is
 *               wrong or the DB behaves differently", not necessarily a bug).
 *   OBSERVED  - purely informational; we recorded what happened.
 *   ERROR     - the scenario itself crashed. Only these set a non-zero exit.
 *
 * Usage (npm script: "concurrent-suite": "ts-node src/scripts/concurrent-suite.ts"):
 *   npm run concurrent-suite
 *   npm run concurrent-suite -- --only=C,P          (scenario id prefixes)
 *   npm run concurrent-suite -- --skip-slow         (skips the X* scale tests)
 *   npm run concurrent-suite -- --repeat=20         (repeat selected scenarios)
 *   npm run concurrent-suite -- --no-sync           (never sync main into a
 *                                                    branch before landing it)
 *
 * Failure-rate workflow for the intermittent HTTP 500s: run the same
 * scenarios with and without --no-sync, e.g.
 *   --only=C4,C6,C8,E4,M9,P2 --repeat=20
 *   --only=C4,C6,C8,E4,M9,P2 --repeat=20 --no-sync
 * and compare the "Rebase calls" table in the two reports. Also capture the
 * server log for the same window (in the VM: docker logs --since <time>
 * <container>); the JSON output has per-scenario start and end timestamps
 * so the two can be lined up.
 *
 * Every branch/doc name carries a run ID and repeat index, so re-running is
 * safe. Output: test-results/concurrent-suite-<runid>.{json,md}. With
 * --repeat > 1 the .md holds aggregate tables only (the full detail is in
 * the .json), so it stays small enough to paste back into chat.
 *
 * Scenarios K* and L* add scratch classes to throwaway branches, never to
 * main. Nothing they create is merged.
 */

const RUN_ID = Date.now();
let seq = 0;
const uid = (p: string) => `${p}-${RUN_ID}-${++seq}`;

const args = process.argv.slice(2);
const argVal = (name: string): string | undefined => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
};
const REPEAT = Math.max(1, parseInt(argVal('repeat') ?? '1', 10) || 1);
const USE_SYNC = !args.includes('--no-sync');

// ---------------------------------------------------------------- findings

type Verdict = 'PASS' | 'FAIL' | 'OBSERVED' | 'ERROR';
interface Finding {
  scenario: string;
  run: number;
  label: string;
  verdict: Verdict;
  detail: string;
}
interface ErrorLogEntry {
  scenario: string;
  run: number;
  kind: string;
  theirCommit?: string;
  body: string;
}
const findings: Finding[] = [];
const errorLog: ErrorLogEntry[] = [];
let currentScenario = '';
let currentRun = 1;

function record(verdict: Verdict, label: string, detail = '') {
  findings.push({ scenario: currentScenario, run: currentRun, label, verdict, detail });
  console.log(`  [${verdict}] ${label}${detail ? ` - ${detail}` : ''}`);
}
const expectThat = (label: string, cond: boolean, detail = '') =>
  record(cond ? 'PASS' : 'FAIL', label, detail);
const observe = (label: string, detail = '') => record('OBSERVED', label, detail);

// Rebase call statistics, split by stage, for the failure-rate comparison.
const rebaseStats = {
  sync: { calls: 0, fivexx: 0, other: 0 },
  land: { calls: 0, fivexx: 0, other: 0 },
};

// ---------------------------------------------------------------- helpers

function shorten(err: any, limit = 400): string {
  let s: string;
  try {
    s = JSON.stringify(err?.response ?? err?.data ?? err?.message ?? String(err));
  } catch {
    s = String(err);
  }
  return (s ?? '').slice(0, limit);
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
/**
 * Runs fn, converting a thrown error into a result. Every failure is also
 * written to errorLog with its full body (and the rebase's api:their_commit
 * when present). `quiet` skips the log, for probes where failure is expected
 * (reading a document that may not exist).
 */
async function attempt<T>(fn: () => Promise<T>, quiet = false): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err: any) {
    const kind = classify(err);
    if (!quiet) {
      const full = shorten(err, 6000);
      const m = /"api:their_commit":"([^"]+)"/.exec(full);
      errorLog.push({
        scenario: currentScenario,
        run: currentRun,
        kind,
        theirCommit: m ? m[1] : undefined,
        body: full,
      });
    }
    return { ok: false, kind, body: shorten(err) };
  }
}
const desc = (a: { ok: boolean; kind?: string; body?: string }) =>
  a.ok ? 'ok' : `${a.kind} ${a.body ?? ''}`.trim();

function countRebase(stage: 'sync' | 'land', a: Attempt<any>) {
  const s = rebaseStats[stage];
  s.calls++;
  if (!a.ok) {
    if (/^HTTP_5/.test(a.kind ?? '')) s.fivexx++;
    else s.other++;
  }
}

/** Sync `base` (default main) into branch b: rebases base's commits onto b. */
const sync = async (b: string, base = 'main') => {
  const r = await attempt(() =>
    rebaseBranch({ sourceBranch: base, targetBranch: b, message: `sync ${base} into ${b}` }),
  );
  countRebase('sync', r);
  return r;
};
/** Land branch b on `target` (default main). */
const land = async (b: string, target = 'main') => {
  const r = await attempt(() =>
    rebaseBranch({ sourceBranch: b, targetBranch: target, message: `merge ${b}` }),
  );
  countRebase('land', r);
  return r;
};
interface MergeOutcome {
  ok: boolean;
  stage: string;
  kind?: string;
  body?: string;
  value?: any;
}
/** Sync (unless --no-sync) then land. */
async function mergeWithSync(b: string, target = 'main'): Promise<MergeOutcome> {
  if (USE_SYNC) {
    const s = await sync(b, target);
    if (!s.ok) return { ok: false, stage: 'sync', kind: s.kind, body: s.body };
  }
  const l = await land(b, target);
  return { ok: l.ok, stage: 'land', kind: l.kind, body: l.body, value: l.value };
}

/** New branch off `base`. branch() always forks from the client's current checkout. */
async function newBranch(c: any, name: string, base = 'main'): Promise<string> {
  c.checkout(base);
  await c.branch(name);
  return name;
}
async function insertOn(c: any, branch: string, docs: any[]): Promise<string[]> {
  c.checkout(branch);
  return c.addDocument(docs);
}
async function addSchemaOn(c: any, branch: string, docs: any[]) {
  c.checkout(branch);
  return c.addDocument(docs, { graph_type: 'schema' });
}
async function getOn(c: any, branch: string, id: string): Promise<any | null> {
  c.checkout(branch);
  const r = await attempt(() => c.getDocument({ id }), true);
  if (!r.ok) return null;
  // The client can hand back a 404 (or other error) body as a plain string or an
  // api:error object instead of throwing, which made C7 read "gone" as "present".
  const v: any = r.value;
  if (typeof v === 'string' && /^Status: \d{3}/.test(v)) return null;
  if (v && typeof v === 'object' && (v['api:error'] || /Error/.test(String(v['@type'] ?? '')))) return null;
  return v;
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
  const r = await attempt(
    () => c.getDocument({ type, as_list: true, count: 100000 }),
    true,
  );
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
  const [s, t] = await insertOn(c, 'main', [nodeDoc(`${tag} source`), nodeDoc(`${tag} target`)]);
  let e = '';
  if (withEdge) {
    [e] = await insertOn(c, 'main', [edgeDoc(s, t, { statement: `${tag} baseline`, ...edgeExtra })]);
  }
  return { s, t, e };
}

/** Two branches edit the same doc; A lands first; B is merged (with or without sync). */
async function twoBranchEdit(c: any, id: string, patchA: any, patchB: any, syncB: boolean) {
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await updateOn(c, a, id, patchA);
  await updateOn(c, b, id, patchB);
  const ra = await land(a);
  const rb: MergeOutcome = syncB
    ? await mergeWithSync(b)
    : { ...(await land(b)), stage: 'land' };
  const mainDoc = await getOn(c, 'main', id);
  const bDoc = await getOn(c, b, id);
  return { a, b, ra, rb, mainDoc, bDoc };
}

/** All commit identifiers on a branch (count is set high so the log is not paginated). */
async function logIds(branch: string): Promise<string[] | null> {
  const log = await getCommitLog(branch, { count: 100000 });
  if (!log) return null;
  return log.map((x) => x.identifier ?? x['@id'] ?? JSON.stringify(x));
}

// --------------------------------------------------- mini validation gate

/** Inserted IDs come back as full IRIs while reads return short IDs; compare short. */
const shortId = (x: string): string => x.replace(/^terminusdb:\/\/\/data\//, '');
const refId = (x: any): string => shortId(typeof x === 'string' ? x : x?.['@id']);

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
  Array.from(
    { length: n },
    (_, i) =>
      `Paragraph ${i + 1}${marker && i === 0 ? ' ' + marker : ''}. ` +
      'Lorem ipsum dolor sit amet. '.repeat(5),
  ).join('\n\n');

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
  expectThat(
    'new branch sees documents that existed on main at branch time',
    !!seen,
    seen ? '' : 'branch() may be creating EMPTY branches: every later result is suspect',
  );
});

add('M1', 'unrelated inserts merge cleanly (with sync)', async (c, tag) => {
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  const [na] = await insertOn(c, a, [nodeDoc(`${tag} A`)]);
  const [nb] = await insertOn(c, b, [nodeDoc(`${tag} B`)]);
  const ra = await land(a);
  const rb = await mergeWithSync(b);
  expectThat('A lands', ra.ok, desc(ra));
  expectThat('B merges', rb.ok, `${rb.stage} ${desc(rb)}`);
  expectThat(
    'both nodes present on main',
    !!(await getOn(c, 'main', na)) && !!(await getOn(c, 'main', nb)),
  );
});

add('M2', 'unrelated inserts WITHOUT sync (does the 500 reproduce?)', async (c, tag) => {
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await insertOn(c, a, [nodeDoc(`${tag} A`)]);
  const [nb] = await insertOn(c, b, [nodeDoc(`${tag} B`)]);
  await land(a);
  const rb = await land(b);
  observe('direct land of B after main moved', desc(rb));
  expectThat(
    'summary theory: direct rebase after main moved gives HTTP 500',
    rb.kind === 'HTTP_500',
    rb.ok ? 'it SUCCEEDED, so the ordering theory is wrong or version-dependent' : `got ${rb.kind}`,
  );
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
  const before = (await listDocs(c, 'main', 'Node')).filter((n) =>
    String(n.subject).startsWith(tag),
  ).length;
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
    expectThat(
      'retry with fresh sync succeeds (a retry loop is viable)',
      retry.ok,
      `${retry.stage} ${desc(retry)}`,
    );
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
  const onMain = (await listDocs(c, 'main', 'Node')).filter((n) =>
    String(n.subject).startsWith(`${tag} par`),
  );
  const okCount = results.filter((r) => r.ok).length;
  expectThat(
    'no lost writes: every reported success is actually on main',
    onMain.length >= okCount,
    `${okCount} reported ok, ${onMain.length} on main`,
  );
  expectThat(
    'no phantom writes: nothing on main that was reported failed',
    onMain.length <= okCount,
    `${okCount} reported ok, ${onMain.length} on main`,
  );
  for (let i = 0; i < N; i++) {
    if (!results[i].ok) await mergeWithSync(branches[i]);
  }
  const after = (await listDocs(c, 'main', 'Node')).filter((n) =>
    String(n.subject).startsWith(`${tag} par`),
  );
  expectThat('sequential retries land the rest', after.length === N, `${after.length}/${N} on main`);
});

add('M10', 'three branches from one base, sync+land in sequence', async (c, tag) => {
  const bs: string[] = [];
  for (let i = 0; i < 3; i++) {
    const b = await newBranch(c, uid(`s${i}`));
    bs.push(b);
    await insertOn(c, b, [nodeDoc(`${tag} seq${i}`)]);
  }
  const outs: MergeOutcome[] = [];
  for (const b of bs) outs.push(await mergeWithSync(b));
  expectThat('all three merge', outs.every((o) => o.ok), outs.map(desc).join(' | '));
});

// ===== C: same-document conflicts =====

add('C1', 'same field (string) conflict, with sync', async (c, tag) => {
  const { e } = await seedPair(c, tag);
  const r = await twoBranchEdit(c, e, { statement: `${tag} from A` }, { statement: `${tag} from B` }, true);
  observe('B merge outcome', `${r.rb.stage}: ${desc(r.rb)}`);
  expectThat(
    'surfaces as cardinality error (summary claim)',
    r.rb.kind === 'CARDINALITY_CONFLICT',
    `got ${r.rb.kind}`,
  );
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
  const r = await twoBranchEdit(
    c,
    e,
    { relationship_kind: 'MaterialNecessity' },
    { relationship_kind: 'ConceptualEnablement' },
    true,
  );
  observe('outcome', `${r.rb.stage}: ${desc(r.rb)}`);
  expectThat(
    'enum conflict also surfaces as cardinality error',
    r.rb.kind === 'CARDINALITY_CONFLICT',
    `got ${r.rb.kind}`,
  );
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
  const r = await twoBranchEdit(
    c,
    e,
    { statement: `${tag} A statement` },
    { relationship_kind: 'MaterialNecessity' },
    true,
  );
  expectThat('field-level merge: no conflict', r.rb.ok, desc(r.rb));
  if (r.rb.ok) {
    expectThat(
      'main has BOTH changes',
      r.mainDoc?.statement === `${tag} A statement` &&
        r.mainDoc?.relationship_kind === 'MaterialNecessity',
      JSON.stringify(r.mainDoc),
    );
  }
});

add('C6', 'different claims on the same node pair (collision-reduction, real case)', async (c, tag) => {
  const { s, t, e } = await seedPair(c, tag);
  const [e2] = await insertOn(c, 'main', [
    edgeDoc(s, t, { statement: `${tag} second claim`, basis: 'HistoricalAttestation', origin: 'Region X' }),
  ]);
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
  observe('delete lands', desc(ra));
  // Distinguishes a real behavior from a timing flaw: is the document gone
  // from main immediately after the delete landed, before B is merged?
  const goneAfterDelete = !(await getOn(c, 'main', e));
  expectThat('document is gone from main right after the delete landed', ra.ok && goneAfterDelete,
    `delete ok=${ra.ok}, gone=${goneAfterDelete}`);
  const rb = await mergeWithSync(b);
  observe('edit-after-delete merge', `${rb.stage}: ${desc(rb)}`);
  const final = await getOn(c, 'main', e);
  observe(
    'main afterwards',
    final ? `document exists: ${JSON.stringify(final).slice(0, 200)}` : 'document gone',
  );
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
  const fresh = await newBranch(c, uid('resolved'));
  await updateOn(c, fresh, e, { statement: `${tag} B (replayed)` });
  const rf = await land(fresh);
  expectThat('replayed edit lands cleanly (a viable "resolve conflict" UX)', rf.ok, desc(rf));
  expectThat(
    'main shows the replayed value',
    (await getOn(c, 'main', e))?.statement === `${tag} B (replayed)`,
  );
  await updateOn(c, r.b, e, { statement: `${tag} A` });
  const rr = await mergeWithSync(r.b);
  observe('can the conflicted branch be fixed in place by matching main?', `${rr.stage}: ${desc(rr)}`);
});

// ===== P: prose merging =====

add('P1', 'prose: different paragraphs of one field', async (c, tag) => {
  const [id] = await insertOn(c, 'main', [nodeDoc(`${tag} prose`, { description: paragraphs(5) })]);
  const base = paragraphs(5);
  const editA = base.replace('Paragraph 1.', 'Paragraph 1 (edited by A).');
  const editB = base.replace('Paragraph 5.', 'Paragraph 5 (edited by B).');
  const r = await twoBranchEdit(c, id, { description: editA }, { description: editB }, true);
  observe('non-overlapping paragraph edits', `${r.rb.stage}: ${desc(r.rb)}`);
  const finalDesc = String(r.mainDoc?.description ?? '');
  observe(
    'final text on main',
    `hasA=${finalDesc.includes('edited by A')} hasB=${finalDesc.includes('edited by B')}`,
  );
  expectThat(
    'text-level auto-merge of non-overlapping paragraphs',
    r.rb.ok,
    r.rb.ok ? '' : 'string fields are atomic: no line-level merge',
  );
});

add('P2', 'prose: same paragraph edited twice', async (c, tag) => {
  const [id] = await insertOn(c, 'main', [nodeDoc(`${tag} prose`, { description: paragraphs(3) })]);
  const base = paragraphs(3);
  const r = await twoBranchEdit(
    c,
    id,
    { description: base.replace('Paragraph 2.', 'Paragraph 2 by A.') },
    { description: base.replace('Paragraph 2.', 'Paragraph 2 by B.') },
    true,
  );
  observe('overlapping paragraph edits', `${r.rb.stage}: ${desc(r.rb)}`);
  const finalDesc = String(r.mainDoc?.description ?? '');
  const hasA = finalDesc.includes('Paragraph 2 by A.');
  const hasB = finalDesc.includes('Paragraph 2 by B.');
  observe('final paragraph 2 on main', `hasA=${hasA} hasB=${hasB}`);
  expectThat('overlapping edit is reported as a conflict', !r.rb.ok, desc(r.rb));
  expectThat(
    'no silent overwrite: A landed first and its text is still on main',
    hasA && !hasB,
    `hasA=${hasA} hasB=${hasB}`,
  );
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
  expectThat(
    'DB itself accepts both (so a post-merge validation gate is required)',
    ra.ok && rb.ok,
    `${desc(ra)} | ${rb.stage} ${desc(rb)}`,
  );
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
  expectThat(
    'main never ends up with an edge pointing at a missing node',
    !(edge && !node),
    edge && !node ? 'DANGLING EDGE on main: dangling-edge check is essential' : 'DB enforced referential integrity',
  );
});

add('E3', 'direct delete of a node that still has a dependent edge', async (c, tag) => {
  const { t } = await seedPair(c, tag);
  const r = await attempt(() => deleteOn(c, 'main', t));
  expectThat(
    'DB refuses to delete a node with dependents (matches Governance rule)',
    !r.ok,
    r.ok ? 'deleted anyway: the rule must be enforced by application code' : r.kind,
  );
  // The classifier labels this as a cardinality conflict; record the body so
  // it can get its own label once we have seen what it looks like.
  if (!r.ok) observe('blocked-delete error body', r.body ?? '');
});

add('E4', 'two logical-necessity edges for one pair from different branches', async (c, tag) => {
  const { s, t } = await seedPair(c, tag, false);
  const a = await newBranch(c, uid('a'));
  const b = await newBranch(c, uid('b'));
  await insertOn(c, a, [edgeDoc(s, t, { statement: `${tag} LN A`, basis: 'LogicalNecessity' })]);
  await insertOn(c, b, [edgeDoc(s, t, { statement: `${tag} LN B`, basis: 'LogicalNecessity' })]);
  await land(a);
  const rb = await mergeWithSync(b);
  const n = (await listDocs(c, 'main', 'Edge')).filter((e) =>
    String(e.statement).startsWith(`${tag} LN`),
  ).length;
  expectThat(
    'DB does not enforce one-LN-edge-per-pair (validation gate must)',
    rb.ok && n === 2,
    `merge ${desc(rb)}, ${n} LN edges on main`,
  );
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
  const edges = (await listDocs(c, 'main', 'Edge')).filter((e) =>
    String(e.statement).startsWith(`${tag} self`),
  );
  if (edges.length) expectThat('script check finds the self-loop', analyze(edges).selfLoops === 1);
});

// ===== S: schema enforcement =====

add('S1', 'edge missing required field (statement)', async (c) => {
  const [s, t] = await insertOn(c, 'main', [nodeDoc('S1 a'), nodeDoc('S1 b')]);
  const r = await attempt(() =>
    insertOn(c, 'main', [
      { '@type': 'Edge', source_node: s, target_node: t, relationship_kind: 'Unspecified', status: 'Ungrounded' },
    ]),
  );
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
  expectThat(
    'round-trips without basis/origin',
    !!back && back.basis === undefined && back.origin === undefined,
    JSON.stringify(back),
  );
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

// ===== K: key strategies (throwaway branches; nothing is merged) =====

add('K1', 'schema probe: Lexical key over an OPTIONAL field', async (c) => {
  const b = await newBranch(c, uid('k1'));
  const r = await attempt(() =>
    addSchemaOn(c, b, [
      {
        '@type': 'Class',
        '@id': 'KeyOpt',
        '@key': { '@type': 'Lexical', '@fields': ['a'] },
        a: { '@type': 'Optional', '@class': 'xsd:string' },
      },
    ]),
  );
  observe('schema push with an optional key field', desc(r));
  if (r.ok) {
    const d = await attempt(() => insertOn(c, b, [{ '@type': 'KeyOpt' }]));
    observe('insert with the key field absent', d.ok ? JSON.stringify(d.value) : desc(d));
  }
});

add('K2', 'schema probe: Lexical key over two node references, then a duplicate', async (c, tag) => {
  const b = await newBranch(c, uid('k2'));
  const sr = await attempt(() =>
    addSchemaOn(c, b, [
      {
        '@type': 'Class',
        '@id': 'KeyRef',
        '@key': { '@type': 'Lexical', '@fields': ['src', 'dst'] },
        src: 'Node',
        dst: 'Node',
        note: { '@type': 'Optional', '@class': 'xsd:string' },
      },
    ]),
  );
  observe('schema push with reference key fields', desc(sr));
  if (!sr.ok) return;
  const [s, t] = await insertOn(c, b, [nodeDoc(`${tag} s`), nodeDoc(`${tag} t`)]);
  const d1 = await attempt(() => insertOn(c, b, [{ '@type': 'KeyRef', src: s, dst: t }]));
  observe('first insert', d1.ok ? JSON.stringify(d1.value) : desc(d1));
  const d2 = await attempt(() => insertOn(c, b, [{ '@type': 'KeyRef', src: s, dst: t, note: 'second' }]));
  expectThat(
    'a second document with the same key fields is rejected',
    !d2.ok,
    d2.ok ? `accepted: ${JSON.stringify(d2.value)}` : desc(d2),
  );
});

add('K3', 'schema probe: editing a key field on an existing document', async (c) => {
  const b = await newBranch(c, uid('k3'));
  const sr = await attempt(() =>
    addSchemaOn(c, b, [
      {
        '@type': 'Class',
        '@id': 'KeyEdit',
        '@key': { '@type': 'Lexical', '@fields': ['label'] },
        label: 'xsd:string',
        note: { '@type': 'Optional', '@class': 'xsd:string' },
      },
    ]),
  );
  if (!sr.ok) {
    observe('schema push failed', desc(sr));
    return;
  }
  const [id] = await insertOn(c, b, [{ '@type': 'KeyEdit', label: 'x', note: 'n' }]);
  observe('id minted from the key field', id);
  const u = await attempt(() => updateOn(c, b, id, { label: 'y' }));
  observe('update that changes the key field, same @id', desc(u));
  const all = await listDocs(c, b, 'KeyEdit');
  observe('KeyEdit documents afterwards', JSON.stringify(all).slice(0, 300));
});

// ===== L: concurrent appends to collections (throwaway base branch) =====

add('L1', 'concurrent appends to Set / Array / List fields', async (c) => {
  const types = ['Set', 'Array', 'List'];
  const base = await newBranch(c, uid('l1base'));
  const sr = await attempt(() =>
    addSchemaOn(
      c,
      base,
      types.map((t) => ({
        '@type': 'Class',
        '@id': `Probe${t}`,
        '@key': { '@type': 'Random' },
        items: { '@type': t, '@class': 'xsd:string' },
      })),
    ),
  );
  if (!sr.ok) {
    observe('schema push failed', desc(sr));
    return;
  }
  const docIds: Record<string, string> = {};
  for (const t of types) {
    [docIds[t]] = await insertOn(c, base, [{ '@type': `Probe${t}`, items: ['base'] }]);
  }
  // One type at a time, so a conflict in one does not hide the others.
  for (const t of types) {
    const a = await newBranch(c, uid(`l1a${t}`), base);
    const b = await newBranch(c, uid(`l1b${t}`), base);
    await updateOn(c, a, docIds[t], { items: ['base', 'from-a'] });
    await updateOn(c, b, docIds[t], { items: ['base', 'from-b'] });
    const ra = await land(a, base);
    const rb = await mergeWithSync(b, base);
    const final = await getOn(c, base, docIds[t]);
    const items = Array.isArray(final?.items) ? final.items : final?.items;
    observe(
      `${t}: A lands, then B`,
      `A ${desc(ra)} | B ${rb.stage} ${desc(rb)} | final items ${JSON.stringify(items)}`,
    );
    if (t === 'Set') {
      const arr: string[] = Array.isArray(items) ? items : [];
      expectThat(
        'Set: both concurrent appends survive the merge',
        rb.ok && arr.includes('from-a') && arr.includes('from-b'),
        `final ${JSON.stringify(items)}`,
      );
    }
  }
});

// ===== Q: isolating the intermittent 500 (quiet server, retry behavior) =====

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Logged runs showed: concurrent rebases onto one branch fail 4 in 5 (expected),
 * but sequential, clean replays of a diverged branch also fail about 10-20% of the
 * time, and never on the conflict path. Three arms separate the candidates:
 *   ff       B forks AFTER A landed, so landing B is a fast-forward (no replay)
 *   replay0  B forked before A landed, B lands immediately after A (replay)
 *   replayP  same, but with a pause after A lands (a background job would finish)
 * Every 500 is retried up to 3 times to measure whether a retry is enough, and each
 * arm checks that every node ends up on main exactly once.
 */
add('Q1', 'sequential clean rebases: fast-forward vs replay vs replay after a pause', async (c, tag) => {
  const N = Number(process.env.Q_N ?? 20);
  const PAUSE = Number(process.env.Q_PAUSE_MS ?? 3000);
  const arms: Array<{ name: string; diverged: boolean; pause: number }> = [
    { name: 'ff', diverged: false, pause: 0 },
    { name: 'replay0', diverged: true, pause: 0 },
    { name: 'replayP', diverged: true, pause: PAUSE },
  ];
  for (const arm of arms) {
    let first500 = 0;
    let needed: number[] = [];
    let gaveUp = 0;
    const subjects: string[] = [];
    for (let i = 0; i < N; i++) {
      const subjA = `${tag} ${arm.name} a${i}`;
      const subjB = `${tag} ${arm.name} b${i}`;
      subjects.push(subjA, subjB);
      const a = await newBranch(c, uid('qa'));
      let b = '';
      if (arm.diverged) b = await newBranch(c, uid('qb'));
      await insertOn(c, a, [nodeDoc(subjA)]);
      if (arm.diverged) await insertOn(c, b, [nodeDoc(subjB)]);
      // A lands, retried until it is on main, so B's situation is the same every time.
      for (let k = 0; k < 4; k++) {
        if ((await land(a)).ok) break;
        await sleep(500);
      }
      if (!arm.diverged) {
        b = await newBranch(c, uid('qb'));
        await insertOn(c, b, [nodeDoc(subjB)]);
      }
      if (arm.pause) await sleep(arm.pause);
      let tries = 0;
      let ok = false;
      while (tries < 4 && !ok) {
        tries++;
        const r = await land(b);
        ok = r.ok;
        if (!ok && tries === 1 && /^HTTP_5/.test(r.kind ?? '')) first500++;
        if (!ok) await sleep(500);
      }
      if (ok) needed.push(tries);
      else gaveUp++;
    }
    const onMain = (await listDocs(c, 'main', 'Node')).filter((n) =>
      subjects.includes(String(n.subject)),
    );
    const dup = onMain.length - new Set(onMain.map((n) => n.subject)).size;
    observe(
      `arm ${arm.name}: first-attempt 500s`,
      `${first500}/${N} (${Math.round((100 * first500) / N)}%), attempts needed: ${JSON.stringify(
        needed.reduce((m: Record<number, number>, t) => ((m[t] = (m[t] ?? 0) + 1), m), {}),
      )}, gave up after 4 tries: ${gaveUp}`,
    );
    expectThat(
      `arm ${arm.name}: every node is on main exactly once`,
      onMain.length === subjects.length - gaveUp && dup === 0,
      `${onMain.length} on main, ${subjects.length} expected, ${dup} duplicates`,
    );
  }
}, true);

// ===== K4: does a Lexical key over (src, dst, basis, origin) enforce the multiplicity rules? =====

add('K4', 'schema probe: composite key with an enum and an optional origin', async (c, tag) => {
  const b = await newBranch(c, uid('k4'));
  const sr = await attempt(() =>
    addSchemaOn(c, b, [
      { '@type': 'Enum', '@id': 'ProbeBasis', '@value': ['Historical', 'Logical'] },
      {
        '@type': 'Class',
        '@id': 'ProbeClaim',
        '@key': { '@type': 'Lexical', '@fields': ['src', 'dst', 'basis', 'origin'] },
        src: 'Node',
        dst: 'Node',
        basis: 'ProbeBasis',
        origin: { '@type': 'Optional', '@class': 'xsd:string' },
        statement: { '@type': 'Optional', '@class': 'xsd:string' },
      },
    ]),
  );
  observe('schema push (reference + enum + optional origin in one key)', desc(sr));
  if (!sr.ok) return;
  const [s, t] = await insertOn(c, b, [nodeDoc(`${tag} s`), nodeDoc(`${tag} t`)]);
  const doc = (basis: string, origin?: string, statement = 'x') => ({
    '@type': 'ProbeClaim', src: s, dst: t, basis, statement, ...(origin ? { origin } : {}),
  });
  const ln1 = await attempt(() => insertOn(c, b, [doc('Logical')]));
  observe('first logical-necessity claim', ln1.ok ? JSON.stringify(ln1.value) : desc(ln1));
  const ln2 = await attempt(() => insertOn(c, b, [doc('Logical', undefined, 'a competing claim')]));
  expectThat('second logical claim for the same pair is rejected', !ln2.ok, ln2.ok ? `accepted ${JSON.stringify(ln2.value)}` : desc(ln2));
  const h1 = await attempt(() => insertOn(c, b, [doc('Historical', 'Fertile Crescent')]));
  expectThat('historical claim with an origin is accepted alongside the logical one', h1.ok, desc(h1));
  const h2 = await attempt(() => insertOn(c, b, [doc('Historical', 'China')]));
  expectThat('historical claim with a different origin is accepted', h2.ok, desc(h2));
  const h3 = await attempt(() => insertOn(c, b, [doc('Historical', 'China', 'dup')]));
  expectThat('historical claim repeating an origin is rejected', !h3.ok, h3.ok ? `accepted ${JSON.stringify(h3.value)}` : desc(h3));
  if (ln1.ok) {
    // Changing basis changes the key, so it cannot be an in-place edit.
    const id = (ln1.value as string[])[0];
    const u = await attempt(() => updateOn(c, b, id, { basis: 'Historical' }));
    observe('editing basis in place', desc(u));
  }
});

// ===== L2: Set of sub-documents, the shape groundings and objections would take =====

add('L2', 'concurrent appends to a Set of sub-documents', async (c) => {
  const base = await newBranch(c, uid('l2base'));
  const sr = await attempt(() =>
    addSchemaOn(c, base, [
      { '@type': 'Class', '@id': 'ProbeSub', '@subdocument': [], '@key': { '@type': 'ValueHash' }, text: 'xsd:string' },
      { '@type': 'Class', '@id': 'ProbeSubHolder', '@key': { '@type': 'Random' }, items: { '@type': 'Set', '@class': 'ProbeSub' } },
    ]),
  );
  if (!sr.ok) {
    observe('schema push failed', desc(sr));
    return;
  }
  const [id] = await insertOn(c, base, [{ '@type': 'ProbeSubHolder', items: [{ '@type': 'ProbeSub', text: 'base' }] }]);
  const a = await newBranch(c, uid('l2a'), base);
  const b = await newBranch(c, uid('l2b'), base);
  for (const [br, text] of [[a, 'from-a'], [b, 'from-b']] as const) {
    c.checkout(br);
    const d = await c.getDocument({ id });
    await c.updateDocument({ ...d, items: [...(d.items ?? []), { '@type': 'ProbeSub', text }] });
  }
  const ra = await land(a, base);
  const rb = await mergeWithSync(b, base);
  const final = await getOn(c, base, id);
  const texts = (final?.items ?? []).map((i: any) => i.text).sort();
  observe('A lands, then B', `A ${desc(ra)} | B ${rb.stage} ${desc(rb)} | final ${JSON.stringify(texts)}`);
  expectThat(
    'Set of sub-documents: both concurrent appends survive, nothing duplicated',
    rb.ok && JSON.stringify(texts) === JSON.stringify(['base', 'from-a', 'from-b']),
    `final ${JSON.stringify(texts)}`,
  );
});


// ===== H: history =====

add('H1', "does a branch keep its own commit IDs across a rebase-merge?", async (c, tag) => {
  const a = await newBranch(c, uid('a'));
  const mainAtBranch = await logIds('main');
  await insertOn(c, a, [nodeDoc(`${tag} h1a`)]);
  await insertOn(c, a, [nodeDoc(`${tag} h1b`)]);
  const before = await logIds(a);
  const b = await newBranch(c, uid('b'));
  await insertOn(c, b, [nodeDoc(`${tag} h1c`)]);
  await land(b); // main moves so A's merge is a true replay
  const m = await mergeWithSync(a);
  const mainLog = await logIds('main');
  if (!before || !mainLog || !mainAtBranch) {
    observe('commit log unavailable', 'GET /api/log returned an error or an unexpected shape');
    return;
  }
  // Only the commits A itself made count: everything already on main when A was created is shared.
  const own = before.filter((id) => !mainAtBranch.includes(id));
  const kept = own.filter((id) => mainLog.includes(id)).length;
  observe('log sizes', `A ${before.length}, main at branch time ${mainAtBranch.length}, main after ${mainLog.length}`);
  observe('A merge outcome', `${m.stage}: ${desc(m)}`);
  const report = m.value?.['api:rebase_report'];
  if (report) observe('api:rebase_report (origin -> applied)', JSON.stringify(report).slice(0, 400));
  expectThat(
    "a branch's own commits keep their IDs after rebase (reviews could bind to them)",
    own.length > 0 && kept === own.length,
    `${kept}/${own.length} of the branch's own commits found on main`,
  );
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
  expectThat(
    'revert restored statement without losing the later good edit',
    d?.statement === `${tag} baseline` && d?.relationship_kind === 'MaterialNecessity',
    JSON.stringify(d),
  );
});

// ===== X: scale =====

add(
  'X1',
  'bulk insert 300 nodes / ~600 edges, read back, cycle check, blast radius',
  async (c, tag) => {
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
    expectThat('root blast radius = N-1', radii.get(shortId(ids[0])) === N - 1, `${radii.get(shortId(ids[0]))}`);
    observe('client-side cycle check + all blast radii (ms)', `${tCalc}`);
  },
  true,
);

add(
  'X2',
  '15 branches merged sequentially with sync (does sync cost grow?)',
  async (c, tag) => {
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
  },
  true,
);

add(
  'X3',
  'large branch (200 docs) merges after main has moved',
  async (c, tag) => {
    const big = await newBranch(c, uid('big'));
    const small = await newBranch(c, uid('small'));
    await insertOn(c, big, Array.from({ length: 200 }, (_, i) => nodeDoc(`${tag}-big${i}`)));
    await insertOn(c, small, [nodeDoc(`${tag} small`)]);
    await land(small);
    const t0 = Date.now();
    const r = await mergeWithSync(big);
    expectThat('large branch merges', r.ok, `${r.stage} ${desc(r)} in ${Date.now() - t0} ms`);
  },
  true,
);

// ---------------------------------------------------------------- report

const esc = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ');

function buildReport(
  names: Map<string, string>,
  timings: { scenario: string; run: number; startedAt: string; endedAt: string; ms: number }[],
): string {
  const count = (v: Verdict) => findings.filter((f) => f.verdict === v).length;
  const lines: string[] = [
    `# Concurrent suite run ${RUN_ID}`,
    '',
    `Mode: sync ${USE_SYNC ? 'ON' : 'OFF (--no-sync)'}, repeat ${REPEAT}. Server: ${config.endpoint}`,
    '',
    `${count('PASS')} pass, ${count('FAIL')} fail, ${count('OBSERVED')} observed, ${count('ERROR')} error.`,
    '',
    '## Rebase calls',
    '',
    '| Stage | Calls | HTTP 5xx | Other errors | 5xx rate |',
    '| --- | --- | --- | --- | --- |',
    ...(['sync', 'land'] as const).map((k) => {
      const s = rebaseStats[k];
      const rate = s.calls ? `${((100 * s.fivexx) / s.calls).toFixed(1)}%` : 'n/a';
      return `| ${k} | ${s.calls} | ${s.fivexx} | ${s.other} | ${rate} |`;
    }),
    '',
  ];

  if (REPEAT > 1) {
    // Aggregate by scenario + check across runs.
    const groups = new Map<string, { scenario: string; label: string; c: Record<Verdict, number>; details: Set<string> }>();
    for (const f of findings) {
      const key = `${f.scenario}\u0000${f.label}`;
      let g = groups.get(key);
      if (!g) {
        g = { scenario: f.scenario, label: f.label, c: { PASS: 0, FAIL: 0, OBSERVED: 0, ERROR: 0 }, details: new Set() };
        groups.set(key, g);
      }
      g.c[f.verdict]++;
      if ((f.verdict === 'FAIL' || f.verdict === 'ERROR') && g.details.size < 3) {
        g.details.add(f.detail.slice(0, 160));
      }
    }
    lines.push(
      '## Checks across runs (only checks that failed at least once, plus all PASS/FAIL checks summarized)',
      '',
      '| Scenario | Check | Pass | Fail | Error | Sample failing detail |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (const g of groups.values()) {
      if (g.c.PASS + g.c.FAIL + g.c.ERROR === 0) continue; // observation-only rows stay in the JSON
      lines.push(
        `| ${g.scenario} ${esc(names.get(g.scenario) ?? '')} | ${esc(g.label)} | ${g.c.PASS} | ${g.c.FAIL} | ${g.c.ERROR} | ${esc([...g.details].join(' ; '))} |`,
      );
    }
    lines.push('', '## Server errors by scenario and kind', '', '| Scenario | Kind | Count | Sample their_commit |', '| --- | --- | --- | --- |');
    const eg = new Map<string, { n: number; commit?: string; scenario: string; kind: string }>();
    for (const e of errorLog) {
      const key = `${e.scenario}\u0000${e.kind}`;
      const g = eg.get(key) ?? { n: 0, commit: undefined, scenario: e.scenario, kind: e.kind };
      g.n++;
      if (!g.commit && e.theirCommit) g.commit = e.theirCommit;
      eg.set(key, g);
    }
    for (const g of eg.values()) lines.push(`| ${g.scenario} | ${g.kind} | ${g.n} | ${g.commit ?? ''} |`);
  } else {
    lines.push('| Scenario | Verdict | Check | Detail |', '| --- | --- | --- | --- |');
    for (const f of findings) {
      lines.push(
        `| ${f.scenario} ${esc(names.get(f.scenario) ?? '')} | ${f.verdict} | ${esc(f.label)} | ${esc(f.detail).slice(0, 300)} |`,
      );
    }
    const withCommit = errorLog.filter((e) => e.theirCommit);
    if (withCommit.length) {
      lines.push('', '## Errors that named a failing commit (api:their_commit)', '');
      for (const e of withCommit) lines.push(`- ${e.scenario}: ${e.kind}, their_commit ${e.theirCommit}`);
    }
  }
  const total = timings.reduce((a, t) => a + t.ms, 0);
  lines.push('', `Total scenario time: ${(total / 1000).toFixed(1)} s. Per-scenario timestamps and full error bodies are in the JSON file.`);
  return lines.join('\n');
}

// ---------------------------------------------------------------- runner

async function main() {
  const only = (argVal('only') ?? '').split(',').filter(Boolean);
  const skipSlow = args.includes('--skip-slow');

  const c = createClient();
  c.db(config.db);

  const selected = scenarios.filter(
    (s) => (only.length === 0 || only.some((p) => s.id.startsWith(p))) && !(skipSlow && s.slow),
  );
  console.log(
    `Running ${selected.length} scenarios x ${REPEAT} (run ${RUN_ID}, sync ${USE_SYNC ? 'on' : 'OFF'})`,
  );

  const timings: { scenario: string; run: number; startedAt: string; endedAt: string; ms: number }[] = [];
  for (let run = 1; run <= REPEAT; run++) {
    currentRun = run;
    for (const s of selected) {
      currentScenario = s.id;
      console.log(`\n=== ${s.id}${REPEAT > 1 ? ` (run ${run}/${REPEAT})` : ''}: ${s.name} ===`);
      const t0 = Date.now();
      const startedAt = new Date().toISOString();
      try {
        await s.fn(c, `${s.id}-${RUN_ID}-r${run}`);
      } catch (err: any) {
        record(
          'ERROR',
          'scenario crashed',
          shorten(err) + ' ' + String(err?.stack ?? '').split('\n').slice(0, 3).join(' | '),
        );
      }
      timings.push({ scenario: s.id, run, startedAt, endedAt: new Date().toISOString(), ms: Date.now() - t0 });
    }
  }

  const count = (v: Verdict) => findings.filter((f) => f.verdict === v).length;
  console.log(
    `\n=== SUMMARY: ${count('PASS')} pass, ${count('FAIL')} fail (hypothesis not confirmed), ${count('OBSERVED')} observed, ${count('ERROR')} error ===`,
  );
  for (const k of ['sync', 'land'] as const) {
    const s = rebaseStats[k];
    console.log(`  rebase ${k}: ${s.calls} calls, ${s.fivexx} HTTP 5xx, ${s.other} other errors`);
  }
  if (REPEAT === 1) {
    for (const f of findings.filter((f) => f.verdict === 'FAIL' || f.verdict === 'ERROR')) {
      console.log(`  [${f.verdict}] ${f.scenario}: ${f.label}${f.detail ? ` - ${f.detail}` : ''}`);
    }
  }

  const dir = path.resolve(process.cwd(), 'test-results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `concurrent-suite-${RUN_ID}.json`),
    JSON.stringify(
      { runId: RUN_ID, repeat: REPEAT, sync: USE_SYNC, rebaseStats, timings, findings, errorLog },
      null,
      2,
    ),
  );
  const names = new Map(scenarios.map((s) => [s.id, s.name]));
  fs.writeFileSync(path.join(dir, `concurrent-suite-${RUN_ID}.md`), buildReport(names, timings));
  console.log(`\nReport written to test-results/concurrent-suite-${RUN_ID}.md`);

  process.exit(count('ERROR') > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('concurrent-suite failed:');
  console.error(err);
  process.exit(1);
});
