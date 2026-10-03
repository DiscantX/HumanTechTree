"""
Offline tests for the Qdrant Local Reader MCP server logic.

Needs no running Qdrant, Ollama or ZooCode: it builds a small in-memory collection and calls the
tool functions directly. Run with:  python test_offline.py

(test_suite.py is the other kind: it runs the same tools against the live index.
test_mcp_protocol.py starts the server and calls the tools over MCP.)
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

import server

DIM = 4


def chunk(i, path, start, end, text):
    return PointStruct(
        id=i,
        vector=[1.0, float(i % 3), 0.5, 0.1],
        payload={"filePath": path, "startLine": start, "endLine": end, "codeChunk": text, "segmentHash": f"h{i}"},
    )


def make_client() -> QdrantClient:
    c = QdrantClient(":memory:")
    for name in ("mixed", "docs", "code", "empty", "tools_md"):
        c.create_collection(name, vectors_config=VectorParams(size=DIM, distance=Distance.COSINE))
    n = 0
    # mixed: Windows-style stored paths, chunks inserted out of line order
    pts = []
    for start, end, text in [(40, 44, "d\r\ne"), (1, 5, "a\r\nb"), (20, 24, "c"), (60, 64, "f"), (10, 12, "x")]:
        n += 1
        pts.append(chunk(n, "src\\db\\merge-queue.ts", start, end, text))
    for k in range(3):
        n += 1
        pts.append(chunk(n, f"wiki\\tech\\essay{k}.md", 1, 9, "prose"))
    c.upsert("mixed", pts)
    c.upsert("docs", [chunk(100 + k, f"time-travel\\page{k}.md", 1, 9, "p") for k in range(6)])
    c.upsert("code", [chunk(200 + k, f"src/mod{k}.ts", 1, 9, "c") for k in range(6)])
    # a markdown file under tools/ is documentation, not code
    c.upsert("tools_md", [chunk(300 + k, f"tools/qdrant-mcp/README{k}.md", 1, 9, "r") for k in range(6)])
    return c


def run():
    server._client_instance = make_client()
    c = server._client_instance

    # --- classification and labels
    assert server.classify_path("src\\db\\merge-queue.ts") == "code"
    assert server.classify_path("tools/readme.md") == "docs"
    assert server.classify_path("package.lock") == "other"
    labels = {col["name"]: col["label"] for col in server.list_qdrant_collections()}
    assert labels == {"mixed": "mixed", "docs": "docs", "code": "code", "empty": "empty", "tools_md": "docs"}, labels
    comp = {col["name"]: col["composition"] for col in server.list_qdrant_collections()}
    assert comp["mixed"] == {"code": 5, "docs": 3}, comp["mixed"]
    assert server.get_collection_info("mixed")["label"] == "mixed"
    print("ok  labels and composition")

    # --- path filters match either slash style
    for form in ("src\\db\\merge-queue.ts", "src/db/merge-queue.ts"):
        assert server.count_points("mixed", "filePath", form)["count"] == 5, form
        assert len(server.scroll_points("mixed", limit=10, filter_key="filePath", filter_value=form)["points"]) == 5
    assert server.count_points("mixed", "filePath", "src/db/nope.ts")["count"] == 0
    print("ok  slash-insensitive path filters")

    # --- get_file_context
    full = server.get_file_context("mixed", "src/db/merge-queue.ts")
    assert [ch["startLine"] for ch in full["chunks"]] == [1, 10, 20, 40, 60], full["chunks"]
    assert full["total_chunks"] == 5
    assert "\r" not in full["chunks"][0]["text"]
    assert full["gaps"] == [{"from": 6, "to": 9}, {"from": 13, "to": 19}, {"from": 25, "to": 39}, {"from": 45, "to": 59}], full["gaps"]
    near = server.get_file_context("mixed", "src\\db\\merge-queue.ts", line=22, context_lines=5)
    assert [ch["startLine"] for ch in near["chunks"]] == [20], near["chunks"]
    wide = server.get_file_context("mixed", "src/db/merge-queue.ts", line=22, context_lines=20)
    assert [ch["startLine"] for ch in wide["chunks"]] == [1, 10, 20, 40], wide["chunks"]
    capped = server.get_file_context("mixed", "src/db/merge-queue.ts", max_chars=4)
    assert [ch["startLine"] for ch in capped["chunks"]] == [1, 10] and capped["next_start_line"] == 20, capped
    missing = server.get_file_context("mixed", "src/db/missing.ts")
    assert missing["total_chunks"] == 0 and missing["chunks"] == [] and "note" in missing
    print("ok  get_file_context ordering, window, gaps, budget, missing file")

    # --- existing tools still work
    assert len(server.search_qdrant_points("mixed", query_vector=[1.0, 0.0, 0.5, 0.1], limit=3)) == 3
    ids = [p["id"] for p in server.scroll_points("mixed", limit=2)["points"]]
    assert len(server.get_points("mixed", ids)) == 2
    print("ok  search, scroll, get_points")
    print("\nALL OFFLINE TESTS PASSED")


if __name__ == "__main__":
    run()
