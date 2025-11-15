#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tên file: embed_doc.py
Script này sẽ nhúng một file văn bản (.txt, .md) vào MongoDB Atlas Vector Search
sử dụng schema IKnowledgeDoc.
"""
import sys
import os
import argparse
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
from textwrap import wrap # Dùng để chia chunk đơn giản

# --- 1. Cấu hình (Lấy từ Biến Môi trường) ---

# Lấy chuỗi kết nối từ biến môi trường (ưu tiên giống backend)
DEFAULT_MONGO_URI = (
    "mongodb+srv://datnguyen151004_db_user:"
    "5mElxgQon9FwpbBk@cluster0.ozch8um.mongodb.net/chatbot"
    "?retryWrites=true&w=majority"
)

MONGO_URI = (
    os.environ.get("MONGO_URI")
    or os.environ.get("ATLAS_CONNECTION_STRING")
    or DEFAULT_MONGO_URI
)

# Tên Database và Collection (khớp với backend: MONGO_DB + knowledgedocs)
DB_NAME = os.environ.get("MONGO_DB", "chatbot")
COLLECTION_NAME = os.environ.get("MONGO_COLLECTION", "knowledgedocs")

# Model để embedding (ví dụ: all-MiniLM-L6-v2 có 384 chiều)
MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
CHUNK_SIZE = 1500 # Số ký tự mỗi chunk (có thể điều chỉnh)

# --- 2. Kiểm tra và Khởi tạo ---

if not MONGO_URI:
    print("Lỗi: Bạn phải cài đặt biến môi trường 'ATLAS_CONNECTION_STRING'.", file=sys.stderr)
    sys.exit(1)

try:
    print(f"Đang tải model embedding: {MODEL_NAME}...")
    model = SentenceTransformer(MODEL_NAME)
    
    print("Đang kết nối tới MongoDB Atlas...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME] # <--- THAY ĐỔI: Sử dụng tên collection mới
    # Kiểm tra kết nối
    client.admin.command('ping')
    print("Kết nối MongoDB thành công!")
    
except Exception as e:
    print(f"Lỗi khi khởi tạo kết nối hoặc model: {e}", file=sys.stderr)
    sys.exit(1)

# --- 3. Hàm chính xử lý file ---

def embed_file(filepath):
    """
    Đọc file, chia chunks, tạo embedding và insert vào DB.
    """
    try:
        print(f"\nĐang xử lý file: {filepath}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            full_text = f.read()
    except FileNotFoundError:
        print(f"Lỗi: Không tìm thấy file '{filepath}'", file=sys.stderr)
        return
    except Exception as e:
        print(f"Lỗi khi đọc file: {e}", file=sys.stderr)
        return

    # --- 4. Chia nhỏ (Chunking) ---
    text_chunks = wrap(full_text, 
                       CHUNK_SIZE, 
                       break_long_words=False, 
                       replace_whitespace=False)
    
    if not text_chunks:
        print("File rỗng, không có gì để nhúng.")
        return

    print(f"Đã chia tài liệu thành {len(text_chunks)} chunks (mỗi chunk ~{CHUNK_SIZE} ký tự).")

    # --- 5. Tạo Embeddings (hàng loạt) ---
    print("Đang tạo vector embeddings cho các chunks...")
    try:
        embeddings = model.encode(text_chunks, show_progress_bar=True)
    except Exception as e:
        print(f"Lỗi khi tạo embedding: {e}", file=sys.stderr)
        return

    # --- 6. Chuẩn bị tài liệu và Insert vào MongoDB ---
    
    # <--- THAY ĐỔI: Cấu trúc document để khớp với IKnowledgeDoc ---
    
    documents_to_insert = []
    
    # Lấy 'title' từ tên file. Tất cả các chunk sẽ có chung title này.
    file_title = os.path.basename(filepath) 
    
    for i, text in enumerate(text_chunks):
        document = {
            "title": file_title,                   # Khớp với 'title: string'
            "content": text,                       # Khớp với 'content: string'
            "embedding": embeddings[i].tolist()    # Khớp với 'embedding: number[]'
            
            # Các trường "source_file", "text_content", "chunk_index", 
            # "vector_embedding" đã bị loại bỏ/đổi tên
        }
        documents_to_insert.append(document)

    print(f"Đang lưu {len(documents_to_insert)} chunks vào collection '{COLLECTION_NAME}'...")
    try:
        result = collection.insert_many(documents_to_insert)
        print("--- THÀNH CÔNG! ---")
        print(f"Đã nhúng {len(result.inserted_ids)} chunks từ file '{filepath}'.")
    except Exception as e:
        print(f"Lỗi khi insert vào MongoDB: {e}", file=sys.stderr)

# --- 7. Entry point để chạy script từ terminal ---

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Nhúng tài liệu văn bản (.md, .txt) vào MongoDB Atlas Vector DB."
    )
    parser.add_argument(
        "filepath", 
        type=str, 
        help="Đường dẫn đến file .md hoặc .txt cần nhúng."
    )
    
    args = parser.parse_args()
    
    embed_file(args.filepath)