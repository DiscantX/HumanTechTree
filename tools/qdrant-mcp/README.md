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

- `list_qdrant_collections`: Lists all available vector collections in the `./storage` directory.
- `get_collection_info`: Retrieves stats, vector dimensions, and point count for a given collection.
- `search_qdrant_points`: Performs vector similarity search against a collection using a query embedding vector.
