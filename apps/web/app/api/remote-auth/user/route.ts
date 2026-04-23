/**
 * Cloud user information API
 * Used to get current logged-in user information in Tauri desktop version
 *
 * - Web version: handle directly
 * - Tauri desktop version: forward to cloud
 */

import type { NextRequest } from "next/server";
import { getUserById, updateUserProfile } from "@/lib/db/queries";
import {
  verifyToken,
  extractToken,
  withErrorHandler,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/auth/remote-auth-utils";

import { createCloudClientForRequest } from "@/lib/auth/remote-client";
import { isTauriMode } from "@/lib/env/constants";

export async function GET(request: NextRequest) {
  // Tauri desktop version: forward to cloud
  if (isTauriMode()) {
    const cloudClient = createCloudClientForRequest(request);

    if (!cloudClient) {
      return createErrorResponse("Cloud API not available", 503);
    }

    try {
      const result = await cloudClient.getCurrentUser();
      return createSuccessResponse(result);
    } catch (error) {
      console.error(
        "[Remote Auth] Failed to forward get user to cloud:",
        error,
      );
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to get user",
        500,
      );
    }
  }

  // Web version: handle directly
  return withErrorHandler(async () => {
    const token = extractToken(request);

    if (!token) {
      return createErrorResponse("Unauthorized", 401);
    }

    const result = verifyToken(token);

    if (!result) {
      return createErrorResponse("Invalid token", 401);
    }

    // Get user information
    const user = await getUserById(result.id);

    if (!user) {
      return createErrorResponse("User not found", 404);
    }

    return createSuccessResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });
  });
}

export async function PUT(request: NextRequest) {
  // Tauri desktop version: forward to cloud
  if (isTauriMode()) {
    const cloudClient = createCloudClientForRequest(request);

    if (!cloudClient) {
      return createErrorResponse("Cloud API not available", 503);
    }

    try {
      const body = await request.json();
      const result = await cloudClient.updateUser(body);
      return createSuccessResponse(result);
    } catch (error) {
      console.error(
        "[Remote Auth] Failed to forward update user to cloud:",
        error,
      );
      return createErrorResponse(
        error instanceof Error ? error.message : "Failed to update user",
        500,
      );
    }
  }

  // Web version: handle directly
  return withErrorHandler(async () => {
    const token = extractToken(request);

    if (!token) {
      return createErrorResponse("Unauthorized", 401);
    }

    const result = verifyToken(token);

    if (!result) {
      return createErrorResponse("Invalid token", 401);
    }

    const body = await request.json();
    const { name, avatarUrl } = body;

    // Update user information
    const updatedUser = await updateUserProfile(result.id, { name, avatarUrl });

    if (!updatedUser) {
      return createErrorResponse("User not found", 404);
    }

    return createSuccessResponse({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatarUrl: updatedUser.avatarUrl,
    });
  });
}
