/**
 * OAuth state management via Redis
 *
 * Stores temporary OAuth state during the OAuth flow to prevent CSRF attacks.
 * State is keyed by userId and contains redirect URI and metadata.
 */

import redis from "@/lib/session/context";

// Redis key prefix for OAuth state
const OAUTH_STATE_PREFIX = "oauth_state:";

// OAuth state TTL in seconds (10 minutes)
const OAUTH_STATE_TTL_SECONDS = 600;

export interface OAuthStateData {
  /** The redirect URI to use after successful OAuth */
  redirectUri: string;
  /** Timestamp when the state was created */
  createdAt: number;
}

/**
 * Store OAuth state for a user
 */
export async function storeOAuthState(
  userId: string,
  state: string,
  data: OAuthStateData,
): Promise<void> {
  if (!redis) {
    console.warn("[oauth] Redis not available, skipping state store");
    return;
  }
  const key = `${OAUTH_STATE_PREFIX}${userId}:${state}`;
  await redis.set(key, JSON.stringify(data), "EX", OAUTH_STATE_TTL_SECONDS);
}

/**
 * Retrieve OAuth state for a user
 */
export async function getOAuthState(
  userId: string,
  state: string,
): Promise<OAuthStateData | null> {
  if (!redis) {
    return null;
  }
  const key = `${OAUTH_STATE_PREFIX}${userId}:${state}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OAuthStateData;
  } catch {
    return null;
  }
}

/**
 * Delete OAuth state for a user
 */
export async function deleteOAuthState(
  userId: string,
  state: string,
): Promise<void> {
  if (!redis) {
    return;
  }
  const key = `${OAUTH_STATE_PREFIX}${userId}:${state}`;
  await redis.del(key);
}

/**
 * Clear all OAuth states for a user
 */
export async function clearAllOAuthStates(userId: string): Promise<void> {
  if (!redis) {
    return;
  }
  const pattern = `${OAUTH_STATE_PREFIX}${userId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
