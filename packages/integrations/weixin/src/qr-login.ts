/**
 * WeChat iLink QR code login (same origin as @tencent-weixin/openclaw-weixin's login-qr.ts)
 * Does not depend on OpenClaw CLI, directly fetches QR code from ilink and long-polls status
 *
 * Session only exists in-process in globalThis singleton Map (to avoid Next bundling the module multiple times, causing multiple Maps and polls not being able to read the session).
 * Multi-instance deployment needs to ensure start/poll are in the same process, or connect external storage later.
 */
import { randomUUID } from "node:crypto";

type WeixinQrMemoryGlobal = typeof globalThis & {
  __WEIXIN_QR_SESSION_MAP__?: Map<string, WeixinQrSession>;
};

function getMemorySessionMap(): Map<string, WeixinQrSession> {
  const g = globalThis as WeixinQrMemoryGlobal;
  if (!g.__WEIXIN_QR_SESSION_MAP__) {
    g.__WEIXIN_QR_SESSION_MAP__ = new Map();
  }
  return g.__WEIXIN_QR_SESSION_MAP__;
}

/** Session max TTL; polling refreshes startedAt (sliding expiration) */
const WEIXIN_QR_SESSION_TTL_MS = 15 * 60_000;

function purgeStaleMemorySessions(): void {
  const map = getMemorySessionMap();
  const now = Date.now();
  for (const [id, s] of map) {
    if (now - s.startedAt > WEIXIN_QR_SESSION_TTL_MS) {
      map.delete(id);
    }
  }
}

/** Consistent with official plugin DEFAULT_ILINK_BOT_TYPE */
export const DEFAULT_WEIXIN_QR_BOT_TYPE = "3";

/** Single long-poll upper limit; too small increases request count, too large may exceed Serverless function timeout (adjustable by deployment environment) */
const QR_LONG_POLL_MS = Number(process.env.WEIXIN_QR_LONG_POLL_MS ?? 12_000);
const MAX_QR_REFRESH = 3;

export type QrCodeApiResponse = {
  qrcode?: string;
  qrcode_img_content?: string;
  /** Some gateways may return camelCase */
  qrcodeImgContent?: string;
};

export type QrStatusApiResponse = {
  status?: "wait" | "scaned" | "confirmed" | "expired";
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
};

export type WeixinQrSession = {
  userId: string;
  qrcode: string;
  /** Text for frontend to generate QR code (consistent with official plugin qrcode_img_content), not an image URL */
  qrcodeUrl: string;
  apiBaseUrl: string;
  botType: string;
  routeTag?: string;
  startedAt: number;
  qrRefreshCount: number;
};

/** Write session and refresh startedAt (sliding expiration) */
function persistWeixinQrSession(
  loginId: string,
  session: WeixinQrSession,
): void {
  session.startedAt = Date.now();
  getMemorySessionMap().set(loginId, session);
}

function loadWeixinQrSessionRaw(
  loginId: string,
  userId: string,
): WeixinQrSession | null {
  const s = getMemorySessionMap().get(loginId);
  if (!s || s.userId !== userId) return null;
  if (Date.now() - s.startedAt > WEIXIN_QR_SESSION_TTL_MS) {
    getMemorySessionMap().delete(loginId);
    return null;
  }
  return s;
}

function removeWeixinQrSession(loginId: string): void {
  getMemorySessionMap().delete(loginId);
}

/**
 * Parse get_bot_qrcode response: qrcode for polling status; qrcode_img_content is the link text to encode into QR code (not image URL)
 */
export function normalizeWeixinQrPayload(raw: unknown): {
  qrcode: string;
  qrEncodeValue: string;
} {
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const str = (k: string) =>
    typeof r[k] === "string" ? (r[k] as string).trim() : "";

  const qrcode = str("qrcode");
  const qrEncodeValue =
    str("qrcode_img_content") ||
    str("qrcodeImgContent") ||
    str("qrcode_url") ||
    str("qrcodeUrl") ||
    qrcode;

  if (!qrcode) {
    throw new Error("WeChat API did not return qrcode");
  }
  if (!qrEncodeValue) {
    throw new Error("WeChat API did not return QR code content");
  }
  return { qrcode, qrEncodeValue };
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

/**
 * Get login QR code (GET, no token required)
 */
export async function fetchWeixinBotQrCode(params: {
  apiBaseUrl: string;
  botType: string;
  routeTag?: string;
}): Promise<QrCodeApiResponse> {
  const base = ensureTrailingSlash(params.apiBaseUrl);
  const url = new URL(
    `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(params.botType)}`,
    base,
  );
  const headers: Record<string, string> = {};
  if (params.routeTag?.trim()) {
    headers.SKRouteTag = params.routeTag.trim();
  }
  const response = await fetch(url.toString(), { headers });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Failed to get WeChat QR code HTTP ${response.status}: ${bodyText.slice(0, 300)}`,
    );
  }
  return JSON.parse(bodyText) as QrCodeApiResponse;
}

/**
 * Long-poll once for QR code status (max ~35s)
 */
export async function pollWeixinQrStatusOnce(params: {
  apiBaseUrl: string;
  qrcode: string;
  routeTag?: string;
}): Promise<QrStatusApiResponse> {
  const base = ensureTrailingSlash(params.apiBaseUrl);
  const url = new URL(
    `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(params.qrcode)}`,
    base,
  );
  const headers: Record<string, string> = {
    "iLink-App-ClientVersion": "1",
  };
  if (params.routeTag?.trim()) {
    headers.SKRouteTag = params.routeTag.trim();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QR_LONG_POLL_MS);
  try {
    const response = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(
        `QR status polling failed HTTP ${response.status}: ${rawText.slice(0, 300)}`,
      );
    }
    return JSON.parse(rawText) as QrStatusApiResponse;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { status: "wait" };
    }
    throw err;
  }
}

/**
 * Create scan session and return loginId, text for frontend to generate QR code (link, not image address)
 */
export function startWeixinQrSession(params: {
  userId: string;
  apiBaseUrl: string;
  botType: string;
  routeTag?: string;
  qr: QrCodeApiResponse;
}): { loginId: string; qrContent: string } {
  purgeStaleMemorySessions();
  const { qrcode, qrEncodeValue } = normalizeWeixinQrPayload(params.qr);
  const loginId = randomUUID();
  const session: WeixinQrSession = {
    userId: params.userId,
    qrcode,
    qrcodeUrl: qrEncodeValue,
    apiBaseUrl: params.apiBaseUrl,
    botType: params.botType,
    routeTag: params.routeTag,
    startedAt: Date.now(),
    qrRefreshCount: 0,
  };
  persistWeixinQrSession(loginId, session);
  return { loginId, qrContent: qrEncodeValue };
}

export function getWeixinQrSession(
  loginId: string,
  userId: string,
): WeixinQrSession | null {
  return loadWeixinQrSessionRaw(loginId, userId);
}

export function deleteWeixinQrSession(loginId: string): void {
  removeWeixinQrSession(loginId);
}

/**
 * Advance poll once: return status; if confirmed, include token and bot id (session still deleted by caller)
 */
export async function advanceWeixinQrPoll(
  loginId: string,
  userId: string,
): Promise<
  | {
      kind: "wait" | "scaned";
    }
  | {
      kind: "expired";
      qrContent?: string;
      message: string;
    }
  | {
      kind: "confirmed";
      botToken: string;
      ilinkBotId: string;
      baseUrl?: string;
      ilinkUserId?: string;
      routeTag?: string;
    }
  | {
      kind: "error";
      message: string;
    }
> {
  const session = loadWeixinQrSessionRaw(loginId, userId);
  if (!session) {
    return {
      kind: "error",
      message: "Login session expired, please start over",
    };
  }

  // Long polling may last a while, refresh startedAt on each request
  persistWeixinQrSession(loginId, session);

  const status = await pollWeixinQrStatusOnce({
    apiBaseUrl: session.apiBaseUrl,
    qrcode: session.qrcode,
    routeTag: session.routeTag,
  });

  switch (status.status) {
    case "wait":
      return { kind: "wait" };
    case "scaned":
      return { kind: "scaned" };
    case "confirmed": {
      const token = status.bot_token?.trim();
      const ilinkBotId = status.ilink_bot_id?.trim();
      if (!token || !ilinkBotId) {
        deleteWeixinQrSession(loginId);
        return {
          kind: "error",
          message: "Login succeeded but missing token or account ID",
        };
      }
      const baseFromStatus = status.baseurl?.trim();
      const baseResolved = baseFromStatus || session.apiBaseUrl;
      const routeResolved = session.routeTag;
      const out = {
        kind: "confirmed" as const,
        botToken: token,
        ilinkBotId,
        baseUrl: baseResolved,
        ilinkUserId: status.ilink_user_id?.trim(),
        routeTag: routeResolved,
      };
      // Consume session to avoid reusing the same loginId
      deleteWeixinQrSession(loginId);
      return out;
    }
    case "expired": {
      session.qrRefreshCount += 1;
      if (session.qrRefreshCount > MAX_QR_REFRESH) {
        deleteWeixinQrSession(loginId);
        return {
          kind: "error",
          message: "QR code expired multiple times, please start login again",
        };
      }
      try {
        const qrResponse = await fetchWeixinBotQrCode({
          apiBaseUrl: session.apiBaseUrl,
          botType: session.botType,
          routeTag: session.routeTag,
        });
        let normalized: ReturnType<typeof normalizeWeixinQrPayload>;
        try {
          normalized = normalizeWeixinQrPayload(qrResponse);
        } catch {
          deleteWeixinQrSession(loginId);
          return { kind: "error", message: "Failed to refresh QR code" };
        }
        session.qrcode = normalized.qrcode;
        session.qrcodeUrl = normalized.qrEncodeValue;
        session.startedAt = Date.now();
        persistWeixinQrSession(loginId, session);
        return {
          kind: "expired",
          qrContent: normalized.qrEncodeValue,
          message: "QR code has been updated, please scan again",
        };
      } catch (e) {
        deleteWeixinQrSession(loginId);
        return {
          kind: "error",
          message: e instanceof Error ? e.message : "Failed to refresh QR code",
        };
      }
    }
    default:
      return { kind: "wait" };
  }
}
