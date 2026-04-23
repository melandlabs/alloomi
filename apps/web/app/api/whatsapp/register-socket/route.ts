import { NextResponse } from "next/server";
import { WhatsAppAdapter } from "@/lib/integrations/whatsapp";
import { auth } from "@/app/(auth)/auth";

/**
 * After WhatsApp authorization completes and the integration account is created,
 * call this to register the live socket under the accountId key.
 * This allows the self-listener and insight bot to find the socket.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, accountId } = await request.json();

    if (!sessionId || !accountId) {
      return NextResponse.json(
        { error: "sessionId and accountId are required" },
        { status: 400 },
      );
    }

    WhatsAppAdapter.registerSocketByAccountId(sessionId, accountId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WhatsApp register-socket] Failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Registration failed",
      },
      { status: 500 },
    );
  }
}
