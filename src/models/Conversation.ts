import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  userId: string;
  createdAt: Date;
}

const conversationSchema = new Schema<IConversation>({
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
