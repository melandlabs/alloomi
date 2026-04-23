import { NextResponse } from "next/server";
import {
  ensureRedis,
  getLoginSession,
  setLoginSession,
  type LoginSession,
} from "@/lib/session/context";

// Max attempts
const MAX_ATTEMPTS = 3;
// Wait interval (milliseconds)
const WAIT_INTERVAL = 1000;
// Max wait attempts
const MAX_WAIT_ATTEMPTS = 120;

export async function POST(request: Request) {
  try {
    await ensureRedis();

    const { sessionId, password } = await request.json();

    if (!sessionId || !password) {
      return NextResponse.json(
        { error: "Session ID and password are required" },
        { status: 400 },
      );
    }

    const session = await getLoginSession(sessionId);
    if (!session) {
      return NextResponse.json(
        {
          error:
            "Session not found, please reopen this window, change the phone number and try again.",
        },
        { status: 404 },
      );
    }

    // Verify session status
    if (session.status !== "password_required") {
      console.log(
        "[Auth] Telegram Password is not required for this session",
        session.status,
      );
      return NextResponse.json(
        { error: "Password is not required for this session" },
        { status: 400 },
      );
    }

    // Get attempt count from session (default 0 for first attempt)
    const currentAttempts = session.passwordAttempts || 0;
    const newAttempts = currentAttempts + 1;

    // Update attempt count in session
    session.passwordAttempts = newAttempts;

    // Lock session if max attempts exceeded
    if (newAttempts > MAX_ATTEMPTS) {
      session.status = "error";
      session.error = "Too many failed password attempts";
      await setLoginSession(sessionId, session);

      return NextResponse.json(
        {
          error: "PASSWORD_ATTEMPTS_EXCEEDED",
          message: "Too many failed attempts",
          remainingAttempts: 0,
        },
        { status: 400 },
      );
    }

    // Store password and update status
    session.password = password;
    session.status = "password_submitted";
    await setLoginSession(sessionId, session);

    // Wait for login flow to complete, max 120 seconds
    let attempts = 0;
    let resultSession: LoginSession | null = session; // Correct type

    while (attempts < MAX_WAIT_ATTEMPTS) {
      // Wait for a while
      await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL));

      // Get latest session status
      resultSession = await getLoginSession(sessionId);

      // Check if session exists
      if (!resultSession) {
        return NextResponse.json(
          {
            error:
              "Session expired or not found, please reopen this window and try again.",
          },
          { status: 400 },
        );
      }

      // Check if session is completed or errored
      if (resultSession.status === "completed") {
        return NextResponse.json({
          success: true,
          user: resultSession.user,
          session: resultSession.tgSession,
          passwordAttempts: newAttempts,
          userId: resultSession.result?.id ?? null,
        });
      }

      if (resultSession.status === "error") {
        const errorLower = resultSession.error?.toLowerCase() || "";
        // Check if it's a password error
        if (
          errorLower.includes("password") ||
          errorLower.includes("invalid") ||
          errorLower.includes("incorrect")
        ) {
          // Calculate remaining attempts
          const remainingAttempts = MAX_ATTEMPTS - newAttempts;

          return NextResponse.json(
            {
              error: "INVALID_PASSWORD",
              message: "Invalid password provided",
              remainingAttempts,
              currentAttempts: newAttempts,
            },
            { status: 400 },
          );
        }

        // Other errors
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
    console.error("Failed to submit password:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to submit password",
      },
      { status: 500 },
    );
  }
}
