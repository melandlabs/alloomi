/**
 * Auth Token Management Utilities
 * Used to store and retrieve cloud auth tokens in Tauri mode
 *
 * Migration strategy: cookie-first reads, localStorage fallback.
 * New sessions: token stored in httpOnly + non-httpOnly cookie
 * Old sessions (not through login/register flow): continue reading from localStorage
 */

import { shouldUseCloudAuth } from "@/lib/auth/remote-client";
import { AUTH_TOKEN_CLIENT_COOKIE } from "./cookie-names";

// Token refresh related constants
const TOKEN_REFRESH_THRESHOLD = 7 * 24 * 60 * 60; // 7 days (seconds)
const REFRESH_RETRY_KEY = "token_refresh_retry";

const TOKEN_KEY = "cloud_auth_token";

// Cloud auth token storage for local scheduler
// In Tauri mode, login page sets token, scheduler reads for API calls
let schedulerCloudAuthToken: string | undefined;

/**
 * Set scheduler cloud auth token
 * Called by login page in Tauri mode, read by scheduler
 */
export function setCloudAuthToken(token: string | undefined) {
  schedulerCloudAuthToken = token;
}

/**
 * Get scheduler cloud auth token
 */
export function getCloudAuthToken(): string | undefined {
  return schedulerCloudAuthToken;
}

/**
 * Extract cookie value by name from document.cookie.
 * Note: document.cookie does not return all cookies at once, can only be parsed through full string.
 */
function getCookie(name: string): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [key, ...valueParts] = cookie.trim().split("=");
      if (key === name) {
        return valueParts.join("=");
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Store auth token
 * Writes to both non-httpOnly cookie and localStorage:
 * - non-httpOnly cookie (cloud_auth_token_client) for getAuthToken() cookie-first reads
 * - localStorage for old session fallback compatibility
 */
export function storeAuthToken(token: string): void {
  if (typeof window === "undefined") return;

  // Write non-httpOnly cookie (for getAuthToken cookie-first reads)
  try {
    const maxAge = Number.parseInt(
      process.env.AUTH_TOKEN_EXPIRY_SECONDS || "7776000",
      10,
    );
    // Only add 'secure' flag when actually on HTTPS (web production).
    // In Tauri production mode, the app runs on http://localhost where 'secure'
    // would prevent the cookie from being stored at all.
    const isHttps =
      typeof window !== "undefined" && window.location.protocol === "https:";
    const securePart =
      process.env.NODE_ENV === "production" && isHttps ? "; secure" : "";
    const cookieStr = `${AUTH_TOKEN_CLIENT_COOKIE}=${token}; path=/; max-age=${maxAge}; samesite=lax${securePart}`;
    document.cookie = cookieStr;
  } catch (error) {
    console.error("[TokenManager] Failed to store token cookie:", error);
  }

  import("@tauri-apps/api/core")
    .then(({ invoke }) => {
      invoke("save_token", { token })
        .then(() => console.log("[TokenManager] Token saved"))
        .catch((e: unknown) =>
          console.error("[TokenManager] Failed to save token:", e),
        );
    })
    .catch(() => {});
}

/**
 * Get auth token
 * Prefer reading from cookie (new sessions), fallback to localStorage (old sessions).
 * Cookie reads the non-httpOnly cloud_auth_token_client.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    // Prefer reading from cookie (cookie-first, new sessions after migration)
    const cookieToken = getCookie(AUTH_TOKEN_CLIENT_COOKIE);
    if (cookieToken) return cookieToken;

    // Fallback to localStorage (old session compatibility)
    const localStorageToken = localStorage.getItem(TOKEN_KEY);
    if (localStorageToken) return localStorageToken;

    // Tauri fallback: try to read directly from Tauri storage
    // This handles cases where cookie/localStorage sync failed
    return getAuthTokenFromTauri();
  } catch (error) {
    console.error("[TokenManager] Failed to get token:", error);
    return null;
  }
}

/**
 * Read auth token directly from Tauri storage
 * Used as fallback when cookie/localStorage are not available
 */
function getAuthTokenFromTauri(): string | null {
  // Synchronous access to schedulerCloudAuthToken (set by login page)
  const schedulerToken = getCloudAuthToken();
  if (schedulerToken) return schedulerToken;

  return null;
}

/**
 * Clear auth token
 * Clears localStorage and calls server logout endpoint to clear cookie.
 */
export async function clearAuthToken(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error("[TokenManager] Failed to clear localStorage token:", error);
  }

  // Call logout endpoint to clear cookie
  try {
    await fetch("/api/auth/clear-auth-cookie", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("[TokenManager] Failed to clear auth cookies:", error);
  }

  // Delete token file
  import("@tauri-apps/api/core")
    .then(({ invoke }) => {
      invoke("delete_token").catch(() => {});
    })
    .catch(() => {});
}

/**
 * Check if token is stored
 */
export function hasAuthToken(): boolean {
  return getAuthToken() !== null;
}

/**
 * Parse token to get user info
 */
export function parseToken(token: string): {
  id: string;
  email: string;
  exp: number;
  iat: number;
} | null {
  try {
    // Custom token format: payload.signature (2 parts, not standard JWT)
    // Standard JWT would be: header.payload.signature (3 parts)
    const parts = token.split(".");

    // For 2-part custom tokens, payload is at index 0
    // For 3-part JWT, payload is at index 1
    const encodedPayload = parts.length === 2 ? parts[0] : parts[1];

    if (!encodedPayload) {
      return null;
    }

    // Convert base64url to base64
    // base64url uses - instead of +, _ instead of /, and has no padding
    let base64Payload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if needed
    while (base64Payload.length % 4 !== 0) {
      base64Payload += "=";
    }

    const payload = JSON.parse(
      Buffer.from(base64Payload, "base64").toString("utf-8"),
    );

    return payload;
  } catch (error) {
    console.error("[TokenManager] Failed to parse token:", error);
    return null;
  }
}

/**
 * Get user ID from token
 */
export function getUserIdFromToken(token: string): string | null {
  const payload = parseToken(token);
  return payload?.id || null;
}

/**
 * Get user email from token
 */
export function getEmailFromToken(token: string): string | null {
  const payload = parseToken(token);
  return payload?.email || null;
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = parseToken(token);

  if (!payload || !payload.exp) {
    return true;
  }

  return payload.exp < Math.floor(Date.now() / 1000);
}

/**
 * Verify if token is valid
 */
export function isTokenValid(token: string): boolean {
  if (!token) {
    return false;
  }

  if (isTokenExpired(token)) {
    return false;
  }

  return true;
}

/**
 * Get currently stored valid token
 */
export function getValidToken(): string | null {
  const token = getAuthToken();

  if (!token || !isTokenValid(token)) {
    return null;
  }

  return token;
}

/**
 * Check if using cloud auth
 */
export function shouldUseRemoteAuth(): boolean {
  return shouldUseCloudAuth() && hasAuthToken();
}

/**
 * Check if token needs refresh
 * Returns true when token expiry time is less than threshold
 */
export function shouldRefreshToken(token: string): boolean {
  const payload = parseToken(token);

  if (!payload || !payload.exp) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = payload.exp - now;

  return timeUntilExpiry < TOKEN_REFRESH_THRESHOLD;
}

/**
 * Refresh auth token
 */
export async function refreshToken(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  const currentToken = getAuthToken();

  if (!currentToken) {
    return { success: false, error: "No token to refresh" };
  }

  try {
    const cloudUrl =
      process.env.CLOUD_API_URL || process.env.NEXT_PUBLIC_CLOUD_API_URL;

    if (!cloudUrl) {
      return { success: false, error: "Cloud API URL not configured" };
    }

    const response = await fetch(`${cloudUrl}/api/remote-auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Refresh failed: ${error}` };
    }

    const data = await response.json();

    // Store new token
    storeAuthToken(data.token);

    // Cookie is auto-updated by refresh response's Set-Cookie
    // (Note: server also needs to call setAuthCookies in refresh route)

    return { success: true, token: data.token };
  } catch (error) {
    console.error("[TokenManager] Failed to refresh token:", error);
    return { success: false, error: "Network error" };
  }
}

/**
 * Auto-refresh token (if needed)
 * Use this function before calling API to ensure token is valid
 */
export async function ensureValidToken(): Promise<string | null> {
  const token = getAuthToken();

  if (!token) {
    return null;
  }

  // If token is valid and doesn't need refresh, return directly
  if (isTokenValid(token) && !shouldRefreshToken(token)) {
    return token;
  }

  // If token is expired, try to refresh
  if (!isTokenValid(token)) {
    const result = await refreshToken();
    return result.success ? result.token || null : null;
  }

  // If refresh is needed, refresh in background (don't block current request)
  if (shouldRefreshToken(token)) {
    // Silent refresh, don't wait for result
    refreshToken().catch((error) => {
      console.warn("[TokenManager] Background refresh failed:", error);
    });
  }

  return token;
}

/**
 * Check refresh retry count
 */
export function getRefreshRetryCount(): number {
  if (typeof window === "undefined") return 0;

  try {
    const count = localStorage.getItem(REFRESH_RETRY_KEY);
    return count ? Number.parseInt(count, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Increment refresh retry count
 */
export function incrementRefreshRetryCount(): number {
  if (typeof window === "undefined") return 0;

  try {
    const count = getRefreshRetryCount() + 1;
    localStorage.setItem(REFRESH_RETRY_KEY, count.toString());
    return count;
  } catch {
    return 0;
  }
}

/**
 * Reset refresh retry count
 */
export function resetRefreshRetryCount(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(REFRESH_RETRY_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Get remaining token validity time (seconds)
 */
export function getTokenTimeRemaining(token: string): number {
  const payload = parseToken(token);

  if (!payload || !payload.exp) {
    return 0;
  }

  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}
