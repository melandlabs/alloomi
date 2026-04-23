/**
 * WeChat iLink long-polling listener initialization
 * Called by frontend after user successfully authorizes, starts getUpdates loop for all WeChat accounts under this user
 */
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { startWeixinListenersForUser } from "@/lib/integrations/weixin/ws-listener";
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
        // Ignore when no body or not JSON
      }
    }

    await startWeixinListenersForUser(session.user.id, authToken);

    return NextResponse.json({
      success: true,
      message: "Weixin listener(s) started",
    });
  } catch (error) {
    console.error("[API] WeChat listener initialization failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      },
      { status: 500 },
    );
  }
}
