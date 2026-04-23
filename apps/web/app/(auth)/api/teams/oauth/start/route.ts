import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getApplicationBaseUrl } from "@/lib/env";

const TEAMS_STATE_COOKIE = "teams_oauth_state";
const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes
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

type StartPayload = {
  redirectUri?: string;
  redirectPath?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as StartPayload;

  const clientId = process.env.TEAMS_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Microsoft Teams OAuth is not configured" },
      { status: 500 },
    );
  }

  const tenant = process.env.TEAMS_TENANT_ID || "common";
  const scope = DEFAULT_SCOPES;
  const state = crypto.randomUUID();
  const redirectUri = resolveRedirectUri(
    payload.redirectUri,
    payload.redirectPath ?? "/teams-authorized",
    process.env.TEAMS_REDIRECT_URI,
  );

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope,
    state,
    prompt: "select_account",
  });

  const authorizationUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;

  const response = NextResponse.json(
    { authorizationUrl, state, redirectUri },
    { status: 200 },
  );

  response.cookies.set({
    name: TEAMS_STATE_COOKIE,
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

  const path = ensureLeadingSlash(redirectPath || "/teams-authorized");
  return `${getApplicationBaseUrl()}${path}`.replace(/\/$/, "");
}

function ensureLeadingSlash(path: string) {
  const trimmed = path.trim();
  if (!trimmed) {
    return "/teams-authorized";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function sanitizeAbsoluteUri(uri: string) {
  return uri.trim().replace(/\/$/, "");
}
