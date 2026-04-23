import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { linearAuthConfig } from "@/app/(auth)/auth.config";
import { getApplicationBaseUrl } from "@/lib/env";

const LINEAR_AUTHORIZE_URL = "https://linear.app/oauth/authorize";
const LINEAR_STATE_COOKIE = "linear_oauth_state";
const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes

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

  const clientId = process.env.LINEAR_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Linear OAuth is not configured" },
      { status: 500 },
    );
  }

  const scope = linearAuthConfig.oauth_config.params.scope.join(" ");

  const state = crypto.randomUUID();
  const redirectUri = resolveRedirectUri(
    payload.redirectUri,
    payload.redirectPath ?? "/linear-authorized",
    process.env.LINEAR_OAUTH_REDIRECT_URI,
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    response_type: "code",
    prompt: linearAuthConfig.oauth_config.params.prompt,
    actor: "application", // Required for Linear OAuth
  });

  const authorizationUrl = `${LINEAR_AUTHORIZE_URL}?${params.toString()}`;

  const response = NextResponse.json(
    {
      authorizationUrl,
      state,
      redirectUri,
    },
    { status: 200 },
  );

  response.cookies.set({
    name: LINEAR_STATE_COOKIE,
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

  const path = ensureLeadingSlash(redirectPath || "/linear-authorized");
  return `${getApplicationBaseUrl()}${path}`.replace(/\/$/, "");
}

function ensureLeadingSlash(path: string) {
  const trimmed = path.trim();
  if (!trimmed) {
    return "/linear-authorized";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function sanitizeAbsoluteUri(uri: string) {
  return uri.trim().replace(/\/$/, "");
}
