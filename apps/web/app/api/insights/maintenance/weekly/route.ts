import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/auth/remote-auth-utils";
import { runWeeklyInsightMaintenance } from "@/lib/insights/maintenance";

export const dynamic = "force-dynamic";

// Keep the route thin: auth at the edge, maintenance orchestration in lib/insights/maintenance.
async function handleWeeklyInsightMaintenance(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  if (!verifyCronAuth(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runWeeklyInsightMaintenance({
    platform: "web",
  });

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return await handleWeeklyInsightMaintenance(request);
}

export async function POST(request: Request) {
  return await handleWeeklyInsightMaintenance(request);
}
