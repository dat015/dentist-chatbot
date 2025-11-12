// src/services/frontier.service.ts (CẬP NHẬT TRỌNG TÂM)

import config from "../config/env";
// Thay thế import OpenAI bằng GoogleGenAI
import { GoogleGenAI, Content } from "@google/genai";

// Khởi tạo client. Nó sẽ tự động dùng GEMINI_API_KEY từ process.env
// Nhưng để đảm bảo TypeScript hoạt động đúng, ta dùng config.geminiApiKey
const aiClient = new GoogleGenAI({
  apiKey: config.aiServiceKey,
});

export class FrontierService {
  /**
   * Chuyển đổi định dạng message của OpenAI sang định dạng Content của Gemini.
   */
  static formatMessages(messages: any[]): Content[] {
    // Bỏ systemPrompt
    const formatted: Content[] = [];

    // Chuyển đổi lịch sử chat (user/assistant)
    for (const msg of messages) {
      // Chỉ chấp nhận user hoặc model
      const role = msg.role === "user" ? "user" : "model";
      formatted.push({
        role: role,
        parts: [{ text: msg.content }],
      });
    }
    return formatted;
  }

  /**
   * Hàm gọi Gemini/Frontier Model cho Chat Completion.
   */
  static async chatCompletion(messages: any[], systemPrompt: string) {
    // 1. Format messages (chỉ có user/model)
    const contents = this.formatMessages(messages);
    console.log("hehe");
    // 2. Gọi API, đưa systemPrompt vào config
    const response = await aiClient.models.generateContent({
      model: config.frontierModelName,
      contents: contents,
      config: {
        temperature: 0.1,
        systemInstruction: systemPrompt,
      },
    });
    console.log("ai", response);
    return response.text;
  }

  // Hàm synthesize giữ nguyên logic, chỉ thay đổi hàm gọi lõi
  static async synthesize(data: {
    text: string;
    intent: any;
    localRes: any;
    ragRes: any;
    history: any[]; // Giữ kiểu any[] vì ta format nó trong chatCompletion
  }) {
    const { intent, localRes, ragRes, history } = data;

    const ragContext = ragRes?.context?.join("\n") || "Không có context RAG.";
    const localAnswer = localRes?.answer || "Không có kết quả Local Model.";

    const synthesisPrompt = `
      Bạn là Trợ lý AI Nha khoa chuyên nghiệp.
      Nhiệm vụ của bạn là tổng hợp câu trả lời cuối cùng cho câu hỏi của người dùng dựa trên LỊCH SỬ CHAT và các kết quả trung gian sau:
      - KẾT QUẢ RAG (Context): ${ragContext}
      - KẾT QUẢ TỪ LOCAL MODEL: ${localAnswer}
      
      Ưu tiên sử dụng thông tin RAG (Context) cho dữ liệu động (giá, địa chỉ) và thông tin Local Model cho kiến thức tĩnh. Đảm bảo câu trả lời mạch lạc, chuyên nghiệp và có tính liên tục với lịch sử chat.
    `;

    const finalAnswer = await this.chatCompletion(history, synthesisPrompt);
    return finalAnswer;
  }

  /**
   * Tạo vector (embedding) cho một đoạn văn bản sử dụng Google AI.
   * @param text Văn bản cần chuyển đổi.
   * @returns Mảng số (vector).
   */
  static async createEmbedding(text: string): Promise<number[]> {
    // Sử dụng mô hình embedding khuyến nghị cho Gemini/Google
    const modelName = "text-embedding-004";

    const response = await aiClient.models.embedContent({
      model: modelName,
      // Cần truyền mảng đối tượng ContentPart[] cho contents
      contents: [{ role: "user", parts: [{ text }] }],
    });

    if (response.embeddings && response.embeddings.length > 0) {
      return response.embeddings[0].values!;
    }

    // Nếu không có embedding nào được tạo (lỗi), trả về mảng rỗng hoặc ném lỗi
    throw new Error("Failed to generate embedding for the text.");
  }
}
