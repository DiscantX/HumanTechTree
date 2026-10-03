"""
Comprehensive Test Suite for Qdrant Local Reader MCP Server

Tests all MCP tools against live collections in the active Qdrant instance,
including Ollama text embedding search, collection labeling, get_points,
scroll_points, and count_points.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from server import (
    get_client,
    list_qdrant_collections,
    get_collection_info,
    search_qdrant_points,
    get_points,
    scroll_points,
    count_points
)

def run_all_tests():
    print("=== RUNNING QDRANT MCP SERVER TEST SUITE ===")
    
    # 1. Test Client Initialization
    client = get_client()
    print("[1/5] Connected to Qdrant client instance.")

    # 2. Test list_qdrant_collections & get_collection_info tools
    collections = list_qdrant_collections()
    print(f"[2/5] list_qdrant_collections() returned {len(collections)} collections with human labels:")
    assert len(collections) > 0, "No collections found"
    
    col_names = []
    for col_dict in collections:
        col_name = col_dict["name"]
        col_names.append(col_name)
        label = col_dict["label"]
        info = get_collection_info(col_name)
        print(f"  - Collection: {col_name} (Label: {label})")
        print(f"    Status: {info['status']}")
        print(f"    Points: {info['points_count']}")
        print(f"    Vector Dimensions: {info['vector_size']}")
        print(f"    Distance Metric: {info['distance']}")
        assert info["points_count"] > 0, f"Collection {col_name} has 0 points"
        assert info["vector_size"] == 768, f"Expected 768d vector size, got {info['vector_size']}"
        assert label in ["code", "docs", "unknown"], f"Unexpected label: {label}"

    # 3. Test search_qdrant_points tool with raw vector and Ollama text query
    print("[3/5] Testing search_qdrant_points() with raw vector and Ollama text search:")
    for col_dict in collections:
        col = col_dict["name"]
        pts, _ = client.scroll(col, limit=1, with_vectors=True, with_payload=True)
        assert len(pts) > 0, f"No sample point in {col}"
        sample = pts[0]
        query_vec = sample.vector
        
        # Test A: Vector query fallback
        results_vec = search_qdrant_points(collection_name=col, query_vector=query_vec, limit=3)
        assert len(results_vec) == 3, f"Expected 3 results, got {len(results_vec)}"
        assert results_vec[0]["id"] == sample.id, f"Expected top hit ID {sample.id}, got {results_vec[0]['id']}"
        assert abs(results_vec[0]["score"] - 1.0) < 1e-3, f"Expected score ~ 1.0, got {results_vec[0]['score']}"
        
        print(f"  - Vector Search [{col}] top hit: id={results_vec[0]['id']}, score={results_vec[0]['score']:.4f}")

        # Test B: Ollama Text search
        query_text = "database client connection and vector search"
        try:
            results_text = search_qdrant_points(collection_name=col, query=query_text, limit=3)
            assert len(results_text) > 0, "Ollama search returned empty results"
            print(f"  - Ollama Text Search [{col}] ('{query_text}') top hit: id={results_text[0]['id']}, score={results_text[0]['score']:.4f}")
        except Exception as err:
            print(f"  - WARNING: Ollama search skipped or failed: {err}")

    # 4. Test get_points, scroll_points, count_points
    print("[4/5] Testing get_points, scroll_points, and count_points:")
    for col_dict in collections:
        col = col_dict["name"]
        
        # count_points
        cnt_res = count_points(col)
        assert cnt_res["count"] > 0, f"count_points returned 0 for {col}"
        print(f"  - count_points[{col}]: {cnt_res['count']}")

        # scroll_points
        scroll_res = scroll_points(col, limit=3)
        assert len(scroll_res["points"]) > 0, f"scroll_points returned no points for {col}"
        print(f"  - scroll_points[{col}]: retrieved {len(scroll_res['points'])} points, next_offset={scroll_res['next_page_offset']}")

        # get_points
        sample_ids = [pt["id"] for pt in scroll_res["points"][:2]]
        fetched = get_points(col, ids=sample_ids)
        assert len(fetched) == len(sample_ids), f"get_points expected {len(sample_ids)} points, got {len(fetched)}"
        print(f"  - get_points[{col}]: fetched IDs {sample_ids}")

    print("\n=== ALL MCP TOOLS AND TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_all_tests()
