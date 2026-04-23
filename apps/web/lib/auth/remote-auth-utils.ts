/**
 * Remote auth shared utilities
 * Extracts common logic from remote-auth API
 */

import { timingSafeEqual } from "node:crypto";
import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { AUTH_TOKEN_COOKIE } from "./cookie-names";

/**
 * Timing-safe comparison of two strings
 * Prevents timing attacks
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Token payload structure
 */
export interface TokenPayload {
  id: string;
  email: string;
  exp: number;
  iat: number;
}

/**
 * Default token lifetime: 90 days in seconds
 */
const DEFAULT_TOKEN_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

/**
 * Get token lifetime from environment variable or default
 */
export function getTokenLifetime(): number {
  const envValue = process.env.AUTH_TOKEN_EXPIRY_SECONDS;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    console.warn("[Auth] AUTH_TOKEN_EXPIRY_SECONDS invalid, using default");
  }
  return DEFAULT_TOKEN_LIFETIME_SECONDS;
}

/**
 * Default refresh grace period: 24 hours in seconds
 */
const DEFAULT_REFRESH_GRACE_PERIOD_SECONDS = 24 * 60 * 60;

/**
 * Get refresh grace period from environment variable or default
 */
export function getRefreshGracePeriod(): number {
  const envValue = process.env.AUTH_TOKEN_REFRESH_GRACE_PERIOD_SECONDS;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    console.warn(
      "[Auth] AUTH_TOKEN_REFRESH_GRACE_PERIOD_SECONDS invalid, using default",
    );
  }
  return DEFAULT_REFRESH_GRACE_PERIOD_SECONDS;
}

/**
 * Generate auth token
 */
export function generateToken(userId: string, email: string): string {
  const authSessionVersion = "1"; // Can be imported from constants
  const payload = JSON.stringify({
    id: userId,
    email,
    sessionVersion: authSessionVersion,
    exp: Math.floor(Date.now() / 1000) + getTokenLifetime(),
    iat: Math.floor(Date.now() / 1000),
  });

  const encodedPayload = Buffer.from(payload).toString("base64url");

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("[Auth] AUTH_SECRET environment variable is required");
  }
  const signature = createHash("sha256")
    .update(`${encodedPayload}.${secret}`)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verify token and return user info
 */
export function verifyToken(token: string): {
  id: string;
  email: string;
  exp: number;
} | null {
  try {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      console.log(
        "[verifyToken] Invalid token format: missing payload or signature",
      );
      return null;
    }

    // Recalculate signature
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      throw new Error("[Auth] AUTH_SECRET environment variable is required");
    }
    const expectedSignature = createHash("sha256")
      .update(`${encodedPayload}.${secret}`)
      .digest("base64url");

    const signatureValid = timingSafeCompare(signature, expectedSignature);

    if (!signatureValid) {
      console.log("[verifyToken] Signature verification failed");
      return null;
    }

    // Decode payload
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

    // Check expiry time
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log("[verifyToken] Token expired:", {
        exp: payload.exp,
        now: Math.floor(Date.now() / 1000),
      });
      return null;
    }

    console.log("[verifyToken] Token valid, user:", payload.id);
    return { id: payload.id, email: payload.email, exp: payload.exp };
  } catch (error) {
    console.log("[verifyToken] Exception:", error);
    return null;
  }
}

/**
 * Extract token from request
 * Prefer reading from httpOnly cookie, then from Authorization header (backward compatibility)
 */
export function extractToken(request: NextRequest): string | null {
  // Prefer reading from cookie (httpOnly, cannot be accessed by JS)
  const cookieToken = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  if (cookieToken) return cookieToken;

  // Fallback to Authorization header (for old client compatibility)
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return null;
}

/**
 * Verify token in request and return user ID
 */
export async function authenticateRequest(
  request: NextRequest,
): Promise<{ userId: string; error?: string }> {
  const token = extractToken(request);

  if (!token) {
    return { userId: "", error: "Unauthorized" };
  }

  const result = verifyToken(token);

  if (!result) {
    return { userId: "", error: "Invalid token" };
  }

  return { userId: result.id };
}

/**
 * Create error response
 */
export function createErrorResponse(error: string, status = 400): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(data: T): NextResponse {
  return NextResponse.json(data);
}

/**
 * Wrap async handler function, catching errors
 */
export function withErrorHandler(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  return handler().catch((error) => {
    console.error("[RemoteAuth] Error:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  });
}

/**
 * OAuth handler interface
 */
export interface OAuthHandlerResult {
  userInfo: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string;
  };
  accessToken: string;
}

/**
 * Timing-safe verification of CRON request Authorization header
 * Prevents timing attacks
 */
export function verifyCronAuth(request: Request, secret: string): boolean {
  const authHeader = request.headers.get("authorization") ?? "";
  const providedSecret = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();
  return timingSafeCompare(providedSecret, secret);
}

/**
 * Get cloud API address from URL
 */
export function getCloudApiUrl(): string {
  return (
    process.env.CLOUD_API_URL ||
    process.env.NEXT_PUBLIC_CLOUD_API_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  );
}
