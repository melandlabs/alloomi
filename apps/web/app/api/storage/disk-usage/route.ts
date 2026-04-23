import { NextResponse } from "next/server";
import { getDiskUsageOverview } from "@/lib/files/workspace/disk-usage";

export async function GET() {
  try {
    const overview = getDiskUsageOverview();
    return NextResponse.json(overview);
  } catch (err) {
    console.error("[disk-usage] GET error:", err);
    return NextResponse.json(
      { error: "Failed to get disk usage" },
      { status: 500 },
    );
  }
}
