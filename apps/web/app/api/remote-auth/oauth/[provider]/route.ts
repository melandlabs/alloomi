/**
 * OAuth authentication API
 * Used for remote authentication via OAuth in Tauri desktop version
 *
 * - Web client: Direct handling
 * - Tauri desktop client: Forward to cloud
 *
 * POST /api/remote-auth/oauth/{provider}
 * Body: { code: string, state: string }
 * Response: { user: { id, email, name, avatarUrl }, token: string }
 */

import { type NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getUser, createUser, getUserTypeForService } from "@/lib/db/queries";
import { authSessionVersion, DUMMY_PASSWORD } from "@/lib/env/constants";
import { verifyState } from "@/lib/auth/oauth-state";

import { createCloudClientForRequest } from "@/lib/auth/remote-client";
import { isTauriMode } from "@/lib/env/constants";

/**
 * Generate authentication token
 */
function generateToken(userId: string, email: string): string {
  const payload = JSON.stringify({
    id: userId,
    email,
    sessionVersion: authSessionVersion,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    iat: Math.floor(Date.now() / 1000),
  });

  const encodedPayload = Buffer.from(payload).toString("base64url");

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("[Auth] AUTH_SECRET environment variable is required");
  }
  const signature = createHash("sha256")
    .update(`${encodedPayload}.${secret}`)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Handle OAuth authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } },
) {
  try {
    const { provider } = params;
    const body = await request.json();
    const { code, state } = body;

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing required parameters: code and state" },
        { status: 400 },
      );
    }

    // Verify state to prevent CSRF attacks
    if (!verifyState(state)) {
      return NextResponse.json(
        { error: "Invalid or expired state parameter" },
        { status: 400 },
      );
    }

    // Tauri desktop client: Forward to cloud
    if (isTauriMode()) {
      const cloudClient = createCloudClientForRequest(request);

      if (!cloudClient) {
        return NextResponse.json(
          { error: "Cloud API not available" },
          { status: 503 },
        );
      }

      // Check if provider is supported
      if (!["google", "slack", "discord"].includes(provider)) {
        return NextResponse.json(
          { error: "Unsupported OAuth provider" },
          { status: 400 },
        );
      }

      try {
        const result = await cloudClient.oauthLogin(
          provider as "google" | "slack" | "discord",
          code,
          state,
        );
        return NextResponse.json(result);
      } catch (error) {
        console.error(
          `[RemoteAuth] Failed to forward OAuth ${provider} to cloud:`,
          error,
        );
        return NextResponse.json(
          { error: "OAuth authentication failed" },
          { status: 500 },
        );
      }
    }

    // Web client: Direct handling
    let userInfo: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let accessToken: string;

    // Handle OAuth for different providers
    switch (provider) {
      case "google":
        ({ userInfo, accessToken } = await handleGoogleOAuth(code));
        break;
      case "slack":
        ({ userInfo, accessToken } = await handleSlackOAuth(code));
        break;
      case "discord":
        ({ userInfo, accessToken } = await handleDiscordOAuth(code));
        break;
      default:
        return NextResponse.json(
          { error: "Unsupported OAuth provider" },
          { status: 400 },
        );
    }

    // Find or create user
    const existingUsers = await getUser(userInfo.email);

    let user: (typeof existingUsers)[0];
    if (existingUsers.length > 0) {
      user = existingUsers[0];
    } else {
      const [newUser] = await createUser(userInfo.email, DUMMY_PASSWORD);
      user = newUser;
    }

    // Get user type
    const userType = await getUserTypeForService(user.id);

    // Generate token
    const token = generateToken(user.id, user.email);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        type: userType,
      },
      token,
    });
  } catch (error) {
    console.error(`[RemoteAuth] OAuth ${params.provider} error:`, error);
    return NextResponse.json(
      { error: "OAuth authentication failed" },
      { status: 500 },
    );
  }
}

/**
 * Handle Google OAuth
 */
async function handleGoogleOAuth(code: string): Promise<{
  userInfo: { id: string; email: string; name: string; avatarUrl: string };
  accessToken: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth credentials");
  }

  const cloudUrl =
    process.env.CLOUD_API_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const redirectUri = `${cloudUrl}/api/auth/callback/google`;

  // Exchange code for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange code for access token");
  }

  const tokenData = await tokenResponse.json();

  // Fetch user information
  const userInfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    },
  );

  if (!userInfoResponse.ok) {
    throw new Error("Failed to fetch user info");
  }

  const googleUser = await userInfoResponse.json();

  return {
    userInfo: {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.picture,
    },
    accessToken: tokenData.access_token,
  };
}

/**
 * Handle Slack OAuth
 */
async function handleSlackOAuth(code: string): Promise<{
  userInfo: { id: string; email: string; name: string; avatarUrl: string };
  accessToken: string;
}> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Slack OAuth credentials");
  }

  const cloudUrl =
    process.env.CLOUD_API_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const redirectUri = `${cloudUrl}/api/auth/callback/slack`;

  // Exchange code for access token
  const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange code for access token");
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.ok) {
    throw new Error(`Slack OAuth error: ${tokenData.error}`);
  }

  // Fetch user information
  const userInfoResponse = await fetch("https://slack.com/api/users.info", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${tokenData.access_token}`,
    },
    body: new URLSearchParams({ user: tokenData.authed_user.id }),
    method: "POST",
  });

  if (!userInfoResponse.ok) {
    throw new Error("Failed to fetch user info");
  }

  const userData = await userInfoResponse.json();

  if (!userData.ok) {
    throw new Error(`Slack API error: ${userData.error}`);
  }

  const slackUser = userData.user;

  return {
    userInfo: {
      id: slackUser.id,
      email: slackUser.profile.email,
      name: slackUser.real_name || slackUser.name,
      avatarUrl: slackUser.profile.image_192,
    },
    accessToken: tokenData.access_token,
  };
}

/**
 * Handle Discord OAuth
 */
async function handleDiscordOAuth(code: string): Promise<{
  userInfo: { id: string; email: string; name: string; avatarUrl: string };
  accessToken: string;
}> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Discord OAuth credentials");
  }

  const cloudUrl =
    process.env.CLOUD_API_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const redirectUri = `${cloudUrl}/api/auth/callback/discord`;

  // Exchange code for access token
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange code for access token");
  }

  const tokenData = await tokenResponse.json();

  // Fetch user information
  const userInfoResponse = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    throw new Error("Failed to fetch user info");
  }

  const discordUser = await userInfoResponse.json();

  // Discord avatar URL
  // Note: New Discord versions removed discriminator, use 0 as default value
  const discriminator = discordUser.discriminator || "0";
  const avatarUrl = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${Number.parseInt(discriminator, 10) % 5}.png`;

  return {
    userInfo: {
      id: discordUser.id,
      email: discordUser.email,
      name: discordUser.global_name || discordUser.username,
      avatarUrl,
    },
    accessToken: tokenData.access_token,
  };
}
