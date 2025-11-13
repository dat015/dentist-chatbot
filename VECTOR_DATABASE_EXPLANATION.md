# Vector Database - Giải thích và Ví dụ

## 📚 Vector Database là gì?

**Vector Database** (Cơ sở dữ liệu Vector) là một loại database đặc biệt được thiết kế để lưu trữ và tìm kiếm dữ liệu dưới dạng **vector** (mảng số). Khác với database truyền thống tìm kiếm theo từ khóa chính xác, vector database tìm kiếm dựa trên **ý nghĩa ngữ nghĩa** (semantic similarity).

### Tại sao cần Vector Database?

- **Tìm kiếm ngữ nghĩa**: Tìm được tài liệu liên quan ngay cả khi không có từ khóa chính xác
- **AI/ML**: Hỗ trợ RAG (Retrieval Augmented Generation), recommendation systems
- **Tốc độ**: Tối ưu hóa cho việc tìm kiếm similarity với hàng triệu vector

---

## 🔍 Cách hoạt động trong code của bạn

Dự án của bạn sử dụng **MongoDB Atlas Vector Search** kết hợp với **Google Gemini API** để tạo embeddings. Đây là kiến trúc RAG (Retrieval Augmented Generation).

### 📋 Luồng hoạt động chi tiết (từng bước với hàm và file):

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CLIENT GỬI CÂU HỎI (Socket.IO)                                │
└─────────────────────────────────────────────────────────────────┘
   📁 File: src/sockets/ai.socket.ts
   🔧 Hàm: socket.on("question:send", ...)
   📝 Code: 
      socket.on("question:send", async (payload) => {
        const { userId, text } = payload;
        void SocketService.processQuestion(io, socket, userId, text);
      })
   ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. XỬ LÝ CÂU HỎI (Main Processing)                               │
└─────────────────────────────────────────────────────────────────┘
   📁 File: src/services/socket.service.ts
   🔧 Hàm: SocketService.processQuestion()
   📝 Bước 2.1: Lấy lịch sử chat từ MongoDB
      - Conversation.findOne({ userId })
      - Message.find({ conversationId }).sort({ timestamp: 1 }).limit(10)
   
   📝 Bước 2.2: Nhận diện Intent
      socket.emit("status:update", { stage: "intent_detection" })
      ↓
      📁 File: src/services/intent.service.ts
      🔧 Hàm: IntentService.detectIntent(text)
      📝 Trả về: { type: "STATIC" | "DYNAMIC" | "MIXED" }
   ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. VECTOR SEARCH (Nếu Intent = DYNAMIC hoặc MIXED)              │
└─────────────────────────────────────────────────────────────────┘
   📁 File: src/services/socket.service.ts (dòng 56 hoặc 60)
   🔧 Hàm: RetrievalService.answer(text)
   ↓
   📁 File: src/services/retrieval.service.ts
   🔧 Hàm: RetrievalService.answer(query: string)
   
   📝 Bước 3.1: Tạo Vector cho câu hỏi
      ↓
      📁 File: src/services/frontier.service.ts
      🔧 Hàm: FrontierService.createEmbedding(text)
      📝 Code:
         const response = await aiClient.models.embedContent({
           model: "text-embedding-004",
           contents: [{ role: "user", parts: [{ text }] }]
         });
         return response.embeddings[0].values!;
      📝 Output: queryVector = [0.123, -0.456, 0.789, ...] (mảng số)
   
   📝 Bước 3.2: Tìm kiếm trong Vector Database
      ↓
      📁 File: src/services/retrieval.service.ts (dòng 12-26)
      📁 Model: src/models/KnowledgeDoc.ts
      🔧 Hàm: KnowledgeDoc.aggregate([{ $vectorSearch: ... }])
      📝 Code:
         const results = await KnowledgeDoc.aggregate([
           {
             $vectorSearch: {
               index: 'knowledge_vector_index',  // Index trên MongoDB Atlas
               path: 'embedding',                 // Trường chứa vector
               queryVector: queryVector,          // Vector của câu hỏi
               numCandidates: 50,                 // Số ứng viên
               limit: 5                           // Số kết quả
             }
           },
           { $project: { _id: 0, content: 1 } }
         ]).exec();
      📝 Output: results = [{ content: "..." }, ...] (5 documents tương tự nhất)
   
   📝 Bước 3.3: Trích xuất Context
      const context = results.map(doc => doc.content);
      return { context: context, answer: null };
   ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. TỔNG HỢP CÂU TRẢ LỜI (Synthesis)                              │
└─────────────────────────────────────────────────────────────────┘
   📁 File: src/services/socket.service.ts (dòng 65-72)
   🔧 Hàm: FrontierService.synthesize({ ... })
   ↓
   📁 File: src/services/frontier.service.ts
   🔧 Hàm: FrontierService.synthesize(data)
   📝 Input:
      - text: Câu hỏi gốc
      - intent: Kết quả nhận diện intent
      - localRes: Kết quả từ Local Model (nếu có)
      - ragRes: Kết quả từ Vector Search (nếu có)
      - history: Lịch sử chat
   📝 Code:
      const ragContext = ragRes?.context?.join("\n") || "Không có context RAG.";
      const synthesisPrompt = `...`; // Prompt tổng hợp
      const finalAnswer = await this.chatCompletion(history, synthesisPrompt);
   📝 Output: finalAnswerContent (câu trả lời cuối cùng)
   ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. KIỂM TRA CHẤT LƯỢNG                                           │
└─────────────────────────────────────────────────────────────────┘
   📁 File: src/services/socket.service.ts (dòng 75)
   🔧 Hàm: QualityService.check(finalAnswerContent)
   📁 File: src/services/quality.service.ts
   📝 Output: quality = { label: "good" | "needs_review", ... }
   ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. LƯU VÀ TRẢ VỀ KẾT QUẢ                                        │
└─────────────────────────────────────────────────────────────────┘
   📁 File: src/services/socket.service.ts (dòng 86-93)
   📝 Lưu message vào MongoDB:
      await Message.create({
        conversationId: conversation._id,
        sender: 'bot',
        text: finalAnswer
      });
   📝 Gửi kết quả về client:
      socket.emit("question:done", { answer: finalAnswer, quality });
```

### 🗂️ Tóm tắt các file liên quan đến Vector Database:

| File | Vai trò | Hàm chính |
|------|---------|-----------|
| `src/sockets/ai.socket.ts` | Nhận câu hỏi từ client | `socket.on("question:send")` |
| `src/services/socket.service.ts` | Điều phối xử lý câu hỏi | `SocketService.processQuestion()` |
| `src/services/retrieval.service.ts` | **Vector Search chính** | `RetrievalService.answer()` |
| `src/services/frontier.service.ts` | Tạo embedding | `FrontierService.createEmbedding()` |
| `src/models/KnowledgeDoc.ts` | Model chứa vector | Schema với trường `embedding` |
| `src/services/intent.service.ts` | Nhận diện loại câu hỏi | `IntentService.detectIntent()` |
| `src/services/frontier.service.ts` | Tổng hợp câu trả lời | `FrontierService.synthesize()` |

---

## 📝 Ví dụ cụ thể từ code

### 1. **Tạo Vector (Embedding)**

Trong file `src/services/frontier.service.ts`:

```typescript
static async createEmbedding(text: string): Promise<number[]> {
  const modelName = "text-embedding-004";
  
  const response = await aiClient.models.embedContent({
    model: modelName,
    contents: [{ role: "user", parts: [{ text }] }],
  });
  
  return response.embeddings[0].values!;
}
```

**Ví dụ:**
- Input: `"Làm thế nào để chăm sóc răng miệng?"`
- Output: `[0.123, -0.456, 0.789, ..., 0.234]` (mảng 768 số - tùy model)

### 2. **Lưu trữ Vector trong Database**

Trong file `src/models/KnowledgeDoc.ts`:

```typescript
export interface IKnowledgeDoc extends Document {
  title: string;
  content: string;
  embedding?: number[];  // ← Vector được lưu ở đây
}
```

**Ví dụ document trong MongoDB:**
```json
{
  "_id": "...",
  "title": "Hướng dẫn chăm sóc răng",
  "content": "Đánh răng 2 lần mỗi ngày, dùng chỉ nha khoa...",
  "embedding": [0.123, -0.456, 0.789, ..., 0.234]  // Vector của content
}
```

### 3. **Tìm kiếm Vector (Vector Search)**

Trong file `src/services/retrieval.service.ts`:

```typescript
static async answer(query: string) {
  // 1. TẠO VECTOR cho câu hỏi
  const queryVector = await FrontierService.createEmbedding(query);
  
  // 2. THỰC HIỆN VECTOR SEARCH với MongoDB Atlas
  const results = await KnowledgeDoc.aggregate([
    {
      $vectorSearch: {
        index: 'knowledge_vector_index',  // Index đã tạo trên Atlas
        path: 'embedding',                 // Trường chứa vector
        queryVector: queryVector,          // Vector của câu hỏi
        numCandidates: 50,                 // Số lượng ứng viên để xem xét
        limit: 5                           // Số kết quả trả về
      }
    },
    { $project: { _id: 0, content: 1 } }
  ]).exec();
  
  // 3. TRÍCH XUẤT CONTEXT
  const context = results.map(doc => doc.content);
  return { context: context, answer: null };
}
```

---

## 🎯 Ví dụ thực tế

### Scenario: Người dùng hỏi về "đau răng"

**Bước 1: Tạo vector cho câu hỏi**
```typescript
query = "Tôi bị đau răng, phải làm sao?"
queryVector = await FrontierService.createEmbedding(query)
// → [0.15, -0.32, 0.78, ..., 0.91]
```

**Bước 2: Vector Search trong MongoDB**
```typescript
// MongoDB sẽ so sánh queryVector với tất cả embedding trong database
// Sử dụng cosine similarity hoặc euclidean distance
// Trả về 5 documents có embedding gần nhất
```

**Bước 3: Kết quả**
```typescript
results = [
  { content: "Đau răng có thể do sâu răng, viêm nướu..." },      // Score: 0.95
  { content: "Khi bị đau răng, nên đến nha sĩ ngay..." },        // Score: 0.92
  { content: "Các biện pháp giảm đau răng tạm thời..." },        // Score: 0.89
  { content: "Nguyên nhân đau răng và cách điều trị..." },       // Score: 0.87
  { content: "Chăm sóc răng miệng hàng ngày..." }                // Score: 0.85
]
```

**Bước 4: Sử dụng context để trả lời**
```typescript
// Context được đưa vào prompt cho AI model
// AI sẽ tổng hợp thông tin từ context để trả lời câu hỏi
```

---

## 🔑 Các khái niệm quan trọng

### 1. **Embedding (Vector)**
- Là biểu diễn số của văn bản
- Văn bản có nghĩa tương tự → vector gần nhau
- Thường là mảng 384, 512, 768, hoặc 1536 số

### 2. **Similarity Search (Tìm kiếm tương tự)**
- **Cosine Similarity**: Đo góc giữa 2 vector (0-1, càng gần 1 càng giống)
- **Euclidean Distance**: Đo khoảng cách giữa 2 vector (càng nhỏ càng giống)

### 3. **Vector Index**
- Index đặc biệt để tăng tốc tìm kiếm vector
- Trong code: `knowledge_vector_index` trên MongoDB Atlas
- Sử dụng thuật toán như HNSW (Hierarchical Navigable Small World)

---

## 🛠️ Setup trong MongoDB Atlas

Để sử dụng Vector Search, bạn cần:

1. **Tạo Vector Search Index** trên MongoDB Atlas:
```json
{
  "name": "knowledge_vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [{
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,  // Số chiều của embedding
      "similarity": "cosine"
    }]
  }
}
```

2. **Lưu embedding khi tạo document**:
```typescript
const doc = new KnowledgeDoc({
  title: "Hướng dẫn chăm sóc răng",
  content: "...",
  embedding: await FrontierService.createEmbedding("...")
});
await doc.save();
```

---

## 💡 Lợi ích trong dự án của bạn

1. **RAG System**: Tìm kiếm thông tin liên quan từ knowledge base
2. **Semantic Search**: Hiểu ý nghĩa câu hỏi, không chỉ từ khóa
3. **Context Retrieval**: Lấy context phù hợp để AI trả lời chính xác hơn

---

## 📊 So sánh với Database truyền thống

| Tính năng | Database truyền thống | Vector Database |
|-----------|----------------------|-----------------|
| Tìm kiếm | Từ khóa chính xác | Ngữ nghĩa tương tự |
| Query | `WHERE title LIKE '%đau răng%'` | `$vectorSearch` với embedding |
| Kết quả | Chỉ tìm thấy nếu có từ khóa | Tìm thấy ngay cả khi không có từ khóa |
| Use case | CRUD, tìm kiếm đơn giản | AI, RAG, recommendation |

---

## 🎓 Tóm tắt

**Vector Database** trong code của bạn:
- ✅ Sử dụng **MongoDB Atlas Vector Search**
- ✅ Tạo embedding bằng **Google Gemini API** (`text-embedding-004`)
- ✅ Lưu trữ trong collection `KnowledgeDoc` với trường `embedding`
- ✅ Tìm kiếm bằng `$vectorSearch` aggregation pipeline
- ✅ Hỗ trợ hệ thống **RAG** để trả lời câu hỏi thông minh

Vector Database giúp AI của bạn hiểu và tìm kiếm thông tin dựa trên **ý nghĩa**, không chỉ từ khóa!

