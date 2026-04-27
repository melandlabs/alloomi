import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getApplicationBaseUrl } from "@/lib/env";

const HUBSPOT_AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_STATE_COOKIE = "hubspot_oauth_state";
const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes
const HUBSPOT_SCOPES = [
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.schemas.deals.read",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "oauth",
  "offline",
];

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

  const clientId = process.env.HUBSPOT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "HubSpot OAuth is not configured" },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  const redirectUri = resolveRedirectUri(
    payload.redirectUri,
    payload.redirectPath ?? "/hubspot-authorized",
    process.env.HUBSPOT_REDIRECT_URI,
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: HUBSPOT_SCOPES.join(" "),
    state,
  });

  const authorizationUrl = `${HUBSPOT_AUTHORIZE_URL}?${params.toString()}`;

  const response = NextResponse.json(
    {
      authorizationUrl,
      state,
      redirectUri,
    },
    { status: 200 },
  );

  response.cookies.set({
    name: HUBSPOT_STATE_COOKIE,
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

  const path = ensureLeadingSlash(redirectPath || "/hubspot-authorized");
  return `${getApplicationBaseUrl()}${path}`.replace(/\/$/, "");
}

function ensureLeadingSlash(path: string) {
  const trimmed = path.trim();
  if (!trimmed) {
    return "/hubspot-authorized";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function sanitizeAbsoluteUri(uri: string) {
  return uri.trim().replace(/\/$/, "");
}
