import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { auth } from "@/app/(auth)/auth";

const JIRA_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const JIRA_STATE_COOKIE = "jira_oauth_state";

type ExchangePayload = {
  code?: string;
  state?: string;
  redirectUri?: string;
};

type JiraOAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
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

  if (!code || !state || !redirectUri) {
    return NextResponse.json(
      { error: "Missing OAuth parameters" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(JIRA_STATE_COOKIE)?.value;
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
    response.cookies.set(JIRA_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const response = NextResponse.json(
      { error: "Jira OAuth is not configured" },
      { status: 500 },
    );
    response.cookies.set(JIRA_STATE_COOKIE, "", {
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
    grant_type: "authorization_code",
  });

  let jiraResponse: Response;
  try {
    jiraResponse = await fetch(JIRA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch (error) {
    const response = NextResponse.json(
      {
        error: "Failed to contact Jira OAuth",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
    response.cookies.set(JIRA_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  let body: JiraOAuthResponse;
  try {
    body = (await jiraResponse.json()) as JiraOAuthResponse;
  } catch {
    const response = NextResponse.json(
      { error: "Failed to parse Jira OAuth response" },
      { status: 502 },
    );
    response.cookies.set(JIRA_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  if (!jiraResponse.ok || body.error) {
    const response = NextResponse.json(
      {
        error: body.error ?? "Jira OAuth failed",
      },
      { status: 400 },
    );
    response.cookies.set(JIRA_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const accessToken = body.access_token ?? null;
  const refreshToken = body.refresh_token ?? null;

  if (!accessToken) {
    const response = NextResponse.json(
      { error: "Jira OAuth did not return an access token" },
      { status: 400 },
    );
    response.cookies.set(JIRA_STATE_COOKIE, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    return response;
  }

  const response = NextResponse.json(
    {
      accessToken,
      refreshToken,
      expiresIn: body.expires_in ?? null,
      scope: body.scope ?? null,
      tokenType: body.token_type ?? null,
    },
    { status: 200 },
  );
  response.cookies.set(JIRA_STATE_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
  return response;
}
