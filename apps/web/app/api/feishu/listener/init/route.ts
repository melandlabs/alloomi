/**
 * Feishu WebSocket listener initialization
 * Called by frontend after user authorizes Feishu, establishes long connections for all Feishu accounts under the user
 * In Tauri, can pass cloudAuthToken for AI authentication when handling incoming messages (same origin as Telegram/iMessage)
 */
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { startFeishuListenersForUser } from "@/lib/integrations/feishu/ws-listener";
import { setCloudAuthToken } from "@/lib/auth/token-manager";
import { isTauriMode } from "@/lib/env/constants";
import { createLogger } from "@/lib/utils/logger";

const logger = createLogger("FeishuListenerInit");

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Tauri: frontend passes cloud auth token (same origin as Telegram GET init?authToken=), store in connection and set globally
    let authToken: string | undefined;
    if (isTauriMode()) {
      try {
        const body = await request.json().catch(() => ({}));
        authToken =
          typeof body?.cloudAuthToken === "string"
            ? body.cloudAuthToken.trim() || undefined
            : undefined;
        if (authToken) setCloudAuthToken(authToken);
      } catch {
        // Ignore when no body or not JSON
      }
    }

    logger.info(`Feishu listener init, userId=${session.user.id}`);
    await startFeishuListenersForUser(session.user.id, authToken);

    return NextResponse.json({
      success: true,
      message: "Lark/Feishu listener(s) started",
    });
  } catch (error) {
    logger.error("Feishu listener init failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      },
      { status: 500 },
    );
  }
}
