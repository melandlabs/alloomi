import { NextResponse } from "next/server";
import { authenticateCloudRequest } from "@/lib/auth/cloud-auth";

const SLACK_API_BASE = "https://slack.com/api";

type SlackTeamInfo = {
  id: string;
  name: string;
  domain: string;
  email_domain: string | null;
  icon: {
    image_34: string | null;
    image_44: string | null;
    image_68: string | null;
    image_88: string | null;
    image_102: string | null;
    image_132: string | null;
    image_230: string | null;
    image_default: boolean;
  };
};

type TeamRequestPayload = {
  accessToken?: string;
  tokenType?: string;
};

type SlackApiResponse<T> = {
  ok: boolean;
  error?: string;
} & T;

export async function POST(request: Request) {
  // Support Session and Bearer Token auth
  const user = await authenticateCloudRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request
    .json()
    .catch(() => ({}))) as TeamRequestPayload;

  const accessToken = payload.accessToken;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Slack access token" },
      { status: 400 },
    );
  }

  const tokenType = payload.tokenType ?? "Bearer";

  try {
    const result = await fetchTeamInfoWithRetry({ accessToken, tokenType });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error ?? "Failed to fetch Slack team info",
          details: result.details,
        },
        { status: result.status },
      );
    }

    return NextResponse.json(
      {
        team: {
          id: result.team.id,
          name: result.team.name,
          domain: result.team.domain,
          icon: result.team.icon,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch Slack team info",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function fetchTeamInfoWithRetry({
  accessToken,
  tokenType,
}: {
  accessToken: string;
  tokenType: string;
}) {
  const maxAttempts = 2;
  let attempt = 0;
  let lastDetails: unknown = null;

  while (attempt < maxAttempts) {
    const response = await fetch(`${SLACK_API_BASE}/team.info`, {
      headers: {
        Authorization: `${tokenType} ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      cache: "no-store",
    });

    const body = (await response.json().catch(() => ({}))) as SlackApiResponse<{
      team?: SlackTeamInfo;
    }>;

    if (response.status === 429) {
      lastDetails = body;
      const retryAfterMs = computeRetryAfter(response, body);
      if (retryAfterMs === null) {
        return {
          ok: false,
          status: 429,
          error: "Slack rate limited the request",
          details: body,
        } as const;
      }
      await wait(retryAfterMs);
      attempt += 1;
      continue;
    }

    if (!response.ok || !body.ok) {
      return {
        ok: false,
        status: response.status,
        error: body.error ?? "Failed to fetch Slack team info",
        details: body,
      } as const;
    }

    if (!body.team) {
      return {
        ok: false,
        status: 404,
        error: "Slack team information not found",
        details: body,
      } as const;
    }

    return {
      ok: true,
      status: 200,
      team: body.team,
      details: body,
    } as const;
  }

  return {
    ok: false,
    status: 429,
    error: "Slack rate limited the request",
    details: lastDetails,
  } as const;
}

function computeRetryAfter(response: Response, body: unknown): number | null {
  const headerValue = response.headers.get("retry-after");
  if (headerValue) {
    const parsed = Number.parseFloat(headerValue);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return Math.min(parsed * 1000, 5000);
    }
  }

  if (
    body &&
    typeof body === "object" &&
    "retry_after" in body &&
    typeof (body as { retry_after: unknown }).retry_after === "number"
  ) {
    const retryAfter = (body as { retry_after: number }).retry_after;
    if (!Number.isNaN(retryAfter) && retryAfter >= 0) {
      return Math.min(retryAfter * 1000, 5000);
    }
  }

  return 1000;
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
