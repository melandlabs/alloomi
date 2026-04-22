/**
 * LangChain PGVector Store Integration.
 * Simplified RAG implementation using LangChain's PGVectorStore.
 *
 * NOTE: This file is currently unused in the main app. The main RAG implementation
 * is in langchain-service.ts.
 */

import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { Document } from "@langchain/core/documents";
import { Pool } from "pg";

import { UniversalEmbeddings } from "./universal-embeddings";

// Embedding pricing
const EMBEDDING_PRICING: Record<string, number> = {
  "openai/text-embedding-3-small": 0.02,
  "openai/text-embedding-3-large": 0.13,
  "openai/text-embedding-ada-002": 0.1,
};

const CREDIT_COST_MULTIPLIER = 100; // 1 USD = 100 credits

export interface PGVectorConfig {
  parseFile: (
    buffer: Buffer,
    contentType: string,
  ) => Promise<{ text: string; metadata: Record<string, unknown> }>;
  estimateTokens: (text: string) => number;
  embeddings?: UniversalEmbeddings;
}

let _config: PGVectorConfig | null = null;

export function configurePGVector(config: PGVectorConfig): void {
  _config = config;
}

function getConfig(): PGVectorConfig {
  if (!_config) {
    throw new Error("PGVector not configured. Call configurePGVector() first.");
  }
  return _config;
}

/**
 * Initialize PGVectorStore for a user.
 */
export async function getPGVectorStore(
  userId: string,
  embeddings?: UniversalEmbeddings,
) {
  const cfg = getConfig();
  const emb = embeddings ?? cfg.embeddings ?? new UniversalEmbeddings();

  // Create a PostgreSQL connection pool
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
  });

  // Initialize PGVectorStore with user-specific table
  const vectorStore = await PGVectorStore.initialize(emb, {
    postgresConnectionOptions: {
      connectionString: process.env.POSTGRES_URL,
    },
    tableName: `langchain_rag_${userId.replace(/-/g, "_")}`, // User-specific table
    collectionName: "documents",
    distanceStrategy: "cosine", // Use cosine similarity
    columns: {
      idColumnName: "id",
      vectorColumnName: "embedding",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
  });

  return { vectorStore, pool, embeddings: emb };
}

/**
 * Process document and add to PGVectorStore.
 */
export async function processDocumentWithPGVector(
  userId: string,
  userType: string,
  fileName: string,
  contentType: string,
  buffer: Buffer,
): Promise<{
  documentId: string;
  chunksCount: number;
  totalTokensUsed: number;
  totalCreditCost: number;
}> {
  const cfg = getConfig();

  // 1. Parse file
  const { text: content } = await cfg.parseFile(buffer, contentType);

  // 2. Estimate tokens and calculate credit cost
  const estimatedTokens = cfg.estimateTokens(content);
  const estimatedCreditCost = Math.ceil(
    (estimatedTokens / 1_000_000) *
      (EMBEDDING_PRICING[
        process.env.LLM_EMBEDDING_MODEL || "openai/text-embedding-3-small"
      ] || 0.02) *
      CREDIT_COST_MULTIPLIER,
  );

  // 4. Create LangChain document
  const doc = new Document({
    pageContent: content,
    metadata: {
      fileName,
      contentType,
      userId,
      uploadedAt: new Date().toISOString(),
    },
  });

  // 5. Get vector store
  const { vectorStore, pool } = await getPGVectorStore(userId);

  // 6. Add document to vector store
  await vectorStore.addDocuments([doc]);

  // 7. Calculate chunks count
  const chunkSize = 1000;
  const chunkOverlap = 200;
  const chunksCount = Math.ceil(content.length / (chunkSize - chunkOverlap));

  // 9. Clean up
  await pool.end();

  return {
    documentId: fileName, // Use fileName as documentId
    chunksCount,
    totalTokensUsed: estimatedTokens,
    totalCreditCost: estimatedCreditCost,
  };
}

/**
 * Search similar documents using PGVectorStore.
 */
export async function searchWithPGVector(
  userId: string,
  query: string,
  options: {
    limit?: number;
    filter?: Record<string, any>;
  } = {},
): Promise<
  Array<{
    content: string;
    metadata: Record<string, any>;
    similarity: number;
  }>
> {
  const { vectorStore, pool } = await getPGVectorStore(userId);

  // Perform similarity search
  const results = await vectorStore.similaritySearchWithScore(
    query,
    options.limit || 5,
    options.filter,
  );

  // Clean up
  await pool.end();

  return results.map(([doc, score]) => ({
    content: doc.pageContent,
    metadata: doc.metadata,
    similarity: 1 - score, // Convert distance to similarity
  }));
}

/**
 * Delete documents from PGVectorStore.
 */
export async function deleteDocumentsFromPGVector(
  userId: string,
  filter?: Record<string, any>,
): Promise<void> {
  const { vectorStore, pool } = await getPGVectorStore(userId);

  await vectorStore.delete({
    filter,
  });

  await pool.end();
}

/**
 * Get document count.
 */
export async function getDocumentCount(userId: string): Promise<number> {
  const { vectorStore, pool } = await getPGVectorStore(userId);

  const result = await pool.query(
    `SELECT COUNT(*) as count FROM "${vectorStore.tableName}"`,
  );

  await pool.end();

  return Number.parseInt(result.rows[0].count, 10);
}

/**
 * List all documents for a user.
 */
export async function listUserDocuments(userId: string): Promise<
  Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
  }>
> {
  const { vectorStore, pool } = await getPGVectorStore(userId);

  const result = await pool.query(
    `SELECT "id", "content", "metadata" FROM "${vectorStore.tableName}"`,
  );

  await pool.end();

  return result.rows.map((row: any) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata,
  }));
}
