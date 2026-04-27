/**
 * Rate limiting helper functions
 * Used for quickly integrating rate limiting in API routes
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  RedisRateLimiter,
  type RateLimitResult,
  RateLimitPresets,
} from "./rate-limiter";
import { ensureRedis } from "@/lib/session/context";
import type Redis from "ioredis";

// Re-export RateLimitPresets for convenience
export { RateLimitPresets };

// Global rate limiter instance (lazy loaded)
let rateLimiter: RedisRateLimiter | null = null;

/**
 * Get rate limiter instance using shared Redis connection
 */
async function getRateLimiter(): Promise<RedisRateLimiter> {
  if (!rateLimiter) {
    const redis = await ensureRedis();
    // RedisRateLimiter requires a real ioredis instance, not the in-memory mock
    rateLimiter = new RedisRateLimiter(redis as Redis);
  }
  return rateLimiter;
}

/**
 * Get client identifier
 * Prioritize real IP (via Vercel headers), fallback to X-Forwarded-For
 */
export function getClientIdentifier(request: NextRequest): string {
  // Real IP provided by Vercel / Vercel Edge
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    return vercelIp.split(",")[0].trim();
  }

  // Standard proxy header
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  // Fallback to IP (usually during local development)
  const ip = request.headers.get("x-real-ip");
  return ip || "unknown";
}

/**
 * Create rate limit check helper function
 */
export async function checkRateLimit(
  identifier: string,
  config: { window: number; maxRequests: number },
): Promise<RateLimitResult> {
  try {
    const limiter = await getRateLimiter();
    return await limiter.check(identifier, config);
  } catch (error) {
    console.error("[RateLimit] Check failed:", error);
    // When rate limit service fails, default to allow (avoid blocking normal users)
    return {
      success: true,
      remaining: config.maxRequests,
      resetTime: Math.floor(Date.now() / 1000) + config.window,
    };
  }
}

/**
 * Create API rate limit response
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please try again later.",
      retryAfter: result.resetTime - Math.floor(Date.now() / 1000),
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": result.resetTime.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.resetTime.toString(),
        "Retry-After": (
          result.resetTime - Math.floor(Date.now() / 1000)
        ).toString(),
      },
    },
  );
}

/**
 * API route rate limit decorator
 * Usage:
 * export async function POST(request: NextRequest) {
 *   const result = await withRateLimit(request, RateLimitPresets.login);
 *   if (!result.success) {
 *     return createRateLimitResponse(result);
 *   }
 *   // Your API logic...
 * }
 */
export async function withRateLimit(
  request: NextRequest,
  config: { window: number; maxRequests: number },
): Promise<RateLimitResult> {
  const identifier = getClientIdentifier(request);
  return await checkRateLimit(identifier, config);
}

/**
 * Rate limit by user ID (for authenticated APIs)
 * Usage:
 * export async function POST(request: NextRequest) {
 *   const user = await getAuthUser(request);
 *   const result = await withRateLimitByUser(user?.id, RateLimitPresets.payment);
 *   if (!result.success) {
 *     return createRateLimitResponse(result);
 *   }
 *   // Your API logic...
 * }
 */
export async function withRateLimitByUser(
  userId: string | null | undefined,
  config: { window: number; maxRequests: number },
): Promise<RateLimitResult> {
  // If no user ID, fallback to lenient limit
  if (!userId) {
    return {
      success: true,
      remaining: config.maxRequests,
      resetTime: Math.floor(Date.now() / 1000) + config.window,
    };
  }

  const identifier = `user:${userId}`;
  return await checkRateLimit(identifier, config);
}
