import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/app/(auth)/auth";
import { pollAppRegistrationOnce } from "@/lib/integrations/feishu/app-registration";
import { upsertFeishuBotIntegration } from "@/lib/integrations/feishu/complete-feishu-account";
import {
  FEISHU_REGISTRATION_COOKIE,
  signRegistrationCookie,
  verifyRegistrationCookie,
} from "@/lib/integrations/feishu/registration-cookie";
import { startFeishuListenersForUser } from "@/lib/integrations/feishu/ws-listener";

function clearRegCookie(response: NextResponse) {
  response.cookies.set({
    name: FEISHU_REGISTRATION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Poll Feishu app registration result once; create integration and clear Cookie on success
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

  const cookieStore = await cookies();
  const raw = cookieStore.get(FEISHU_REGISTRATION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ status: "no_session" }, { status: 400 });
  }

  const payload = verifyRegistrationCookie(raw, secret);
  if (!payload || payload.userId !== session.user.id) {
    const bad = NextResponse.json(
      { status: "invalid_session" },
      { status: 400 },
    );
    clearRegCookie(bad);
    return bad;
  }

  if (Date.now() > payload.deadlineMs) {
    const exp = NextResponse.json({ status: "expired" }, { status: 410 });
    clearRegCookie(exp);
    return exp;
  }

  const step = await pollAppRegistrationOnce({
    domain: payload.domain,
    deviceCode: payload.deviceCode,
    currentIntervalSec: payload.intervalSec,
    domainAlreadySwitched: payload.domainSwitched,
    tp: "ob_app",
  });

  if (step.kind === "success") {
    const displayName =
      step.openId != null && step.openId.length > 0
        ? `Feishu · ${step.openId.slice(0, 12)}`
        : `Feishu · ${step.appId.slice(0, 12)}`;

    await upsertFeishuBotIntegration({
      userId: session.user.id,
      appId: step.appId,
      appSecret: step.appSecret,
      displayName,
      botName: displayName,
      botDescription: "Chat with Alloomi via Feishu",
      apiDomain: step.domain,
      metadata: {
        feishuRegistrationAt: new Date().toISOString(),
        feishuOpenId: step.openId ?? null,
        feishuAccountsDomain: step.domain,
      },
    });

    await startFeishuListenersForUser(session.user.id).catch((err) => {
      console.warn("[Feishu registration poll] listener start", err);
    });

    const res = NextResponse.json({ status: "success" });
    clearRegCookie(res);
    return res;
  }

  if (step.kind === "denied") {
    const res = NextResponse.json({ status: "denied" }, { status: 403 });
    clearRegCookie(res);
    return res;
  }

  if (step.kind === "expired") {
    const res = NextResponse.json({ status: "expired" }, { status: 410 });
    clearRegCookie(res);
    return res;
  }

  if (step.kind === "error") {
    const res = NextResponse.json(
      { status: "error", message: step.message },
      { status: 502 },
    );
    clearRegCookie(res);
    return res;
  }

  // pending: may switch domain or adjust interval
  let nextPayload = { ...payload };
  if (step.nextDomain !== payload.domain) {
    nextPayload = {
      ...nextPayload,
      domain: step.nextDomain,
      domainSwitched: true,
    };
  }
  if (step.nextIntervalSec !== payload.intervalSec) {
    nextPayload = { ...nextPayload, intervalSec: step.nextIntervalSec };
  }

  const res = NextResponse.json({
    status: "pending",
    pollIntervalSec: step.nextIntervalSec,
    domain: nextPayload.domain,
  });
  res.cookies.set({
    name: FEISHU_REGISTRATION_COOKIE,
    value: signRegistrationCookie(nextPayload, secret),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(
      60,
      Math.ceil((nextPayload.deadlineMs - Date.now()) / 1000) + 30,
    ),
  });
  return res;
}
