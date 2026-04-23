import { NextResponse } from "next/server";
import { slackAuthConfig } from "@/app/(auth)/auth.config";
import { getApplicationBaseUrl } from "@/lib/env";
import { getCloudUrl } from "@/lib/auth/cloud-proxy";
import { isTauriMode } from "@/lib/env/constants";
import { getAuthUser } from "@/lib/auth/dual-auth";

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_STATE_COOKIE = "slack_oauth_state";
const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes

type StartPayload = {
  redirectUri?: string;
  redirectPath?: string;
  token?: string; // Bearer token from Tauri client
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as StartPayload;

  console.log("[Slack OAuth] IS_TAURI env:", process.env.IS_TAURI);
  console.log("[Slack OAuth] isTauriMode():", isTauriMode());
  console.log(
    "[Slack OAuth] token from payload:",
    payload.token ? "exists" : "undefined",
  );

  // ========================================
  // 1. Tauri local version: forward to cloud public API (no auth required)
  // ========================================
  if (isTauriMode()) {
    console.log(
      "[Slack OAuth] Tauri mode detected, forwarding to cloud public API",
    );
    return forwardToCloudPublicAPI(payload.token);
  }

  // ========================================
  // 2. Authentication check: supports both session and Bearer token
  // ========================================
  const user = await getAuthUser(request);

  if (!user) {
    console.log(
      "[Slack OAuth] Authentication failed: no valid session or token",
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Slack OAuth] Authenticated user:", user.id);

  // ========================================
  // 3. Tauri desktop: forward to cloud auth API
  // ========================================
  if (isTauriMode()) {
    console.log("[Slack OAuth] Local Web mode, forwarding to cloud auth API");
    return forwardToCloudAuthAPI(payload, request);
  }

  // ========================================
  // 4. Web side: handle directly
  // ========================================
  console.log("[Slack OAuth] Cloud mode, handling directly");
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

    // Must provide a valid token
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
      console.error("[Slack OAuth] Invalid token, cannot extract userId");
      return NextResponse.json(
        { error: "Invalid or expired token. Please log in again." },
        { status: 401 },
      );
    }

    console.log("[Slack OAuth] Extracted userId from token:", userId);

    const response = await fetch(
      `${cloudUrl}/api/integrations/slack/oauth/start?userId=${userId}`,
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
      console.error("[Slack OAuth] Cloud API error:", error);
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    console.log("[Slack OAuth] Cloud API success");
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Slack OAuth] Failed to forward to cloud:", error);
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
    const response = await fetch(`${cloudUrl}/api/slack/oauth/start`, {
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
    console.error("[Slack OAuth] Failed to forward to cloud:", error);
    return NextResponse.json(
      { error: "Failed to start OAuth flow" },
      { status: 503 },
    );
  }
}

/**
 * Cloud environment handles OAuth directly
 */
async function handleDirectly(payload: StartPayload, userId: string) {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Slack OAuth is not configured" },
      { status: 500 },
    );
  }

  const scopes = slackAuthConfig.oauth_config.params.scope.join(",");
  const userScopes = slackAuthConfig.oauth_config.params.user_scope.join(",");

  // Generate state containing userId, format: {userId}:{uuid}
  // This allows extracting userId from state in callback
  const state = `${userId}:${crypto.randomUUID()}`;
  const redirectUri = resolveRedirectUri(
    payload.redirectUri,
    payload.redirectPath ?? "/slack-authorized",
    process.env.SLACK_OAUTH_REDIRECT_URI,
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });

  if (scopes) {
    params.set("scope", scopes);
  }

  if (userScopes) {
    params.set("user_scope", userScopes);
  }

  const authorizationUrl = `${SLACK_AUTHORIZE_URL}?${params.toString()}`;

  const response = NextResponse.json(
    {
      authorizationUrl,
      state,
      redirectUri,
    },
    { status: 200 },
  );

  response.cookies.set({
    name: SLACK_STATE_COOKIE,
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

  const path = ensureLeadingSlash(redirectPath || "/slack-authorized");
  return `${getApplicationBaseUrl()}${path}`.replace(/\/$/, "");
}

function ensureLeadingSlash(path: string) {
  const trimmed = path.trim();
  if (!trimmed) {
    return "/slack-authorized";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function sanitizeAbsoluteUri(uri: string) {
  return uri.trim().replace(/\/$/, "");
}
