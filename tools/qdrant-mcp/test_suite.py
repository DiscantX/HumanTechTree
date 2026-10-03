"""
Comprehensive Test Suite for Qdrant Local Reader MCP Server

Tests all MCP tools against live collections in the active Qdrant instance.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from server import (
    get_client,
    list_qdrant_collections,
    get_collection_info,
    search_qdrant_points
)

def run_all_tests():
    print("=== RUNNING QDRANT MCP SERVER TEST SUITE ===")
    
    # 1. Test Client Initialization
    client = get_client()
    print("[1/3] Connected to Qdrant client instance.")

    # 2. Test list_qdrant_collections & get_collection_info tools
    collections = list_qdrant_collections()
    print(f"[2/3] list_qdrant_collections() returned {len(collections)} collections:")
    assert len(collections) > 0, "No collections found"
    
    for col in collections:
        info = get_collection_info(col)
        print(f"  - Collection: {col}")
        print(f"    Status: {info['status']}")
        print(f"    Points: {info['points_count']}")
        print(f"    Vector Dimensions: {info['vector_size']}")
        print(f"    Distance Metric: {info['distance']}")
        assert info["points_count"] > 0, f"Collection {col} has 0 points"
        assert info["vector_size"] == 768, f"Expected 768d vector size, got {info['vector_size']}"

    # 3. Test search_qdrant_points tool with real vectors
    print("[3/3] Testing search_qdrant_points() on live collections:")
    for col in collections:
        pts, _ = client.scroll(col, limit=1, with_vectors=True, with_payload=True)
        assert len(pts) > 0, f"No sample point in {col}"
        sample = pts[0]
        query_vec = sample.vector
        
        results = search_qdrant_points(collection_name=col, query_vector=query_vec, limit=3)
        assert len(results) == 3, f"Expected 3 results, got {len(results)}"
        assert results[0]["id"] == sample.id, f"Expected top hit ID {sample.id}, got {results[0]['id']}"
        assert abs(results[0]["score"] - 1.0) < 1e-3, f"Expected score ~ 1.0, got {results[0]['score']}"
        
        print(f"  - Collection {col} Search Results (Top 3):")
        for i, hit in enumerate(results, 1):
            file_path = hit["payload"].get("filePath") if hit["payload"] else "None"
            print(f"    Hit {i}: id={hit['id']}, score={hit['score']:.4f}, file={file_path}")

    print("\n=== ALL MCP TOOLS AND REAL QUERIES PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_all_tests()
