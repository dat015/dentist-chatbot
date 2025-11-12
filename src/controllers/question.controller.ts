import { Request, Response } from "express";
import { Message } from "../models/Message";
import { Conversation } from "../models/Conversation";

export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { userId, text } = req.body;

    let conversation = await Conversation.findOne({ userId });
    if (!conversation) {
      conversation = await Conversation.create({
        userId,
        createdAt: new Date(),
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      sender: userId,
      text,
      timestamp: new Date(),
    });

    res.status(201).json({ conversation, message });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
