#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script nhỏ để kiểm tra search trong MongoDB Atlas Vector Search.
Yêu cầu:
  - Đã export MONGO_URI, MONGO_DB và (tuỳ chọn) MONGO_COLLECTION
  - Các documents đã được embed bằng cùng một model (ví dụ MiniLM)
"""

import os
import sys
import argparse
from typing import List, Any, Dict

from pymongo import MongoClient
from sentence_transformers import SentenceTransformer


DEFAULT_MONGO_URI = (
    "mongodb+srv://datnguyen151004_db_user:"
    "5mElxgQon9FwpbBk@cluster0.ozch8um.mongodb.net/chatbot"
    "?retryWrites=true&w=majority"
)
DEFAULT_DB_NAME = "chatbot"
DEFAULT_COLLECTION_NAME = "knowledgeDocs"
DEFAULT_VECTOR_INDEX = "knowledge_vector_index"


def get_env_var(name: str, default: str = "") -> str:
    value = os.environ.get(name, default)
    if not value:
        print(f"⚠️  Cảnh báo: biến môi trường {name} đang trống.", file=sys.stderr)
    return value


def connect_collection() -> Any:
    mongo_uri = (
        os.environ.get("MONGO_URI")
        or os.environ.get("ATLAS_CONNECTION_STRING")
        or DEFAULT_MONGO_URI
    )
    if not mongo_uri:
        print("❌ Thiếu MONGO_URI hoặc ATLAS_CONNECTION_STRING.", file=sys.stderr)
        sys.exit(1)

    db_name = os.environ.get("MONGO_DB", DEFAULT_DB_NAME)
    collection_name = os.environ.get("MONGO_COLLECTION", DEFAULT_COLLECTION_NAME)

    client = MongoClient(mongo_uri)
    db = client[db_name]
    return db[collection_name]


def build_query_vector(text: str, model_name: str) -> List[float]:
    print(f"🧠 Đang load model '{model_name}'...")
    model = SentenceTransformer(model_name)
    print("✅ Model đã sẵn sàng, tạo embedding cho câu hỏi...")
    return model.encode(text).tolist()


def run_vector_search(
    collection: Any,
    query_vector: List[float],
    index_name: str,
    num_candidates: int,
    limit: int,
) -> List[Dict[str, Any]]:
    print(
        f"🔍 Thực thi $vectorSearch với index='{index_name}', "
        f"numCandidates={num_candidates}, limit={limit}"
    )
    pipeline = [
        {
            "$vectorSearch": {
                "index": index_name,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": num_candidates,
                "limit": limit,
            }
        },
        {
            "$project": {
                "_id": 0,
                "title": 1,
                "content": 1,
                
                # --- SỬA LỖI Ở ĐÂY ---
                "score": {"$meta": "vectorSearchScore"}, 
            }
        },
    ]
    return list(collection.aggregate(pipeline))
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Test MongoDB Atlas Vector Search với một câu hỏi mẫu."
    )
    parser.add_argument(
        "--query",
        required=True,
        help="Câu hỏi/câu truy vấn muốn thử nghiệm.",
    )
    parser.add_argument(
        "--model",
        default="sentence-transformers/all-MiniLM-L6-v2",
        help="Tên SentenceTransformer dùng để tạo query vector.",
    )
    parser.add_argument(
        "--index",
        default=os.environ.get("MONGO_VECTOR_INDEX", DEFAULT_VECTOR_INDEX),
        help="Tên vector index trên Atlas.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=3,
        help="Số kết quả trả về.",
    )
    parser.add_argument(
        "--num-candidates",
        type=int,
        default=50,
        help="Số ứng viên ban đầu cho Atlas đánh giá.",
    )
    args = parser.parse_args()

    collection = connect_collection()
    query_vector = build_query_vector(args.query, args.model)
    results = run_vector_search(
        collection,
        query_vector,
        args.index,
        args.num_candidates,
        args.limit,
    )

    if not results:
        print("⚠️  Không tìm thấy kết quả nào.")
        return

    print("✅ Kết quả:")
    for i, doc in enumerate(results, start=1):
        title = doc.get("title", "<no title>")
        score = doc.get("score")
        score_str = f"{score:.4f}" if isinstance(score, (int, float)) else "N/A"
        print(f"\n--- Kết quả #{i} (score: {score_str}) ---")
        print(f"Tiêu đề: {title}")
        print("Nội dung:")
        print(doc.get("content", "")[:500])
        if len(doc.get("content", "")) > 500:
            print("... (đã cắt bớt)")


if __name__ == "__main__":
    main()

