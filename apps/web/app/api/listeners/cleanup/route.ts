/**
 * Cleanup Listeners API
 *
 * Stops all active listeners (Telegram, WhatsApp, etc.) for the current user.
 * Called when user logs out to ensure clean state.
 */
import { type NextRequest, NextResponse } from "next/server";
import { stopTelegramUserListener } from "@/lib/integrations/telegram/user-listener";
import { stopWhatsAppSelfMessageListener } from "@/lib/integrations/whatsapp/init";
import { stopIMessageSelfListener } from "@/lib/integrations/imessage/init";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const userId = body.userId as string | undefined;
    if (!userId) {
      // No userId provided - skip cleanup
      if (process.env.NODE_ENV === "development") {
        console.log("[ListenersCleanup] No userId provided, skipping cleanup");
      }
      return NextResponse.json({
        status: "skipped",
        message: "No userId provided",
      });
    }

    // Stop Telegram user listener for this user
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[ListenersCleanup] Stopping Telegram listener for user ${userId}`,
      );
    }
    await stopTelegramUserListener(userId);

    // Stop WhatsApp self message listener for this user
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[ListenersCleanup] Stopping WhatsApp listener for user ${userId}`,
      );
    }
    await stopWhatsAppSelfMessageListener(userId);

    // Stop iMessage self message listener for this user
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[ListenersCleanup] Stopping iMessage listener for user ${userId}`,
      );
    }
    await stopIMessageSelfListener(userId).catch((error) => {
      // iMessage listener may not be initialized or macOS only
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[ListenersCleanup] Failed to stop iMessage listener:",
          error instanceof Error ? error.message : String(error),
        );
      }
    });

    return NextResponse.json({
      success: true,
      message: "All listeners stopped",
    });
  } catch (error) {
    console.error("[ListenersCleanup] Failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
