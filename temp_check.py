
from pymongo import MongoClient

uri = "mongodb+srv://datnguyen151004_db_user:5mElxgQon9FwpbBk@cluster0.ozch8um.mongodb.net/chatbot?retryWrites=true&w=majority"
client = MongoClient(uri)
coll = client["chatbot"]["knowledgeDocs"]

print("Tổng documents:", coll.count_documents({}))
doc = coll.find_one({}, {"title": 1, "embedding": 1})
emb = doc.get("embedding")
print("Embedding chiều thật:", len(emb) if emb else 0)
if doc:
    print("Ví dụ title:", doc.get("title"))
    emb = doc.get("embedding")
    print("Embedding chiều:", len(emb) if emb else 0)

