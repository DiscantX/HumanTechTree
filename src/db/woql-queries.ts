import TerminusClient from 'terminusdb';

const WOQL = TerminusClient.WOQL;

/**
 * Module providing server-side WOQL graph traversal queries for cycle detection
 * and blast radius calculations, replacing client-side in-memory map traversals.
 */

/**
 * Builds a WOQL query to detect cycles among logical-necessity edges.
 *
 * Traverses edges where basis is LogicalNecessity, following source_node and
 * target_node connections to find any path that loops back to its source node.
 *
 * Returns:
 *     Configured WOQL query object.
 */
export function cycleDetectionQuery() {
  return WOQL.and(
    WOQL.triple('v:Edge', 'rdf:type', '@schema:Edge'),
    WOQL.triple('v:Edge', '@schema:basis', '@schema:Basis/LogicalNecessity'),
    WOQL.triple('v:Edge', '@schema:source_node', 'v:Source'),
    WOQL.triple('v:Edge', '@schema:target_node', 'v:Target'),
    WOQL.path(
      'v:Source',
      '(<@schema:source_node,@schema:target_node>)+',
      'v:Source',
      'v:Path',
    ),
  );
}

/**
 * Builds a WOQL query to calculate the blast radius (transitive descendants count).
 *
 * Traverses outward from a given root node IRI across all edge relationships
 * to compute reachable downstream descendant nodes on the server.
 *
 * Args:
 *     nodeIri: Full IRI or short ID of the root node (e.g., "terminusdb:///data/Node_123").
 *
 * Returns:
 *     Configured WOQL query object.
 */
export function blastRadiusQuery(nodeIri: string) {
  return WOQL.select('v:Descendant')
    .distinct('v:Descendant')
    .path(
      nodeIri,
      '(<@schema:source_node,@schema:target_node>)+',
      'v:Descendant',
      'v:Path',
    );
}

/**
 * Executes a WOQL query against the specified client, database, and branch.
 *
 * Args:
 *     client: Configured TerminusDB WOQLClient instance.
 *     query: WOQL query object to execute.
 *     branch: Target branch name (defaults to "main").
 *
 * Returns:
 *     Promise resolving to query results bindings.
 */
export async function executeWoqlQuery(
  client: any,
  query: any,
  branch: string = 'main',
): Promise<any[]> {
  client.checkout(branch);
  const result = await client.query(query);
  return result?.bindings ?? [];
}
