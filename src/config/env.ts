// src/config/env.ts

import dotenv from 'dotenv';
dotenv.config();

// Khai báo kiểu dữ liệu cho config object
interface EnvConfig {
  port: string;
  mongoUri: string;
  mongoDb: string;
  // Loại bỏ các placeholder cũ (Frontier API)
  // frontierIntentUrl: string; 
  // frontierApiUrl: string; 
  localModelUrl: string;
  ragApiUrl: string;
  
  // Thêm các thuộc tính mới
  aiServiceUrl: string;
  aiServiceKey: string;
  frontierModelName: string;
}

const config: EnvConfig = {
  port: process.env.PORT || '3000',
  mongoUri: process.env.MONGO_URI || '',
  mongoDb: process.env.MONGO_DB || 'ai_assistant',
  

  localModelUrl: process.env.LOCAL_MODEL_URL || '',
  ragApiUrl: process.env.RAG_API_URL || '',
  
  // Thêm các biến mới:
  aiServiceUrl: process.env.AI_SERVICE_URL || '',
  aiServiceKey: process.env.AI_SERVICE_KEY || '',
  frontierModelName: process.env.FRONTIER_MODEL_NAME || 'MODEL_NAME_HERE',
};

export default config;