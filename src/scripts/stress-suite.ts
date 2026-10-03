/**
 * Stress suite: graph size, prose placement and edit growth (issue #24).
 *
 * Fills a dedicated database with synthetic graphs, measures query and commit
 * latency at each scale step, then makes many edits to watch history growth.
 * Prose placement variants:
 *   A  graph only
 *   B  ~STRESS_PROSE_BYTES of prose in a field on every node
 *   C  the same prose on 10% of nodes
 *   D  the same prose as a separate Prose document referenced by every node
 *
 * One database per variant is created as `${TERMINUSDB_DB}_<variant>`. Set
 * TERMINUSDB_DB to a scratch name; the prototype database is refused.
 *
 * Memory, disk and restart are measured through optional shell commands, so
 * they can run over ssh into the VM (or be left unset):
 *   STRESS_MEM_CMD      prints the server's memory use
 *   STRESS_DISK_CMD     prints the storage size
 *   STRESS_RESTART_CMD  restarts the server (cold-start timing)
 *
 * Other settings (all optional): STRESS_NODES=1000,10000  STRESS_VARIANTS=A,B,C,D
 * STRESS_EDITS=500  STRESS_PROSE_BYTES=8192  STRESS_EDIT_PROSE_BYTES=20480
 * STRESS_BATCH=500  STRESS_REPS=20  STRESS_OPTIMIZE=1  STRESS_LABEL=...
 * STRESS_VM_NOTES=...  STRESS_OUT=results/name.json
 *
 * Not yet run against a live server: expect to fix details on the first run.
 */
import axios from 'axios';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { config } from '../config';
import { createClient } from '../db/client';
import { blastRadiusQuery, executeWoqlQuery } from '../db/woql-queries';

const env = (k: string, d: string) => process.env[k] ?? d;
const NODES = env('STRESS_NODES', '1000,10000').split(',').map((s) => parseInt(s, 10));
const VARIANTS = env('STRESS_VARIANTS', 'A,B,C,D').split(',').map((s) => s.trim().toUpperCase());
const EDITS = parseInt(env('STRESS_EDITS', '500'), 10);
const PROSE_BYTES = parseInt(env('STRESS_PROSE_BYTES', '8192'), 10);
const EDIT_PROSE_BYTES = parseInt(env('STRESS_EDIT_PROSE_BYTES', '20480'), 10);
const BATCH = parseInt(env('STRESS_BATCH', '500'), 10);
const REPS = parseInt(env('STRESS_REPS', '20'), 10);
const DO_OPTIMIZE = env('STRESS_OPTIMIZE', '1') === '1';
const CHECKPOINT = 50;
const WINDOW = 200;
const LABEL = env('STRESS_LABEL', '');

if (config.db === 'tech_tree_dev') {
  console.error('Refusing to run: set TERMINUSDB_DB to a scratch name, not the prototype database.');
  process.exit(1);
}

const auth = { username: config.user, password: config.key };
const dbPath = (db: string) => `${config.organization}/${db}`;

// ---------- deterministic data generation ----------

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const vocab: string[] = (() => {
  const r = rng(7);
  const words: string[] = [];
  for (let i = 0; i < 3000; i++) {
    const len = 3 + Math.floor(r() * 8);
    let w = '';
    for (let j = 0; j < len; j++) w += String.fromCharCode(97 + Math.floor(r() * 26));
    words.push(w);
  }
  return words;
})();

/** Pseudo-prose of about `bytes` characters, skewed so some words repeat as in natural text. */
function prose(bytes: number, seed: number): string {
  const r = rng(seed);
  let out = '';
  let startOfSentence = true;
  while (out.length < bytes) {
    let w = vocab[Math.floor(vocab.length * Math.pow(r(), 3))];
    if (startOfSentence) w = w[0].toUpperCase() + w.slice(1);
    out += w;
    startOfSentence = r() < 0.08;
    out += startOfSentence ? '. ' : ' ';
  }
  return out.slice(0, bytes);
}

const CATEGORIES = ['Discovery', 'Invention', 'Achievement'];
const KINDS = ['MaterialNecessity', 'ConceptualEnablement', 'Combination', 'MereInfluence'];

function nodeDoc(i: number, variant: string, proseRef?: string): any {
  const r = rng(i * 31 + 1);
  const doc: any = {
    '@type': 'Node',
    subject: `Node ${i}`,
    category: CATEGORIES[Math.floor(r() * CATEGORIES.length)],
    description: prose(120 + Math.floor(r() * 80), i + 5),
  };
  if (variant === 'B' || (variant === 'C' && i % 10 === 0)) doc.prose = prose(PROSE_BYTES, i + 11);
  if (variant === 'D' && proseRef) doc.prose_ref = proseRef;
  return doc;
}

/** Up to three incoming claims for node i, from earlier nodes (acyclic by construction). */
function claimDocs(i: number, ids: string[]): any[] {
  if (i === 0) return [];
  const r = rng(i * 17 + 3);
  const lo = Math.max(0, i - WINDOW);
  const sources = new Set<number>();
  for (let k = 0; k < 3 && sources.size < i - lo; k++) sources.add(lo + Math.floor(r() * (i - lo)));
  const docs: any[] = [];
  for (const s of sources) {
    const logical = r() < 0.15;
    docs.push({
      '@type': 'Claim',
      source_node: ids[s],
      target_node: ids[i],
      basis: logical ? 'LogicalNecessity' : 'HistoricalAttestation',
      ...(logical ? {} : { origin: `Region ${Math.floor(r() * 6)}` }),
      relationship_kind: KINDS[Math.floor(r() * KINDS.length)],
      statement: prose(80, i * 3 + s),
      groundings: [{ '@type': 'Grounding', kind: 'Citation', text: prose(160, s + 99) }],
      reviews: [{ '@type': 'Review', reviewer: `user-${Math.floor(r() * 50)}`, verdict: 'Supports', content_hash: prose(64, s + 5).replace(/[^a-z]/g, 'x') }],
    });
  }
  return docs;
}

function schemaFor(variant: string): any[] {
  const node: any = {
    '@type': 'Class',
    '@id': 'Node',
    '@key': { '@type': 'Random' },
    subject: 'xsd:string',
    category: 'Category',
    description: { '@type': 'Optional', '@class': 'xsd:string' },
  };
  if (variant === 'B' || variant === 'C') node.prose = { '@type': 'Optional', '@class': 'xsd:string' };
  if (variant === 'D') node.prose_ref = { '@type': 'Optional', '@class': 'Prose' };
  const s: any[] = [
    { '@type': '@context', '@base': 'terminusdb:///data/', '@schema': 'terminusdb:///schema#' },
    { '@type': 'Enum', '@id': 'Category', '@value': ['Discovery', 'Invention', 'Achievement'] },
    { '@type': 'Enum', '@id': 'RelationshipKind', '@value': KINDS },
    { '@type': 'Enum', '@id': 'Basis', '@value': ['HistoricalAttestation', 'LogicalNecessity'] },
    { '@type': 'Enum', '@id': 'GroundingKind', '@value': ['Citation', 'Argument'] },
    { '@type': 'Enum', '@id': 'Verdict', '@value': ['Supports', 'Disputes'] },
    { '@type': 'Class', '@id': 'Grounding', '@subdocument': [], '@key': { '@type': 'ValueHash' }, kind: 'GroundingKind', text: 'xsd:string' },
    { '@type': 'Class', '@id': 'Review', '@subdocument': [], '@key': { '@type': 'ValueHash' }, reviewer: 'xsd:string', verdict: 'Verdict', content_hash: 'xsd:string' },
    node,
    {
      '@type': 'Class',
      '@id': 'Claim',
      '@key': { '@type': 'Lexical', '@fields': ['source_node', 'target_node', 'basis', 'origin'] },
      source_node: 'Node',
      target_node: 'Node',
      basis: 'Basis',
      origin: { '@type': 'Optional', '@class': 'xsd:string' },
      relationship_kind: 'RelationshipKind',
      statement: 'xsd:string',
      groundings: { '@type': 'Set', '@class': 'Grounding' },
      reviews: { '@type': 'Set', '@class': 'Review' },
    },
  ];
  if (variant === 'D') s.push({ '@type': 'Class', '@id': 'Prose', '@key': { '@type': 'Random' }, text: 'xsd:string' });
  return s;
}

// ---------- measurement helpers ----------

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: string }> {
  const t = process.hrtime.bigint();
  try {
    const value = await fn();
    return { ms: Number(process.hrtime.bigint() - t) / 1e6, value };
  } catch (e: any) {
    return { ms: Number(process.hrtime.bigint() - t) / 1e6, error: String(e?.message ?? e).slice(0, 200) };
  }
}

function summarize(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1) };
}

function sh(cmd: string | undefined): string | null {
  if (!cmd) return null;
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 60000 }).trim();
  } catch (e: any) {
    return `ERR ${String(e?.message ?? e).slice(0, 120)}`;
  }
}
const mem = () => sh(process.env.STRESS_MEM_CMD);
const disk = () => sh(process.env.STRESS_DISK_CMD);

async function repeat(n: number, fn: () => Promise<any>) {
  const ms: number[] = [];
  const errors: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = await timed(fn);
    if (r.error) errors.push(r.error);
    else ms.push(r.ms);
  }
  return { ...summarize(ms), errors: errors.length, firstError: errors[0] };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms))]);
}

const histLatency = (db: string, id: string) =>
  timed(() => axios.get(`${config.endpoint}/api/history/${dbPath(db)}`, { params: { id }, auth }));
const logLatency = (db: string) =>
  timed(() =>
    axios.get(`${config.endpoint}/api/log/${dbPath(db)}/local/branch/main`, { params: { count: 10 }, auth }),
  );

async function waitReady(): Promise<void> {
  for (let i = 0; i < 120; i++) {
    try {
      await axios.get(`${config.endpoint}/api/info`, { auth, timeout: 2000 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('server did not come back after restart');
}

// ---------- the run ----------

async function measureQueries(client: any, db: string, ids: string[]) {
  const rand = rng(123);
  const pick = () => ids[Math.floor(rand() * ids.length)];
  client.db(db).checkout('main');
  const lookup = await repeat(REPS, () => client.getDocument({ id: pick() }));
  const { WOQL } = require('terminusdb');
  const edgesOf = await repeat(REPS, () =>
    client.query(WOQL.triple('v:Claim', '@schema:target_node', pick())),
  );
  const early = [ids[0], ids[Math.min(5, ids.length - 1)], ids[Math.min(25, ids.length - 1)]];
  const blast = await repeat(3, () =>
    withTimeout(executeWoqlQuery(client, blastRadiusQuery(early[Math.floor(rand() * early.length)])), 120000),
  );
  const edit = await repeat(REPS, async () => {
    const id = pick();
    const d = await client.getDocument({ id });
    await client.updateDocument({ ...d, description: `edited ${Math.random()}` }, {}, undefined, 'stress edit');
  });
  return { lookup, edgesOf, blastRadius: blast, smallEdit: edit };
}

async function runVariant(variant: string, results: any) {
  const db = `${config.db}_${variant.toLowerCase()}`;
  const client = createClient();
  console.log(`\n=== Variant ${variant}: database ${db} ===`);
  try {
    await client.deleteDatabase(db, config.organization);
  } catch {
    /* did not exist */
  }
  await client.createDatabase(db, { label: db, comment: 'stress suite', schema: true });
  client.db(db);
  await client.addDocument(schemaFor(variant), { graph_type: 'schema', full_replace: true });

  const out: any = { steps: [], edits: null };
  results.variants[variant] = out;
  const ids: string[] = [];
  const proseIds: string[] = [];
  let commits = 0;

  for (const target of NODES) {
    const from = ids.length;
    const t0 = Date.now();
    for (let start = from; start < target; start += BATCH) {
      const end = Math.min(target, start + BATCH);
      let refs: string[] = [];
      if (variant === 'D') {
        const pdocs = [];
        for (let i = start; i < end; i++) pdocs.push({ '@type': 'Prose', text: prose(PROSE_BYTES, i + 11) });
        refs = await client.addDocument(pdocs, {}, undefined, `prose ${start}-${end}`);
        commits++;
        proseIds.push(...refs);
      }
      const ndocs = [];
      for (let i = start; i < end; i++) ndocs.push(nodeDoc(i, variant, refs[i - start]));
      const nres = await client.addDocument(ndocs, {}, undefined, `nodes ${start}-${end}`);
      commits++;
      if (!Array.isArray(nres) || nres.length !== ndocs.length) throw new Error('unexpected addDocument result');
      ids.push(...nres);
      const cdocs: any[] = [];
      for (let i = start; i < end; i++) cdocs.push(...claimDocs(i, ids));
      if (cdocs.length) {
        await client.addDocument(cdocs, {}, undefined, `claims ${start}-${end}`);
        commits++;
      }
    }
    const loadSec = (Date.now() - t0) / 1000;
    console.log(`  loaded to ${target} nodes in ${loadSec.toFixed(1)}s`);
    const step: any = { nodes: target, loadSec, memory: mem(), disk: disk() };
    step.queries = await measureQueries(client, db, ids);
    commits += REPS;
    step.memoryAfterQueries = mem();
    const restart = process.env.STRESS_RESTART_CMD;
    if (restart) {
      sh(restart);
      const t = Date.now();
      await waitReady();
      const first = await timed(() => client.getDocument({ id: ids[0] }));
      step.cold = { readyMs: Date.now() - t, firstLookupMs: +first.ms.toFixed(1), error: first.error };
      step.memoryAfterRestart = mem();
    }
    out.steps.push(step);
    console.log(`  step ${target}: lookup median ${(step.queries.lookup as any)?.median}ms, blast median ${(step.queries.blastRadius as any)?.median}ms`);
  }

  // ----- edit growth -----
  const edits: any = { prose: [], field: [] };
  const fieldId = ids[Math.min(1, ids.length - 1)];
  const proseNode = ids[0];
  let proseDocId = proseNode;
  if (variant === 'D') proseDocId = (await client.getDocument({ id: proseNode })).prose_ref;
  const hasProse = variant !== 'A';

  async function editLoop(kind: 'prose' | 'field') {
    if (kind === 'prose' && !hasProse) return;
    const log: number[] = [];
    for (let n = 1; n <= EDITS; n++) {
      const r = await timed(async () => {
        if (kind === 'field') {
          const d = await client.getDocument({ id: fieldId });
          await client.updateDocument({ ...d, description: prose(100, n) }, {}, undefined, `field edit ${n}`);
        } else if (variant === 'D') {
          const d = await client.getDocument({ id: proseDocId });
          await client.updateDocument({ ...d, text: prose(EDIT_PROSE_BYTES, n) }, {}, undefined, `prose edit ${n}`);
        } else {
          const d = await client.getDocument({ id: proseNode });
          await client.updateDocument({ ...d, prose: prose(EDIT_PROSE_BYTES, n) }, {}, undefined, `prose edit ${n}`);
        }
      });
      if (r.error) {
        edits[kind].push({ edit: n, error: r.error });
        break;
      }
      commits++;
      log.push(r.ms);
      if (n % CHECKPOINT === 0 || n === EDITS) {
        const docId = kind === 'field' ? fieldId : proseDocId;
        const h = await histLatency(db, docId);
        const l = await logLatency(db);
        edits[kind].push({
          edit: n,
          commitsOnBranch: commits,
          recentEditMeanMs: +(log.slice(-CHECKPOINT).reduce((a, b) => a + b, 0) / Math.min(CHECKPOINT, log.length)).toFixed(1),
          disk: disk(),
          historyMs: h.error ? h.error : +h.ms.toFixed(1),
          logMs: l.error ? l.error : +l.ms.toFixed(1),
        });
        console.log(`  ${kind} edits ${n}: mean ${edits[kind][edits[kind].length - 1].recentEditMeanMs}ms, history ${edits[kind][edits[kind].length - 1].historyMs}ms`);
      }
    }
  }
  await editLoop('field');
  await editLoop('prose');
  out.edits = edits;

  if (DO_OPTIMIZE) {
    const before = disk();
    const t = Date.now();
    const branch = await timed(() => axios.post(`${config.endpoint}/api/optimize/${dbPath(db)}/local/branch/main`, {}, { auth }));
    const repo = await timed(() => axios.post(`${config.endpoint}/api/optimize/${dbPath(db)}/local`, {}, { auth }));
    out.optimize = {
      diskBefore: before,
      diskAfter: disk(),
      branchMs: branch.error ?? +branch.ms.toFixed(1),
      repoMs: repo.error ?? +repo.ms.toFixed(1),
      totalSec: (Date.now() - t) / 1000,
      queriesAfter: await measureQueries(client, db, ids),
    };
  }
}

async function main() {
  const info = await timed(() => axios.get(`${config.endpoint}/api/info`, { auth }));
  const results: any = {
    label: LABEL,
    startedAt: new Date().toISOString(),
    vmNotes: process.env.STRESS_VM_NOTES ?? null,
    server: info.error ? info.error : (info.value as any)?.data,
    settings: { NODES, VARIANTS, EDITS, PROSE_BYTES, EDIT_PROSE_BYTES, BATCH, REPS, DO_OPTIMIZE },
    variants: {},
  };
  const outFile = env('STRESS_OUT', path.join('results', `stress-${(LABEL || 'run').replace(/\W+/g, '-')}-${Date.now()}.json`));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  for (const v of VARIANTS) {
    try {
      await runVariant(v, results);
    } catch (e: any) {
      results.variants[v] = { ...(results.variants[v] ?? {}), fatal: String(e?.message ?? e).slice(0, 400) };
      console.error(`  variant ${v} failed:`, e?.message ?? e);
    }
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  }
  console.log(`\nResults written to ${outFile}`);
}

main().catch((e) => {
  console.error('stress-suite failed:', e);
  process.exit(1);
});
