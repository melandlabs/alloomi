/**
 * Database batch operation utilities
 *
 * Provides batch insert operations that respect database-specific
 * parameter limits (e.g., SQLite's ~999 limit).
 */

// SQLite single binding parameter limit is about 999, insert in batches to avoid "Too many parameter values were provided"
export const DB_INSERT_CHUNK_SIZE = 100;

/**
 * Execute batch insert operations in chunks
 * @param items Array of data to insert
 * @param chunkSize Size of each batch
 * @param insertFn Insert function that receives a batch of data
 */
export async function batchInsert<T>(
  items: T[],
  chunkSize: number,
  insertFn: (chunk: T[]) => Promise<unknown>,
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const result = await insertFn(chunk);
    // If returns array, merge results
    if (Array.isArray(result)) {
      results.push(...result);
    } else {
      results.push(result);
    }
  }
  return results;
}
