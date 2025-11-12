import config from '../config/env';
import { KnowledgeDoc } from '../models/KnowledgeDoc'; 
import { FrontierService } from './frontier.service'; 

export class RetrievalService {
  static async answer(query: string) {
    try {
      // 1. TẠO VECTOR cho câu hỏi (query)
      const queryVector = await FrontierService.createEmbedding(query);
      
      // 2. THỰC HIỆN VECTOR SEARCH với MongoDB Atlas
      const results = await KnowledgeDoc.aggregate([
        {
          $vectorSearch: {
            // Đặt tên index bạn đã tạo trên Atlas
            index: 'knowledge_vector_index', 
            // Tên trường trong DB phải khớp với Index (đã được sửa thành 'embedding')
            path: 'embedding', 
            queryVector: queryVector,
            numCandidates: 50, 
            limit: 5 
          }
        },
        // Chỉ lấy trường 'content' để gửi tới Frontier Model
        { $project: { _id: 0, content: 1 } } 
      ]).exec();

      // 3. TRÍCH XUẤT CONTEXT
      const context = results.map(doc => doc.content);
      
      return { context: context, answer: null }; 

    } catch (error) {
      console.error("RAG Retrieval Error:", error);
      // Trả về context rỗng nếu có lỗi
      return { context: [], answer: null }; 
    }
  }
}