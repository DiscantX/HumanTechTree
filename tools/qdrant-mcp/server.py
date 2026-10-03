"""
Qdrant Local Read-Only MCP Server

Provides a Model Context Protocol (MCP) server for querying and inspecting 
the local Qdrant vector database created and populated by ZooCode.
"""

import os
import requests
from collections import Counter
from typing import Optional, Union, Any
from mcp.server.fastmcp import FastMCP
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny

# Initialize FastMCP server
mcp = FastMCP("Qdrant Local Reader")

# Server URL (Zoo runs Qdrant on port 6333) and local storage path fallback
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
STORAGE_PATH = os.environ.get(
    "QDRANT_STORAGE_PATH", 
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../storage"))
)

# Local Ollama embedding configuration
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text")

_client_instance: Optional[QdrantClient] = None


def get_client() -> QdrantClient:
    """Initializes and caches a Qdrant client, prioritizing active server over local storage lock."""
    global _client_instance
    if _client_instance is not None:
        return _client_instance

    if QDRANT_URL:
        try:
            client = QdrantClient(url=QDRANT_URL, timeout=3)
            # Verify connectivity to active server
            client.get_collections()
            _client_instance = client
            return _client_instance
        except Exception:
            pass

    if os.path.exists(STORAGE_PATH):
        _client_instance = QdrantClient(path=STORAGE_PATH)
        return _client_instance

    raise RuntimeError(f"Could not connect to Qdrant at {QDRANT_URL} or local directory {STORAGE_PATH}")


def get_embedding(text: str) -> list[float]:
    """Generates a text embedding vector using the local Ollama service."""
    url = f"{OLLAMA_URL.rstrip('/')}/api/embeddings"
    payload = {"model": EMBEDDING_MODEL, "prompt": text}
    try:
        response = requests.post(url, json=payload, timeout=15)
        response.raise_for_status()
        data = response.json()
        if "embedding" in data:
            return data["embedding"]
        raise ValueError(f"Unexpected response structure from Ollama: {data}")
    except Exception as e:
        raise RuntimeError(f"Failed to generate embedding via Ollama at {url}: {e}")


def truncate_payload(payload: Any, max_len: Optional[int] = 500) -> Any:
    """Recursively truncates string values in payloads to max_len characters."""
    if not payload or max_len is None:
        return payload
    if isinstance(payload, str):
        if len(payload) > max_len:
            return payload[:max_len] + f"... [truncated {len(payload) - max_len} chars]"
        return payload
    elif isinstance(payload, dict):
        return {k: truncate_payload(v, max_len) for k, v in payload.items()}
    elif isinstance(payload, list):
        return [truncate_payload(v, max_len) for v in payload]
    return payload


PATH_KEYS = ("filePath", "path", "file")
DOC_EXTS = (".md", ".txt", ".rst", ".doc", ".docx", ".pdf")
CODE_EXTS = (".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".c", ".cpp", ".h", ".java", ".sh")
LABEL_SAMPLE_SIZE = 200
LABEL_DOMINANCE = 0.8


def payload_path(payload: Optional[dict]) -> str:
    """Returns the file path stored in a point payload, or an empty string."""
    for key in PATH_KEYS:
        value = (payload or {}).get(key)
        if value:
            return str(value)
    return ""


def classify_path(file_path: str) -> str:
    """Classifies one stored path as 'docs', 'code' or 'other', by extension only.

    Extension is decisive: a markdown file under tools/ is still documentation.
    """
    p = file_path.replace("\\", "/").lower()
    if p.endswith(DOC_EXTS):
        return "docs"
    if p.endswith(CODE_EXTS):
        return "code"
    return "other"


def collection_composition(client: QdrantClient, collection_name: str) -> dict:
    """Samples up to LABEL_SAMPLE_SIZE points and reports a label plus the sampled mix.

    The label is 'code' or 'docs' when one kind makes up at least 80% of the classifiable
    sample, 'mixed' otherwise, 'empty' for an empty collection and 'unknown' when no path
    could be classified. The sample is in point-ID order (effectively random), not exhaustive.
    """
    try:
        pts, _ = client.scroll(
            collection_name=collection_name,
            limit=LABEL_SAMPLE_SIZE,
            with_payload=list(PATH_KEYS),
            with_vectors=False,
        )
        if not pts:
            return {"label": "empty", "sampled": 0, "mix": {}}
        counts = Counter(classify_path(payload_path(pt.payload)) for pt in pts)
        mix = dict(counts)
        classifiable = counts["code"] + counts["docs"]
        if classifiable == 0:
            return {"label": "unknown", "sampled": len(pts), "mix": mix}
        top, n = max(("code", counts["code"]), ("docs", counts["docs"]), key=lambda kv: kv[1])
        label = top if n / classifiable >= LABEL_DOMINANCE else "mixed"
        return {"label": label, "sampled": len(pts), "mix": mix}
    except Exception:
        return {"label": "unknown", "sampled": 0, "mix": {}}


def infer_collection_label(client: QdrantClient, collection_name: str) -> str:
    """Infers 'code', 'docs', 'mixed', 'empty' or 'unknown' for a collection from a payload sample."""
    return collection_composition(client, collection_name)["label"]


def path_variants(value: str) -> list[str]:
    """Both slash styles of a path. The indexer stores the platform's native form (backslashes on Windows)."""
    forward = value.replace("\\", "/")
    return list(dict.fromkeys([value, forward, forward.replace("/", "\\")]))


def payload_filter(filter_key: Optional[str], filter_value: Optional[str]) -> Optional[Filter]:
    """Exact-match payload filter. Path-like keys match either slash style."""
    if not filter_key or filter_value is None:
        return None
    if filter_key in PATH_KEYS:
        condition = FieldCondition(key=filter_key, match=MatchAny(any=path_variants(filter_value)))
    else:
        condition = FieldCondition(key=filter_key, match=MatchValue(value=filter_value))
    return Filter(must=[condition])


@mcp.tool()
def list_qdrant_collections() -> list[dict]:
    """List all vector collections available in the local Qdrant store with human-readable labels.
    
    Returns:
        List of dictionaries with collection name, label ('code', 'docs', 'mixed', 'empty' or 'unknown'),
        the sampled file-type mix, and point count.
    """
    client = get_client()
    collections = client.get_collections()
    results = []
    for col in collections.collections:
        info = client.get_collection(col.name)
        comp = collection_composition(client, col.name)
        results.append({
            "name": col.name,
            "label": comp["label"],
            "composition": comp["mix"],
            "points_count": info.points_count
        })
    return results


@mcp.tool()
def get_collection_info(collection_name: str) -> dict:
    """Get metadata, human label, and statistics for a specific Qdrant collection.
    
    Args:
        collection_name: Name of the collection to inspect.
        
    Returns:
        Dictionary containing vector size, distance metric, point count, and label ('code', 'docs', 'mixed', 'empty' or 'unknown'),
        and the sampled file-type mix.
    """
    client = get_client()
    info = client.get_collection(collection_name)
    vectors_config = info.config.params.vectors
    vector_size = None
    distance = None
    if vectors_config is not None:
        if hasattr(vectors_config, "size"):
            vector_size = vectors_config.size
            distance = str(vectors_config.distance)
        elif isinstance(vectors_config, dict):
            vector_size = {k: v.size for k, v in vectors_config.items()}
            distance = {k: str(v.distance) for k, v in vectors_config.items()}

    comp = collection_composition(client, collection_name)

    return {
        "status": str(info.status),
        "label": comp["label"],
        "composition": comp["mix"],
        "points_count": info.points_count,
        "indexed_vectors_count": getattr(info, "indexed_vectors_count", 0),
        "vector_size": vector_size,
        "distance": distance,
    }


@mcp.tool()
def search_qdrant_points(
    collection_name: str,
    query: Optional[str] = None,
    query_vector: Optional[list[float]] = None,
    limit: int = 5,
    score_threshold: Optional[float] = None,
    truncate_length: Optional[int] = 500
) -> list[dict]:
    """Perform a vector similarity search against a specific Qdrant collection using natural language text or raw vector.
    
    Args:
        collection_name: Name of the collection to search in.
        query: Natural language query string (embedded server-side via Ollama nomic-embed-text).
        query_vector: Optional raw floating-point embedding vector fallback.
        limit: Maximum number of matching points to return (default: 5).
        score_threshold: Minimum similarity score threshold for returned results.
        truncate_length: Maximum length for text fields in returned payloads (default: 500).
        
    Returns:
        List of matching points with IDs, scores, and truncated payloads.
    """
    client = get_client()
    
    if query:
        vector = get_embedding(query)
    elif query_vector:
        vector = query_vector
    else:
        raise ValueError("Must provide either 'query' text string or 'query_vector' list.")

    kwargs = {
        "collection_name": collection_name,
        "limit": limit,
        "with_payload": True
    }
    if score_threshold is not None:
        kwargs["score_threshold"] = score_threshold

    if hasattr(client, "query_points"):
        res = client.query_points(query=vector, **kwargs)
        points = res.points
    else:
        points = client.search(query_vector=vector, **kwargs)

    return [
        {
            "id": hit.id,
            "score": hit.score,
            "payload": truncate_payload(hit.payload, max_len=truncate_length)
        }
        for hit in points
    ]


@mcp.tool()
def get_points(
    collection_name: str,
    ids: list[Union[str, int]],
    truncate_length: Optional[int] = 500
) -> list[dict]:
    """Retrieve specific points and their payloads by point ID(s).
    
    Args:
        collection_name: Name of the collection.
        ids: List of point IDs (UUIDs or integers) to fetch.
        truncate_length: Maximum length for text fields in payloads (default: 500).
        
    Returns:
        List of points with ID and payload.
    """
    client = get_client()
    pts = client.retrieve(
        collection_name=collection_name,
        ids=ids,
        with_payload=True,
        with_vectors=False
    )
    return [
        {
            "id": pt.id,
            "payload": truncate_payload(pt.payload, max_len=truncate_length)
        }
        for pt in pts
    ]


@mcp.tool()
def scroll_points(
    collection_name: str,
    limit: int = 10,
    offset: Optional[Union[str, int]] = None,
    filter_key: Optional[str] = None,
    filter_value: Optional[str] = None,
    truncate_length: Optional[int] = 500
) -> dict:
    """Pages through points in a collection with optional exact payload filtering.
    
    Args:
        collection_name: Name of the collection.
        limit: Number of points to return (default: 10).
        offset: Pagination offset cursor from previous scroll call.
        filter_key: Optional payload key to filter by (e.g., 'filePath').
        filter_value: Optional payload string value to match. For path keys (filePath, path,
            file) either slash style matches.
        truncate_length: Maximum length for text fields in payloads (default: 500).
        
    Returns:
        Dictionary with list of points and next_page_offset cursor.
    """
    client = get_client()
    scroll_filter = payload_filter(filter_key, filter_value)

    pts, next_offset = client.scroll(
        collection_name=collection_name,
        limit=limit,
        offset=offset,
        scroll_filter=scroll_filter,
        with_payload=True,
        with_vectors=False
    )

    return {
        "points": [
            {
                "id": pt.id,
                "payload": truncate_payload(pt.payload, max_len=truncate_length)
            }
            for pt in pts
        ],
        "next_page_offset": str(next_offset) if next_offset is not None else None
    }


@mcp.tool()
def count_points(
    collection_name: str,
    filter_key: Optional[str] = None,
    filter_value: Optional[str] = None
) -> dict:
    """Returns total count of points in a collection with optional payload filtering.
    
    Args:
        collection_name: Name of the collection.
        filter_key: Optional payload key to filter by.
        filter_value: Optional payload string value to match.
        
    Returns:
        Dictionary containing 'count'.
    """
    client = get_client()
    count_filter = payload_filter(filter_key, filter_value)

    res = client.count(
        collection_name=collection_name,
        count_filter=count_filter,
        exact=True
    )

    return {"count": res.count}


@mcp.tool()
def get_file_context(
    collection_name: str,
    file_path: str,
    line: Optional[int] = None,
    context_lines: int = 30,
    max_chars: int = 6000
) -> dict:
    """Returns the indexed chunks of one file in line order, optionally around a line.

    The indexer stores small chunks, and scroll_points returns them in point-ID order. This tool
    gathers every chunk of a file, sorts them by start line and returns a contiguous window, so
    a search hit can be read in context without changing the shared index. Text is not truncated;
    max_chars bounds the response instead.

    Args:
        collection_name: Name of the collection.
        file_path: Stored path of the file. Forward or back slashes both match.
        line: Optional line to centre on (for example a search hit's startLine). Omit to read
            from the top of the file.
        context_lines: Lines before and after `line` to include (default: 30). Ignored when
            `line` is omitted.
        max_chars: Maximum characters of chunk text to return (default: 6000).

    Returns:
        Dictionary with the chunks in line order (id, startLine, endLine, text), `gaps` (line
        ranges inside the window that no chunk covers, so the indexer skipped them and the repo
        file must be read for those lines), `total_chunks`, and, when the budget cut the window
        short, `next_start_line` to continue from.
    """
    client = get_client()
    flt = payload_filter("filePath", file_path)
    found: list[Any] = []
    offset = None
    while len(found) < 5000:
        pts, offset = client.scroll(
            collection_name=collection_name,
            limit=256,
            offset=offset,
            scroll_filter=flt,
            with_payload=True,
            with_vectors=False,
        )
        found.extend(pts)
        if offset is None:
            break

    chunks = []
    seen = set()
    for pt in found:
        pl = pt.payload or {}
        start, end = pl.get("startLine"), pl.get("endLine")
        text = pl.get("codeChunk") or pl.get("text") or pl.get("content") or ""
        key = (start, end, pl.get("segmentHash") or text)
        if start is None or end is None or key in seen:
            continue
        seen.add(key)
        chunks.append({"id": pt.id, "startLine": start, "endLine": end, "text": text.replace("\r\n", "\n").replace("\r", "")})
    chunks.sort(key=lambda c: (c["startLine"], c["endLine"]))

    if not chunks:
        return {
            "file_path": file_path,
            "total_chunks": 0,
            "chunks": [],
            "gaps": [],
            "note": "No chunks found for this path. Use scroll_points without a filter to see how paths are stored.",
        }

    total = len(chunks)
    if line is not None:
        lo, hi = line - context_lines, line + context_lines
        chunks = [c for c in chunks if c["endLine"] >= lo and c["startLine"] <= hi]

    picked, used, next_start = [], 0, None
    for c in chunks:
        if picked and used + len(c["text"]) > max_chars:
            next_start = c["startLine"]
            break
        picked.append(c)
        used += len(c["text"])

    gaps = [
        {"from": a["endLine"] + 1, "to": b["startLine"] - 1}
        for a, b in zip(picked, picked[1:])
        if b["startLine"] > a["endLine"] + 1
    ]
    result = {"file_path": file_path, "total_chunks": total, "chunks": picked, "gaps": gaps}
    if next_start is not None:
        result["next_start_line"] = next_start
    return result


if __name__ == "__main__":
    mcp.run()
