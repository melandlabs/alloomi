import { type NextRequest, NextResponse } from "next/server";
import {
  listSessionsWithSizes,
  deleteSessionsOlderThan,
  deleteAllSessions,
} from "@/lib/files/workspace/disk-usage";

export async function GET() {
  try {
    const sessions = listSessionsWithSizes();
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[sessions] GET error:", err);
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { olderThanDays, deleteAll } = body as {
      olderThanDays?: number;
      deleteAll?: boolean;
    };

    if (deleteAll) {
      const count = deleteAllSessions();
      return NextResponse.json({ deleted: count });
    }

    if (typeof olderThanDays === "number" && olderThanDays > 0) {
      const count = deleteSessionsOlderThan(olderThanDays);
      return NextResponse.json({ deleted: count });
    }

    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  } catch (err) {
    console.error("[sessions] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete sessions" },
      { status: 500 },
    );
  }
}
