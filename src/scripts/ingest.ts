import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { KnowledgeDoc } from '../models/KnowledgeDoc';
import { FrontierService } from '../services/frontier.service';

dotenv.config();

interface IngestOptions {
  inputPath: string;
  chunkSize: number;
  overlap: number;
}

const DEFAULT_CHUNK_SIZE = 1500; // characters
const DEFAULT_OVERLAP = 100;

const parseArgs = (): IngestOptions => {
  const [, , inputArg, ...rest] = process.argv;

  if (!inputArg) {
    console.error('Usage: npm run ingest -- <file-or-directory> [--chunk 1500] [--overlap 100]');
    process.exit(1);
  }

  let chunkSize = DEFAULT_CHUNK_SIZE;
  let overlap = DEFAULT_OVERLAP;

  rest.forEach((value, index) => {
    if (value === '--chunk') {
      chunkSize = Number(rest[index + 1]) || DEFAULT_CHUNK_SIZE;
    }
    if (value === '--overlap') {
      overlap = Number(rest[index + 1]) || DEFAULT_OVERLAP;
    }
  });

  return {
    inputPath: inputArg,
    chunkSize,
    overlap,
  };
};

const gatherFiles = async (inputPath: string): Promise<string[]> => {
  const resolvedPath = path.resolve(process.cwd(), inputPath);
  const stats = await fs.stat(resolvedPath);

  if (stats.isDirectory()) {
    const dirEntries = await fs.readdir(resolvedPath);
    const markdownFiles = dirEntries
      .filter((file) => file.endsWith('.md') || file.endsWith('.txt'))
      .map((file) => path.join(resolvedPath, file));

    if (markdownFiles.length === 0) {
      console.warn(`No markdown/txt files found in directory: ${resolvedPath}`);
    }

    return markdownFiles;
  }

  return [resolvedPath];
};

const chunkContent = (content: string, chunkSize: number, overlap: number): string[] => {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= chunkSize) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    if (end === normalized.length) {
      break;
    }
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
};

const ingestFile = async (filePath: string, options: IngestOptions) => {
  const relativeSource = path.relative(process.cwd(), filePath);
  console.log(`\n🔄 Processing: ${relativeSource}`);

  const rawContent = await fs.readFile(filePath, 'utf8');
  const chunks = chunkContent(rawContent, options.chunkSize, options.overlap);

  await KnowledgeDoc.deleteMany({ source: relativeSource });

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    try {
      const embedding = await FrontierService.createEmbedding(chunk);
      await KnowledgeDoc.findOneAndUpdate(
        { source: relativeSource, chunkIndex: index },
        {
          title: `${path.basename(filePath)}#${index + 1}`,
          content: chunk,
          embedding,
          source: relativeSource,
          chunkIndex: index,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      console.log(`✅ Upserted chunk ${index + 1}/${chunks.length}`);
    } catch (error) {
      console.error(`❌ Failed to embed chunk ${index + 1}:`, error);
    }
  }
};

const main = async () => {
  const options = parseArgs();
  try {
    await connectDB();
    const files = await gatherFiles(options.inputPath);

    if (files.length === 0) {
      console.warn('No files to ingest.');
      process.exit(0);
    }

    for (const file of files) {
      await ingestFile(file, options);
    }

    console.log('\n🎉 Ingestion completed.');
  } catch (error) {
    console.error('Ingestion failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

main();


