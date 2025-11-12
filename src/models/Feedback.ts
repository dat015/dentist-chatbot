import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFeedback extends Document {
  conversationId: Types.ObjectId;
  userId: string;
  rating: number;
  comment?: string;
}

const feedbackSchema = new Schema<IFeedback>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  userId: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: String,
});

export const Feedback = mongoose.model<IFeedback>('Feedback', feedbackSchema);
