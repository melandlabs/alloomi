import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/app/(auth)/auth";

import { getCloudUrl } from "@/lib/auth/cloud-proxy";
import { isTauriMode } from "@/lib/env/constants";

const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
const SLACK_STATE_COOKIE = "slack_oauth_state";

type ExchangePayload = {
  code?: string;
  state?: string;
  redirectUri?: string;
};

type SlackOAuthResponse = {
  ok: boolean;
  access_token?: string;
  authed_user?: {
    id?: string;
    scope?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  team?: {
    id?: string;
    name?: string;
  };
  error?: string;
  [key: string]: unknown;
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

  // Tauri desktop: forward to cloud
  if (isTauriMode()) {
    try {
      const cloudUrl = getCloudUrl();
      const response = await fetch(`${cloudUrl}/api/slack/oauth/exchange`, {
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
        cookieStore.set(SLACK_STATE_COOKIE, "", {
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
      cookieStore.set(SLACK_STATE_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });

      return NextResponse.json(data);
    } catch (error) {
      console.error("[Slack OAuth] Failed to forward to cloud:", error);
      return NextResponse.json(
        { error: "Failed to exchange OAuth code" },
        { status: 503 },
      );
    }
  }

  // Web side: handle directly

  if (!code || !state || !redirectUri) {
    return NextResponse.json(
      { error: "Missing OAuth parameters" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(SLACK_STATE_COOKIE)?.value;
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
    response.cookies.set(SLACK_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const response = NextResponse.json(
      { error: "Slack OAuth is not configured" },
      { status: 500 },
    );
    response.cookies.set(SLACK_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  let slackResponse: Response;
  try {
    slackResponse = await fetch(SLACK_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch (error) {
    const response = NextResponse.json(
      {
        error: "Failed to contact Slack OAuth",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
    response.cookies.set(SLACK_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  let body: SlackOAuthResponse;
  try {
    body = (await slackResponse.json()) as SlackOAuthResponse;
  } catch {
    const response = NextResponse.json(
      { error: "Failed to parse Slack OAuth response" },
      { status: 502 },
    );
    response.cookies.set(SLACK_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  if (!slackResponse.ok || !body.ok) {
    const response = NextResponse.json(
      {
        error: body.error ?? "Slack OAuth failed",
      },
      { status: 400 },
    );
    response.cookies.set(SLACK_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const accessToken =
    body.authed_user?.access_token ?? body.access_token ?? null;

  if (!accessToken) {
    const response = NextResponse.json(
      { error: "Slack OAuth did not return an access token" },
      { status: 400 },
    );
    response.cookies.set(SLACK_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const response = NextResponse.json(
    {
      accessToken,
      authedUser: body.authed_user ?? null,
      team: body.team ?? null,
    },
    { status: 200 },
  );
  response.cookies.set(SLACK_STATE_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
  return response;
}
