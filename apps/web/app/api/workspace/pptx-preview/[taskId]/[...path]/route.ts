/**
 * PPTX Preview API
 *
 * Server-side high-fidelity PPTX preview rendering via LibreOffice -> PDF -> WebP pipeline.
 * Returns a manifest with slide metadata and paths to rendered WebP images.
 *
 * Slide images are served via the existing /api/workspace/file/{taskId}/{path} route.
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getOrCreatePptxRenderManifest } from "@/lib/files/pptx-render";

// GET /api/workspace/pptx-preview/[taskId]/[...path] - Get PPTX render manifest
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ taskId: string; path: string[] }> },
) {
  // Verify user authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { taskId, path: pathParts } = await context.params;

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 },
      );
    }

    const pptxPath = decodeURIComponent(pathParts.join("/"));

    if (!pptxPath) {
      return NextResponse.json(
        { error: "PPTX path is required" },
        { status: 400 },
      );
    }

    // Validate file extension
    if (
      !pptxPath.toLowerCase().endsWith(".pptx") &&
      !pptxPath.toLowerCase().endsWith(".ppt")
    ) {
      return NextResponse.json(
        { error: "File must be a PPTX or PPT file" },
        { status: 400 },
      );
    }

    // Get or create the render manifest
    const manifest = await getOrCreatePptxRenderManifest(taskId, pptxPath);

    if (!manifest) {
      return NextResponse.json(
        {
          error: "Render engine not available",
          message:
            "High-fidelity rendering is not available. Please install LibreOffice and pdftoppm, or use client-side rendering.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(manifest);
  } catch (error) {
    console.error("[PPTXPreviewAPI] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to render PPTX",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
