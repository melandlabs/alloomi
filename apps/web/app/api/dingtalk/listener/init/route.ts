/**
 * DingTalk Stream listener initialization: Called by frontend after user completes authorization, establishes long connections for all DingTalk integrations under this user
 * In Tauri, cloudAuthToken can be passed for inbound messages to use cloud AI (consistent with Feishu)
 */
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { startDingTalkListenersForUser } from "@/lib/integrations/dingtalk/ws-listener";
import { setCloudAuthToken } from "@/lib/auth/token-manager";
import { isTauriMode } from "@/lib/env/constants";

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
        // Ignore when no body
      }
    }

    await startDingTalkListenersForUser(session.user.id, authToken);

    return NextResponse.json({
      success: true,
      message: "DingTalk listener(s) started",
    });
  } catch (error) {
    console.error("[API] DingTalk listener initialization failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      },
      { status: 500 },
    );
  }
}
