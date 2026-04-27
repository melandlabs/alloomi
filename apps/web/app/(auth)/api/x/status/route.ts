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
    await deleteLoginSession(sessionId);
    return NextResponse.json(
      {
        status: "completed",
        sessionId,
        result: session.result,
      },
      { status: 200 },
    );
  }

  if (session.status === "error") {
    await deleteLoginSession(sessionId);
    return NextResponse.json(
      {
        status: "error",
        error: session.error ?? "X authentication failed",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      status: session.status,
      sessionId,
    },
    { status: 200 },
  );
}
