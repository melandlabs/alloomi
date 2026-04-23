/**
 * Cloud integration sync logic
 *
 * Used to sync integration accounts from cloud to local in local version (executed once on app startup)
 */

import { getAuthToken } from "@/lib/auth/token-manager";
import { isTauriMode } from "@/lib/env/client-mode";

/**
 * Sync cloud integration accounts to local
 *
 * Calls /api/integrations/accounts, this API automatically fetches and syncs new accounts from cloud
 */
export async function syncCloudIntegrationsToLocal(): Promise<number> {
  // Only enabled in Tauri mode
  if (!isTauriMode()) {
    return 0;
  }

  // Get authentication token
  const token = getAuthToken();
  if (!token) {
    console.warn("[CloudSync] No auth token, skipping sync");
    return 0;
  }

  try {
    // Call /api/integrations/accounts to trigger sync
    const response = await fetch("/api/integrations/accounts", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn("[CloudSync] Sync request failed:", response.status);
      return 0;
    }

    const data = (await response.json()) as { accounts: unknown[] };
    return data.accounts?.length || 0;
  } catch (error) {
    console.error("[CloudSync] Failed to sync cloud integrations:", error);
    return 0;
  }
}

/**
 * Sync once on initialization
 *
 * No longer need continuous polling because:
 * 1. Polling after OAuth callback automatically syncs new accounts
 * 2. Syncing once on app startup is enough to get existing accounts
 */
export function initializeCloudSync(): void {
  if (!isTauriMode()) {
    return;
  }

  console.log("[CloudSync] Initializing cloud sync");

  syncCloudIntegrationsToLocal().then((count) => {
    console.log(`[CloudSync] Initialized with ${count} account(s)`);
  });
}
