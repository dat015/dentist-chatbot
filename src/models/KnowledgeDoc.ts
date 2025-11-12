import mongoose, { Schema, Document } from "mongoose";

export interface IKnowledgeDoc extends Document {
  title: string;
  content: string;
  embedding?: number[];
}

const schema = new Schema<IKnowledgeDoc>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  embedding: { type: [Number] },
});

export const KnowledgeDoc = mongoose.model<IKnowledgeDoc>(
  "KnowledgeDoc",
  schema
);
