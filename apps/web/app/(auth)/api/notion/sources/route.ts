import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  getIntegrationAccountByPlatform,
  updateIntegrationAccount,
} from "@/lib/db/queries";
import type { NotionMetadata } from "@/lib/files/notion";
import { mergeNotionMetadata } from "@/lib/files/notion";

const targetSchema = z.object({
  type: z.enum(["page", "database"]),
  id: z.string().min(1),
  titleProperty: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
});

const payloadSchema = z.object({
  uploadTarget: targetSchema.optional(),
  syncPages: z.array(z.string().min(1)).optional(),
  syncDatabases: z.array(z.string().min(1)).optional(),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getIntegrationAccountByPlatform({
    userId: session.user.id,
    platform: "notion",
  });

  if (!account) {
    return NextResponse.json(
      { error: "Notion is not connected." },
      { status: 404 },
    );
  }

  const metadata = (account.metadata as NotionMetadata | null) ?? {};

  return NextResponse.json(
    {
      uploadTarget: metadata.uploadTarget ?? null,
      syncSources: metadata.syncSources ?? null,
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const account = await getIntegrationAccountByPlatform({
    userId: session.user.id,
    platform: "notion",
  });

  if (!account) {
    return NextResponse.json(
      { error: "Notion is not connected." },
      { status: 404 },
    );
  }

  const syncSources =
    parsed.data.syncPages !== undefined ||
    parsed.data.syncDatabases !== undefined
      ? {
          pages: parsed.data.syncPages,
          databases: parsed.data.syncDatabases,
        }
      : undefined;

  const metadata = mergeNotionMetadata(account.metadata as any, {
    uploadTarget: parsed.data.uploadTarget ?? undefined,
    syncSources,
  });

  await updateIntegrationAccount({
    userId: session.user.id,
    platformAccountId: account.id,
    metadata,
  });

  return NextResponse.json(
    {
      uploadTarget: metadata.uploadTarget ?? null,
      syncSources: metadata.syncSources ?? null,
    },
    { status: 200 },
  );
}
