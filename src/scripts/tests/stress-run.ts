/**
 * One-command runner for the stress suite (issue #24).
 *
 * Does everything around `stress-suite.ts` so nothing is done by hand:
 *   1. preflight: server reachable, ssh into the VM works, container running, storage path,
 *      free disk, memory command, VM facts (RAM, CPUs, storage driver, volume vs container layer)
 *   2. string-length probe (writes 50 KB .. 1 MB strings, records what the server accepts)
 *   3. smoke run (small), with an automatic pass/fail check of its results
 *   4. full run (only if the smoke run passed), then a Markdown summary
 *   5. cleanup of the scratch databases
 *
 * Usage (from the repo root):
 *   STRESS_VM_SSH=user@vm-address npm run stress-run
 *
 * Flags: --smoke-only  --skip-smoke  --large (adds a 10k/50k run of variants A and D)  --keep (keep scratch DBs)
 *
 * Settings (environment):
 *   STRESS_VM_SSH        required. ssh target for the VM, e.g. user@192.168.56.101 or an ssh config alias
 *   STRESS_SSH_CMD       optional ssh executable (default "ssh"); same idea as --ssh-cmd in tools/run-experiments.js
 *   STRESS_SSH_OPTS      optional extra ssh options, e.g. "-i C:/keys/vm_key -p 2222" (no spaces inside values)
 *                        Use a normal login key, NOT the read-only forced-command key used by the MCP server.
 *   STRESS_DOCKER        docker command in the VM (default "docker"; use "sudo docker" if needed, passwordless)
 *   STRESS_CONTAINER     container name (default "terminus-db")
 *   STRESS_STORAGE_PATH  data directory inside the container (default /app/terminusdb/storage)
 *   STRESS_DB            scratch database prefix (default "stress_scratch")
 *   STRESS_FULL_NODES    node steps for the full run (default "1000,10000")
 *
 * Output goes to results/ (gitignored): raw JSON per run plus summary-<label>.md.
 */
import axios from 'axios';
import { execFileSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';

import { config } from '../../config';
import { createClient } from '../../db/client';

// One connection per request, as in the suite: pooled keep-alive sockets can go stale between calls.
(http.globalAgent as any).keepAlive = false;
(https.globalAgent as any).keepAlive = false;

const args = new Set(process.argv.slice(2));
const VM = process.env.STRESS_VM_SSH;
const SSH_CMD = process.env.STRESS_SSH_CMD ?? 'ssh';
const SSH_OPTS = (process.env.STRESS_SSH_OPTS ?? '').split(/\s+/).filter(Boolean);
const DOCKER = process.env.STRESS_DOCKER ?? 'docker';
const CONTAINER = process.env.STRESS_CONTAINER ?? 'terminus-db';
const STORAGE = process.env.STRESS_STORAGE_PATH ?? '/app/terminusdb/storage';
const SCRATCH = process.env.STRESS_DB ?? 'stress_scratch';
const FULL_NODES = process.env.STRESS_FULL_NODES ?? '1000,10000';
const RESULTS = 'results';
const auth = { username: config.user, password: config.key };

const MIN_FREE_KB_FAIL = 2 * 1024 * 1024;
const MIN_FREE_KB_WARN = 5 * 1024 * 1024;

// ---------- ssh helpers ----------

// No -o ConnectTimeout: Windows OpenSSH 8.6 fails with "Connection to UNKNOWN port -1" when it is set
// (same finding as tools/run-experiments.js). The execFileSync timeout below bounds a hung connection instead.
const SSH_BASE = [...SSH_OPTS, '-o', 'BatchMode=yes'];

function remote(cmd: string): string {
  return execFileSync(SSH_CMD, [...SSH_BASE, VM as string, cmd], {
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** The same ssh call as a single shell string, for the suite's STRESS_*_CMD hooks (no inner double quotes). */
function sshString(cmd: string): string {
  return `${SSH_CMD} ${SSH_BASE.join(' ')} ${VM} "${cmd}"`;
}

const memRemote = `${DOCKER} stats --no-stream --format {{.MemUsage}} ${CONTAINER}`;
const diskRemote = `${DOCKER} exec ${CONTAINER} du -sk ${STORAGE}`;
const restartRemote = `${DOCKER} restart ${CONTAINER}`;

// ---------- preflight ----------

const failures: string[] = [];
const warnings: string[] = [];

function check<T>(name: string, fn: () => T, hint?: string): T | undefined {
  try {
    const v = fn();
    console.log(`  ok    ${name}${v !== undefined && typeof v !== 'object' ? `: ${v}` : ''}`);
    return v;
  } catch (e: any) {
    const msg = String(e?.stderr || e?.message || e).trim().split('\n')[0].slice(0, 200);
    console.log(`  FAIL  ${name}: ${msg}`);
    failures.push(`${name}${hint ? ` (${hint})` : ''}`);
    return undefined;
  }
}

interface Preflight {
  version: string;
  startKB: number;
  vmNotes: string;
}

async function preflight(): Promise<Preflight | null> {
  console.log('\n== Preflight ==');
  if (!VM) {
    console.error('STRESS_VM_SSH is not set. Example: STRESS_VM_SSH=user@192.168.56.101 npm run stress-run');
    return null;
  }
  if (SCRATCH === 'tech_tree_dev') {
    console.error('STRESS_DB must not be the prototype database.');
    return null;
  }
  if (!fs.existsSync('package.json') || !fs.existsSync('node_modules')) {
    console.error('Run from the repo root after `npm install`.');
    return null;
  }

  let version = 'unknown';
  try {
    const info = await axios.get(`${config.endpoint}/api/info`, { auth, timeout: 5000 });
    // Prefer a semantic version (12.0.7); a bare "version" field can be the API version (e.g. 2).
    const text = JSON.stringify(info.data);
    const m = text.match(/"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/) ?? text.match(/"version"\s*:\s*"([^"]+)"/);
    version = m ? m[1] : 'unknown';
    if (!/\./.test(version)) warnings.push(`server version looks odd ("${version}"); check the full /api/info output`);
    console.log(`  ok    TerminusDB server reachable at ${config.endpoint}, version ${version}`);
  } catch (e: any) {
    console.log(`  FAIL  TerminusDB server not reachable at ${config.endpoint}: ${e?.message}`);
    failures.push('server reachable');
  }

  console.log(`  info  ssh command: ${[SSH_CMD, ...SSH_BASE, VM].join(' ')}`);
  const sshOk = check(
    'ssh into the VM',
    () => {
      const out = remote('echo ok');
      if (out !== 'ok') throw new Error(`unexpected output "${out.slice(0, 60)}" (a forced-command key? use STRESS_SSH_OPTS="-i <key>")`);
      return 'ok';
    },
    'set STRESS_VM_SSH / STRESS_SSH_OPTS to a working key-based login',
  );
  if (!sshOk) return null;

  check('container running', () => {
    const r = remote(`${DOCKER} inspect -f {{.State.Running}} ${CONTAINER}`);
    if (r !== 'true') throw new Error(`state is "${r}"`);
    return CONTAINER;
  }, 'check STRESS_CONTAINER / STRESS_DOCKER');

  const startKB = check('storage directory size (KB)', () => {
    const kb = parseInt(remote(diskRemote), 10);
    if (!Number.isFinite(kb)) throw new Error('could not parse du output');
    return kb;
  }, `is ${STORAGE} right? see STRESS_STORAGE_PATH`);

  check('free disk (KB)', () => {
    const lines = remote(`${DOCKER} exec ${CONTAINER} df -kP ${STORAGE}`).split('\n');
    const free = parseInt(lines[lines.length - 1].trim().split(/\s+/)[3], 10);
    if (!Number.isFinite(free)) throw new Error('could not parse df output');
    if (free < MIN_FREE_KB_FAIL) throw new Error(`only ${(free / 1048576).toFixed(1)} GB free, need at least 2 GB`);
    if (free < MIN_FREE_KB_WARN) warnings.push(`only ${(free / 1048576).toFixed(1)} GB free; the full run may fill it`);
    return free;
  }, 'free up VM disk space');

  check('memory hook output', () => {
    const r = remote(memRemote);
    if (!r) throw new Error('empty output');
    return r;
  });

  let ramMB = '?';
  let cpus = '?';
  let driver = '?';
  let storageKind = '?';
  try {
    const mem = remote('free -m').split('\n').find((l) => /^Mem:/.test(l));
    if (mem) ramMB = mem.trim().split(/\s+/)[1];
    cpus = remote('nproc');
    driver = remote(`${DOCKER} info --format {{.Driver}}`);
    const mounts = JSON.parse(remote(`${DOCKER} inspect -f {{json .Mounts}} ${CONTAINER}`)) as any[];
    const cover = mounts.find((m) => m.Destination && (STORAGE === m.Destination || STORAGE.startsWith(`${m.Destination}/`)));
    storageKind = cover ? `${cover.Type} ${cover.Name ?? cover.Source}` : `container writable layer (${driver})`;
  } catch {
    warnings.push('could not collect all VM facts; fill STRESS_VM_NOTES by hand if needed');
  }
  const vmNotes = `VM RAM ${ramMB} MB, ${cpus} CPUs, storage: ${storageKind}`;
  console.log(`  info  ${vmNotes}`);

  if (failures.length) return null;
  return { version, startKB: (startKB as number) ?? 0, vmNotes };
}

// ---------- string-length probe ----------

async function stringProbe(): Promise<any[]> {
  console.log('\n== String length probe ==');
  const db = `${SCRATCH}_probe`;
  const client = createClient();
  try {
    await client.deleteDatabase(db, config.organization);
  } catch {
    /* did not exist */
  }
  await client.createDatabase(db, { label: db, comment: 'string probe', schema: true });
  client.db(db);
  await client.addDocument(
    [
      { '@type': '@context', '@base': 'terminusdb:///data/', '@schema': 'terminusdb:///schema#' },
      { '@type': 'Class', '@id': 'Probe', '@key': { '@type': 'Random' }, text: 'xsd:string' },
    ],
    { graph_type: 'schema', full_replace: true },
  );
  const rows: any[] = [];
  for (const kb of [50, 99, 101, 200, 500, 1024]) {
    const text = 'abcdefghij'.repeat(Math.ceil((kb * 1024) / 10)).slice(0, kb * 1024);
    try {
      const ids = await client.addDocument({ '@type': 'Probe', text }, {}, undefined, `probe ${kb}KB`);
      const back = await client.getDocument({ id: Array.isArray(ids) ? ids[0] : ids });
      const ok = back?.text?.length === text.length;
      rows.push({ kb, accepted: true, roundTrip: ok });
      console.log(`  ${kb} KB: accepted${ok ? '' : ' but read back with a different length'}`);
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 160);
      rows.push({ kb, accepted: false, error: msg });
      console.log(`  ${kb} KB: rejected (${msg})`);
    }
  }
  try {
    await client.deleteDatabase(db, config.organization);
  } catch {
    /* ignore */
  }
  return rows;
}

// ---------- subdocument id probe ----------

/** Do two parents holding an identical ValueHash subdocument collide? Matters for the Data Model's groundings. */
async function subdocProbe(): Promise<any[]> {
  console.log('\n== Subdocument id probe ==');
  const db = `${SCRATCH}_subdoc`;
  const client = createClient();
  try {
    await client.deleteDatabase(db, config.organization);
  } catch {
    /* did not exist */
  }
  await client.createDatabase(db, { label: db, comment: 'subdoc probe', schema: true });
  client.db(db);
  await client.addDocument(
    [
      { '@type': '@context', '@base': 'terminusdb:///data/', '@schema': 'terminusdb:///schema#' },
      { '@type': 'Class', '@id': 'G', '@subdocument': [], '@key': { '@type': 'ValueHash' }, text: 'xsd:string' },
      { '@type': 'Class', '@id': 'Holder', '@key': { '@type': 'Random' }, name: 'xsd:string', gs: { '@type': 'Set', '@class': 'G' } },
    ],
    { graph_type: 'schema', full_replace: true },
  );
  const holder = (name: string) => ({ '@type': 'Holder', name, gs: [{ '@type': 'G', text: 'same text' }] });
  const rows: any[] = [];
  const attempt = async (label: string, fn: () => Promise<any>) => {
    try {
      await fn();
      rows.push({ label, ok: true });
      console.log(`  ${label}: accepted`);
    } catch (e: any) {
      const error = String(e?.message ?? e).slice(0, 160);
      rows.push({ label, ok: false, error });
      console.log(`  ${label}: rejected (${error})`);
    }
  };
  await attempt('two holders, identical subdocument, one request', () => client.addDocument([holder('h1'), holder('h2')]));
  await attempt('two more holders, identical subdocument, separate requests', async () => {
    await client.addDocument(holder('h3'));
    await client.addDocument(holder('h4'));
  });
  try {
    await client.deleteDatabase(db, config.organization);
  } catch {
    /* ignore */
  }
  return rows;
}

// ---------- suite runner and checks ----------

function runSuite(extraEnv: Record<string, string>): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn('npm run stress-suite', {
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        TERMINUSDB_DB: SCRATCH,
        STRESS_MEM_CMD: sshString(memRemote),
        STRESS_DISK_CMD: sshString(diskRemote),
        STRESS_RESTART_CMD: sshString(restartRemote),
        ...extraEnv,
      },
    });
    p.on('exit', (c) => resolve(c ?? 1));
  });
}

const bad = (v: any) => v == null || (typeof v === 'string' && v.startsWith('ERR'));

export function validateSmoke(results: any): { problems: string[]; notes: string[] } {
  const problems: string[] = [];
  const notes: string[] = [];
  const variants = Object.entries<any>(results.variants ?? {});
  if (!variants.length) problems.push('no variants in the results file');
  for (const [name, v] of variants) {
    if (v.fatal) problems.push(`variant ${name} failed: ${v.fatal}`);
    if (!v.steps?.length) {
      problems.push(`variant ${name}: no measurement steps`);
      continue;
    }
    for (const s of v.steps) {
      for (const k of ['lookup', 'edgesOf', 'blastRadius', 'blastRadiusNoPath', 'smallEdit']) {
        const q = s.queries?.[k];
        if (!q || q.errors > 0 || q.median == null) problems.push(`variant ${name}: query "${k}" failed (${q?.firstError ?? 'no data'})`);
      }
      if (bad(s.memory)) problems.push(`variant ${name}: memory hook returned ${s.memory}`);
      if (bad(s.disk)) problems.push(`variant ${name}: disk hook returned ${s.disk}`);
      if (!s.cold || s.cold.error) problems.push(`variant ${name}: cold-start step failed (${s.cold?.error ?? 'missing'})`);
    }
    for (const kind of ['field', 'prose']) {
      if (kind === 'prose' && name === 'A') continue;
      const e = v.edits?.[kind] ?? [];
      if (!e.length) problems.push(`variant ${name}: no ${kind} edit checkpoints`);
      for (const row of e) {
        if (row.error) problems.push(`variant ${name}: ${kind} edit ${row.edit} failed: ${row.error}`);
        else if (typeof row.historyMs === 'string') problems.push(`variant ${name}: history endpoint failed at edit ${row.edit}: ${row.historyMs}`);
        else if (typeof row.logMs === 'string') problems.push(`variant ${name}: log endpoint failed at edit ${row.edit}: ${row.logMs}`);
      }
    }
    if (v.optimize && (typeof v.optimize.branchMs === 'string' || typeof v.optimize.repoMs === 'string')) {
      notes.push(`variant ${name}: optimize call failed (${String(v.optimize.branchMs)} / ${String(v.optimize.repoMs)}); not blocking`);
    }
  }
  return { problems, notes };
}

/** Rough duration of the full run from a smoke result, excluding blast radius and optimize. */
export function estimateMinutes(smoke: any, smokeNodes: number, fullNodes: number, edits: number): number | null {
  const loads: number[] = [];
  const editMs: number[] = [];
  for (const v of Object.values<any>(smoke.variants ?? {})) {
    const s = v.steps?.[0];
    if (!s) continue;
    loads.push(s.loadSec / smokeNodes);
    if (s.queries?.smallEdit?.median) editMs.push(s.queries.smallEdit.median);
  }
  if (!loads.length || !editMs.length) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const perVariantSec = avg(loads) * fullNodes + (edits * 2 * avg(editMs)) / 1000;
  return Math.round((perVariantSec * 4) / 60);
}

// ---------- summary ----------

const num = (s: any) => (typeof s === 'string' ? parseInt(s, 10) : NaN);
const f = (x: any) => (x == null ? '-' : String(x));
const q = (o: any) => (o?.skipped ? 'skipped' : o ? `${o.median == null ? '-' : `${f(o.median)}/${f(o.p95)}`}${o.errors ? ` (${o.timedOut ? 'timeout' : 'error'})` : ''}` : '-');

function summarize(results: any, pre: Preflight, probe: any[] | null, subdoc: any[] | null = null): string {
  const L: string[] = [];
  L.push(`# Stress run summary: ${results.label}`, '');
  L.push(`- Server: TerminusDB ${pre.version}`);
  L.push(`- VM: ${pre.vmNotes}`);
  L.push(`- Settings: ${JSON.stringify(results.settings)}`);
  L.push(`- Storage at start: ${pre.startKB} KB (growth below is raw, not baseline-corrected)`, '');
  L.push('Times in ms as median/p95 unless stated. Memory is the container figure from docker stats.', '');
  for (const [name, v] of Object.entries<any>(results.variants)) {
    L.push(`## Variant ${name}`, '');
    if (v.fatal) L.push(`FAILED: ${v.fatal}`, '');
    if (v.steps?.length) {
      L.push('| Nodes | Load s | Lookup | Edges-into-node | Blast radius | Blast (no path) | Small edit | Memory | Disk KB | Cold ready ms |');
      L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
      for (const s of v.steps) {
        L.push(`| ${s.nodes} | ${f(s.loadSec?.toFixed?.(1))} | ${q(s.queries?.lookup)} | ${q(s.queries?.edgesOf)} | ${q(s.queries?.blastRadius)} | ${q(s.queries?.blastRadiusNoPath)} | ${q(s.queries?.smallEdit)} | ${f(s.memory)} | ${f(num(s.disk))} | ${f(s.cold?.readyMs)} |`);
      }
      L.push('');
    }
    for (const kind of ['field', 'prose']) {
      const e: any[] = v.edits?.[kind] ?? [];
      if (!e.length) continue;
      const first = e[0];
      const last = e[e.length - 1];
      L.push(`Edit growth (${kind}): edit ${first.edit} -> ${last.edit}: mean edit ${f(first.recentEditMeanMs)} -> ${f(last.recentEditMeanMs)} ms, history ${f(first.historyMs)} -> ${f(last.historyMs)} ms, disk ${f(num(first.disk))} -> ${f(num(last.disk))} KB${last.error ? ` (stopped: ${last.error})` : ''}`, '');
    }
    if (v.optimize) {
      L.push(`Optimize: disk ${f(num(v.optimize.diskBefore))} -> ${f(num(v.optimize.diskAfter))} KB, branch ${f(v.optimize.branchMs)} ms, repo ${f(v.optimize.repoMs)} ms`, '');
    }
  }
  if (probe) {
    L.push('## String length probe', '');
    for (const r of probe) L.push(`- ${r.kb} KB: ${r.accepted ? `accepted${r.roundTrip ? '' : ' (length mismatch on read-back)'}` : `rejected: ${r.error}`}`);
    L.push('');
  }
  if (subdoc) {
    L.push('## Subdocument id probe', '');
    for (const r of subdoc) L.push(`- ${r.label}: ${r.ok ? 'accepted' : `rejected: ${r.error}`}`);
    L.push('');
  }
  return L.join('\n');
}

// ---------- main ----------

async function cleanup(): Promise<void> {
  for (const v of ['a', 'b', 'c', 'd', 'probe', 'subdoc']) {
    try {
      await axios.delete(`${config.endpoint}/api/db/${config.organization}/${SCRATCH}_${v}`, { auth, timeout: 60000 });
    } catch {
      /* not there */
    }
  }
}

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function main() {
  const pre = await preflight();
  if (!pre) {
    console.error(`\nPreflight failed${failures.length ? `: ${failures.join('; ')}` : ''}. Nothing was run.`);
    process.exit(1);
  }
  for (const w of warnings) console.log(`  warn  ${w}`);
  fs.mkdirSync(RESULTS, { recursive: true });
  const stamp = Date.now();
  const label = `v${pre.version}-baseline`;

  let probe: any[] | null = null;
  let subdoc: any[] | null = null;
  try {
    probe = await stringProbe();
  } catch (e: any) {
    console.log(`  string probe could not run: ${e?.message}`);
  }
  try {
    subdoc = await subdocProbe();
  } catch (e: any) {
    console.log(`  subdocument probe could not run: ${e?.message}`);
  }

  if (!args.has('--skip-smoke')) {
    console.log('\n== Smoke run ==');
    const smokeNodes = 200;
    const smokeOut = path.join(RESULTS, `smoke-${stamp}.json`);
    const code = await runSuite({
      STRESS_NODES: String(smokeNodes), STRESS_EDITS: '20', STRESS_REPS: '3', STRESS_VARIANTS: 'A,D',
      STRESS_LABEL: 'smoke', STRESS_OUT: smokeOut, STRESS_VM_NOTES: pre.vmNotes,
    });
    if (code !== 0 || !fs.existsSync(smokeOut)) {
      console.error(`\nSmoke run crashed (exit ${code}). Paste the output above; no full run was started.`);
      if (!args.has('--keep')) await cleanup();
      process.exit(1);
    }
    const smoke = readJson(smokeOut);
    const { problems, notes } = validateSmoke(smoke);
    for (const n of notes) console.log(`  note  ${n}`);
    if (problems.length) {
      console.error('\nSmoke run found problems, so the full run was not started:');
      for (const p of problems) console.error(`  - ${p}`);
      console.error(`\nRaw results: ${smokeOut}. Paste this output and I will fix the suite.`);
      if (!args.has('--keep')) await cleanup();
      process.exit(1);
    }
    const first = FULL_NODES.split(',').map((s) => parseInt(s, 10));
    const est = estimateMinutes(smoke, smokeNodes, Math.max(...first), 500);
    console.log(`\nSmoke run passed.${est ? ` Rough estimate for the full run: about ${est} minutes (blast radius and optimize not included).` : ''}`);
  }

  if (args.has('--smoke-only')) {
    if (!args.has('--keep')) await cleanup();
    console.log('\n--smoke-only: stopping here.');
    return;
  }

  console.log('\n== Full run ==');
  const fullOut = path.join(RESULTS, `stress-${label}-${stamp}.json`);
  const code = await runSuite({ STRESS_NODES: FULL_NODES, STRESS_LABEL: label, STRESS_OUT: fullOut, STRESS_VM_NOTES: pre.vmNotes });
  if (fs.existsSync(fullOut)) {
    const summaryFile = path.join(RESULTS, `summary-${label}-${stamp}.md`);
    fs.writeFileSync(summaryFile, summarize(readJson(fullOut), pre, probe, subdoc));
    console.log(`\nSummary: ${summaryFile}\nRaw:     ${fullOut}`);
  }
  if (code !== 0) console.error(`The suite exited with code ${code}; partial results may exist.`);

  if (args.has('--large')) {
    console.log('\n== Large run (10,000 and 50,000 nodes, variants A and D) ==');
    const largeLabel = `v${pre.version}-50k`;
    const largeOut = path.join(RESULTS, `stress-${largeLabel}-${stamp}.json`);
    await runSuite({ STRESS_NODES: '10000,50000', STRESS_VARIANTS: 'A,D', STRESS_LABEL: largeLabel, STRESS_OUT: largeOut, STRESS_VM_NOTES: pre.vmNotes });
    if (fs.existsSync(largeOut)) {
      const f2 = path.join(RESULTS, `summary-${largeLabel}-${stamp}.md`);
      fs.writeFileSync(f2, summarize(readJson(largeOut), pre, null));
      console.log(`Summary: ${f2}`);
    }
  }

  if (!args.has('--keep')) {
    await cleanup();
    console.log('\nScratch databases deleted.');
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('stress-run failed:', e);
    process.exit(1);
  });
}
