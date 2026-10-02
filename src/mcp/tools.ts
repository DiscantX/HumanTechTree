/**
 * Module providing MCP tool definitions and handlers for TerminusDB.
 *
 * Implements read-only database tools: list_branches, read_commit_log,
 * fetch_document, and run_woql_query, reusing [`src/db/client.ts`](src/db/client.ts),
 * [`src/db/log.ts`](src/db/log.ts), and [`src/db/woql-queries.ts`](src/db/woql-queries.ts).
 */

import { createClient } from '../db/client';
import { getCommitLog } from '../db/log';
import { executeWoqlQuery, cycleDetectionQuery, blastRadiusQuery } from '../db/woql-queries';
import { config } from '../config';
import axios from 'axios';

/**
 * Lists all active branches in the configured TerminusDB database.
 *
 * Args:
 *     None.
 *
 * Returns:
 *     Promise resolving to an array of branch names.
 */
export async function handleListBranches(): Promise<string[]> {
  try {
    const r = await axios.get(
      `${config.endpoint}/api/db/${config.organization}/${config.db}`,
      {
        params: { branches: true },
        auth: { username: config.user, password: config.key },
        validateStatus: () => true,
      },
    );
    if (r.status === 200 && r.data && Array.isArray(r.data.branches)) {
      return r.data.branches as string[];
    }
    return ['main'];
  } catch {
    return ['main'];
  }
}

/**
 * Retrieves the commit audit log for a specified branch.
 *
 * Args:
 *     args: Object containing branch name and optional count limit.
 *
 * Returns:
 *     Promise resolving to array of commit info objects.
 */
export async function handleReadCommitLog(args: {
  branch?: string;
  count?: number;
}): Promise<any> {
  const branch = args.branch ?? 'main';
  const count = args.count ?? 50;
  const log = await getCommitLog(branch, { count });
  return log ?? [];
}

/**
 * Fetches documents or a specific document from a TerminusDB branch.
 *
 * Args:
 *     args: Object containing branch name, optional document ID, or document type.
 *
 * Returns:
 *     Promise resolving to retrieved document or list of documents.
 */
export async function handleFetchDocument(args: {
  branch?: string;
  id?: string;
  type?: string;
}): Promise<any> {
  const branch = args.branch ?? 'main';
  const client = createClient();
  client.db(config.db);
  client.checkout(branch);

  if (args.id) {
    return await client.getDocument({ id: args.id });
  } else if (args.type) {
    const res = await client.getDocument({ type: args.type, as_list: true, count: 1000 });
    return Array.isArray(res) ? res : [res];
  } else {
    throw new Error('Either "id" or "type" must be provided to fetch documents.');
  }
}

/**
 * Executes a WOQL query or preset analysis against a TerminusDB branch.
 *
 * Args:
 *     args: Object containing query type, branch, and optional parameters (like node_iri).
 *
 * Returns:
 *     Promise resolving to query bindings array.
 */
export async function handleRunWoqlQuery(args: {
  query_type: string;
  branch?: string;
  node_iri?: string;
}): Promise<any> {
  const branch = args.branch ?? 'main';
  const client = createClient();
  client.db(config.db);

  let query: any;
  if (args.query_type === 'cycle_detection') {
    query = cycleDetectionQuery();
  } else if (args.query_type === 'blast_radius') {
    if (!args.node_iri) {
      throw new Error('node_iri is required for blast_radius query.');
    }
    query = blastRadiusQuery(args.node_iri);
  } else {
    throw new Error(`Unknown query_type: ${args.query_type}. Supported: "cycle_detection", "blast_radius".`);
  }

  return await executeWoqlQuery(client, query, branch);
}
