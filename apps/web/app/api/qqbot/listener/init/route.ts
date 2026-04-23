/**
 * QQ bot WebSocket listener initialization
 * Called by frontend after user successfully authorizes QQ, establishes long connections for all QQ accounts under this user
 * In Tauri, cloudAuthToken can be passed for authentication when calling AI with subsequent inbound messages
 */
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { startQQListenersForUser } from "@/lib/integrations/qqbot/ws-listener";
import { setCloudAuthToken } from "@/lib/auth/token-manager";
import { isTauriMode } from "@/lib/env/constants";
import { createLogger } from "@/lib/utils/logger";

const logger = createLogger("QQListenerInit");

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    logger.info(`QQ listener init, userId=${session.user.id}`);
    await startQQListenersForUser(session.user.id, authToken);

    return NextResponse.json({
      success: true,
      message: "QQ listener(s) started",
    });
  } catch (error) {
    logger.error("QQ listener init failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      },
      { status: 500 },
    );
  }
}
