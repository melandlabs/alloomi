import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/app/(auth)/auth";

const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_INTROSPECT_URL = "https://api.hubapi.com/oauth/v1/access-tokens";
const HUBSPOT_STATE_COOKIE = "hubspot_oauth_state";

type ExchangePayload = {
  code?: string;
  state?: string;
  redirectUri?: string;
};

type HubspotTokenResponse = {
  access_token?: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  token_type?: string | null;
  scope?: string | null;
  hub_id?: number | null;
  user?: string | null;
  user_id?: number | null;
  error?: string | null;
};

type HubspotTokenIntrospection = {
  hub_id?: number | null;
  hub_domain?: string | null;
  user?: string | null;
  user_id?: number | null;
  token?: string | null;
  expires_in?: number | null;
  scope?: string[];
  token_type?: string;
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
  const storedState = cookieStore.get(HUBSPOT_STATE_COOKIE)?.value;
  const secureCookie = process.env.NODE_ENV === "production";
  const baseCookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookie,
    path: "/",
  };

  const clearState = (response: NextResponse) => {
    response.cookies.set(HUBSPOT_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  };

  if (!storedState || storedState !== state) {
    return clearState(
      NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 }),
    );
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return clearState(
      NextResponse.json(
        { error: "HubSpot OAuth is not configured" },
        { status: 500 },
      ),
    );
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  try {
    const tokenResponse = await fetch(HUBSPOT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const body = (await tokenResponse
      .json()
      .catch(() => ({}))) as HubspotTokenResponse;

    if (!tokenResponse.ok || !body.access_token) {
      return clearState(
        NextResponse.json(
          { error: body?.error ?? "HubSpot OAuth failed" },
          { status: 400 },
        ),
      );
    }

    const tokenInfo = await fetchTokenInfo(body.access_token).catch(() => null);

    const response = NextResponse.json(
      {
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? null,
        expiresIn: body.expires_in ?? null,
        tokenType: body.token_type ?? tokenInfo?.token_type ?? null,
        scope: body.scope ?? tokenInfo?.scope?.join(" ") ?? null,
        hubId: body.hub_id ?? tokenInfo?.hub_id ?? null,
        hubDomain: tokenInfo?.hub_domain ?? null,
        userEmail: body.user ?? tokenInfo?.user ?? null,
        userId: body.user_id ?? tokenInfo?.user_id ?? null,
      },
      { status: 200 },
    );

    return clearState(response);
  } catch (error) {
    console.error("[HubSpot OAuth] Exchange failed:", error);
    return clearState(
      NextResponse.json(
        {
          error: "Failed to finalize HubSpot OAuth flow",
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 502 },
      ),
    );
  }
}

async function fetchTokenInfo(
  accessToken: string,
): Promise<HubspotTokenIntrospection | null> {
  const response = await fetch(
    `${HUBSPOT_INTROSPECT_URL}/${encodeURIComponent(accessToken)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as HubspotTokenIntrospection;
}
