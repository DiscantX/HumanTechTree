/**
 * Entry point for the TerminusDB Model Context Protocol (MCP) server.
 *
 * Runs over stdio transport, exposing read-only tools for branch listing,
 * commit log auditing, document fetching, and WOQL query execution by wrapping
 * helper functions defined in [`src/mcp/tools.ts`](src/mcp/tools.ts).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  handleListBranches,
  handleReadCommitLog,
  handleFetchDocument,
  handleRunWoqlQuery,
  handleContainerStatus,
  handleLogTail,
  handleListPlugins,
  handleTerminusDbVersion,
  handleRestartContainer,
  handleCopyPlugin,
} from './tools';

/**
 * Initializes and starts the TerminusDB MCP server.
 *
 * Returns:
 *     Promise resolving when the server is running and listening on stdio.
 */
async function main() {
  const server = new Server(
    {
      name: 'terminusdb-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_branches',
          description: 'List all active branches in the TerminusDB database.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'read_commit_log',
          description: 'Retrieve the commit audit log for a specified branch.',
          inputSchema: {
            type: 'object',
            properties: {
              branch: {
                type: 'string',
                description: 'Name of the branch (default: "main").',
              },
              count: {
                type: 'number',
                description: 'Maximum number of commits to retrieve (default: 50).',
              },
            },
          },
        },
        {
          name: 'fetch_document',
          description: 'Fetch document records or a specific document by ID from a branch.',
          inputSchema: {
            type: 'object',
            properties: {
              branch: {
                type: 'string',
                description: 'Name of the branch (default: "main").',
              },
              id: {
                type: 'string',
                description: 'Specific document ID or IRI to fetch.',
              },
              type: {
                type: 'string',
                description: 'Document class type to list documents for.',
              },
            },
          },
        },
        {
          name: 'run_woql_query',
          description: 'Execute preset WOQL graph queries (cycle_detection, blast_radius) against a branch.',
          inputSchema: {
            type: 'object',
            properties: {
              query_type: {
                type: 'string',
                description: 'Preset query type: "cycle_detection" or "blast_radius".',
              },
              branch: {
                type: 'string',
                description: 'Name of the branch (default: "main").',
              },
              node_iri: {
                type: 'string',
                description: 'Root node IRI required for blast_radius query.',
              },
            },
            required: ['query_type'],
          },
        },
        {
          name: 'container_status',
          description: 'Get status of the TerminusDB Docker container.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'log_tail',
          description: 'Retrieve a bounded log tail from the TerminusDB Docker container.',
          inputSchema: {
            type: 'object',
            properties: {
              lines: {
                type: 'number',
                description: 'Number of lines to tail (default: 50).',
              },
            },
          },
        },
        {
          name: 'list_plugins',
          description: 'List files in the TerminusDB plugins directory inside the container.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'terminusdb_version',
          description: 'Get TerminusDB reported server version.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'restart_container',
          description: 'Restart the TerminusDB Docker container.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'copy_plugin',
          description: 'Copy a plugin file from a repository path into the TerminusDB container.',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to the plugin file in the repository.',
              },
              container_path: {
                type: 'string',
                description: 'Destination path inside the container.',
              },
            },
            required: ['repo_path', 'container_path'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args ?? {}) as Record<string, any>;

    try {
      let result: any;
      switch (name) {
        case 'list_branches':
          result = await handleListBranches();
          break;
        case 'read_commit_log':
          result = await handleReadCommitLog(toolArgs);
          break;
        case 'fetch_document':
          result = await handleFetchDocument(toolArgs);
          break;
        case 'run_woql_query':
          result = await handleRunWoqlQuery(toolArgs as any);
          break;
        case 'container_status':
          result = await handleContainerStatus();
          break;
        case 'log_tail':
          result = await handleLogTail(toolArgs);
          break;
        case 'list_plugins':
          result = await handleListPlugins();
          break;
        case 'terminusdb_version':
          result = await handleTerminusDbVersion();
          break;
        case 'restart_container':
          result = await handleRestartContainer();
          break;
        case 'copy_plugin':
          result = await handleCopyPlugin(toolArgs as any);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${err?.message ?? err}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TerminusDB MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error in MCP server:', err);
  process.exit(1);
});
