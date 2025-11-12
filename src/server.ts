import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import config from "./config/env";
import { connectDB } from "./config/db";
import { registerAiSocket } from "./sockets/ai.socket";

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" },
  transports: ["websocket"],
});

io.on("connection", (socket) => registerAiSocket(io, socket));

const startServer = async () => {
  await connectDB();
  const port = Number(config.port);
  server.listen(port, () => console.log(`🚀 Server running on port ${port}`));
};

startServer();
