import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/app/(auth)/auth";

const TEAMS_STATE_COOKIE = "teams_oauth_state";
const DEFAULT_SCOPES =
  process.env.TEAMS_OAUTH_SCOPE ??
  [
    "offline_access",
    "User.Read",
    "Chat.Read",
    "Chat.ReadWrite",
    "ChannelMessage.Read.All",
    "ChannelMessage.Send",
    "Team.ReadBasic.All",
  ].join(" ");

type ExchangePayload = {
  code?: string;
  state?: string;
  redirectUri?: string;
};

type TeamsOAuthResponse = {
  token_type?: string;
  scope?: string;
  expires_in?: number;
  ext_expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GraphUser = {
  id?: string;
  displayName?: string;
  userPrincipalName?: string;
  mail?: string | null;
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
  if (!code || !state || !redirectUri) {
    return NextResponse.json(
      { error: "Missing OAuth parameters" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(TEAMS_STATE_COOKIE)?.value;
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
    response.cookies.set(TEAMS_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const clientId = process.env.TEAMS_CLIENT_ID;
  const clientSecret = process.env.TEAMS_CLIENT_SECRET;
  const tenant = process.env.TEAMS_TENANT_ID || "common";

  if (!clientId || !clientSecret) {
    const response = NextResponse.json(
      { error: "Microsoft Teams OAuth is not configured" },
      { status: 500 },
    );
    response.cookies.set(TEAMS_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: DEFAULT_SCOPES,
  });

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch (error) {
    const response = NextResponse.json(
      {
        error: "Failed to contact Microsoft identity platform",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
    response.cookies.set(TEAMS_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  let body: TeamsOAuthResponse;
  try {
    body = (await tokenResponse.json()) as TeamsOAuthResponse;
  } catch {
    const response = NextResponse.json(
      { error: "Failed to parse Microsoft OAuth response" },
      { status: 502 },
    );
    response.cookies.set(TEAMS_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  if (!tokenResponse.ok || !body.access_token) {
    const response = NextResponse.json(
      {
        error:
          body.error_description ??
          body.error ??
          "Microsoft Teams OAuth failed",
      },
      { status: 400 },
    );
    response.cookies.set(TEAMS_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const expiresIn = body.expires_in ?? null;
  const expiresAt =
    expiresIn && Number.isFinite(expiresIn)
      ? Date.now() + Math.max(0, expiresIn - 60) * 1000
      : null;
  const tenantId =
    process.env.TEAMS_TENANT_ID ?? decodeTenantFromIdToken(body.id_token);

  let user: GraphUser | null = null;
  try {
    user = await fetchGraphUser(body.access_token);
  } catch (error) {
    console.warn("[Teams OAuth] Failed to fetch graph user profile:", error);
  }

  const response = NextResponse.json(
    {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresIn,
      expiresAt,
      tokenType: body.token_type ?? "Bearer",
      scope: body.scope ?? null,
      tenantId: tenantId ?? null,
      user,
    },
    { status: 200 },
  );
  response.cookies.set(TEAMS_STATE_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
  return response;
}

function decodeTenantFromIdToken(idToken?: string | null): string | null {
  if (!idToken || typeof idToken !== "string") return null;
  const [, payload] = idToken.split(".");
  if (!payload) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64")
        .toString()
        .trim(),
    ) as { tid?: string };
    return decoded.tid ?? null;
  } catch {
    return null;
  }
}

async function fetchGraphUser(token: string): Promise<GraphUser | null> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch graph profile (${response.status}): ${await response.text().catch(() => "unknown error")}`,
    );
  }
  const body = (await response.json()) as GraphUser;
  return body ?? null;
}
