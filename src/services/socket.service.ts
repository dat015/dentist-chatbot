import { Server } from "socket.io";
import { TypedSocket } from "../types/socket-events";
import { IntentService } from "./intent.service";
import { RetrievalService } from "./retrieval.service";
import { LocalModelService } from "./localModel.service";
import { FrontierService } from "./frontier.service";
import { QualityService } from "./quality.service";
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import OpenAI from "openai";
export class SocketService {
  static async processQuestion(
    io: Server,
    socket: TypedSocket,
    userId: string,
    text: string
  ) {
    try {
      // 1. LẤY LỊCH SỬ CHAT VÀ LƯU MESSAGE HIỆN TẠI (Theo flow có lịch sử chat)
      socket.emit('status:update', { stage: 'fetching_history' });
      let conversation = await Conversation.findOne({ userId });
      if (!conversation) {
        conversation = await Conversation.create({ userId, createdAt: new Date() });
      }
      console.log("conversation", conversation)

      // Lấy lịch sử chat
      const historyMessages = await Message.find({ conversationId: conversation._id })
        .sort({ timestamp: 1 })
        .limit(10); // Giới hạn 10 tin nhắn gần nhất

      // Chuyển đổi sang format của OpenAI messages, thêm câu hỏi hiện tại
      const chatHistory = [
        ...historyMessages.map(msg => ({
          role: msg.sender === userId ? 'user' : 'assistant',
          content: msg.text,
        })),
        { role: 'user', content: text } // Thêm câu hỏi hiện tại vào cuối
      ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[];



      // 2. NHẬN DIỆN INTENT (Dùng Frontier Model)
      socket.emit("status:update", { stage: "intent_detection" });
      // Chỉ dùng câu hỏi hiện tại để Intent (Tránh độ trễ nếu dùng lịch sử quá dài)
      const intent = await IntentService.detectIntent(text); 
      socket.emit("status:update", { stage: "intent_detected", meta: intent });

      let localRes: any = null;
      let ragRes: any = null;

      // 3. XỬ LÝ THEO INTENT
      if (intent.type === "STATIC") {
        localRes = await LocalModelService.answer(text);
      } else if (intent.type === "DYNAMIC") {
        ragRes = await RetrievalService.answer(text);
      } else {
        [localRes, ragRes] = await Promise.all([
          LocalModelService.answer(text),
          RetrievalService.answer(text),
        ]);
      }

      // 4. TỔNG HỢP (Dùng Frontier Model)
      socket.emit("status:update", { stage: "synthesizing" });
      const finalAnswerContent = await FrontierService.synthesize({
        text,
        intent,
        localRes,
        ragRes,
        history: chatHistory, // Truyền Lịch sử Chat và câu hỏi hiện tại
      });
      
      // 5. KIỂM TRA CHẤT LƯỢNG VÀ VÒNG LẶP ĐIỀU CHỈNH
      const quality = await QualityService.check(finalAnswerContent);
      let finalAnswer = finalAnswerContent;

      if (quality.label === 'needs_review') {
          // *** THIẾT KẾ VÒNG LẶP ĐIỀU CHỈNH (Cần Frontier Model) ***
          // Để đơn giản, ta sẽ bỏ qua bước gọi lại Frontier Model để điều chỉnh, 
          // nhưng đây là nơi logic đó sẽ được đặt.
          console.log("Cần điều chỉnh câu trả lời, gửi kết quả thô.");
      }
      
      // 6. LƯU CẢ CÂU TRẢ LỜI CỦA BOT VÀO DB
      await Message.create({
          conversationId: conversation._id,
          sender: 'bot', 
          text: finalAnswer,
      });

      // 7. GỬI KẾT QUẢ
      socket.emit("question:done", { answer: finalAnswer, quality });
    } catch (err: any) {
      // Xử lý lỗi
      socket.emit("question:error", {
        message: err.message || "Processing error",
      });
    }
  }
}