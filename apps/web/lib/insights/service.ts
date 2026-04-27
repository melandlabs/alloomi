import { maxChunkSummaryCount } from "@/lib/env/constants";
import {
  getBotsByUserId,
  getStoredInsightsByBotIds,
  getUserInsightSettings,
  updateUserInsightSettings,
  normalizeInsight,
} from "@/lib/db/queries";
import type { Insight, InsightSettings } from "@/lib/db/schema";
import { getInsightsSession, type InsightSession } from "@/lib/session/context";
import { clampActivityTier as clampActivityTierInternal } from "@/lib/insights/tier";

export type InsightSessionResult = InsightSession & { id: string };

function normalizeSettings(settings: InsightSettings): InsightSettings {
  const tier = clampActivityTierInternal(settings.activityTier);
  return {
    ...settings,
    activityTier: tier,
    lastActiveAt: settings.lastActiveAt ?? null,
  };
}

export async function ensureUserInsightSettings(
  userId: string,
): Promise<InsightSettings> {
  let settings = await getUserInsightSettings(userId);
  if (!settings) {
    try {
      await updateUserInsightSettings(userId, {
        focusPeople: [],
        focusTopics: [],
        language: "",
        refreshIntervalMinutes: 30,
        lastMessageProcessedAt: null,
        lastActiveAt: null,
        lastInsightMaintenanceRunAt: null,
        activityTier: "low",
      });
      settings = await getUserInsightSettings(userId);
    } catch (error: any) {
      // If foreign key constraint fails (user doesn't exist yet), return default settings
      // Check both the error object and the cause string (AppError stores cause as string)
      const isForeignKeyError =
        error?.code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
        (typeof error?.message === "string" &&
          error.message.includes("FOREIGN KEY")) ||
        (typeof error?.cause === "string" &&
          error.cause.includes("FOREIGN KEY"));

      if (isForeignKeyError) {
        console.warn(
          `User ${userId} not found in database, returning default insight settings`,
        );
        return normalizeSettings({
          userId,
          focusPeople: [],
          focusTopics: [],
          language: "",
          refreshIntervalMinutes: 30,
          lastMessageProcessedAt: null,
          lastActiveAt: null,
          lastInsightMaintenanceRunAt: null,
          activityTier: "low",
          aiSoulPrompt: null,
          lastUpdated: new Date(),
          identityIndustries: null,
          identityWorkDescription: null,
        });
      }
      throw error;
    }
  }
  if (!settings) {
    throw new Error(`Unable to load insight settings for user ${userId}`);
  }
  return normalizeSettings(settings);
}

export async function computeInsightPayload(
  userId: string,
  options: {
    historyDays?: number;
    limit?: number;
    startingAfter?: string | null;
    endingBefore?: string | null;
  } = {},
): Promise<{
  items: Insight[];
  hasMore: boolean;
  percent: number | null;
  sessions: InsightSessionResult[];
}> {
  const { historyDays, limit, startingAfter, endingBefore } = options;
  const bots = await getBotsByUserId({
    id: userId,
    limit: null,
    startingAfter: null,
    endingBefore: null,
    onlyEnable: false,
  });

  if (bots.bots.length === 0) {
    return {
      items: [] as Insight[],
      hasMore: false,
      percent: null,
      sessions: [],
    };
  }

  const targetBotIds = bots.bots.map((bot) => bot.id);
  const { insights: insightItems, hasMore } = await getStoredInsightsByBotIds({
    ids: targetBotIds,
    days: historyDays ?? 3,
    limit,
    startingAfter,
    endingBefore,
  });

  // Get all bot sessions in parallel (optimization: avoid N+1 queries)
  const percents: Array<number | null> = [];
  const sessions: InsightSessionResult[] = [];
  const sessionResults = await Promise.all(
    targetBotIds.map((botId) => getInsightsSession(botId)),
  );
  sessionResults.forEach((insightsSession, index) => {
    const botId = targetBotIds[index];
    if (insightsSession) {
      sessions.push({ ...insightsSession, id: botId });
    }
    percents.push(insightsSession ? insightsSession.count : null);
  });

  // All bots finish the insight process, return null.
  const allNull = percents.every((p) => p === null);
  let percent: number | null = null;
  if (!allNull) {
    const sum = percents.reduce((acc: number, p) => {
      return acc + (p ?? maxChunkSummaryCount);
    }, 0);
    const denominator = maxChunkSummaryCount * targetBotIds.length;
    percent = sum / denominator;
  }

  // Normalize insight data: deserialize JSON string fields (e.g. groups, people etc.)
  const normalizedItems = insightItems.map((item) => normalizeInsight(item));

  return { items: normalizedItems, hasMore, percent, sessions };
}

export {
  deriveActivityTier,
  getCacheTtlMs,
  getEffectiveRefreshIntervalMinutes,
  ACTIVITY_TIER_PRIORITIES,
  resolveTierRefreshMinutes,
  resolveTierPriority,
  filterDueInsightSettings as filterDueSummarySettings,
  clampActivityTier,
  type ActivityTier,
} from "@/lib/insights/tier";
