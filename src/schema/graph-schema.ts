/**
 * First-pass schema, transcribed from wiki/tech/data-model.md.
 *
 * Deliberately left out for now: Grounding, Review, and Objection.
 * Those depend on policy that's still Open (the Argument Page Format,
 * reviewer permission tiers), so modeling them today would mean
 * guessing at a shape likely to change. Node and Edge alone are enough
 * to prove out the TerminusDB connection, schema push, and basic
 * document CRUD, which is what this first prototype step is testing.
 *
 * Per Data Model: blast radius is NOT a field here. It's always
 * computed from the live graph, never stored.
 */
export const graphSchema = [
  {
    '@type': '@context',
    '@base': `terminusdb:///data/`,
    '@schema': `terminusdb:///schema#`,
  },
  {
    '@type': 'Enum',
    '@id': 'Stage',
    '@value': ['Observation', 'Exploitation', 'Production', 'Explanation'],
  },
  {
    '@type': 'Enum',
    '@id': 'Category',
    '@value': ['Discovery', 'Invention', 'Achievement', 'Disambiguation'],
  },
  {
    '@type': 'Enum',
    '@id': 'RelationshipKind',
    '@value': [
      'MaterialNecessity',
      'ConceptualEnablement',
      'Combination',
      'MereInfluence',
      'Unspecified',
    ],
  },
  {
    '@type': 'Enum',
    '@id': 'Basis',
    '@value': ['HistoricalAttestation', 'LogicalNecessity'],
  },
  {
    '@type': 'Enum',
    '@id': 'Status',
    '@value': ['Ungrounded', 'Red', 'Yellow', 'Green'],
  },
  {
    '@type': 'Class',
    '@id': 'Node',
    '@key': { '@type': 'Random' },
    '@documentation': {
      '@comment':
        'A single discovery, invention, or achievement. See wiki/policy/founding-axioms.md and wiki/policy/achievement-discovery-invention.md.',
    },
    subject: 'xsd:string',
    stage: { '@type': 'Optional', '@class': 'Stage' },
    category: 'Category',
    description: { '@type': 'Optional', '@class': 'xsd:string' },
    // redirect_target is deliberately omitted from this first pass: it's a
    // nullable self-reference used only once Governance's move/merge
    // mechanics are being tested, which is a later prototype step.
  },
  {
    '@type': 'Class',
    '@id': 'Edge',
    '@key': { '@type': 'Random' },
    '@documentation': {
      '@comment':
        'A single claim about an ordered node pair. See wiki/policy/edge-schema.md.',
    },
    source_node: 'Node',
    target_node: 'Node',
    statement: 'xsd:string',
    relationship_kind: 'RelationshipKind',
    basis: { '@type': 'Optional', '@class': 'Basis' },
    origin: { '@type': 'Optional', '@class': 'xsd:string' },
    status: 'Status',
  },
];
