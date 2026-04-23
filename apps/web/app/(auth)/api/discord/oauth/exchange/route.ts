import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/app/(auth)/auth";
import { getCloudUrl } from "@/lib/auth/cloud-proxy";
import { isTauriMode } from "@/lib/env/constants";

const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_STATE_COOKIE = "discord_oauth_state";

type ExchangePayload = {
  code?: string;
  state?: string;
  redirectUri?: string;
};

type DiscordOAuthResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: ExchangePayload;
  try {
    payload = (await request.json()) as ExchangePayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { code, state, redirectUri } = payload;

  // Tauri desktop version: forward to cloud
  if (isTauriMode()) {
    try {
      const cloudUrl = getCloudUrl();
      const response = await fetch(`${cloudUrl}/api/discord/oauth/exchange`, {
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
          .catch(() => ({ error: "Failed to exchange OAuth code" }));
        // Clear state cookie
        const cookieStore = await cookies();
        cookieStore.set(DISCORD_STATE_COOKIE, "", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 0,
        });
        return NextResponse.json(error, { status: response.status });
      }

      const data = await response.json();

      // Clear state cookie
      const cookieStore = await cookies();
      cookieStore.set(DISCORD_STATE_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });

      return NextResponse.json(data);
    } catch (error) {
      console.error("[Discord OAuth] Failed to forward to cloud:", error);
      return NextResponse.json(
        { error: "Failed to exchange OAuth code" },
        { status: 503 },
      );
    }
  }

  // Web version: handle directly

  if (!code || !state || !redirectUri) {
    return NextResponse.json(
      { error: "Missing OAuth parameters" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(DISCORD_STATE_COOKIE)?.value;
  const secureCookie = process.env.NODE_ENV === "production";
  const baseCookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookie,
    path: "/",
  };

  if (!storedState || storedState !== state) {
    const response = NextResponse.json(
      { error: "Invalid OAuth state" },
      { status: 400 },
    );
    response.cookies.set(DISCORD_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const clientId =
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ||
    process.env.DISCORD_CLIENT_ID ||
    "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    const response = NextResponse.json(
      { error: "Discord OAuth is not configured" },
      { status: 500 },
    );
    response.cookies.set(DISCORD_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  let discordResponse: Response;
  try {
    discordResponse = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch (error) {
    const response = NextResponse.json(
      {
        error: "Failed to contact Discord OAuth",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
    response.cookies.set(DISCORD_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  let body: DiscordOAuthResponse;
  try {
    body = (await discordResponse.json()) as DiscordOAuthResponse;
  } catch {
    const response = NextResponse.json(
      { error: "Failed to parse Discord OAuth response" },
      { status: 502 },
    );
    response.cookies.set(DISCORD_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  if (!discordResponse.ok || !body.access_token) {
    const response = NextResponse.json(
      {
        error: body.error_description ?? body.error ?? "Discord OAuth failed",
      },
      { status: 400 },
    );
    response.cookies.set(DISCORD_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const response = NextResponse.json(
    {
      accessToken: body.access_token,
      tokenType: body.token_type ?? "Bearer",
      expiresIn: body.expires_in ?? null,
      refreshToken: body.refresh_token ?? null,
      scope: body.scope ?? null,
    },
    { status: 200 },
  );
  response.cookies.set(DISCORD_STATE_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
  return response;
}
