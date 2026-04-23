import { NextResponse } from "next/server";
import { initWhatsAppSelfMessageListener } from "@/lib/integrations/whatsapp/init";
import { auth } from "@/app/(auth)/auth";

/**
 * Initialize WhatsApp Self Message Listener for the current user
 * This should be called after user logs in
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get authToken from request body for API configuration
    let authToken: string | undefined;
    try {
      const body = await request.json();
      authToken = body?.authToken;
    } catch {
      // Request body not available, auth token not passed
    }

    await initWhatsAppSelfMessageListener(userId, authToken);

    return NextResponse.json({
      success: true,
      message: "WhatsApp Self Message Listener initialization started",
    });
  } catch (error) {
    console.error(
      "[API] Failed to initialize WhatsApp Self Message Listener:",
      error,
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      },
      { status: 500 },
    );
  }
}
