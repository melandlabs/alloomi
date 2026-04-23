/**
 * Telegram User Listener Initialization API
 *
 * This API endpoint initializes the Telegram user listener for a given user.
 * It starts monitoring the user's Telegram "Saved Messages" for AI agent interactions.
 *
 * Only one listener can run per user at a time. If a listener is already running,
 * this endpoint returns "already_running" status unless a new authToken is provided,
 * in which case it will restart the listener with the new token.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  startTelegramUserListener,
  isUserListenerRunning,
  stopTelegramUserListener,
} from "@/lib/integrations/telegram/user-listener";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const authToken = searchParams.get("authToken") || undefined;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    // Check if listener is already running
    if (isUserListenerRunning(userId)) {
      // If authToken is provided and wasn't before, restart with new token
      if (authToken) {
        console.log(
          `[TelegramUserListenerInit] Stopping existing listener to restart with new auth token for user ${userId}`,
        );
        await stopTelegramUserListener(userId);
      } else {
        console.log(
          `[TelegramUserListenerInit] Listener already running for user ${userId}`,
        );
        return NextResponse.json({
          status: "already_running",
          message: "Telegram user listener is already running",
        });
      }
    }

    // Start the listener with auth token
    await startTelegramUserListener(userId, authToken);

    return NextResponse.json({
      status: "started",
      message: "Telegram user listener started successfully",
    });
  } catch (error) {
    console.error("[TelegramUserListenerInit] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to initialize",
        status: "error",
      },
      { status: 500 },
    );
  }
}
