# Qdrant Local Reader MCP Server

A lightweight, read-only Model Context Protocol (MCP) server that connects directly to the local Qdrant vector database storage created by ZooCode in `./storage`.

## Setup

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Configure in your Claude Desktop configuration (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "qdrant-local-reader": {
         "command": "python",
         "args": [
           "C:/Users/Admin/Documents/Dylan/HumanTechTree/tools/qdrant-mcp/server.py"
         ]
       }
     }
   }
   ```

## Available Tools

- `list_qdrant_collections`: Lists collections with a label (`code`, `docs`, `mixed`, `empty` or `unknown`), the sampled file-type mix, and the point count. The label comes from a 200-point sample and needs 80% of one kind to be `code` or `docs`.
- `get_collection_info`: Stats, vector dimensions, point count, label and sampled mix for one collection.
- `search_qdrant_points`: Similarity search. Pass `query` (text, embedded with Ollama `nomic-embed-text`) or `query_vector`.
- `get_points`: Fetch points by ID.
- `scroll_points`: Page through points, optionally filtered by one payload key. Results are in point-ID order, not line order.
- `count_points`: Count points, optionally filtered.
- `get_file_context`: All chunks of one file in line order, optionally a window around `line`. Reports `gaps` (lines the indexer did not cover). This is how to read a search hit in context, since the index holds small chunks and is shared and read-only.

Path filters (`filePath`, `path`, `file`) match either slash style, because the indexer stores the platform's native form.

## Tests

Three kinds, for different questions:

- `python test_offline.py`: tool logic against a small in-memory collection. No servers needed.
- `python test_mcp_protocol.py`: starts `server.py` and calls the tools over MCP stdio, as Claude Desktop does. Seeds its own throwaway data; no servers needed (text queries are not covered because they need Ollama).
- `python test_suite.py`: every tool against the live index. Needs Qdrant (and Ollama for text search).
