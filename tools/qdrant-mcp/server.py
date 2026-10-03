"""
Qdrant Local Read-Only MCP Server

Provides a Model Context Protocol (MCP) server for querying and inspecting 
the local Qdrant vector database created and populated by ZooCode.
"""

import os
import requests
from typing import Optional, Union, Any
from mcp.server.fastmcp import FastMCP
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

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


def infer_collection_label(client: QdrantClient, collection_name: str) -> str:
    """Infers whether a collection primarily contains 'code', 'docs', or 'unknown' by inspecting sample payloads."""
    try:
        pts, _ = client.scroll(collection_name=collection_name, limit=5, with_payload=True)
        if not pts:
            return "empty"
        for pt in pts:
            if not pt.payload:
                continue
            payload_str = str(pt.payload).lower()
            file_path = str(
                pt.payload.get("filePath") 
                or pt.payload.get("path") 
                or pt.payload.get("file") 
                or ""
            ).lower()
            
            if any(file_path.endswith(ext) for ext in [".ts", ".js", ".py", ".json", ".rs", ".go", ".c", ".cpp"]):
                return "code"
            if any(prefix in file_path for prefix in ["src/", "lib/", "tools/"]):
                return "code"
            if any(file_path.endswith(ext) for ext in [".md", ".txt", ".rst", ".doc", ".docx", ".pdf"]):
                return "docs"
            if any(prefix in file_path for prefix in ["wiki/", "docs/", "readme"]):
                return "docs"
            if "code" in payload_str or "function" in payload_str or "class" in payload_str:
                return "code"
            if "document" in payload_str or "section" in payload_str or "markdown" in payload_str:
                return "docs"
        return "unknown"
    except Exception:
        return "unknown"


@mcp.tool()
def list_qdrant_collections() -> list[dict]:
    """List all vector collections available in the local Qdrant store with human-readable labels.
    
    Returns:
        List of dictionaries containing collection name, label ('code'/'docs'), and point count.
    """
    client = get_client()
    collections = client.get_collections()
    results = []
    for col in collections.collections:
        info = client.get_collection(col.name)
        label = infer_collection_label(client, col.name)
        results.append({
            "name": col.name,
            "label": label,
            "points_count": info.points_count
        })
    return results


@mcp.tool()
def get_collection_info(collection_name: str) -> dict:
    """Get metadata, human label, and statistics for a specific Qdrant collection.
    
    Args:
        collection_name: Name of the collection to inspect.
        
    Returns:
        Dictionary containing vector size, distance metric, point count, and label ('code'/'docs').
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

    label = infer_collection_label(client, collection_name)

    return {
        "status": str(info.status),
        "label": label,
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
        filter_value: Optional payload string value to match.
        truncate_length: Maximum length for text fields in payloads (default: 500).
        
    Returns:
        Dictionary with list of points and next_page_offset cursor.
    """
    client = get_client()
    scroll_filter = None
    if filter_key and filter_value is not None:
        scroll_filter = Filter(
            must=[
                FieldCondition(
                    key=filter_key,
                    match=MatchValue(value=filter_value)
                )
            ]
        )

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
    count_filter = None
    if filter_key and filter_value is not None:
        count_filter = Filter(
            must=[
                FieldCondition(
                    key=filter_key,
                    match=MatchValue(value=filter_value)
                )
            ]
        )

    res = client.count(
        collection_name=collection_name,
        count_filter=count_filter,
        exact=True
    )

    return {"count": res.count}


if __name__ == "__main__":
    mcp.run()
