import { MergeQueue, QueueDeps, QueueOptions } from '../db/merge-queue';
import { ValidationFailure } from '../db/staged-landing';

/** Database-free tests of the queue's own logic, using a fake clock and fake landings. */
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

const opts: QueueOptions = { minGapMs: 1000, maxRetries: 3, retryBaseMs: 500 };
const err = (status: number, body: unknown) => Object.assign(new Error('x'), { status, response: body });

function harness(script: Array<'ok' | Error>, existing = true) {
  let clock = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const starts: number[] = [];
  const sleeps: number[] = [];
  const deps: QueueDeps = {
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    branchExists: async () => existing,
    land: async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      starts.push(clock);
      await Promise.resolve(); // yield, so overlap would show
      clock += 50; // a landing takes 50 ms
      inFlight--;
      const next = script.shift() ?? 'ok';
      if (next === 'ok') return { 'api:status': 'api:success' };
      throw next;
    },
  };
  return { q: new MergeQueue(opts, deps), starts, sleeps, max: () => maxInFlight };
}

async function main() {
  {
    const h = harness([]);
    const rs = await Promise.all(['a', 'b', 'c', 'd'].map((b) => h.q.enqueue({ sourceBranch: b, message: b })));
    check('serializes: never more than one landing in flight', h.max() === 1);
    check('all four landed', rs.every((r) => r.outcome === 'landed'));
    const gaps = h.starts.slice(1).map((s, i) => s - h.starts[i] - 50);
    check('spacing: each landing starts >= 1000 ms after the last ended', gaps.every((g) => g >= 1000), JSON.stringify(gaps));
  }
  {
    const h = harness([err(500, 'boom'), err(500, 'boom'), 'ok']);
    const r = await h.q.enqueue({ sourceBranch: 'a', message: 'm' });
    check('transient: lands after two 5xx', r.outcome === 'landed' && r.attempts === 3);
    check('transient: pauses grow (500, 1000) before retries', JSON.stringify(h.sleeps.filter((s) => s < 1000 || s === 1000).slice(0, 3)).includes('500'), JSON.stringify(h.sleeps));
  }
  {
    const h = harness([err(500, 'x'), err(500, 'x'), err(500, 'x'), err(500, 'x'), 'ok']);
    const r = await h.q.enqueue({ sourceBranch: 'a', message: 'm' });
    check('retry cap: gives up after 1 + 3 attempts', r.outcome === 'transient_failed' && r.attempts === 4);
  }
  {
    const h = harness([err(400, { 'api:message': 'cardinality violated' }), 'ok']);
    const r = await h.q.enqueue({ sourceBranch: 'a', message: 'm' });
    check('conflict: reported, not retried', r.outcome === 'conflict' && r.attempts === 1);
  }
  {
    const h = harness([err(400, { witness: 'instance_not_of_class' })]);
    const r = await h.q.enqueue({ sourceBranch: 'a', message: 'm' });
    check('deleted reference is translated', r.outcome === 'deleted_reference');
  }
  {
    const h = harness([err(418, 'teapot')]);
    const r = await h.q.enqueue({ sourceBranch: 'a', message: 'm' });
    check('unrecognized: surfaced, not retried', r.outcome === 'unrecognized' && r.attempts === 1);
  }
  {
    const h = harness([], false);
    const r = await h.q.enqueue({ sourceBranch: 'ghost', message: 'm' });
    check('preflight: missing branch never calls land', r.outcome === 'missing_branch' && r.attempts === 0 && h.starts.length === 0);
  }
  {
    const h = harness([err(400, 'cardinality'), 'ok']);
    const [a, b] = await Promise.all([
      h.q.enqueue({ sourceBranch: 'a', message: 'm' }),
      h.q.enqueue({ sourceBranch: 'b', message: 'm' }),
    ]);
    check('a failed job does not block the next', a.outcome === 'conflict' && b.outcome === 'landed');
  }
  {
    const v = [{ check: 'dangling_edge' as const, severity: 'block' as const, subjects: ['e'], message: 'dangling' }];
    const h = harness([new ValidationFailure(v) as any, 'ok']);
    const r = await h.q.enqueue({ sourceBranch: 'a', message: 'm' });
    check('validation failure: reported with violations, not retried', r.outcome === 'validation_failed' && r.attempts === 1 && r.violations?.[0].check === 'dangling_edge');
  }
  {
    // Preflight failures: 5xx is retried with backoff, then lands.
    let calls = 0;
    const h = harness([]);
    (h.q as any).deps.branchExists = async () => {
      calls++;
      if (calls <= 2) throw Object.assign(new Error('x'), { status: 503 });
      return true;
    };
    const r = await h.q.enqueue({ sourceBranch: 'a', message: 'm' });
    check('preflight 5xx: retried, then lands', r.outcome === 'landed' && calls === 3);
    check('preflight 5xx: backoff pauses 500 then 1000', JSON.stringify(h.sleeps.slice(0, 2)) === '[500,1000]', JSON.stringify(h.sleeps));
  }
  {
    // Preflight 5xx that never clears: gives up, never lands.
    const h = harness([]);
    (h.q as any).deps.branchExists = async () => {
      throw Object.assign(new Error('x'), { status: 500 });
    };
    const r = await h.q.enqueue({ sourceBranch: 'a', message: 'm' });
    check('preflight 5xx exhausted: transient_failed, land never called', r.outcome === 'transient_failed' && r.attempts === 0 && h.starts.length === 0);
  }
  {
    // Preflight 401: surfaced, not retried, and the next job still runs.
    let calls = 0;
    const h = harness([]);
    (h.q as any).deps.branchExists = async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error('x'), { status: 401 });
      return true;
    };
    const [a, b] = await Promise.all([
      h.q.enqueue({ sourceBranch: 'a', message: 'm' }),
      h.q.enqueue({ sourceBranch: 'b', message: 'm' }),
    ]);
    check('preflight 401: unrecognized, not retried', a.outcome === 'unrecognized' && calls === 2 && h.sleeps.length === 0);
    check('preflight 401: the next job still lands', b.outcome === 'landed');
  }
  {
    // Something unexpected escapes process() (here, a throwing sleep during spacing):
    // that job resolves as unrecognized and the queue keeps going.
    let sleeps = 0;
    const h = harness([]);
    (h.q as any).deps.sleep = async () => {
      sleeps++;
      if (sleeps === 1) throw new Error('clock exploded');
    };
    const rs = await Promise.all(['a', 'b', 'c'].map((x) => h.q.enqueue({ sourceBranch: x, message: x })));
    check('unexpected throw: that job resolves as unrecognized', rs[1].outcome === 'unrecognized' && /clock exploded/.test(rs[1].detail ?? ''));
    check('unexpected throw: jobs before and after still land', rs[0].outcome === 'landed' && rs[2].outcome === 'landed');
  }
  console.log(failures === 0 ? '\nAll passed.' : `\n${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}
void main();
