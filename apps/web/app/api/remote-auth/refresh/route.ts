/**
 * Token refresh API
 * Used to refresh expiring authentication tokens
 */

import type { NextRequest } from "next/server";
import { getUserById } from "@/lib/db/queries";
import {
  generateToken,
  getTokenLifetime,
  getRefreshGracePeriod,
  verifyToken,
  extractToken,
  withErrorHandler,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/auth/remote-auth-utils";
import { setAuthCookies } from "@/lib/auth/cookie-auth";

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const token = extractToken(request);

    if (!token) {
      return createErrorResponse("Unauthorized", 401);
    }

    const result = verifyToken(token);

    if (!result) {
      return createErrorResponse("Invalid token", 401);
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    const gracePeriod = getRefreshGracePeriod();

    // If token expired more than grace period ago, refuse refresh (need to re-login)
    if (result.exp < now - gracePeriod) {
      return createErrorResponse(
        "Token expired too long. Please login again.",
        401,
      );
    }

    // Verify user still exists
    const user = await getUserById(result.id);

    if (!user) {
      return createErrorResponse("User not found", 404);
    }

    // Generate new token
    const newToken = generateToken(user.id, user.email);

    // Parse token to get payload (for setting payload cookie)
    const payload = {
      id: user.id,
      email: user.email,
      exp: now + getTokenLifetime(),
      iat: now,
    };

    // Set auth cookies and return success response (token in cookie, also return in body for legacy client compatibility)
    const response = createSuccessResponse({ success: true, token: newToken });
    return setAuthCookies(response, newToken, payload);
  });
}
