# TerminusDB MCP Server Implementation Plan

This document outlines the architectural plan and technical specifications for building a self-contained, read-only Model Context Protocol (MCP) server for TerminusDB within [`src/mcp/`](src/mcp/), leveraging existing database utilities in [`src/db/`](src/db/).

## 1. Architectural Objectives

- **Self-Contained Module**: Located entirely within [`src/mcp/`](src/mcp/).
- **Reusability**: Directly reuses connection factories, commit log parsers, and WOQL query builders from [`src/db/client.ts`](src/db/client.ts), [`src/db/log.ts`](src/db/log.ts), and [`src/db/woql-queries.ts`](src/db/woql-queries.ts).
- **Transport**: Stdio transport protocol compatible with Claude Desktop configuration.
- **Read-Only Safety**: Exposes read-only observation tools (listing branches, reading commit history, fetching documents, executing WOQL queries).

## 2. File Structure within [`src/mcp/`](src/mcp/)

```
src/mcp/
├── IMPLEMENTATION_PLAN.md
├── package.json
├── index.ts
└── tools.ts
```

### File Details:
1. [`src/mcp/package.json`](src/mcp/package.json):
   - Dependencies: `@modelcontextprotocol/sdk`, `terminusdb`, `axios`, `dotenv`.
   - Scripts: build and start entry points.
2. [`src/mcp/index.ts`](src/mcp/index.ts):
   - Initializes the MCP `Server` instance from `@modelcontextprotocol/sdk/server/index.js`.
   - Connects to `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.
   - Registers tool handlers and error handling.
3. [`src/mcp/tools.ts`](src/mcp/tools.ts):
   - Implements tool execution logic and JSON schemas.

## 3. Tool Definitions

### Tool 1: `list_branches`
- **Purpose**: Lists all available branches in the TerminusDB database.
- **Input Schema**: Empty or optional database scope.
- **Implementation**: Calls database metadata inspection or [`branchExists()`](src/db/log.ts:63) helpers.

### Tool 2: `read_commit_log`
- **Purpose**: Retrieves the commit audit history for a specified branch.
- **Input Schema**:
  - `branch` (string, optional, default: `"main"`): Branch name.
  - `count` (number, optional): Maximum number of commits to retrieve.
- **Implementation**: Calls [`getCommitLog()`](src/db/log.ts:31) from [`src/db/log.ts`](src/db/log.ts).

### Tool 3: `fetch_document`
- **Purpose**: Fetches document records from the database graph.
- **Input Schema**:
  - `branch` (string, optional, default: `"main"`): Target branch.
  - `id` (string, optional): Specific document ID or IRI.
- **Implementation**: Uses [`createClient()`](src/db/client.ts:19) scoped to the target branch.

### Tool 4: `run_woql_query`
- **Purpose**: Executes WOQL queries (such as graph traversals, cycle detection, or custom queries) against the database.
- **Input Schema**:
  - `query_type` (string): Predefined query name (`"cycle_detection"`, `"blast_radius"`, or `"custom"`).
  - `branch` (string, optional, default: `"main"`): Target branch.
  - `node_iri` (string, optional): Required if running `"blast_radius"`.
- **Implementation**: Uses [`executeWoqlQuery()`](src/db/woql-queries.ts:92) with queries from [`src/db/woql-queries.ts`](src/db/woql-queries.ts).

## 4. Integration with Claude Desktop

Add the server definition to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "terminusdb": {
      "command": "npx",
      "args": [
        "ts-node",
        "c:/Users/Admin/Documents/Dylan/HumanTechTree/src/mcp/index.ts"
      ]
    }
  }
}
```
