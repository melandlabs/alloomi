/**
 * Poll Google OAuth login session status (cloud endpoint)
 *
 * Reads the session from Redis that was updated by the callback.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  deleteLoginSession,
  ensureRedis,
  getLoginSession,
} from "@/lib/session/context";

export async function GET(request: NextRequest) {
  await ensureRedis();

  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 },
    );
  }

  const session = await getLoginSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status === "completed") {
    await deleteLoginSession(sessionId);
    return NextResponse.json({
      status: "completed",
      sessionId,
      token: (session as any).token,
      user: (session as any).user,
      password: (session as any).password,
    });
  }

  if (session.status === "error") {
    await deleteLoginSession(sessionId);
    return NextResponse.json({
      status: "error",
      error: session.error ?? "Google authentication failed",
    });
  }

  // pending or other states
  return NextResponse.json({
    status: session.status,
    sessionId,
  });
}
