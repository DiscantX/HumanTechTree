#!/usr/bin/env node
'use strict';
/**
 * Runs the three concurrency experiments end to end and bundles the results.
 *
 *   node tools/run-experiments.js --ssh user@vm-address
 *
 * What it does, with no manual steps in between:
 *   1. Checks that ssh to the VM works without a password prompt and that
 *      the TerminusDB container is running (it auto-detects whether docker
 *      needs sudo).
 *   2. Run 1: the probe scenarios (K, L, P2, C7, H1), single pass.
 *   3. Run 2: the flaky-scenario set, repeated, sync ON.
 *   4. Run 3: the same set, repeated, sync OFF (--no-sync).
 *      Runs 2 and 3 each start from a freshly reset database.
 *   5. During every run it streams `docker logs -f` from the VM over ssh and
 *      stamps each line with THIS machine's clock at the moment it arrives.
 *      The suite's own timestamps come from the same clock, so nothing has
 *      to be synchronised or converted afterwards.
 *   6. Writes everything to experiment-<time>/ and makes one archive, plus
 *      paste-me.md: the small file to upload in chat.
 *
 * Requirements: Node 18+, the project's dependencies installed (ts-node),
 * and key-based ssh to the VM (BatchMode: a password prompt would hang the
 * background log capture). Start the VM first.
 *
 * Options:
 *   --ssh <target>        required, e.g. user@192.168.1.50
 *   --ssh-cmd <exe>       ssh executable (default: ssh)
 *   --ssh-opt <arg>       extra ssh argument, repeatable (e.g. --ssh-opt -i --ssh-opt C:\keys\vm)
 *   --container <name>    default: terminus-db
 *   --repeat <n>          repeats for runs 2 and 3 (default: 20)
 *   --only <ids>          scenario prefixes for runs 2 and 3 (default: C4,C6,C8,E4,M9,P2)
 *   --runs <list>         which runs to do, e.g. 2,3 (default: 1,2,3)
 *   --out <dir>           output directory (default: experiment-<time>)
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------------ args
function parseArgs(argv) {
  const o = {
    sshCmd: 'ssh', sshOpts: [], container: 'terminus-db', repeat: 20,
    only: 'C4,C6,C8,E4,M9,P2', runs: [1, 2, 3], out: null, ssh: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value after ${a}`);
      return argv[++i];
    };
    if (a === '--ssh') o.ssh = next();
    else if (a === '--ssh-cmd') o.sshCmd = next();
    else if (a === '--ssh-opt') o.sshOpts.push(next());
    else if (a === '--container') o.container = next();
    else if (a === '--repeat') o.repeat = parseInt(next(), 10);
    else if (a === '--only') o.only = next();
    else if (a === '--runs') o.runs = next().split(',').map((x) => parseInt(x, 10));
    else if (a === '--out') o.out = next();
    else throw new Error(`Unknown option ${a}`);
  }
  if (!o.ssh) throw new Error('--ssh <user@vm-address> is required');
  if (!(o.repeat >= 1)) throw new Error('--repeat must be a positive number');
  return o;
}

// ------------------------------------------------------------------ utils
const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => console.log(`[experiments ${new Date().toLocaleTimeString()}] ${m}`);

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

let opts;
let dockerPrefix = '';
let timeoutPrefix = ''; // remote safety net: a stray `docker logs -f` ends itself after 2 hours
const children = new Set();
process.on('SIGINT', () => {
  for (const c of children) try { c.kill(); } catch (e) { /* ignore */ }
  process.exit(130);
});

/** Run one command on the VM, non-interactively. */
function remote(cmd, timeoutMs = 30000) {
  // No -o ConnectTimeout: Windows OpenSSH 8.6 fails with "Connection to UNKNOWN port -1" when it is set.
  // The spawnSync timeout below bounds a hung connection instead.
  const args = [...opts.sshOpts, '-o', 'BatchMode=yes', opts.ssh, cmd];
  const r = spawnSync(opts.sshCmd, args, { encoding: 'utf8', timeout: timeoutMs });
  return {
    code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim(),
    cmdline: `${opts.sshCmd} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`,
    timedOut: !!(r.error && r.error.code === 'ETIMEDOUT'),
  };
}

function preflight() {
  say('Checking ssh access to the VM...');
  const r = remote('echo ok');
  if (r.code !== 0 || r.out !== 'ok') {
    const authProblem = /permission denied|publickey/i.test(r.err);
    fail(
      'Could not run a command on the VM over ssh.\n' +
      `  command: ${r.cmdline}\n` +
      `  exit status: ${r.code}${r.timedOut ? ' (timed out after 30s)' : ''}\n` +
      `  ssh said: ${r.err || '(nothing)'}\n\n` +
      (authProblem
        ? 'This looks like a login problem. Key-based login must work with no prompts. To test by hand:\n' +
          `  ssh -o BatchMode=yes ${opts.ssh} echo ok\n` +
          'To install a key: ssh-keygen -t ed25519, then append the .pub file to ~/.ssh/authorized_keys on the VM\n' +
          '(strip Windows \\r line endings if piping from PowerShell).'
        : 'This does not look like a login problem. Check that the VM is running, the address and port are right,\n' +
          'and run the command above by hand (add -v for detail). Extra ssh options can be passed with --ssh-opt.'),
    );
  }
  say('Looking for the docker container...');
  const fmt = "--format '{{.Names}}'";
  let names = remote(`docker ps ${fmt}`);
  if (names.code !== 0) {
    names = remote(`sudo -n docker ps ${fmt}`);
    if (names.code === 0) dockerPrefix = 'sudo -n ';
  }
  if (names.code !== 0) {
    fail(
      `docker did not run on the VM (also tried sudo -n).\n  ${names.err}\n` +
      'Add your user to the docker group, or allow passwordless sudo for docker.',
    );
  }
  if (!names.out.split(/\r?\n/).includes(opts.container)) {
    fail(`No running container named "${opts.container}". Running: ${names.out.split(/\r?\n/).join(', ') || '(none)'}`);
  }
  const hasTimeout = remote('command -v timeout');
  if (hasTimeout.code === 0 && hasTimeout.out) timeoutPrefix = 'timeout 7200 ';
  const info = remote(`${dockerPrefix}docker ps --filter name=${opts.container} --format '{{.Image}} | {{.Status}}'`);
  say(`Container OK: ${info.out}`);
  return info.out;
}

// ------------------------------------------------------------------ processes
function tsNodeBin() {
  try {
    return require.resolve('ts-node/dist/bin.js', { paths: [process.cwd()] });
  } catch (e) {
    return fail('ts-node is not installed in this project. Run from the project root after `npm install`.');
  }
}

/** Run a project script with ts-node, teeing output to a file. Resolves to the exit code. */
function runTs(bin, scriptRel, args, outFile) {
  return new Promise((resolve) => {
    const out = outFile ? fs.createWriteStream(outFile, { flags: 'a' }) : null;
    const c = spawn(process.execPath, [bin, scriptRel, ...args], {
      cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(c);
    const pipe = (d) => { process.stdout.write(d); if (out) out.write(d); };
    c.stdout.on('data', pipe);
    c.stderr.on('data', pipe);
    c.on('close', (code) => { children.delete(c); if (out) out.end(); resolve(code); });
    c.on('error', () => resolve(1));
  });
}

/** Stream docker logs from the VM, stamping each line with the local clock on arrival. */
function startCapture(logPath) {
  const remoteCmd = `${timeoutPrefix}${dockerPrefix}docker logs -f --timestamps --since 5s ${opts.container} 2>&1`;
  const args = [...opts.sshOpts, '-o', 'BatchMode=yes', '-o', 'ServerAliveInterval=15', opts.ssh, remoteCmd];
  const child = spawn(opts.sshCmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  const out = fs.createWriteStream(logPath);
  let buf = '';
  let lines = 0;
  const handle = (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      out.write(`${nowIso()} | ${line}\n`);
      lines++;
    }
  };
  child.stdout.on('data', handle);
  child.stderr.on('data', handle);
  return {
    count: () => lines,
    stop: () => new Promise((resolve) => {
      if (buf.trim()) { out.write(`${nowIso()} | ${buf}\n`); lines++; buf = ''; }
      const done = () => { children.delete(child); out.end(resolve); };
      const t = setTimeout(done, 4000);
      child.once('close', () => { clearTimeout(t); done(); });
      try { child.kill(); } catch (e) { done(); }
    }),
  };
}

// ------------------------------------------------------------------ results
function newestResult(sinceMs) {
  const dir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => /^concurrent-suite-\d+\.json$/.test(f))
    .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
    .filter((x) => x.m >= sinceMs - 2000)
    .sort((a, b) => b.m - a.m);
  return files.length ? files[0].f.replace(/\.json$/, '') : null;
}

const PATTERN = /error|exception|fail|500|unexpected/i;
function logExcerpt(logPath, max = 100) {
  const all = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean) : [];
  const hits = all.filter((l) => PATTERN.test(l));
  return {
    total: all.length,
    matches: hits.length,
    lines: hits.slice(0, max).map((l) => (l.length > 240 ? l.slice(0, 240) + '...' : l)),
  };
}

// ------------------------------------------------------------------ main
async function main() {
  opts = parseArgs(process.argv.slice(2));
  const bin = tsNodeBin();
  const stamp = nowIso().replace(/[:.]/g, '-');
  const outDir = path.resolve(opts.out || `experiment-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const containerInfo = preflight();

  const plan = [
    { id: 1, label: 'probes', only: 'K,L,P2,C7,H1', repeat: 1, noSync: false, reset: false },
    { id: 2, label: 'sync-on', only: opts.only, repeat: opts.repeat, noSync: false, reset: true },
    { id: 3, label: 'sync-off', only: opts.only, repeat: opts.repeat, noSync: true, reset: true },
  ].filter((r) => opts.runs.includes(r.id));

  const paste = [
    `# Experiment bundle ${stamp}`,
    '',
    `- Started (host clock, UTC): ${nowIso()}`,
    `- Node ${process.version}, ${process.platform}`,
    `- Container: ${containerInfo}`,
    '- Every server log line is prefixed with the host clock at the moment it arrived, so it lines up directly with the suite JSON timestamps (same clock, no offset).',
    '',
  ];

  for (const run of plan) {
    const dir = path.join(outDir, `run${run.id}-${run.label}`);
    fs.mkdirSync(dir, { recursive: true });
    say(`===== Run ${run.id}: ${run.label} =====`);
    const suiteArgs = [`--only=${run.only}`];
    if (run.repeat > 1) suiteArgs.push(`--repeat=${run.repeat}`);
    if (run.noSync) suiteArgs.push('--no-sync');

    if (run.reset) {
      say('Resetting the dev database...');
      await runTs(bin, 'src/scripts/reset-db.ts', [], path.join(dir, 'setup-output.txt')); // fails harmlessly if no DB yet
      const code = await runTs(bin, 'src/scripts/init-db.ts', [], path.join(dir, 'setup-output.txt'));
      if (code !== 0) fail(`init-db failed (exit ${code}); see ${path.join(dir, 'setup-output.txt')}`);
    }

    const logPath = path.join(dir, 'server.log');
    const cap = startCapture(logPath);
    await sleep(2500); // let the capture attach before the suite starts
    const startMs = Date.now();
    const startedAt = nowIso();
    say(`Suite: ${suiteArgs.join(' ')}`);
    const code = await runTs(bin, 'src/scripts/tests/concurrent-suite.ts', suiteArgs, path.join(dir, 'suite-output.txt'));
    const endedAt = nowIso();
    await sleep(3000); // let trailing log lines arrive
    await cap.stop();
    say(`Suite exited with ${code}; captured ${cap.count()} log lines.`);

    const result = newestResult(startMs);
    let report = '(no report found: the suite may have crashed before writing one; see suite-output.txt)';
    if (result) {
      for (const ext of ['.json', '.md']) {
        fs.copyFileSync(path.join('test-results', result + ext), path.join(dir, result + ext));
      }
      report = fs.readFileSync(path.join(dir, result + '.md'), 'utf8');
    }
    const ex = logExcerpt(logPath);
    paste.push(
      `## Run ${run.id}: ${run.label}`, '',
      `- Command: suite ${suiteArgs.join(' ')}`,
      `- Started ${startedAt}, ended ${endedAt} (host clock, UTC), exit code ${code}`,
      `- Server log: ${ex.total} lines, ${ex.matches} matching /${PATTERN.source}/i (first ${ex.lines.length} below)`,
      `- Result files: ${result ? result + '.json / .md' : 'none'}`,
      '', '### Suite report', '', report, '',
      '### Server log excerpt', '', '```', ...ex.lines, '```', '',
    );
  }

  fs.writeFileSync(path.join(outDir, 'paste-me.md'), paste.join('\n'));

  // Archive: bsdtar (Windows, macOS) writes zip; fall back to tar.gz where only GNU tar exists.
  let archive = `${outDir}.zip`;
  let r = spawnSync('tar', ['-a', '-c', '-f', archive, '-C', outDir, '.'], { encoding: 'utf8' });
  // GNU tar ignores the .zip suffix and writes a plain tar; only accept real zip files (magic "PK").
  const isZip = (f) => {
    try { const fd = fs.openSync(f, 'r'); const b = Buffer.alloc(2); fs.readSync(fd, b, 0, 2, 0); fs.closeSync(fd); return b.toString() === 'PK'; }
    catch (e) { return false; }
  };
  if (r.status !== 0 || !isZip(archive)) {
    try { fs.unlinkSync(archive); } catch (e) { /* ignore */ }
    archive = `${outDir}.tar.gz`;
    r = spawnSync('tar', ['-czf', archive, '-C', outDir, '.'], { encoding: 'utf8' });
  }
  console.log('\n==================================================');
  console.log('Done. Upload these two files in chat:');
  console.log(`  1. ${path.join(outDir, 'paste-me.md')}   (small; the summary and log excerpts)`);
  console.log(r.status === 0 ? `  2. ${archive}   (everything, including the full logs and JSON)` : `  2. the folder ${outDir} (archiving failed: ${r.stderr || 'tar not found'})`);
  console.log('==================================================');
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
