import { config } from '../config';
import { createClient } from './client';

/**
 * The validation gate's first checks. The store cannot catch these, so they run
 * on a staging branch before main moves (see Editing Model, "The merge queue").
 *
 *   dangling_edge   an edge endpoint that is not a node on this branch. The store
 *                   refuses this on a direct insert but NOT when a branch lands
 *                   after another branch deleted the node (queue tests Q3a, Q3b).
 *   self_loop       an edge from a node to itself.
 *   origin_on_necessity
 *                   an origin set on a logical-necessity edge, which would escape
 *                   the one-edge-per-pair rule the composite key enforces.
 *   cycle           a cycle among logical-necessity edges (nodes on the cycle are
 *                   reported). Historical-attestation edges are not checked here.
 *
 * Whether a violation hard-blocks a landing or is only flagged for a human is still
 * open in Governance and Moderation. Severity is therefore one table, SEVERITY.
 */
export type CheckName = 'dangling_edge' | 'self_loop' | 'origin_on_necessity' | 'cycle';
export type Severity = 'block' | 'flag';

export const SEVERITY: Record<CheckName, Severity> = {
  dangling_edge: 'block',
  self_loop: 'block',
  origin_on_necessity: 'block',
  cycle: 'block', // open question: block or flag
};

export interface Violation {
  check: CheckName;
  severity: Severity;
  /** Short ids of the edges or nodes involved. */
  subjects: string[];
  message: string;
}

/** Inserted IDs come back as full IRIs while reads return short ones; compare short. */
const shortId = (x: string): string => x.replace(/^terminusdb:\/\/\/data\//, '');
export const refId = (x: any): string => shortId(typeof x === 'string' ? x : x?.['@id'] ?? '');

export interface GraphData {
  nodes: any[];
  edges: any[];
}

export function validateGraph({ nodes, edges }: GraphData): Violation[] {
  const out: Violation[] = [];
  const add = (check: CheckName, subjects: string[], message: string) =>
    out.push({ check, severity: SEVERITY[check], subjects, message });

  const nodeIds = new Set(nodes.map((n) => refId(n['@id'] ?? n)));

  for (const e of edges) {
    const id = refId(e['@id']);
    const s = refId(e.source_node);
    const t = refId(e.target_node);
    if (!nodeIds.has(s)) add('dangling_edge', [id, s], `edge ${id} has a source node that does not exist: ${s}`);
    if (!nodeIds.has(t)) add('dangling_edge', [id, t], `edge ${id} has a target node that does not exist: ${t}`);
    if (s === t) add('self_loop', [id, s], `edge ${id} points from ${s} to itself`);
    if (e.basis === 'LogicalNecessity' && e.origin !== undefined && e.origin !== null && e.origin !== '') {
      add('origin_on_necessity', [id], `logical-necessity edge ${id} has an origin (${e.origin})`);
    }
  }

  // Cycles among logical-necessity edges, by Kahn's algorithm: whatever is left after
  // removing every node with no unprocessed incoming edge is on, or downstream of, a cycle.
  // Self-loops are excluded here because they are reported on their own.
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const e of edges) {
    if (e.basis !== 'LogicalNecessity') continue;
    const s = refId(e.source_node);
    const t = refId(e.target_node);
    if (s === t) continue;
    if (!adj.has(s)) adj.set(s, []);
    adj.get(s)!.push(t);
    indeg.set(t, (indeg.get(t) ?? 0) + 1);
    if (!indeg.has(s)) indeg.set(s, 0);
  }
  const deg = new Map(indeg);
  const ready = [...deg.entries()].filter(([, d]) => d === 0).map(([n]) => n);
  const done = new Set<string>();
  while (ready.length) {
    const n = ready.pop()!;
    done.add(n);
    for (const m of adj.get(n) ?? []) {
      deg.set(m, deg.get(m)! - 1);
      if (deg.get(m) === 0) ready.push(m);
    }
  }
  const stuck = [...indeg.keys()].filter((n) => !done.has(n));
  if (stuck.length > 0) {
    add('cycle', stuck, `logical-necessity cycle, involving or downstream of: ${stuck.join(', ')}`);
  }
  return out;
}

export const blocking = (vs: Violation[]): Violation[] => vs.filter((v) => v.severity === 'block');

/** Reads every Node and Edge on a branch and validates them. */
export async function validateBranch(branch: string): Promise<Violation[]> {
  const c: any = createClient();
  c.db(config.db);
  c.checkout(branch);
  const read = async (type: string): Promise<any[]> => {
    const r = await c.getDocument({ type, as_list: true, count: 100000 });
    return Array.isArray(r) ? r : [];
  };
  return validateGraph({ nodes: await read('Node'), edges: await read('Edge') });
}
