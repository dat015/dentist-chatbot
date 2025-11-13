import mongoose, { Schema, Document } from "mongoose";

export interface IKnowledgeDoc extends Document {
  title: string;
  content: string;
  embedding?: number[];
  source?: string;
  chunkIndex?: number;
}

const schema = new Schema<IKnowledgeDoc>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  embedding: { type: [Number] },
  source: { type: String, index: true },
  chunkIndex: { type: Number },
});

export const KnowledgeDoc = mongoose.model<IKnowledgeDoc>(
  "KnowledgeDoc",
  schema
);
