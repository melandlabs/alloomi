/**
 * Cloud API unified authentication utility
 *
 * Supports:
 * 1. Session cookie authentication (Web)
 * 2. Bearer token authentication (Local/Tauri)
 */

import type { NextRequest } from "next/server";
import { auth, type UserType } from "@/app/(auth)/auth";
import { verifyToken, extractToken } from "@/lib/auth/remote-auth-utils";
import { getUserById, getUserTypeForService } from "@/lib/db/queries";

export interface CloudAuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  type: UserType;
}

/**
 * Unified authentication - supports Session and Bearer Token
 *
 * @param request - Next.js Request object
 * @returns Authenticated user info or null
 */
export async function authenticateCloudRequest(
  request: Request,
): Promise<CloudAuthUser | null> {
  // 1. First try Bearer token authentication (local)
  const token = extractToken(request as NextRequest);

  if (token) {
    // JWT token authentication
    const tokenResult = verifyToken(token);

    if (!tokenResult) {
      return null;
    }
    // Token valid, get full user info
    let user = await getUserById(tokenResult.id);

    // If user not found, try adding cloud_ prefix (shadow user)
    if (!user && !tokenResult.id.startsWith("cloud_")) {
      user = await getUserById(`cloud_${tokenResult.id}`);
    }

    if (!user) {
      return null;
    }

    const userType = await getUserTypeForService(user.id);

    return {
      id: user.id,
      email: user.email || "",
      name: user.name,
      avatarUrl: user.avatarUrl,
      type: userType,
    };
  }

  // 2. Try Session cookie authentication (Web)
  const session = await auth();

  if (session?.user) {
    return {
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name || null,
      avatarUrl: session.user.avatarUrl || null,
      type: session.user.type,
    };
  }
  return null;
}

/**
 * Auth middleware - returns error response when auth fails
 */
export async function requireCloudAuth(
  request: Request,
): Promise<{ user: CloudAuthUser } | { error: string; status: number }> {
  const user = await authenticateCloudRequest(request);

  if (!user) {
    return {
      error: "Unauthorized",
      status: 401,
    };
  }

  return { user };
}
