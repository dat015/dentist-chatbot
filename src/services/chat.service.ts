import mongoose, { Types } from "mongoose";
import { Conversation, IConversation } from "../models/Conversation";
import { Message, IMessage } from "../models/Message";
import { IntentService } from "./intent.service";
import { RetrievalService } from "./retrieval.service";
import { LocalModelService } from "./localModel.service";
import { FrontierService } from "./frontier.service";
import { QualityService } from "./quality.service";

export interface ProcessQuestionParams {
  userId: string;
  text: string;
  conversationId?: string | null;
}

export interface ProcessQuestionResult {
  conversation: IConversation;
  conversationId: string;
  userMessage: IMessage;
  assistantMessage: IMessage;
  intent: any;
  localRes: any;
  ragRes: any;
  quality: { score: number; label: string };
}

const MAX_HISTORY_MESSAGES = 10;

const buildChatHistory = (messages: IMessage[], userId: string, latestUserText: string) => {
  const sorted = messages
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .slice(-MAX_HISTORY_MESSAGES);

  const history = sorted.map((msg) => ({
    role: msg.sender === userId ? "user" : "assistant",
    content: msg.text,
  }));

  if (history.length === 0 || history[history.length - 1].content !== latestUserText) {
    history.push({ role: "user", content: latestUserText });
  }

  return history;
};

const resolveConversation = async (
  userId: string,
  conversationId?: string | null,
): Promise<IConversation> => {
  if (conversationId && mongoose.isValidObjectId(conversationId)) {
    const byId = await Conversation.findById(conversationId);
    if (byId) {
      return byId;
    }
  }

  return Conversation.create({
    userId,
    createdAt: new Date(),
  });
};

export class ChatService {
  static async processQuestion(params: ProcessQuestionParams): Promise<ProcessQuestionResult> {
    const { userId, text, conversationId } = params;

    if (!userId || !text) {
      throw new Error("Missing userId or text");
    }

    const conversation = await resolveConversation(userId, conversationId);

    const userMessage = await Message.create({
      conversationId: conversation._id,
      sender: userId,
      text,
      timestamp: new Date(),
    });

    const historyMessages = await Message.find({ conversationId: conversation._id })
      .sort({ timestamp: -1 })
      .limit(MAX_HISTORY_MESSAGES)
      .exec();
    const chatHistory = buildChatHistory(historyMessages, userId, text);

    const intent = await IntentService.detectIntent(text);

    let localRes: any = null;
    let ragRes: any = null;

    const shouldCallLocal = intent.type === "STATIC" || intent.type === "MIXED";
    const shouldCallRag = intent.type === "DYNAMIC" || intent.type === "MIXED";

    const localPromise = shouldCallLocal
      ? LocalModelService.answer(text).catch((error) => {
          console.warn("[ChatService] Local model call failed", error?.message || error);
          return null;
        })
      : Promise.resolve(null);
    const ragPromise = shouldCallRag ? RetrievalService.answer(text) : Promise.resolve(null);

    [localRes, ragRes] = await Promise.all([localPromise, ragPromise]);

    const finalAnswerContent = await FrontierService.synthesize({
      text,
      intent,
      localRes,
      ragRes,
      history: chatHistory,
    });

    const assistantMessage = await Message.create({
      conversationId: conversation._id,
      sender: "bot",
      text: finalAnswerContent,
      timestamp: new Date(),
    });

    const quality = await QualityService.check(finalAnswerContent);

    const conversationObjectId = conversation._id as Types.ObjectId;

    return {
      conversation,
      conversationId: conversationObjectId.toString(),
      userMessage,
      assistantMessage,
      intent,
      localRes,
      ragRes,
      quality,
    };
  }
}


