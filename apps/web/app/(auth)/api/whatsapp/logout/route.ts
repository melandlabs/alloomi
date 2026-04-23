import { NextResponse } from "next/server";
import { WhatsAppAdapter } from "@/lib/integrations/whatsapp";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientId = typeof body?.session === "string" ? body.session : "";

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Missing WhatsApp session identifier" },
        { status: 400 },
      );
    }

    const adapter = new WhatsAppAdapter({ botId: clientId });
    try {
      await adapter.run();
    } catch (error) {
      console.warn("[WhatsApp Logout] Failed to run adapter:", error);
    } finally {
      await adapter.kill().catch(() => {});
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[WhatsApp Logout] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to invalidate WhatsApp session",
      },
      { status: 500 },
    );
  }
}
