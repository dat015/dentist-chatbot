import { Server } from "socket.io";
import { TypedSocket } from "../types/socket-events";
import { ChatService } from "./chat.service";

export class SocketService {
  static async processQuestion(
    io: Server,
    socket: TypedSocket,
    userId: string,
    text: string
  ) {
    try {
      socket.emit("status:update", { stage: "processing" });

      const result = await ChatService.processQuestion({
        userId,
        text,
      });

      socket.emit("question:done", {
        answer: result.assistantMessage.text,
        quality: result.quality,
        conversationId: result.conversationId,
      });
    } catch (err: any) {
      // Xử lý lỗi
      socket.emit("question:error", {
        message: err.message || "Processing error",
      });
    }
  }
}