import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserRAGStats } from "@/lib/ai/rag/langchain-service";

/**
 * GET /api/rag/stats
 * Get RAG statistics for the current user
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getUserRAGStats(session.user.id);

    return NextResponse.json({
      totalDocuments: stats.totalDocuments,
      totalChunks: stats.totalChunks,
      totalSize: stats.totalSize,
      documents: stats.documents,
    });
  } catch (error) {
    console.error("RAG stats error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch RAG statistics",
      },
      { status: 500 },
    );
  }
}
