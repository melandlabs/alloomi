import { NextResponse } from "next/server";
import { initIMessageSelfListener } from "@/lib/integrations/imessage/init";
import { auth } from "@/app/(auth)/auth";

/**
 * Initialize iMessage self-message listener
 * Called by frontend after user login
 *
 * POST /api/imessage/init-self-listener
 * Optional body: { selfIdentifier: string, authToken: string } - User's phone number/email and authentication token
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get optional self identifier (phone number/email) and auth token from request body
    let selfIdentifier: string | undefined;
    let authToken: string | undefined;
    try {
      const body = await request.json();
      selfIdentifier = body?.selfIdentifier;
      authToken = body?.authToken;
    } catch {
      // Request body is empty or not JSON, use automatic detection
    }

    await initIMessageSelfListener(userId, selfIdentifier, authToken);

    return NextResponse.json({
      success: true,
      message: "iMessage Self Message Listener initialization started",
    });
  } catch (error) {
    console.error(
      "[API] Failed to initialize iMessage self-message listener:",
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
