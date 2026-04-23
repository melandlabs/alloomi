import { NextResponse } from "next/server";
import {
  ensureRedis,
  getLoginSession,
  type LoginSession,
  setLoginSession,
} from "@/lib/session/context";

// Wait interval (milliseconds)
const WAIT_INTERVAL = 1000;
// Max wait attempts
const MAX_WAIT_ATTEMPTS = 120;

export async function POST(request: Request) {
  try {
    await ensureRedis();

    const { sessionId, code } = await request.json();

    console.log(`[Auth] Session ${sessionId} submit code ${code}`);

    if (!sessionId || !code) {
      return NextResponse.json(
        { error: "Session ID and code are required" },
        { status: 400 },
      );
    }

    const session = await getLoginSession(sessionId);
    // Session is expired or removed
    if (!session) {
      return NextResponse.json({ success: true });
    }

    // Store verification code
    session.code = code;
    session.status = "code_submitted";
    // Note: we don't clean the session error here
    await setLoginSession(sessionId, session);

    // Wait for login flow to complete, max 120 seconds
    let attempts = 0;
    let resultSession: LoginSession | null = session;

    while (attempts < MAX_WAIT_ATTEMPTS) {
      // Wait for a while
      await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL));

      // Get latest session status
      resultSession = await getLoginSession(sessionId);

      if (!resultSession) {
        return NextResponse.json(
          { error: "Session expired or not found" },
          { status: 400 },
        );
      }

      // Check if session is completed or errored
      if (resultSession.status === "completed") {
        return NextResponse.json({
          success: true,
          user: resultSession.user,
          session: resultSession.tgSession,
          userId: resultSession.result?.id ?? null,
        });
      }

      if (resultSession.status === "password_required") {
        return NextResponse.json({
          success: true,
          requiresPassword: true,
        });
      }

      if (resultSession.status === "error") {
        return NextResponse.json(
          { error: resultSession.error || "Authentication failed" },
          { status: 400 },
        );
      }

      attempts++;
    }

    return NextResponse.json(
      { error: "Login timed out, please reopen this window and try again." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Failed to submit code:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to submit code",
      },
      { status: 500 },
    );
  }
}
