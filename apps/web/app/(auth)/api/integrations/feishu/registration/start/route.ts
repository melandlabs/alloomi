import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  beginAppRegistration,
  initAppRegistration,
} from "@/lib/integrations/feishu/app-registration";
import {
  FEISHU_REGISTRATION_COOKIE,
  signRegistrationCookie,
  type FeishuRegistrationCookiePayload,
} from "@/lib/integrations/feishu/registration-cookie";

function shouldUseSecureCookie() {
  if (process.env.NODE_ENV !== "production") return false;
  const appUrl =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_CLOUD_API_URL;
  return appUrl?.startsWith("https://") ?? false;
}

/**
 * Start Feishu app registration device code flow: write HttpOnly Cookie, return QR code URL
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "AUTH_SECRET is not configured" },
      { status: 500 },
    );
  }

  try {
    await initAppRegistration("feishu");
    const begin = await beginAppRegistration("feishu");
    const deadlineMs = Date.now() + begin.expireInSec * 1000;
    const payload: FeishuRegistrationCookiePayload = {
      v: 1,
      userId: session.user.id,
      deviceCode: begin.deviceCode,
      domain: "feishu",
      intervalSec: begin.intervalSec,
      deadlineMs,
      domainSwitched: false,
    };
    const token = signRegistrationCookie(payload, secret);
    const res = NextResponse.json({
      qrUrl: begin.qrUrl,
      userCode: begin.userCode,
      pollIntervalSec: begin.intervalSec,
      expireInSec: begin.expireInSec,
    });
    res.cookies.set({
      name: FEISHU_REGISTRATION_COOKIE,
      value: token,
      httpOnly: true,
      secure: shouldUseSecureCookie(),
      sameSite: "lax",
      path: "/",
      maxAge: begin.expireInSec + 60,
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[Feishu registration start]", message);
    return NextResponse.json(
      {
        error: "feishu_scan_unavailable",
        message,
      },
      { status: 503 },
    );
  }
}
