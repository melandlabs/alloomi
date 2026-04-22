/**
 * SQLite-vec Vector Store.
 * Local vector search using the sqlite-vec extension.
 *
 * Compared to PGVectorStore:
 * - No external database service required
 * - Suitable for local desktop applications
 * - Performance slightly lower than PostgreSQL but fully featured
 */

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export interface VectorSearchResult {
  id: string;
  content: string;
  score: number;
  documentId: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface SchemaModule {
  ragChunks: {
    id: unknown;
    documentId: unknown;
    userId: unknown;
    content: unknown;
    embedding: unknown;
    metadata: unknown;
    chunkIndex: unknown;
  };
  ragDocuments: {
    id: unknown;
    documentId: unknown;
    userId: unknown;
    fileName: unknown;
  };
  InsertRAGChunk: Record<string, unknown>;
  InsertRAGDocument: Record<string, unknown>;
}

/**
 * SQLite Vector Store class.
 */
export class SQLiteVecStore {
  private db: Database.Database;
  private drizzleDb: any; // Drizzle instance
  private vecTableName: string;
  private initialized = false;

  constructor(dbPath: string, schemaModule: SchemaModule) {
    // Open database connection
    this.db = new Database(dbPath);

    // Enable WAL mode
    this.db.pragma("journal_mode = WAL");
    // Use FULL to maximize durability under sudden power loss.
    this.db.pragma("synchronous = FULL");

    // Load sqlite-vec extension
    try {
      (sqliteVec as any).load(this.db);
      console.log("✅ sqlite-vec extension loaded");
    } catch (error) {
      console.error("❌ Failed to load sqlite-vec:", error);
      throw error;
    }

    // Lazy-init Drizzle to avoid import cycle
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.initDrizzle(schemaModule);

    // User-specific vector table name (using a common name)
    this.vecTableName = "rag_chunks_vec";

    // Initialize vector table
    this.initVectorTable();
  }

  private async initDrizzle(schemaModule: SchemaModule): Promise<void> {
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    this.drizzleDb = drizzle(this.db, { schema: schemaModule as any });
  }

  /**
   * Initialize vector table (using sqlite-vec's vec0 virtual table).
   */
  private initVectorTable() {
    try {
      // Check if table already exists
      const existingTable = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(this.vecTableName);

      if (!existingTable) {
        console.log(`📝 Creating vector table: ${this.vecTableName}`);

        // Create vec0 virtual table
        // Embedding vector dimension is 1536 (OpenAI text-embedding-3-small dimension)
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS ${this.vecTableName}
          USING vec0(
            embedding float[1536],
            chunk_id TEXT PRIMARY KEY
          )
        `);

        console.log(`✅ Vector table created: ${this.vecTableName}`);
      } else {
        console.log(`✅ Vector table already exists: ${this.vecTableName}`);
      }

      this.initialized = true;
    } catch (error) {
      console.error("❌ Failed to initialize vector table:", error);
      throw error;
    }
  }

  /**
   * Add document chunk to vector store.
   */
  async addChunk(chunk: DocumentChunk): Promise<void> {
    try {
      // 1. First insert into rag_chunks table
      const chunkData: Record<string, unknown> = {
        id: chunk.id,
        documentId: chunk.documentId,
        userId: "local", // Fixed user ID for local mode
        chunkIndex: 0, // Can be obtained from metadata
        content: chunk.content,
        embedding: JSON.stringify(chunk.embedding),
        metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : null,
      };

      await this.drizzleDb
        .insert({} as any) // schema resolved at runtime
        .values(chunkData)
        .onConflictDoNothing();

      // 2. Insert vector into vec0 table
      const vecStmt = this.db.prepare(`
        INSERT INTO ${this.vecTableName} (embedding, chunk_id)
        VALUES (?, ?)
        ON CONFLICT(chunk_id) DO UPDATE SET embedding = excluded.embedding
      `);

      // Convert embedding array to the format required by sqlite-vec
      const embeddingBytes = this.floatArrayToBytes(chunk.embedding);
      vecStmt.run(embeddingBytes, chunk.id);

      console.log(`✅ Added chunk ${chunk.id} to vector store`);
    } catch (error) {
      console.error(`❌ Failed to add chunk ${chunk.id}:`, error);
      throw error;
    }
  }

  /**
   * Batch add document chunks.
   */
  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    const insertMany = this.db.transaction(async (chunks: DocumentChunk[]) => {
      for (const chunk of chunks) {
        await this.addChunk(chunk);
      }
    });

    await insertMany(chunks);
  }

  /**
   * Vector similarity search.
   * @param queryEmbedding Query vector
   * @param limit Number of results to return
   * @param userId Optional user ID filter
   * @returns List of search results
   */
  async similaritySearch(
    queryEmbedding: number[],
    limit = 10,
    userId?: string,
  ): Promise<VectorSearchResult[]> {
    try {
      if (!this.initialized) {
        throw new Error("Vector store not initialized");
      }

      // Convert query vector to byte array
      const queryBytes = this.floatArrayToBytes(queryEmbedding);

      // Perform vector search
      // Use KNN search algorithm
      const sql = `
        SELECT
          chunk_id,
          distance
        FROM ${this.vecTableName}
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
      `;

      const results = this.db.prepare(sql).all(queryBytes, limit) as Array<{
        chunk_id: string;
        distance: number;
      }>;

      // Get full chunk information
      const chunkIds = results.map((r) => r.chunk_id);

      // Dynamic import of schema-dependent types at call time
      const { eq } = await import("drizzle-orm");
      const schemaModule = (this as any)._schemaModule;
      if (!schemaModule || chunkIds.length === 0) {
        return results.map((result) => ({
          id: result.chunk_id,
          content: "",
          score: 1 - result.distance,
          documentId: "",
          metadata: undefined,
        }));
      }

      const chunks = await this.drizzleDb
        .select()
        .from(schemaModule.ragChunks)
        .where(eq(schemaModule.ragChunks.id as any, chunkIds[0]));

      // Merge results
      const finalResults: VectorSearchResult[] = results.map((result) => {
        const chunk = chunks.find((c: any) => c.id === result.chunk_id);
        return {
          id: result.chunk_id,
          content: chunk?.content || "",
          score: 1 - result.distance, // Convert distance to similarity score
          documentId: chunk?.documentId || "",
          metadata: chunk?.metadata
            ? JSON.parse(chunk.metadata as string)
            : undefined,
        };
      });

      return finalResults;
    } catch (error) {
      console.error("❌ Vector search failed:", error);
      throw error;
    }
  }

  /**
   * Delete a document and all its chunks.
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const schemaModule = (this as any)._schemaModule;

      // 1. Get all chunk IDs for the document
      if (schemaModule) {
        const { eq } = await import("drizzle-orm");
        const chunks = await this.drizzleDb
          .select({ id: (schemaModule.ragChunks as any).id })
          .from(schemaModule.ragChunks)
          .where(eq((schemaModule.ragChunks as any).documentId, documentId));

        // 2. Delete from vector table
        const deleteVecStmt = this.db.prepare(`
          DELETE FROM ${this.vecTableName} WHERE chunk_id = ?
        `);

        const deleteVec = this.db.transaction((chunkIds: string[]) => {
          for (const chunkId of chunkIds) {
            deleteVecStmt.run(chunkId);
          }
        });

        await deleteVec(chunks.map((c: any) => c.id));

        // 3. Delete from rag_chunks table
        await this.drizzleDb
          .delete(schemaModule.ragChunks)
          .where(eq((schemaModule.ragChunks as any).documentId, documentId));

        // 4. Delete from rag_documents table
        await this.drizzleDb
          .delete(schemaModule.ragDocuments)
          .where(eq((schemaModule.ragDocuments as any).id, documentId));
      }

      console.log(`✅ Deleted document ${documentId} and its chunks`);
    } catch (error) {
      console.error(`❌ Failed to delete document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Get total document count.
   */
  async getDocumentCount(): Promise<number> {
    try {
      const schemaModule = (this as any)._schemaModule;
      if (!schemaModule) return 0;

      const result = await this.drizzleDb
        .select({ count: (schemaModule.ragDocuments as any).id })
        .from(schemaModule.ragDocuments);

      return result.length;
    } catch (error) {
      console.error("❌ Failed to get document count:", error);
      return 0;
    }
  }

  /**
   * Get total chunk count.
   */
  async getChunkCount(): Promise<number> {
    try {
      const schemaModule = (this as any)._schemaModule;
      if (!schemaModule) return 0;

      const result = await this.drizzleDb
        .select({ count: (schemaModule.ragChunks as any).id })
        .from(schemaModule.ragChunks);

      return result.length;
    } catch (error) {
      console.error("❌ Failed to get chunk count:", error);
      return 0;
    }
  }

  /**
   * Clear all vector data.
   */
  async clear(): Promise<void> {
    try {
      const schemaModule = (this as any)._schemaModule;

      // Delete vector table
      this.db.exec(`DROP TABLE IF EXISTS ${this.vecTableName}`);

      // Delete RAG tables
      if (schemaModule) {
        await this.drizzleDb.delete(schemaModule.ragChunks);
        await this.drizzleDb.delete(schemaModule.ragDocuments);
      }

      // Re-initialize
      this.initVectorTable();

      console.log("✅ Cleared all vector data");
    } catch (error) {
      console.error("❌ Failed to clear vector data:", error);
      throw error;
    }
  }

  /**
   * Close database connection.
   */
  close(): void {
    try {
      this.db.close();
      console.log("✅ Vector store connection closed");
    } catch (error) {
      console.error("❌ Failed to close connection:", error);
    }
  }

  /**
   * Convert float array to byte array format required by sqlite-vec.
   */
  private floatArrayToBytes(arr: number[]): Buffer {
    const buffer = Buffer.allocUnsafe(arr.length * 4);
    for (let i = 0; i < arr.length; i++) {
      buffer.writeFloatLE(arr[i], i * 4);
    }
    return buffer;
  }

  /**
   * Convert byte array to float array.
   */
  private bytesToFloatArray(buffer: Buffer): number[] {
    const arr: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      arr.push(buffer.readFloatLE(i));
    }
    return arr;
  }
}

/**
 * Get SQLiteVecStore instance (singleton pattern).
 */
let vectorStoreInstance: SQLiteVecStore | null = null;

export async function getSQLiteVecStore(
  dbPath: string,
  schemaModule: SchemaModule,
): Promise<SQLiteVecStore> {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new SQLiteVecStore(dbPath, schemaModule);
    // Attach schema module for use in methods
    (vectorStoreInstance as any)._schemaModule = schemaModule;
  }
  return vectorStoreInstance;
}

/**
 * Close and reset the vector store instance.
 */
export function resetSQLiteVecStore(): void {
  if (vectorStoreInstance) {
    vectorStoreInstance.close();
    vectorStoreInstance = null;
  }
}
