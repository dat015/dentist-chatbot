import { Server } from "socket.io";
import { TypedSocket } from "../types/socket-events";
import { SocketService } from "../services/socket.service";

export const registerAiSocket = (io: Server, socket: TypedSocket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  socket.on("question:send", async (payload) => {
    try {
      const { userId, text } = payload;
      socket.emit("question:ack", { status: "received", text });
      // xử lý async
      void SocketService.processQuestion(io, socket, userId, text);
    } catch (err: any) {
      socket.emit("question:error", {
        message: err.message || "Internal error",
      });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`💨 Client disconnected: ${socket.id} - reason: ${reason}`);
  });
};
