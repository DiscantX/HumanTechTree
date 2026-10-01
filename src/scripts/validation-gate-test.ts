import { validateGraph, refId } from '../db/validation-gate';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};
const N = (id: string) => ({ '@id': `Node/${id}` });
const E = (id: string, s: string, t: string, extra: any = {}) => ({
  '@id': `Edge/${id}`,
  source_node: `Node/${s}`,
  target_node: `Node/${t}`,
  basis: 'LogicalNecessity',
  ...extra,
});
const kinds = (vs: any[]) => vs.map((v) => v.check).sort().join(',');

const nodes = ['a', 'b', 'c', 'd'].map(N);
check('clean DAG has no violations', validateGraph({ nodes, edges: [E('1', 'a', 'b'), E('2', 'b', 'c'), E('3', 'a', 'c')] }).length === 0);
check('dangling target is found', kinds(validateGraph({ nodes, edges: [E('1', 'a', 'gone')] })) === 'dangling_edge');
check('dangling source is found', kinds(validateGraph({ nodes, edges: [E('1', 'gone', 'a')] })) === 'dangling_edge');
check('self-loop is found once', kinds(validateGraph({ nodes, edges: [E('1', 'a', 'a')] })) === 'self_loop');
check('origin on a logical-necessity edge is found', kinds(validateGraph({ nodes, edges: [E('1', 'a', 'b', { origin: 'Fertile Crescent' })] })) === 'origin_on_necessity');
check(
  'origin on a historical-attestation edge is fine',
  validateGraph({ nodes, edges: [E('1', 'a', 'b', { basis: 'HistoricalAttestation', origin: 'Fertile Crescent' })] }).length === 0,
);
const cyc = validateGraph({ nodes, edges: [E('1', 'a', 'b'), E('2', 'b', 'c'), E('3', 'c', 'a')] });
check('three-node cycle is found', kinds(cyc) === 'cycle' && cyc[0].subjects.length === 3, cyc[0]?.subjects.join(','));
check(
  'a cycle made only of historical-attestation edges is not reported',
  validateGraph({ nodes, edges: [E('1', 'a', 'b', { basis: 'HistoricalAttestation' }), E('2', 'b', 'a', { basis: 'HistoricalAttestation' })] }).length === 0,
);
check(
  'full-IRI and short ids compare equal',
  validateGraph({
    nodes: [{ '@id': 'Node/a' }, { '@id': 'Node/b' }],
    edges: [{ '@id': 'Edge/1', source_node: 'terminusdb:///data/Node/a', target_node: 'Node/b', basis: 'LogicalNecessity' }],
  }).length === 0 && refId('terminusdb:///data/Node/a') === 'Node/a',
);
check('two problems on one edge both report', kinds(validateGraph({ nodes, edges: [E('1', 'a', 'a', { origin: 'x' })] })) === 'origin_on_necessity,self_loop');
console.log(failures === 0 ? '\nAll passed.' : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
