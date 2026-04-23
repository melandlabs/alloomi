/**
 * Interface for storage providers, defining basic data storage operations
 */
export interface StorageProvider {
  /**
   * Initialize the storage provider
   * Can be used to connect to databases, create necessary storage structures, etc.
   */
  initialize(): Promise<void>;

  /**
   * Save data to storage
   * @param key Unique identifier for the data
   * @param value Binary data to be stored
   */
  save(key: string, value: Uint8Array): Promise<void>;

  /**
   * Load data from storage
   * @param key Unique identifier of the data to load
   * @returns The corresponding binary data
   */
  load(key: string): Promise<Uint8Array>;

  /**
   * Check if a key exists in storage
   * @param key Unique identifier to check
   * @returns True if exists, false otherwise
   */
  exists(key: string): Promise<boolean>;

  /**
   * Delete data from storage
   * @param key Unique identifier of the data to delete
   */
  delete(key: string): Promise<void>;
}
