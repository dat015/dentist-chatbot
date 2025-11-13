import { Request, Response } from "express";
import { ChatService } from "../services/chat.service";

export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { userId, text, conversationId } = req.body;

    const result = await ChatService.processQuestion({
      userId,
      text,
      conversationId,
    });

    res.status(201).json({
      conversation: result.conversation,
      conversationId: result.conversationId,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
      quality: result.quality,
      intent: result.intent,
    });
  } catch (err: any) {
    const statusCode =
      typeof err?.status === "number"
        ? err.status
        : err?.response?.status || err?.statusCode || 500;

    const message =
      err?.message ||
      err?.response?.data?.error?.message ||
      err?.response?.data?.message ||
      err?.data?.message ||
      "Internal server error";

    console.error("[createQuestion] Failed to process question", {
      statusCode,
      message,
      raw: err,
    });

    res.status(statusCode).json({
      message,
      details: err?.response?.data || err?.data || undefined,
    });
  }
};
