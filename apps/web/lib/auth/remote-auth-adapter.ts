import {
  getCloudApiClient,
  shouldUseCloudAuth,
} from "@/lib/auth/remote-client";
import type { User } from "../db/schema";

/**
 * Cloud user response type
 */
export interface CloudUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  subscription?: string | null;
}

/**
 * Auth response type
 */
export interface AuthResponse {
  user: CloudUser;
  token: string;
}

/**
 * Shadow user: local database user record
 * Associated with cloud user ID
 */
export interface ShadowUser extends User {
  cloudUserId: string; // Cloud user ID
  cloudToken?: string; // Cloud auth token (optional, not stored in database)
}

/**
 * User login request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * User register request
 */
export interface RegisterRequest {
  email: string;
  password: string;
}

/**
 * OAuth login request
 */
export interface OAuthRequest {
  provider: "google" | "slack" | "discord";
  code: string;
  state: string;
}

/**
 * Check if should use remote auth
 */
export function shouldUseRemoteAuth(): boolean {
  return shouldUseCloudAuth();
}

/**
 * User login
 */
export async function login(
  email: string,
  password: string,
): Promise<{ user: User; token: string }> {
  const client = getCloudApiClient();
  if (!client) {
    throw new Error("Cloud API client not available");
  }

  // Call cloud API for login
  const response = await client.login(email, password);

  // Save token
  client.setAuthToken(response.token);

  // Return user info (note: User type here doesn't fully match, needs type conversion)
  return {
    user: {
      ...response.user,
      password: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      firstLoginAt: new Date(),
      lastLoginAt: new Date(),
      finishOnboarding: false,
    } as User,
    token: response.token,
  };
}

/**
 * User register
 */
export async function register(
  email: string,
  password: string,
): Promise<{ user: User; token: string }> {
  const client = getCloudApiClient();
  if (!client) {
    throw new Error("Cloud API client not available");
  }

  // Call cloud API for registration
  const response = await client.register(email, password);

  // Save token
  client.setAuthToken(response.token);

  // Return user info
  return {
    user: {
      ...response.user,
      password: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      firstLoginAt: new Date(),
      lastLoginAt: new Date(),
      finishOnboarding: false,
    } as User,
    token: response.token,
  };
}

/**
 * OAuth login
 */
export async function oauthLogin(
  provider: "google" | "slack" | "discord",
  code: string,
  state: string,
): Promise<{ user: User; token: string }> {
  const client = getCloudApiClient();
  if (!client) {
    throw new Error("Cloud API client not available");
  }

  // Call cloud API for OAuth login
  const response = await client.oauthLogin(provider, code, state);

  // Save token
  client.setAuthToken(response.token);

  // Return user info
  return {
    user: {
      ...response.user,
      password: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      firstLoginAt: new Date(),
      lastLoginAt: new Date(),
      finishOnboarding: false,
    } as User,
    token: response.token,
  };
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<User | null> {
  const client = getCloudApiClient();
  if (!client) {
    return null;
  }

  try {
    const cloudUser = await client.getCurrentUser();
    return await getOrCreateShadowUser(cloudUser);
  } catch (error) {
    console.error("Failed to get current user from cloud:", error);
    return null;
  }
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  const client = getCloudApiClient();
  if (client) {
    client.clearAuthToken();
  }
}

/**
 * Get or create shadow user
 *
 * Shadow user is a local database user record for associating with cloud user.
 * This allows local app data (Chat, Message, Bot, etc.) to properly associate with user ID.
 */
async function getOrCreateShadowUser(cloudUser: CloudUser): Promise<User> {
  const { getUserById } = await import("@/lib/db/queries");
  const { db } = await import("@/lib/db");
  const { user } = await import("@/lib/db/schema");

  // Shadow user ID format: cloud_<cloudUserId>
  // Avoid cloud_cloud_xxx if caller already added prefix
  const shadowUserId = cloudUser.id.startsWith("cloud_")
    ? cloudUser.id
    : `cloud_${cloudUser.id}`;

  // 1. Try to get existing shadow user
  const existing = await getUserById(shadowUserId);
  if (existing) {
    return existing;
  }

  // 2. Create new shadow user
  // Use SHA-256 hash as password (placeholder, actual auth handled by cloud)
  const { createHash } = await import("node:crypto");
  const dummyPassword = createHash("sha256")
    .update(`shadow_${cloudUser.id}_${Date.now()}`)
    .digest("hex");

  const now = new Date();

  try {
    const [newUser] = await db
      .insert(user)
      .values({
        id: shadowUserId,
        email: cloudUser.email,
        name: cloudUser.name || "Cloud User",
        avatarUrl: cloudUser.avatarUrl,
        password: dummyPassword,
        createdAt: now,
        updatedAt: now,
        firstLoginAt: now,
        lastLoginAt: now,
        finishOnboarding: false,
      })
      .returning();

    return newUser;
  } catch (error) {
    console.error("[RemoteAuth] Failed to create shadow user:", error);
    throw error;
  }
}

/**
 * Verify if token is valid
 */
export async function validateToken(token: string): Promise<boolean> {
  const client = getCloudApiClient();
  if (!client) {
    return false;
  }

  try {
    client.setAuthToken(token);
    await client.getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if using remote auth mode
 */
export function isRemoteAuthMode(): boolean {
  return shouldUseRemoteAuth();
}

/**
 * Get auth mode
 */
export function getAuthMode(): "local" | "remote" {
  return isRemoteAuthMode() ? "remote" : "local";
}
