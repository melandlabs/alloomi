import { NextResponse } from "next/server";
import { initTelegramUserListener } from "@/lib/integrations/telegram/init";
import { auth } from "@/app/(auth)/auth";

/**
 * Initialize Telegram User Listener for the current user
 * This should be called after user logs in
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    console.log(`[API] Initializing Telegram User Listener for user ${userId}`);

    await initTelegramUserListener(userId);

    return NextResponse.json({
      success: true,
      message: "Telegram User Listener initialization started",
    });
  } catch (error) {
    console.error("[API] Failed to initialize Telegram User Listener:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      },
      { status: 500 },
    );
  }
}
