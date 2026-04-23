import { NextResponse } from "next/server";
import {
  ensureRedis,
  getLoginSession,
  deleteLoginSession,
} from "@/lib/session/context";

// Wait interval (milliseconds)
const WAIT_INTERVAL = 1000;
// Max wait attempts (120 seconds)
const MAX_WAIT_ATTEMPTS = 120;

export async function GET(request: Request) {
  try {
    await ensureRedis();

    // Get sessionId from URL
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    // Check if session exists
    const initialSession = await getLoginSession(sessionId);
    if (!initialSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Loop until status changes or timeout
    let attempts = 0;
    while (attempts < MAX_WAIT_ATTEMPTS) {
      // Wait for a while
      await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL));

      // Get current session status
      const session = await getLoginSession(sessionId);

      if (!session) {
        return NextResponse.json({ error: "Session expired" }, { status: 400 });
      }

      // Login successful
      if (session.status === "completed" && session.user && session.tgSession) {
        // Clean up session after successful login
        await deleteLoginSession(sessionId);

        return NextResponse.json({
          success: true,
          user: session.user,
          session: session.tgSession,
          userId: session.result?.id ?? null,
        });
      }

      if (session.status === "password_required") {
        return NextResponse.json({
          success: true,
          requiresPassword: true,
        });
      }

      // Login error
      if (session.status === "error") {
        const error = session.error || "Authentication failed";
        await deleteLoginSession(sessionId);

        return NextResponse.json({ error }, { status: 400 });
      }

      attempts++;
    }

    // Timeout handling
    await deleteLoginSession(sessionId);
    return NextResponse.json({ error: "QR login timed out" }, { status: 408 });
  } catch (error) {
    console.error(
      `[QR Auth] Confirmation error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return NextResponse.json(
      { error: "Failed to wait for QR confirmation" },
      { status: 500 },
    );
  }
}
