import Redis from "ioredis";
import { isTauriMode } from "@/lib/env";
import { getTauriStoragePath } from "@/lib/utils/path";
import path from "node:path";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";

const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || "";

function base64url(data: string | Buffer): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function hmacSign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function hmacVerify(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest();
  try {
    const received = Buffer.from(signature, "base64url");
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export interface OAuthStatePayload {
  v: number;
  sid: string;
  p: string;
  t: number;
}

export function encodeOAuthState(data: OAuthStatePayload): string {
  const payload = base64url(JSON.stringify(data));
  const sig = hmacSign(payload, OAUTH_STATE_SECRET);
  return `${payload}.${sig}`;
}

export function decodeOAuthState(token: string): OAuthStatePayload | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!hmacVerify(payload, sig, OAUTH_STATE_SECRET)) return null;
  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as OAuthStatePayload;
    if (data.v !== 1) return null;
    if (Date.now() - data.t > SESSION_EXPIRE_MS) return null;
    return data;
  } catch {
    return null;
  }
}

// Type alias for type compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PipelineCommands = {
  incr(key: string): PipelineCommands;
  expire(key: string, seconds: number): PipelineCommands;
  set(key: string, value: string, ...args: any[]): PipelineCommands;
  getBuffer(key: string): PipelineCommands;
  exec(): Promise<any[]>;
};

export type InMemoryRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  multi(): PipelineCommands;
  pipeline(): PipelineCommands;
  on(event: string, callback: (...args: any[]) => void): void;
  status: string;
};

// Redis is optional in development - graceful degradation if not configured
let redis: Redis | InMemoryRedis | null = null;
let isRedisEnabled = false;
let redisReady = false;
// Promise that resolves when Redis initialization completes and connection is ready
let redisInitPromise: Promise<void> | null = null;

async function initRedis(): Promise<void> {
  if (isTauriMode()) {
    // Tauri mode: use in-memory Redis mock for operations that require Redis
    isRedisEnabled = true;
    redisReady = true;
    // Dynamically import ioredis-mock to avoid bundling issues with fengari
    const RedisMock = (await import("ioredis-mock")).default;
    redis = new RedisMock();
  } else if (process.env.REDIS_URL) {
    isRedisEnabled = true;
    console.log(
      "[Redis] Connecting with URL:",
      process.env.REDIS_URL.replace(/:[^:@]+@/, ":***@"),
    );
    redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        if (times > 3) return null;
        return delay;
      },
    });

    redis.on("error", (err: Error) => {
      console.error("[Redis] Connection error:", err.message);
      redisReady = false;
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected successfully");
      redisReady = true;
    });

    redis.on("ready", () => {
      console.log("[Redis] Ready");
      redisReady = true;
    });

    redis.on("close", () => {
      console.warn("[Redis] Connection closed");
      redisReady = false;
    });

    redis.on("reconnecting", () => {
      console.log("[Redis] Reconnecting...");
    });

    // Wait for connection to be established before resolving
    // This ensures redis is truly ready when initRedis() resolves
    if (!redisReady) {
      await new Promise<void>((resolve) => {
        (redis as Redis).once("ready", () => {
          redisReady = true;
          resolve();
        });
      });
    }
  } else {
    isRedisEnabled = true;
    redisReady = true;
    // Dynamically import ioredis-mock to avoid bundling issues with fengari
    const RedisMock = (await import("ioredis-mock")).default;
    redis = new RedisMock();
  }
}

/**
 * Ensure Redis is initialized and ready. Call this before any critical operation.
 * Returns the Redis instance or throws if unavailable.
 */
export async function ensureRedis(): Promise<Redis | InMemoryRedis> {
  // If we have a ready instance, return it
  if (redis && redisReady) {
    return redis;
  }

  // If init hasn't been called yet, call it
  if (!redisInitPromise) {
    redisInitPromise = initRedis();
    // For in-memory/mock mode, initRedis resolves immediately
    // For cloud mode, it resolves after connection
    await redisInitPromise;
  } else {
    // Wait for existing init to complete
    await redisInitPromise;
  }

  if (!redis) {
    throw new Error("[Redis] Initialization failed: redis is null");
  }
  if (!redisReady) {
    throw new Error("[Redis] Initialization failed: redis not ready");
  }
  return redis;
}

// Redis initialization is now lazy: first call to ensureRedis() triggers init.
// For serverless/Vercel, cold start will trigger init on first request.

export const LOGIN_SESSION_KEY_PREFIX = "login_session:";
export const INSIGHTS_KEY_PREFIX = "insights_session:";
export const INSIGHTS_LOCK_PREFIX = "insights_lock:";

export const SESSION_EXPIRE_MS = 1800000;

// ============ File-based storage for Tauri mode ============

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export interface LoginSession {
  provider?: "telegram" | "whatsapp" | "twitter" | "google" | "github";
  phone?: string;
  status:
    | "pending"
    | "code_required"
    | "code_submitted"
    | "password_required"
    | "password_submitted"
    | "completed"
    | "qr_generated"
    | "code_generated"
    | "reconnecting"
    | "error";
  error?: string;
  result?: {
    id: string | number;
  };
  code?: string;
  password?: string;
  qrUrl?: string;
  qrData?: string;
  pairingCode?: string;
  tgSession?: string;
  waSession?: string;
  session?: string;
  token?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    userName?: string;
    wid?: string;
    pushName?: string;
    formattedNumber?: string;
  };
  passwordAttempts?: number;
  createdAt: number;
}

export type InsightSesstionStatus =
  | "initializing"
  | "fetching"
  | "insighting"
  | "finished";

export interface InsightSession {
  count: number;
  msgCount?: number;
  platform?: string;
  status?: InsightSesstionStatus;
}

export interface AuthResponse {
  sessionId?: string;
  error?: string;
  success?: boolean;
  user?: any;
  session?: string;
}

/**
 * Store login session to Redis
 * @param sessionId - Session ID (uuid)
 * @param session - Session data (excluding non-serializable TelegramAdapter)
 */
export async function setLoginSession(
  sessionId: string,
  session: LoginSession,
) {
  if (!isRedisEnabled) {
    console.error(
      "[setLoginSession] Redis not enabled, cannot store session:",
      sessionId,
    );
    return false;
  }
  if (!redis) {
    console.error(
      "[setLoginSession] Redis client is null, cannot store session:",
      sessionId,
    );
    return false;
  }
  if (isTauriMode()) {
    // File-based storage for Tauri local mode
    const dir = path.join(getTauriStoragePath(), "wa_sessions");
    await ensureDir(dir);
    await writeFile(
      path.join(dir, `${sessionId}.json`),
      JSON.stringify(session),
      "utf-8",
    );
    return true;
  }
  try {
    const key = `${LOGIN_SESSION_KEY_PREFIX}${sessionId}`;
    const result = await redis?.set(
      key,
      JSON.stringify(session),
      "PX",
      SESSION_EXPIRE_MS,
    );
    console.log(
      `[setLoginSession] key=${key} result=${result} redis=${!!redis} redisReady=${redisReady}`,
    );
    if (result == null) {
      console.error(
        "[setLoginSession] Redis write returned null/undefined:",
        sessionId,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("[setLoginSession] Redis write failed:", error);
    return false;
  }
}

/**
 * Get login session from Redis
 * @param sessionId - Session ID
 * @returns Session data (without adapter) or null
 */
export async function getLoginSession(
  sessionId: string,
): Promise<LoginSession | null> {
  if (!isRedisEnabled) {
    return null;
  }
  if (isTauriMode()) {
    // File-based storage for Tauri local mode
    const filePath = path.join(
      getTauriStoragePath(),
      "wa_sessions",
      `${sessionId}.json`,
    );
    if (!existsSync(filePath)) return null;
    try {
      const data = await readFile(filePath, "utf-8");
      return JSON.parse(data) as Omit<LoginSession, "adapter">;
    } catch {
      return null;
    }
  }
  try {
    const key = `${LOGIN_SESSION_KEY_PREFIX}${sessionId}`;
    const sessionStr = await redis?.get(key);
    if (!sessionStr) return null;
    return JSON.parse(sessionStr) as Omit<LoginSession, "adapter">;
  } catch (err) {
    console.error("[getLoginSession] error:", err);
    return null;
  }
}

/**
 * Delete login session from Redis (used on expiration/logout)
 * @param sessionId - Session ID
 */
export async function deleteLoginSession(sessionId: string) {
  if (!isRedisEnabled) {
    return false;
  }
  if (isTauriMode()) {
    const filePath = path.join(
      getTauriStoragePath(),
      "wa_sessions",
      `${sessionId}.json`,
    );
    try {
      await rm(filePath, { force: true });
    } catch {
      /* ignore */
    }
    return true;
  }
  try {
    const key = `${LOGIN_SESSION_KEY_PREFIX}${sessionId}`;
    await redis?.del(key);
    return true;
  } catch {
    return false;
  }
}

export async function setInsightsSession(
  botId: string,
  session: InsightSession,
) {
  if (!isRedisEnabled) {
    return false;
  }
  if (isTauriMode()) {
    const dir = path.join(getTauriStoragePath(), "insights");
    await ensureDir(dir);
    await writeFile(
      path.join(dir, `${botId}.json`),
      JSON.stringify(session),
      "utf-8",
    );
    return true;
  }
  try {
    const key = `${INSIGHTS_KEY_PREFIX}${botId}`;
    await redis?.set(key, JSON.stringify(session), "PX", SESSION_EXPIRE_MS);
    return true;
  } catch {
    return false;
  }
}

export async function getInsightsSession(
  botId: string,
): Promise<InsightSession | null> {
  if (!isRedisEnabled) {
    return null;
  }
  if (isTauriMode()) {
    const filePath = path.join(
      getTauriStoragePath(),
      "insights",
      `${botId}.json`,
    );
    if (!existsSync(filePath)) return null;
    try {
      const data = await readFile(filePath, "utf-8");
      return JSON.parse(data) as InsightSession;
    } catch {
      return null;
    }
  }
  try {
    const key = `${INSIGHTS_KEY_PREFIX}${botId}`;
    const sessionStr = await redis?.get(key);
    if (!sessionStr) return null;
    return JSON.parse(sessionStr) as InsightSession;
  } catch {
    return null;
  }
}

export async function deleteInsightsSession(botId: string) {
  if (!isRedisEnabled) {
    return false;
  }
  if (isTauriMode()) {
    try {
      await rm(path.join(getTauriStoragePath(), "insights", `${botId}.json`), {
        force: true,
      });
    } catch {
      /* ignore */
    }
    await releaseInsightLock(botId);
    return true;
  }
  try {
    const key = `${INSIGHTS_KEY_PREFIX}${botId}`;
    await redis?.del(key);
    await releaseInsightLock(botId);
    return true;
  } catch {
    return false;
  }
}

export async function tryAcquireInsightLock(botId: string): Promise<boolean> {
  if (!redis || !isRedisEnabled) {
    return true; // Allow operation when Redis is disabled
  }
  const key = `${INSIGHTS_LOCK_PREFIX}:${botId}`;
  try {
    const multi = redis.multi();
    multi.incr(key);
    multi.expire(key, 100);
    const execResult = await multi.exec();
    if (execResult === null) {
      return false;
    }
    const [incrError, incrResult] = execResult[0];
    if (incrError) {
      return false;
    }
    const count = incrResult as number;
    const [expireError, expireResult] = execResult[1];
    if (expireError) {
      await redis.decr(key).catch(() => {});
      return false;
    }
    const expireSuccess = expireResult as number;
    if (expireSuccess !== 1) {
      await redis.decr(key).catch(() => {});
      return false;
    }

    if (count <= 1) {
      return true;
    }

    await redis.decr(key);
    return false;
  } catch (error) {
    await redis.decr(key).catch(() => {});
    return false;
  }
}

async function releaseInsightLock(botId: string) {
  if (!redis || !isRedisEnabled) {
    return;
  }
  const key = `${INSIGHTS_LOCK_PREFIX}:${botId}`;
  const currentCount = await redis.get(key);
  if (!currentCount) return;

  const count = Number.parseInt(currentCount, 10);
  if (count <= 1) {
    await redis.del(key);
  } else {
    await redis.decr(key);
  }
}

export default redis;
export const expireTime = 36000000;
export { redisReady };
