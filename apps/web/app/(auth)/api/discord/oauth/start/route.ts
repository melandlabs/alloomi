import { NextResponse } from "next/server";
import { getApplicationBaseUrl } from "@/lib/env";
import { getCloudUrl } from "@/lib/auth/cloud-proxy";
import { isTauriMode } from "@/lib/env/constants";
import { getAuthUser } from "@/lib/auth/dual-auth";

const DISCORD_AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize";
const DISCORD_STATE_COOKIE = "discord_oauth_state";
const DISCORD_OAUTH_SCOPES = ["identify", "email", "guilds", "bot"];
const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes

type StartPayload = {
  redirectUri?: string;
  redirectPath?: string;
  token?: string; // Bearer token from Tauri client
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as StartPayload;

  // ========================================
  // 1. Tauri local version: forward to cloud public API (no authentication required)
  // ========================================
  if (isTauriMode()) {
    return forwardToCloudPublicAPI(payload.token);
  }

  // ========================================
  // 2. Authentication check: support both session and Bearer token
  // ========================================
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ========================================
  // 3. Tauri desktop version: forward to cloud auth API
  // ========================================
  if (isTauriMode()) {
    return forwardToCloudAuthAPI(payload, request);
  }

  // ========================================
  // 4. Web version: handle directly
  // ========================================
  return handleDirectly(payload, user.id);
}

// ========================================
// Helper functions
// ========================================

/**
 * Forward to cloud public API (used by Tauri local version)
 */
async function forwardToCloudPublicAPI(token?: string) {
  try {
    const cloudUrl = getCloudUrl();

    // Must provide valid token
    if (!token) {
      return NextResponse.json(
        { error: "Authentication required. Please log in first." },
        { status: 401 },
      );
    }

    // Parse token to get userId
    const { getUserIdFromToken } = await import("@/lib/auth/token-manager");
    const userId = getUserIdFromToken(token);

    if (!userId) {
      console.error("[Discord OAuth] Invalid token, cannot extract userId");
      return NextResponse.json(
        { error: "Invalid or expired token. Please log in again." },
        { status: 401 },
      );
    }

    const response = await fetch(
      `${cloudUrl}/api/integrations/discord/oauth/start?userId=${userId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Failed to start OAuth" }));
      console.error("[Discord OAuth] Cloud API error:", error);
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Discord OAuth] Failed to forward to cloud:", error);
    return NextResponse.json(
      { error: "Failed to start OAuth flow" },
      { status: 503 },
    );
  }
}

/**
 * Forward to cloud auth API (used by Web version local development)
 */
async function forwardToCloudAuthAPI(payload: StartPayload, request: Request) {
  try {
    const cloudUrl = getCloudUrl();
    const response = await fetch(`${cloudUrl}/api/discord/oauth/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward session cookie
        Cookie: request.headers.get("Cookie") || "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Failed to start OAuth" }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Discord OAuth] Failed to forward to cloud:", error);
    return NextResponse.json(
      { error: "Failed to start OAuth flow" },
      { status: 503 },
    );
  }
}

/**
 * Cloud environment directly handles OAuth
 */
async function handleDirectly(payload: StartPayload, userId: string) {
  const clientId =
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ||
    process.env.DISCORD_CLIENT_ID ||
    "";

  if (!clientId) {
    return NextResponse.json(
      { error: "Discord OAuth is not configured" },
      { status: 500 },
    );
  }

  // Generate state containing userId, format: {userId}:{uuid}
  // This allows extracting userId from state during callback
  const state = `${userId}:${crypto.randomUUID()}`;
  const redirectUri = resolveRedirectUri(
    payload.redirectUri,
    payload.redirectPath ?? "/discord-authorized",
    process.env.DISCORD_OAUTH_REDIRECT_URI,
  );

  const params = new URLSearchParams({
    response_type: "code",
    integration_type: "0",
    permissions: "67584",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: DISCORD_OAUTH_SCOPES.join(" "),
    state,
    prompt: "consent",
  });

  const authorizationUrl = `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;

  const response = NextResponse.json(
    {
      authorizationUrl,
      state,
      redirectUri,
    },
    { status: 200 },
  );

  response.cookies.set({
    name: DISCORD_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });

  return response;
}

function resolveRedirectUri(
  providedUri: string | undefined,
  redirectPath: string,
  overrideUri: string | undefined,
) {
  const explicit = providedUri ?? overrideUri;
  if (explicit) {
    return sanitizeAbsoluteUri(explicit);
  }

  const path = ensureLeadingSlash(redirectPath || "/discord-authorized");
  return `${getApplicationBaseUrl()}${path}`.replace(/\/$/, "");
}

function ensureLeadingSlash(path: string) {
  const trimmed = path.trim();
  if (!trimmed) {
    return "/discord-authorized";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function sanitizeAbsoluteUri(uri: string) {
  return uri.trim().replace(/\/$/, "");
}
