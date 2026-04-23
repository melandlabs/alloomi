import type { StorageProvider } from "./provider";

/**
 * In-memory implementation of the StorageProvider interface
 * Stores data in a Map. Useful for testing or ephemeral storage needs.
 * Data is lost when the process restarts.
 */
export class MemoryStorageProvider implements StorageProvider {
  private store: Map<string, Uint8Array> = new Map();

  /**
   * Initialize memory storage provider (no-op)
   */
  async initialize(): Promise<void> {
    // No initialization needed for in-memory storage
  }

  /**
   * Save data to memory store
   * @param key - Unique identifier for the data
   * @param value - Binary data to store
   */
  async save(key: string, value: Uint8Array): Promise<void> {
    this.store.set(key, value);
  }

  /**
   * Load data from memory store
   * @param key - Unique identifier for the data
   * @returns Stored binary data
   * @throws Error if the key does not exist
   */
  async load(key: string): Promise<Uint8Array> {
    const value = this.store.get(key);
    if (value === undefined) {
      throw new Error(`Key not found: ${key}`);
    }
    return value;
  }

  /**
   * Check if a key exists in the memory store
   * @param key - Unique identifier to check
   * @returns True if exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  /**
   * Delete data from memory store
   * @param key - Unique identifier for the data to delete
   */
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Clear all data from the memory store
   */
  async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Get the number of items in the store
   */
  get size(): number {
    return this.store.size;
  }
}
