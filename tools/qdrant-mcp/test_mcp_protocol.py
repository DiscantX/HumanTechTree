"""
Protocol-level test: starts server.py as a subprocess and calls its tools over MCP (stdio), the same
way Claude Desktop does. This checks tool registration, argument schemas and JSON results.

It needs no running Qdrant or Ollama: it seeds a throwaway local-storage Qdrant directory and points
the server at it (QDRANT_URL is set empty so the server uses the local path). Text queries are not
tested here because they need Ollama. Run with:  python test_mcp_protocol.py

(test_offline.py calls the functions directly; test_suite.py runs against the live index.)
"""

import asyncio
import json
import os
import sys
import tempfile

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

HERE = os.path.dirname(os.path.abspath(__file__))
EXPECTED_TOOLS = {
    "list_qdrant_collections",
    "get_collection_info",
    "search_qdrant_points",
    "get_points",
    "scroll_points",
    "count_points",
    "get_file_context",
}


def seed(path: str) -> None:
    c = QdrantClient(path=path)
    c.create_collection("project", vectors_config=VectorParams(size=4, distance=Distance.COSINE))
    pts = [
        PointStruct(id=i + 1, vector=[1.0, 0.0, float(i), 0.1], payload={
            "filePath": "src\\db\\a.ts", "startLine": s, "endLine": e, "codeChunk": f"chunk {s}-{e}"})
        for i, (s, e) in enumerate([(30, 34), (1, 5), (10, 14)])
    ]
    pts.append(PointStruct(id=9, vector=[0.0, 1.0, 0.0, 0.1], payload={
        "filePath": "wiki\\x.md", "startLine": 1, "endLine": 3, "codeChunk": "prose"}))
    c.upsert("project", pts)
    c.close()


def payload(result):
    """The tool result as Python data (structured content if present, else the JSON text blocks)."""
    sc = getattr(result, "structuredContent", None)
    if sc:
        return sc.get("result", sc)
    blocks = [json.loads(b.text) for b in result.content if getattr(b, "text", None)]
    return blocks if len(blocks) != 1 else blocks[0]


async def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        seed(tmp)
        env = {**os.environ, "QDRANT_URL": "", "QDRANT_STORAGE_PATH": tmp}
        params = StdioServerParameters(command=sys.executable, args=[os.path.join(HERE, "server.py")], env=env)
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()

                tools = {t.name: t for t in (await session.list_tools()).tools}
                assert set(tools) == EXPECTED_TOOLS, set(tools) ^ EXPECTED_TOOLS
                props = tools["search_qdrant_points"].inputSchema["properties"]
                assert "query" in props and "query_vector" in props
                print(f"ok  list_tools: {sorted(tools)}")

                cols = payload(await session.call_tool("list_qdrant_collections", {}))
                cols = cols if isinstance(cols, list) else [cols]
                assert cols[0]["name"] == "project" and cols[0]["label"] == "mixed", cols
                print(f"ok  list_qdrant_collections: {cols[0]}")

                cnt = payload(await session.call_tool(
                    "count_points", {"collection_name": "project", "filter_key": "filePath", "filter_value": "src/db/a.ts"}))
                assert cnt["count"] == 3, cnt
                print("ok  count_points with forward-slash path")

                ctx = payload(await session.call_tool(
                    "get_file_context", {"collection_name": "project", "file_path": "src/db/a.ts"}))
                assert [c["startLine"] for c in ctx["chunks"]] == [1, 10, 30], ctx
                print("ok  get_file_context returns chunks in line order")

                hits = payload(await session.call_tool(
                    "search_qdrant_points", {"collection_name": "project", "query_vector": [1.0, 0.0, 0.0, 0.1], "limit": 2}))
                hits = hits if isinstance(hits, list) else [hits]
                assert len(hits) == 2, hits
                ids = [hits[0]["id"]]
                got = payload(await session.call_tool("get_points", {"collection_name": "project", "ids": ids}))
                got = got if isinstance(got, list) else [got]
                assert got[0]["id"] == ids[0]
                sc = payload(await session.call_tool("scroll_points", {"collection_name": "project", "limit": 2}))
                assert len(sc["points"]) == 2
                print("ok  search_qdrant_points (vector), get_points, scroll_points")

    print("\nALL MCP PROTOCOL TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
