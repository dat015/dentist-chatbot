// src/services/intent.service.ts
import { FrontierService } from "./frontier.service";

const INTENT_SYSTEM_PROMPT = `
  Bạn là một mô hình phân loại intent. Dựa trên câu hỏi của người dùng, 
  chỉ trả về một trong ba từ khóa sau: STATIC (Kiến thức chung, quy trình), 
  DYNAMIC (Thông tin thay đổi, giá, địa điểm), hoặc MIXED (Phức hợp). 
  TUYỆT ĐỐI KHÔNG TRẢ VỀ BẤT KỲ VĂN BẢN NÀO KHÁC NGOÀI 3 TỪ KHÓA ĐÓ.
`;

export class IntentService {
  static async detectIntent(text: string) {
    const messagesForIntent = [{ role: "user", content: text }];

    const rawIntent = await FrontierService.chatCompletion(
      messagesForIntent,
      INTENT_SYSTEM_PROMPT
    );
    console.log("ok",rawIntent)

    // Chuẩn hóa kết quả
    const intentType = rawIntent?.toUpperCase().trim() || "MIXED";

    if (["STATIC", "DYNAMIC", "MIXED"].includes(intentType)) {
      return { type: intentType };
    }
    // Mặc định là MIXED nếu mô hình trả về ngoài ý muốn
    return { type: "MIXED" };
  }
}
