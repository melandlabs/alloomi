/**
 * Offline manager
 * Detects network status, supports offline mode and data synchronization
 */

import { shouldUseCloudAuth } from "@/lib/auth/remote-client";
import { getAuthToken } from "@/lib/auth/token-manager";

/**
 * Network status
 */
export type NetworkStatus = "online" | "offline" | "unknown";

/**
 * Sync status
 */
export type SyncStatus = "idle" | "syncing" | "failed" | "success";

/**
 * Sync item
 */
export interface SyncItem {
  id: string;
  type: "chat" | "message" | "bot" | "insight" | "setting";
  action: "create" | "update" | "delete";
  data: unknown;
  timestamp: number;
  retryCount: number;
}

/**
 * Offline manager class
 */
export class OfflineManager {
  private isOnline = true;
  private syncStatus: SyncStatus = "idle";
  private syncQueue: SyncItem[] = [];
  private listeners: Set<(status: NetworkStatus) => void> = new Set();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  // Max sync queue size to prevent localStorage overflow
  private static readonly MAX_QUEUE_SIZE = 500;

  constructor() {
    if (typeof window !== "undefined") {
      this.initialize();
    }
  }

  /**
   * Initialize offline manager
   */
  private initialize(): void {
    // Check initial network status
    this.isOnline = navigator.onLine;

    // Listen for network status changes
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);

    // Load incomplete sync queue
    this.loadSyncQueue();

    // If online and has pending sync data, start syncing
    if (this.isOnline && this.syncQueue.length > 0) {
      this.startSync();
    }
  }

  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    this.isOnline = true;
    this.notifyListeners("online");

    // Start syncing pending data
    if (this.syncQueue.length > 0) {
      this.startSync();
    }
  };

  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    this.isOnline = false;
    this.notifyListeners("offline");

    // Stop syncing
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  };

  /**
   * Notify all listeners
   */
  private notifyListeners(status: NetworkStatus): void {
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.error("[OfflineManager] Listener error:", error);
      }
    });
  }

  /**
   * Load sync queue
   */
  private loadSyncQueue(): void {
    try {
      const stored = localStorage.getItem("sync_queue");
      if (stored) {
        this.syncQueue = JSON.parse(stored);
        // Prune queue to max size on load (keep most recent items)
        this.pruneQueue();
      }
    } catch (error) {
      console.error("[OfflineManager] Failed to load sync queue:", error);
    }
  }

  /**
   * Prune queue to max size - keeps most recent items
   */
  private pruneQueue(): void {
    if (this.syncQueue.length > OfflineManager.MAX_QUEUE_SIZE) {
      // Sort by timestamp descending and keep the newest items
      this.syncQueue.sort((a, b) => b.timestamp - a.timestamp);
      this.syncQueue = this.syncQueue.slice(0, OfflineManager.MAX_QUEUE_SIZE);
      this.saveSyncQueue();
    }
  }

  /**
   * Save sync queue
   */
  private saveSyncQueue(): void {
    try {
      localStorage.setItem("sync_queue", JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error("[OfflineManager] Failed to save sync queue:", error);
    }
  }

  /**
   * Start syncing
   */
  private async startSync(): Promise<void> {
    if (this.syncStatus === "syncing") {
      return;
    }

    this.syncStatus = "syncing";

    try {
      while (this.syncQueue.length > 0 && this.isOnline) {
        const item = this.syncQueue[0];

        try {
          await this.syncItem(item);

          // Sync successful, remove from queue
          this.syncQueue.shift();
          this.saveSyncQueue();
        } catch (error) {
          console.error("[OfflineManager] Sync item failed:", error);

          // Increment retry count
          item.retryCount++;

          // If retry count exceeds threshold, remove the item
          if (item.retryCount >= 3) {
            console.error(
              "[OfflineManager] Max retries exceeded, removing item:",
              item.id,
            );
            this.syncQueue.shift();
            this.saveSyncQueue();
          } else {
            // Move to end of queue, retry later
            const shiftedItem = this.syncQueue.shift();
            if (shiftedItem) {
              this.syncQueue.push(shiftedItem);
            }
            this.saveSyncQueue();

            // Wait for a period before continuing
            await this.delay(5000);
          }
        }
      }

      this.syncStatus = "success";
    } catch (error) {
      console.error("[OfflineManager] Sync failed:", error);
      this.syncStatus = "failed";
    } finally {
      // Reset status after 5 seconds
      // Clear previous timer first to prevent accumulation
      if (this.syncTimer) {
        clearTimeout(this.syncTimer);
      }
      this.syncTimer = setTimeout(() => {
        this.syncStatus = "idle";
      }, 5000);
    }
  }

  /**
   * Sync single item
   */
  private async syncItem(item: SyncItem): Promise<void> {
    const token = getAuthToken();

    if (!token) {
      throw new Error("No auth token");
    }

    const cloudUrl =
      process.env.CLOUD_API_URL || process.env.NEXT_PUBLIC_CLOUD_API_URL;

    if (!cloudUrl) {
      throw new Error("Cloud API URL not configured");
    }

    // Sync to different API endpoints based on type
    const endpoint = this.getEndpointForType(item.type);

    await fetch(`${cloudUrl}/api/sync/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: item.action,
        data: item.data,
      }),
    });
  }

  /**
   * Get sync endpoint
   */
  private getEndpointForType(type: SyncItem["type"]): string {
    const endpoints: Record<SyncItem["type"], string> = {
      chat: "chats",
      message: "messages",
      bot: "bots",
      insight: "insights",
      setting: "settings",
    };

    return endpoints[type];
  }

  /**
   * Delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Add pending sync item
   */
  public addSyncItem(
    item: Omit<SyncItem, "id" | "timestamp" | "retryCount">,
  ): void {
    // Only sync when using cloud authentication
    if (!shouldUseCloudAuth()) {
      return;
    }

    const syncItem: SyncItem = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substring(2)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(syncItem);

    // Enforce max queue size to prevent localStorage overflow
    this.pruneQueue();
    this.saveSyncQueue();

    // If online, start syncing immediately
    if (this.isOnline && this.syncStatus !== "syncing") {
      this.startSync();
    }
  }

  /**
   * Get current network status
   */
  public getNetworkStatus(): NetworkStatus {
    if (typeof window === "undefined") return "unknown";
    return this.isOnline ? "online" : "offline";
  }

  /**
   * Get sync status
   */
  public getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  /**
   * Get pending sync item count
   */
  public getPendingSyncCount(): number {
    return this.syncQueue.length;
  }

  /**
   * Manually trigger sync
   */
  public async manualSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error("Cannot sync while offline");
    }

    await this.startSync();
  }

  /**
   * Listen for network status changes
   */
  public onNetworkStatusChange(
    listener: (status: NetworkStatus) => void,
  ): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Clear sync queue
   */
  public clearSyncQueue(): void {
    this.syncQueue = [];
    this.saveSyncQueue();
  }

  /**
   * Destroy offline manager
   */
  public destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.listeners.clear();
  }
}

// Global singleton
let offlineManagerInstance: OfflineManager | null = null;

/**
 * Get offline manager instance
 */
export function getOfflineManager(): OfflineManager {
  if (!offlineManagerInstance) {
    offlineManagerInstance = new OfflineManager();
  }

  return offlineManagerInstance;
}

/**
 * Check if online
 */
export function isOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

/**
 * Check if offline
 */
export function isOffline(): boolean {
  return !isOnline();
}

/**
 * Add pending sync item (convenience function)
 */
export function addSyncItem(
  item: Omit<SyncItem, "id" | "timestamp" | "retryCount">,
): void {
  const manager = getOfflineManager();
  manager.addSyncItem(item);
}
