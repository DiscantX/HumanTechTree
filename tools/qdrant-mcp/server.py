"""
Qdrant Local Read-Only MCP Server

Provides a Model Context Protocol (MCP) server for querying and inspecting 
the local Qdrant vector database created and populated by ZooCode.
"""

import os
from typing import Optional
from mcp.server.fastmcp import FastMCP
from qdrant_client import QdrantClient

# Initialize FastMCP server
mcp = FastMCP("Qdrant Local Reader")

# Server URL (Zoo runs Qdrant on port 6333) and local storage path fallback
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
STORAGE_PATH = os.environ.get(
    "QDRANT_STORAGE_PATH", 
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../storage"))
)

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

@mcp.tool()
def list_qdrant_collections() -> list[str]:
    """List all vector collections available in the local Qdrant store.
    
    Returns:
        List of collection names found in the Qdrant database.
    """
    client = get_client()
    collections = client.get_collections()
    return [col.name for col in collections.collections]

@mcp.tool()
def get_collection_info(collection_name: str) -> dict:
    """Get metadata and statistics for a specific Qdrant collection.
    
    Args:
        collection_name: Name of the collection to inspect.
        
    Returns:
        Dictionary containing vector size, distance metric, and point count.
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

    return {
        "status": str(info.status),
        "points_count": info.points_count,
        "indexed_vectors_count": getattr(info, "indexed_vectors_count", 0),
        "vector_size": vector_size,
        "distance": distance,
    }

@mcp.tool()
def search_qdrant_points(collection_name: str, query_vector: list[float], limit: int = 5) -> list[dict]:
    """Perform a vector similarity search against a specific Qdrant collection.
    
    Args:
        collection_name: Name of the collection to search in.
        query_vector: The floating-point embedding vector to search with.
        limit: Maximum number of matching points to return (default: 5).
        
    Returns:
        List of matching points with IDs, scores, and payloads.
    """
    client = get_client()
    if hasattr(client, "query_points"):
        res = client.query_points(
            collection_name=collection_name,
            query=query_vector,
            limit=limit,
            with_payload=True
        )
        points = res.points
    else:
        points = client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=limit,
            with_payload=True
        )

    return [
        {
            "id": hit.id,
            "score": hit.score,
            "payload": hit.payload
        }
        for hit in points
    ]

if __name__ == "__main__":
    mcp.run()
