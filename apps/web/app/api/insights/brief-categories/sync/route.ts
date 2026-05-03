import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { insight, insightBriefCategories } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

type Category = "urgent" | "important" | "monitor" | "archive";

/**
 * Sync events that appear in today's focus list to the backend:
 * 1. Save categories (prefer frontend categories, don't recalculate EventRank)
 * 2. Don't override user-set categories (source: "manual")
 * 3. Auto-clean expired "keep-focused" items: auto-delete after 1 day of no activity
 * Note: keep-focused tags are only managed through pin interface, not handled here
 *
 * POST /api/insights/brief-categories/sync
 * Body: { insightIds: string[], categories?: Record<string, Category> }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { insightIds, categories } = body as {
      insightIds: string[];
      categories?: Record<string, Category>;
    };

    if (!Array.isArray(insightIds) || insightIds.length === 0) {
      return NextResponse.json(
        { success: true, data: { synced: 0 } },
        { status: 200 },
      );
    }

    const userId = session.user.id;
    const limit = 100;
    // Filter out invalid IDs and remove duplicates to prevent drizzle error
    const validIdsSet = new Set<string>();
    for (const id of insightIds) {
      if (typeof id === "string" && id.length > 0) {
        validIdsSet.add(id);
      }
    }
    const idsToSync = Array.from(validIdsSet).slice(0, limit);

    const insights = await db
      .select()
      .from(insight)
      .where(inArray(insight.id, idsToSync));

    // Get existing category records, including source field
    const existing = await db
      .select()
      .from(insightBriefCategories)
      .where(
        and(
          eq(insightBriefCategories.userId, userId),
          inArray(insightBriefCategories.insightId, idsToSync),
        ),
      );

    // Build insightId -> category mapping, prefer keeping records with source "manual"
    const existingCategoryMap = new Map<
      string,
      { category: Category; source: string }
    >();
    for (const row of existing) {
      if (!row) continue;
      const existing = existingCategoryMap.get(row.insightId);
      if (!existing || row.source === "manual") {
        existingCategoryMap.set(row.insightId, {
          category: row.category as Category,
          source: row.source,
        });
      }
    }

    const existingIdsWithCategory = new Set(existingCategoryMap.keys());

    // Build current sync list Set for quick lookup
    const currentSyncIds = new Set(idsToSync);

    // Get all user's existing category records (for cleanup)
    const allUserCategories: (typeof insightBriefCategories.$inferSelect)[] =
      await db
        .select()
        .from(insightBriefCategories)
        .where(eq(insightBriefCategories.userId, userId));

    // Conditional cleanup trigger optimization: only run cleanup when sync list changes > 20%
    // Calculate change rate
    const previousSyncIds = new Set(
      allUserCategories
        .filter(
          (c: typeof insightBriefCategories.$inferSelect) =>
            c.source === "auto",
        )
        .map((c: typeof insightBriefCategories.$inferSelect) => c.insightId),
    );
    let changedCount = 0;
    for (const id of currentSyncIds) {
      if (!previousSyncIds.has(id)) {
        changedCount++;
      }
    }
    for (const id of previousSyncIds) {
      if (!currentSyncIds.has(id)) {
        changedCount++;
      }
    }
    const totalCount = Math.max(currentSyncIds.size, previousSyncIds.size, 1);
    const changeRate = changedCount / totalCount;
    const shouldRunCleanup = changeRate > 0.2 || allUserCategories.length === 0;

    // Find records to clean up:
    // 1. source is "auto" (not user manually pinned)
    // 2. Not in current sync list
    // 3. Corresponding insight has no keep-focused tag
    // 4. Or in "monitor" category for more than 1 day (24 hours) with no new activity
    // Use Set to prevent duplicate IDs
    const idsToCleanSet = new Set<string>();

    // Calculate timestamp for 1 day ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (shouldRunCleanup && allUserCategories.length > 0) {
      // Get keep-focused status for all related insights
      // Filter out null/undefined insight IDs and remove duplicates to prevent drizzle error
      const allCategoryInsightIdsSet = new Set<string>();
      for (const c of allUserCategories) {
        if (typeof c.insightId === "string" && c.insightId.length > 0) {
          allCategoryInsightIdsSet.add(c.insightId);
        }
      }
      const allCategoryInsightIds = Array.from(allCategoryInsightIdsSet);

      let allInsights: (typeof insight.$inferSelect)[] = [];

      // Skip if no valid IDs
      if (allCategoryInsightIds.length > 0) {
        // Select all columns to avoid potential issues with specific column selection
        allInsights = await db
          .select()
          .from(insight)
          .where(inArray(insight.id, allCategoryInsightIds));
      }

      // Build insightId -> has keep-focused mapping
      const keepFocusedMap = new Map<string, boolean>();
      for (const ins of allInsights) {
        if (!ins) continue;
        const categories = Array.isArray(ins.categories)
          ? ins.categories
          : typeof ins.categories === "string"
            ? JSON.parse(ins.categories || "[]")
            : [];
        keepFocusedMap.set(ins.id, categories.includes("keep-focused"));
      }

      // Build insightId -> lastActiveAt mapping (for batch queries)
      const lastActiveAtMap = new Map<string, Date | null>();
      for (const ins of allInsights) {
        if (ins) {
          lastActiveAtMap.set(
            ins.id,
            ins.lastActiveAt ? new Date(ins.lastActiveAt) : null,
          );
        }
      }

      // Find records to clean up
      for (const cat of allUserCategories) {
        if (!cat) continue;
        // Only clean records with source "auto"
        if (cat.source !== "auto") {
          continue;
        }
        // If has keep-focused tag, do not clean (keep pin status)
        if (keepFocusedMap.get(cat.insightId)) {
          continue;
        }

        // Check if cleanup needed: condition 1 - not in current sync list
        const notInSyncList = !currentSyncIds.has(cat.insightId);

        // Check if cleanup needed: condition 2 - "monitor" category for more than 1 day with no new activity
        let isOldMonitor = false;
        if (cat.category === "monitor" && cat.assignedAt) {
          // If assignedAt is more than 1 day old and the corresponding insight has no recent activity in the last day, clean up
          const assignedAt = new Date(cat.assignedAt);
          if (assignedAt.getTime() < oneDayAgo.getTime()) {
            // Use pre-built mapping to check lastActiveAt
            const lastActiveAt = lastActiveAtMap.get(cat.insightId) ?? null;
            // If insight also has no recent activity, mark for cleanup
            if (!lastActiveAt || lastActiveAt.getTime() < oneDayAgo.getTime()) {
              isOldMonitor = true;
            }
          }
        }

        // Cleanup condition met: not in sync list OR is an expired monitor item
        if ((notInSyncList || isOldMonitor) && cat.id) {
          idsToCleanSet.add(cat.id);
        }
      }
    }

    // Execute cleanup
    let cleaned = 0;
    const validIdsToClean = Array.from(idsToCleanSet);
    if (validIdsToClean.length > 0) {
      await db
        .delete(insightBriefCategories)
        .where(inArray(insightBriefCategories.id, validIdsToClean));
      cleaned = validIdsToClean.length;
    }

    let synced = 0;

    // Collect all records that need to be inserted
    const recordsToInsert = [];

    for (const insightRecord of insights) {
      if (!insightRecord) continue;
      const id = insightRecord.id;

      // Check if user explicitly unpinned
      const existingInfo = existingCategoryMap.get(id);
      const isUnpinned = existingInfo?.source === "unpinned";

      // If user explicitly unpinned, don't create category record
      if (isUnpinned) {
        continue;
      }

      // If no category record exists, create new record
      // Prefer frontend categories, fallback to existing categories
      if (!existingIdsWithCategory.has(id)) {
        // Prefer frontend categories
        const category = categories?.[id] || "monitor";

        recordsToInsert.push({
          insightRecord,
          id,
          category,
        });
      }

      synced += 1;
    }

    // Parallelize inserts using Promise.all
    if (recordsToInsert.length > 0) {
      await Promise.all(
        recordsToInsert.map((r) =>
          db.insert(insightBriefCategories).values({
            userId,
            insightId: r.id,
            category: r.category,
            dedupeKey: r.insightRecord.dedupeKey,
            title: r.insightRecord.title,
            source: "auto",
          }),
        ),
      );
    }

    return NextResponse.json({
      success: true,
      data: { synced, cleaned },
    });
  } catch (error) {
    console.error("[Insights] Brief categories sync failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
