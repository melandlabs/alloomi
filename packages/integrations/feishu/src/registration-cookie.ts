/**
 * Device code polling state: signed and stored in HttpOnly Cookie, preventing device_code from leaking to frontend JS
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import type { FeishuAccountsDomain } from "./app-registration";

export const FEISHU_REGISTRATION_COOKIE = "feishu_app_registration";

export type FeishuRegistrationCookiePayload = {
  v: 1;
  userId: string;
  deviceCode: string;
  domain: FeishuAccountsDomain;
  intervalSec: number;
  deadlineMs: number;
  /** Whether domain has already been switched to Lark international */
  domainSwitched: boolean;
};

function encodePayload(payload: FeishuRegistrationCookiePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(raw: string): FeishuRegistrationCookiePayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const p = JSON.parse(json) as FeishuRegistrationCookiePayload;
    if (
      p.v !== 1 ||
      typeof p.userId !== "string" ||
      typeof p.deviceCode !== "string"
    )
      return null;
    if (p.domain !== "feishu" && p.domain !== "lark") return null;
    if (typeof p.intervalSec !== "number" || typeof p.deadlineMs !== "number")
      return null;
    if (typeof p.domainSwitched !== "boolean") return null;
    return p;
  } catch {
    return null;
  }
}

export function signRegistrationCookie(
  payload: FeishuRegistrationCookiePayload,
  secret: string,
): string {
  const body = encodePayload(payload);
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyRegistrationCookie(
  token: string,
  secret: string,
): FeishuRegistrationCookiePayload | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const body = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return decodePayload(body);
}
