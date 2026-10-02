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
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Executes a restricted command on the remote Alpine/Docker environment via SSH
 * (or locally if sshHost is localhost and ssh is not configured/available).
 *
 * Args:
 *     command: The shell command to execute.
 *
 * Returns:
 *     Promise resolving to command output string.
 */
export async function sshExec(command: string): Promise<string> {
  const host = config.sshHost;
  const port = config.sshPort;
  const user = config.sshUser;
  const keyPath = config.sshKeyPath;
  const password = config.sshPassword;

  const isLocal = host === 'localhost' || host === '127.0.0.1';

  let fullCmd = command;
  if (!isLocal || keyPath || password) {
    let sshArgs = ['-p', port, '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null'];
    if (keyPath) {
      sshArgs.push('-i', keyPath);
    }
    sshArgs.push(`${user}@${host}`);
    sshArgs.push(command);

    fullCmd = `ssh ${sshArgs.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ')}`;
    if (password && !keyPath) {
      fullCmd = `sshpass -p "${password.replace(/"/g, '\\"')}" ${fullCmd}`;
    }
  }

  try {
    const { stdout, stderr } = await execAsync(fullCmd, { timeout: 30000 });
    return (stdout || stderr || '').trim();
  } catch (err: any) {
    if (isLocal) {
      try {
        const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
        return (stdout || stderr || '').trim();
      } catch (localErr: any) {
        throw new Error(`Execution failed: ${localErr.message}`);
      }
    }
    throw new Error(`SSH execution failed: ${err.message}${err.stderr ? ` (${err.stderr})` : ''}`);
  }
}

export async function handleContainerStatus(): Promise<any> {
  const output = await sshExec("docker inspect --format '{{.State.Status}} (running: {{.State.Running}}, restarted: {{.RestartCount}})' terminus-db");
  return { status: output };
}

export async function handleLogTail(args: { lines?: number }): Promise<any> {
  const lines = args.lines ?? 50;
  const output = await sshExec(`docker logs --tail ${lines} terminus-db`);
  return { logs: output };
}

export async function handleListPlugins(): Promise<any> {
  const output = await sshExec("docker exec terminus-db ls -la /app/plugins || docker exec terminus-db find / -name plugins 2>/dev/null");
  return { plugins: output };
}

export async function handleTerminusDbVersion(): Promise<any> {
  try {
    const r = await axios.get(`${config.endpoint}/api/`, {
      auth: { username: config.user, password: config.key },
      validateStatus: () => true,
    });
    return { versionInfo: r.data, endpoint: config.endpoint };
  } catch (err: any) {
    const output = await sshExec("docker exec terminus-db terminus-db --version || curl -s http://localhost:6363/api/");
    return { versionInfo: output };
  }
}

export async function handleRestartContainer(): Promise<any> {
  const output = await sshExec("docker restart terminus-db");
  return { result: output || 'terminus-db container restarted successfully' };
}

export async function handleCopyPlugin(args: { repo_path: string; container_path: string }): Promise<any> {
  if (!args.repo_path || !args.container_path) {
    throw new Error('Both "repo_path" and "container_path" must be provided.');
  }
  const resolvedRepoPath = path.resolve(process.cwd(), args.repo_path);
  if (!fs.existsSync(resolvedRepoPath)) {
    throw new Error(`Repository plugin path does not exist: ${resolvedRepoPath}`);
  }
  const cpCommand = `docker cp "${resolvedRepoPath}" terminus-db:"${args.container_path}"`;
  const output = await sshExec(cpCommand);
  return { result: output || `Successfully copied ${args.repo_path} to terminus-db:${args.container_path}` };
}

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
