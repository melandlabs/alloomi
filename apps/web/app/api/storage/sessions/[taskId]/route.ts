import { type NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/files/workspace/disk-usage";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 },
      );
    }
    const success = deleteSession(taskId);
    if (!success) {
      return NextResponse.json(
        { error: "Session not found or could not be deleted" },
        { status: 404 },
      );
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[session] DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 },
    );
  }
}
