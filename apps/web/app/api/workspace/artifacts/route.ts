/**
 * Artifacts API Routes
 *
 * Provides file resource interface for task-generated artifacts
 * Extracts artifacts from two sources:
 * 1. generatedFile/codeFile in message parts
 * 2. Important file types in the filesystem
 */

import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { message } from "@/lib/db/schema";
import {
  listSessionFiles,
  getTaskSessionDir,
} from "@/lib/files/workspace/sessions";
import { existsSync } from "node:fs";

// Important file types (these files will be treated as artifacts)
const ARTIFACT_FILE_EXTENSIONS = new Set([
  // Office documents
  "xlsx",
  "xls",
  "csv",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "pdf",
  // Images
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  // Web pages
  "html",
  "htm",
  // Text and Markdown (may contain important content)
  "txt",
  "md",
  "markdown",
]);

// Check if file is artifact type
function isArtifactFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? ARTIFACT_FILE_EXTENSIONS.has(ext) : false;
}

// GET /api/workspace/artifacts - Get task artifacts
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 },
      );
    }

    // Map for deduplication (filename -> artifact)
    const artifactsMap = new Map<
      string,
      {
        id: string;
        name: string;
        type: string;
        path: string;
        messageId?: string;
        createdAt: Date;
      }
    >();

    // 1. Extract generatedFile/codeFile from message parts
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(message.createdAt);

    for (const msg of messages) {
      if (!msg.parts || !Array.isArray(msg.parts)) continue;

      for (const part of msg.parts as any[]) {
        if (part.type === "tool-native") {
          if (part.generatedFile) {
            const key = part.generatedFile.name;
            if (!artifactsMap.has(key)) {
              artifactsMap.set(key, {
                id: `${msg.id}-${part.generatedFile.name}`,
                name: part.generatedFile.name,
                type: part.generatedFile.type || "unknown",
                path: part.generatedFile.path,
                messageId: msg.id,
                createdAt: msg.createdAt,
              });
            }
          }
          if (part.codeFile) {
            const key = part.codeFile.name;
            if (!artifactsMap.has(key)) {
              artifactsMap.set(key, {
                id: `${msg.id}-${part.codeFile.name}`,
                name: part.codeFile.name,
                type: "code",
                path: part.codeFile.path,
                messageId: msg.id,
                createdAt: msg.createdAt,
              });
            }
          }
        }
      }
    }

    // 2. Extract important file types from filesystem
    const sessionDir = getTaskSessionDir(chatId);
    if (existsSync(sessionDir)) {
      const files = listSessionFiles(chatId);

      for (const file of files) {
        // Only process files, skip directories
        if (file.isDirectory) continue;

        // Only process artifact type files
        if (!isArtifactFile(file.name)) continue;

        // Skip already existing (message parts have higher priority)
        if (artifactsMap.has(file.name)) continue;

        // Infer type from filename
        const ext = file.name.split(".").pop()?.toLowerCase() || "unknown";

        artifactsMap.set(file.name, {
          id: `fs-${file.name}`,
          name: file.name,
          type: ext,
          path: file.path,
          createdAt: file.modifiedTime,
        });
      }
    }

    // Convert to array and sort by creation time
    const artifacts = Array.from(artifactsMap.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return NextResponse.json({
      artifacts,
      count: artifacts.length,
    });
  } catch (error) {
    console.error("[ArtifactsAPI] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to get artifacts",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
