import axios from 'axios';

import { config } from '../../config';
import { createClient } from '../../db/client';
import { getCommitLog } from '../../db/log';
import { queueFromEnv } from '../../db/merge-queue';
import { rebaseBranch } from '../../db/rebase';

/**
 * Live checks that need a running TerminusDB (issues #8, #10, #11, #12, #14):
 *
 *   G1  staged refusal of a dangling edge through the merge queue
 *   G2  staged refusal of a cycle through the merge queue
 *   G3  reading a document as of a past commit
 *   G4  apply as a three-way merge, with an explicit merge base
 *   G5  nested collections: the same sub-document edited on two branches, a Set of
 *       reviews nested inside a grounding, and a List of premises
 *
 * Every test works on scratch branches cut from main, and nothing is written to main.
 * The scratch branches are deleted at the end (set KEEP_BRANCHES=1 to keep them).
 * Needs the dev database with the graph schema pushed (npm run init-db), and a main
 * with no leftover cycles or dangling edges, since the gate reads the whole graph.
 *
 *   npm run gate-live
 *
 * G1 and G2 assert. The rest print what the server did, with the expectation noted,
 * because the point is to find out.
 */
const c: any = createClient();
c.db(config.db);

const run = Date.now().toString(36);
let n = 0;
const uid = (p: string) => `${p}_${run}_${n++}`;
const made: string[] = [];
let failures = 0;

const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};
const observe = (name: string, detail: string) => console.log(`SEE   ${name}  ${detail}`);
const brief = (x: unknown, max = 260): string => {
  let s: string;
  try {
    s = typeof x === 'string' ? x : (JSON.stringify(x) ?? String(x));
  } catch {
    s = String(x);
  }
  return s.length > max ? s.slice(0, max) + '...' : s;
};
const errText = (e: any): string => brief(e?.response ?? e?.data ?? e?.message ?? String(e));
const bare = (d: any): any => {
  const { ['@id']: _drop, ...rest } = d ?? {};
  return rest;
};

async function branchOff(base: string, prefix = 'g'): Promise<string> {
  const name = uid(prefix);
  c.checkout(base);
  await c.branch(name);
  made.push(name);
  return name;
}
async function insert(branch: string, docs: any[]): Promise<string[]> {
  c.checkout(branch);
  return c.addDocument(docs);
}
async function schemaOn(branch: string, docs: any[]): Promise<void> {
  c.checkout(branch);
  await c.addDocument(docs, { graph_type: 'schema' });
}
async function getOn(branch: string, id: string): Promise<any> {
  c.checkout(branch);
  return c.getDocument({ id });
}
async function listOn(branch: string, type: string): Promise<any[]> {
  c.checkout(branch);
  const r = await c.getDocument({ type, as_list: true, count: 100000 });
  return Array.isArray(r) ? r : [];
}
async function land(source: string, target: string): Promise<{ ok: boolean; text: string }> {
  try {
    await rebaseBranch({ sourceBranch: source, targetBranch: target, message: `land ${source}` });
    return { ok: true, text: 'landed' };
  } catch (e) {
    return { ok: false, text: errText(e) };
  }
}
const head = async (branch: string): Promise<string | undefined> => (await getCommitLog(branch, { count: 1 }))?.[0]?.identifier;
const branchPath = (b: string) => `${config.organization}/${config.db}/local/branch/${b}`;

const nodeDoc = (subject: string) => ({ '@type': 'Node', subject, category: 'Invention' });
const edgeDoc = (s: string, t: string, statement: string) => ({
  '@type': 'Edge',
  source_node: s,
  target_node: t,
  statement,
  relationship_kind: 'MaterialNecessity',
  basis: 'LogicalNecessity',
  status: 'Ungrounded',
});

async function section(name: string, fn: () => Promise<void>) {
  console.log(`\n--- ${name}`);
  try {
    await fn();
  } catch (e) {
    console.log(`ERROR in ${name}: ${errText(e)}`);
    failures++;
  }
}

async function stageBranches(): Promise<string[]> {
  const all = await c.getBranches();
  return Object.keys(all).filter((b) => b.startsWith('stage_'));
}

async function main() {
  const queue = queueFromEnv();
  const stagesBefore = new Set(await stageBranches());

  await section('G1 dangling edge refused through the queue (issue #8, Q3)', async () => {
    const base = await branchOff('main', 'g1base');
    const [x, y] = await insert(base, [nodeDoc(`G1 X ${run}`), nodeDoc(`G1 Y ${run}`)]);
    const withEdge = await branchOff(base, 'g1edge');
    await insert(withEdge, [edgeDoc(x, y, `G1 ${run}`)]);
    const deleter = await branchOff(base, 'g1del');
    c.checkout(deleter);
    await c.deleteDocument({ id: y });

    const rd = await queue.enqueue({ sourceBranch: deleter, targetBranch: base, message: 'G1 delete' });
    check('the deletion lands', rd.outcome === 'landed', rd.outcome);
    const re = await queue.enqueue({ sourceBranch: withEdge, targetBranch: base, message: 'G1 edge' });
    // With rebase the replay succeeds and the gate refuses; with apply the store's own schema check refuses first.
    check(
      'the edge to the deleted node is refused (gate with rebase, apply\'s schema check with apply)',
      re.outcome === 'validation_failed' || re.outcome === 'deleted_reference',
      `${re.outcome} ${brief(re.violations?.map((v) => v.check))} ${re.outcome === 'landed' ? '' : brief(re.detail ?? '', 120)}`,
    );
    if (re.outcome === 'validation_failed') {
      check('the refusal names a dangling edge', !!re.violations?.some((v) => v.check === 'dangling_edge'));
    }
    // main may hold edges from other scripts, so count only this run's.
    const mine = (await listOn(base, 'Edge')).filter((e) => String(e.statement).includes(run));
    check('no edge reached the target', mine.length === 0, `${mine.length} found`);
  });

  await section('G2 cycle refused through the queue (issue #8, Q7)', async () => {
    const base = await branchOff('main', 'g2base');
    const [a, b] = await insert(base, [nodeDoc(`G2 A ${run}`), nodeDoc(`G2 B ${run}`)]);
    const ab = await branchOff(base, 'g2ab');
    await insert(ab, [edgeDoc(a, b, `G2 a to b ${run}`)]);
    const ba = await branchOff(base, 'g2ba');
    await insert(ba, [edgeDoc(b, a, `G2 b to a ${run}`)]);

    const r1 = await queue.enqueue({ sourceBranch: ab, targetBranch: base, message: 'G2 a to b' });
    check('the first edge lands', r1.outcome === 'landed', r1.outcome);
    const r2 = await queue.enqueue({ sourceBranch: ba, targetBranch: base, message: 'G2 b to a' });
    check('the edge that closes the cycle is refused', r2.outcome === 'validation_failed', `${r2.outcome} ${brief(r2.violations?.map((v) => v.check))}`);
    check('the refusal names a cycle', !!r2.violations?.some((v) => v.check === 'cycle'));
    const mine = (await listOn(base, 'Edge')).filter((e) => String(e.statement).includes(run));
    check('only the first edge is on the target', mine.length === 1, `${mine.length} of this run's edges found`);
  });

  await section('G3 reading a document as of a past commit (issue #14)', async () => {
    const base = await branchOff('main', 'g3');
    const [id] = await insert(base, [nodeDoc(`G3 v1 ${run}`)]);
    const v1 = await head(base);
    c.checkout(base);
    const d = await c.getDocument({ id });
    await c.updateDocument({ ...d, subject: `G3 v2 ${run}` });
    observe('commit id of v1', String(v1));
    const auth = { username: config.user, password: config.key };
    const url = `${config.endpoint}/api/document/${config.organization}/${config.db}/local/commit/${v1}`;
    const r = await axios.get(url, { params: { id }, auth, validateStatus: () => true });
    observe('GET at the past commit', `${r.status} ${brief(r.data)}`);
    check('the past commit returns the first version', r.status === 200 && brief(r.data, 500).includes(`G3 v1 ${run}`));
    const now = await getOn(base, id);
    check('the branch head still shows the second version', now.subject === `G3 v2 ${run}`);
    const h = await axios.get(`${config.endpoint}/api/history/${config.organization}/${config.db}/local/branch/${base}`, {
      params: { id },
      auth,
      timeout: 20000,
      validateStatus: () => true,
    }).catch((e) => ({ status: e.code ?? 'error', data: undefined as unknown }));
    observe('per-document history for that document (issue #15)', `${h.status} ${brief(h.data)}`);
  });

  await section('G4 apply as a three-way merge with an explicit base (issue #11)', async () => {
    // The spec takes a bare commit ID or branch name for before and after, not a full path.
    const scenario = async (label: string, kind: 'branch' | 'commit', sameField: boolean): Promise<void> => {
      const base = await branchOff('main', 'g4base');
      const [id] = await insert(base, [nodeDoc(`G4 ${label} ${run}`)]);
      const snap = await branchOff(base, 'g4snap'); // stays at the merge base
      const baseCommit = await head(base);
      const a = await branchOff(base, 'g4a');
      const b = await branchOff(base, 'g4b');
      c.checkout(a);
      await c.updateDocument({ ...(await c.getDocument({ id })), description: sameField ? 'A says one thing' : 'edited on A' });
      c.checkout(b);
      await c.updateDocument({ ...(await c.getDocument({ id })), ...(sameField ? { description: 'B says another' } : { stage: 'Observation' }) });
      await land(a, base);
      const before = kind === 'branch' ? snap : String(baseCommit);
      c.checkout(base);
      try {
        const res = await c.apply(before, b, `G4 ${label}`);
        observe(`${label}: apply, before = ${kind} ${before.slice(0, 12)}`, `OK ${brief(res)}`);
      } catch (e: any) {
        observe(`${label}: apply, before = ${kind} ${before.slice(0, 12)}`, `status ${e?.status} ${errText(e)}`);
        if (sameField) check(`${label}: a same-field collision is a 409`, e?.status === 409);
      }
      const m = await getOn(base, id);
      observe(`${label}: target afterwards`, brief({ description: m.description, stage: m.stage }));
      if (!sameField) {
        check(`${label}: both edits present (a true three-way merge)`, m.description === 'edited on A' && m.stage === 'Observation');
      }
    };
    await scenario('different fields', 'branch', false);
    await scenario('different fields', 'commit', false);
    await scenario('same field', 'branch', true);
    await scenario('same field', 'commit', true);
  });

  await section('G5 nested collections (issue #12)', async () => {
    const base = await branchOff('main', 'g5base');
    try {
      await schemaOn(base, [
        { '@type': 'Class', '@id': 'ProbeItem', '@subdocument': [], '@key': { '@type': 'Lexical', '@fields': ['name'] }, name: 'xsd:string', text: 'xsd:string', note: { '@type': 'Optional', '@class': 'xsd:string' } },
        { '@type': 'Class', '@id': 'ProbeItemHolder', '@key': { '@type': 'Random' }, items: { '@type': 'Set', '@class': 'ProbeItem' } },
        { '@type': 'Class', '@id': 'ProbeReview', '@subdocument': [], '@key': { '@type': 'ValueHash' }, who: 'xsd:string' },
        { '@type': 'Class', '@id': 'ProbeGround', '@subdocument': [], '@key': { '@type': 'Lexical', '@fields': ['name'] }, name: 'xsd:string', reviews: { '@type': 'Set', '@class': 'ProbeReview' } },
        { '@type': 'Class', '@id': 'ProbeGroundHolder', '@key': { '@type': 'Random' }, grounds: { '@type': 'Set', '@class': 'ProbeGround' } },
        { '@type': 'Class', '@id': 'ProbeStep', '@subdocument': [], '@key': { '@type': 'ValueHash' }, text: 'xsd:string' },
        { '@type': 'Class', '@id': 'ProbeArg', '@key': { '@type': 'Random' }, steps: { '@type': 'List', '@class': 'ProbeStep' } },
      ]);
    } catch (e) {
      observe('probe schema push failed', errText(e));
      return;
    }

    // N1: one sub-document (stable key), two branches.
    {
      const [id] = await insert(base, [{ '@type': 'ProbeItemHolder', items: [{ '@type': 'ProbeItem', name: 'x', text: 'base' }] }]);
      const mk = async (edit: (i: any) => any) => {
        const br = await branchOff(base, 'n1');
        c.checkout(br);
        const d = await c.getDocument({ id });
        await c.updateDocument({ ...d, items: d.items.map((i: any) => (i.name === 'x' ? edit(i) : i)) });
        return br;
      };
      const a = await mk((i) => ({ ...i, text: 'from-a' }));
      const b = await mk((i) => ({ ...i, text: 'from-b' }));
      const ra = await land(a, base);
      const rb = await land(b, base);
      observe('N1 same field of one sub-document on two branches (expect a conflict)', `A ${ra.text} | B ${brief(rb.text, 140)} | final ${brief((await getOn(base, id)).items)}`);

      const [id2] = await insert(base, [{ '@type': 'ProbeItemHolder', items: [{ '@type': 'ProbeItem', name: 'y', text: 'base' }] }]);
      const mk2 = async (edit: (i: any) => any) => {
        const br = await branchOff(base, 'n1b');
        c.checkout(br);
        const d = await c.getDocument({ id: id2 });
        await c.updateDocument({ ...d, items: d.items.map((i: any) => (i.name === 'y' ? edit(i) : i)) });
        return br;
      };
      const a2 = await mk2((i) => ({ ...i, text: 'from-a' }));
      const b2 = await mk2((i) => ({ ...i, note: 'from-b' }));
      const ra2 = await land(a2, base);
      const rb2 = await land(b2, base);
      observe('N1b different fields of one sub-document (expect both to survive)', `A ${ra2.text} | B ${brief(rb2.text, 140)} | final ${brief((await getOn(base, id2)).items)}`);
    }

    // N2: reviews nested one level deeper, inside a grounding.
    {
      const [id] = await insert(base, [{ '@type': 'ProbeGroundHolder', grounds: [{ '@type': 'ProbeGround', name: 'g', reviews: [{ '@type': 'ProbeReview', who: 'r0' }] }] }]);
      const mk = async (who: string) => {
        const br = await branchOff(base, 'n2');
        c.checkout(br);
        const d = await c.getDocument({ id });
        await c.updateDocument({
          ...d,
          grounds: d.grounds.map((g: any) => (g.name === 'g' ? { ...g, reviews: [...(g.reviews ?? []), { '@type': 'ProbeReview', who }] } : g)),
        });
        return br;
      };
      const a = await mk('r-a');
      const b = await mk('r-b');
      const ra = await land(a, base);
      const rb = await land(b, base);
      const who = ((await getOn(base, id)).grounds?.[0]?.reviews ?? []).map((r: any) => r.who).sort();
      observe('N2 reviews appended on two branches (expect r0, r-a, r-b)', `A ${ra.text} | B ${brief(rb.text, 140)} | final ${brief(who)}`);
    }

    // N3: ordered premises as a List of sub-documents.
    {
      const steps = (...t: string[]) => t.map((text) => ({ '@type': 'ProbeStep', text }));
      const [id] = await insert(base, [{ '@type': 'ProbeArg', steps: steps('s1', 's2') }]);
      const mk = async (edit: (s: any[]) => any[]) => {
        const br = await branchOff(base, 'n3');
        c.checkout(br);
        const d = await c.getDocument({ id });
        await c.updateDocument({ ...d, steps: edit(d.steps) });
        return br;
      };
      const a = await mk((s) => [...s, ...steps('from-a')]);
      const b = await mk((s) => [...s, ...steps('from-b')]);
      const ra = await land(a, base);
      const rb = await land(b, base);
      observe('N3 a step appended on two branches (expect a conflict)', `A ${ra.text} | B ${brief(rb.text, 140)} | final ${brief(((await getOn(base, id)).steps ?? []).map((s: any) => s.text))}`);

      const [id2] = await insert(base, [{ '@type': 'ProbeArg', steps: steps('p1', 'p2') }]);
      const mk2 = async (edit: (s: any[]) => any[]) => {
        const br = await branchOff(base, 'n3b');
        c.checkout(br);
        const d = await c.getDocument({ id: id2 });
        await c.updateDocument({ ...d, steps: edit(d.steps) });
        return br;
      };
      const a2 = await mk2((s) => [{ ...bare(s[0]), text: 'p1 by A' }, s[1]]);
      const b2 = await mk2((s) => [s[0], { ...bare(s[1]), text: 'p2 by B' }]);
      const ra2 = await land(a2, base);
      const rb2 = await land(b2, base);
      observe('N3b different steps edited on two branches (expect a conflict: the list is one value)', `A ${ra2.text} | B ${brief(rb2.text, 140)} | final ${brief(((await getOn(base, id2)).steps ?? []).map((s: any) => s.text))}`);
    }
  });

  const leftover = (await stageBranches()).filter((b) => !stagesBefore.has(b));
  check('no staging branch left behind by the queue', leftover.length === 0, leftover.join(', '));

  if (!process.env.KEEP_BRANCHES) {
    for (const b of made.reverse()) {
      try {
        const d: any = createClient();
        d.db(config.db);
        await d.deleteBranch(b);
      } catch {
        // best effort
      }
    }
  }
  console.log(failures === 0 ? '\nAll asserted checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
