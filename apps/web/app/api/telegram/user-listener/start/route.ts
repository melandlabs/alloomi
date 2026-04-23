import { NextResponse } from "next/server";
import {
  startTelegramUserListener,
  isUserListenerRunning,
} from "@/lib/integrations/telegram/user-listener";
import { auth } from "@/app/(auth)/auth";

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if already running
    if (isUserListenerRunning(userId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Telegram listener is already running for this user",
        },
        { status: 400 },
      );
    }

    console.log(`[TelegramUserListener API] Starting for user ${userId}`);

    // Start the listener (uses gramjs event-driven architecture, not polling)
    await startTelegramUserListener(userId);

    return NextResponse.json({
      success: true,
      message: "Telegram User Listener started successfully",
    });
  } catch (error) {
    console.error("[TelegramUserListener API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start user listener",
      },
      { status: 500 },
    );
  }
}
