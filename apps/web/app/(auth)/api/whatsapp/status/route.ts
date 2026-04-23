import { NextResponse } from "next/server";
import {
  deleteLoginSession,
  ensureRedis,
  getLoginSession,
} from "@/lib/session/context";

export async function GET(request: Request) {
  await ensureRedis();

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

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
    const sessionPayload = session.waSession ?? session.session ?? "";
    if (!sessionPayload) {
      return NextResponse.json(
        {
          status: "error",
          error: "WhatsApp session not available. Please retry authorization.",
        },
        { status: 400 },
      );
    }

    await deleteLoginSession(sessionId);
    return NextResponse.json(
      {
        status: "completed",
        sessionId,
        session: sessionPayload,
        user: session.user,
      },
      { status: 200 },
    );
  }

  if (session.status === "error") {
    await deleteLoginSession(sessionId);
    return NextResponse.json(
      {
        status: "error",
        error: session.error ?? "WhatsApp authentication failed",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      status: session.status,
      sessionId,
      qr: session.qrData ?? session.qrUrl ?? null,
    },
    { status: 200 },
  );
}
