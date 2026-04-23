/**
 * Cloud login API
 * Used for remote authentication in Tauri desktop version
 *
 * - Web: direct handling
 * - Tauri desktop: forward to cloud
 */

import type { NextRequest } from "next/server";
import { compare } from "bcrypt-ts";
import { getUser, getUserTypeForService } from "@/lib/db/queries";
import { DUMMY_PASSWORD } from "@/lib/env/constants";
import {
  generateToken,
  getTokenLifetime,
  withErrorHandler,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/auth/remote-auth-utils";
import {
  withRateLimit,
  createRateLimitResponse,
  RateLimitPresets,
} from "@/lib/rate-limit/middleware";
import { setAuthCookies } from "@/lib/auth/cookie-auth";
import { createCloudClientForRequest } from "@/lib/auth/remote-client";
import { isTauriMode } from "@/lib/env/constants";

export async function POST(request: NextRequest) {
  // Tauri desktop: forward to cloud (rate limiting handled by cloud)
  if (isTauriMode()) {
    const cloudClient = createCloudClientForRequest(request);

    if (!cloudClient) {
      return createErrorResponse("Cloud API not available", 503);
    }

    try {
      const body = await request.json();
      const result = await cloudClient.login(body.email, body.password);
      return createSuccessResponse(result);
    } catch (error) {
      console.error("[Remote Auth] Failed to forward login to cloud:", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Login failed",
        500,
      );
    }
  }

  // Web: direct handling (includes rate limiting)
  // Rate limit check: 5 requests/minute
  const rateLimitResult = await withRateLimit(request, RateLimitPresets.login);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult);
  }

  return withErrorHandler(async () => {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return createErrorResponse("Email and password are required");
    }

    // Find user
    const users = await getUser(email);

    if (users.length === 0) {
      // Prevent timing attack, use dummy password comparison
      await compare(password, DUMMY_PASSWORD);
      return createErrorResponse("Invalid email or password");
    }

    const [user] = users;

    if (!user.password) {
      await compare(password, DUMMY_PASSWORD);
      return createErrorResponse("Invalid email or password");
    }

    // Verify password
    const passwordsMatch = await compare(password, user.password);

    if (!passwordsMatch) {
      return createErrorResponse("Invalid email or password");
    }

    // Get user type
    const userType = await getUserTypeForService(user.id);

    // Generate authentication token
    const token = generateToken(user.id, user.email);

    // Parse token to get payload (for setting payload cookie)
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      id: user.id,
      email: user.email,
      exp: now + getTokenLifetime(),
      iat: now,
    };

    // Set auth cookies and return user info (token is in cookie)
    // Token is also returned in response body for Tauri mode compatibility
    const response = createSuccessResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        type: userType,
      },
      token,
    });
    return setAuthCookies(response, token, payload);
  });
}
