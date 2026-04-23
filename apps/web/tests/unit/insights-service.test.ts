import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureUserInsightSettings,
  computeInsightPayload,
} from "@/lib/insights/service";
import * as dbQueries from "@/lib/db/queries";
import * as sessionContext from "@/lib/session/context";
import type { InsightSettings } from "@/lib/db/schema";

// Mock dependencies
vi.mock("@/lib/db/queries");
vi.mock("@/lib/session/context");
vi.mock("@/lib/cache/insight");

// Prevent actual database initialization
vi.mock("@/lib/env/constants", () => ({
  isTauriMode: vi.fn(() => false),
  DEPLOYMENT_MODE: "server",
  maxChunkSummaryCount: 10,
}));

vi.mock("@/lib/db/adapters", () => ({
  initDb: vi.fn(() => ({})),
  getDb: vi.fn(() => ({})),
}));

describe("Insights Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureUserInsightSettings", () => {
    it("should return existing settings when they exist", async () => {
      const existingSettings: InsightSettings = {
        userId: "user-1",
        focusPeople: ["Alice"],
        focusTopics: ["Engineering"],
        language: "en",
        refreshIntervalMinutes: 60,
        lastMessageProcessedAt: new Date("2024-01-01"),
        lastActiveAt: new Date("2024-01-01"),
        activityTier: "medium",
        aiSoulPrompt: null,
        identityIndustries: null,
        identityWorkDescription: null,
        lastUpdated: new Date(),
      };

      vi.mocked(dbQueries.getUserInsightSettings).mockResolvedValue(
        existingSettings,
      );

      const result = await ensureUserInsightSettings("user-1");

      expect(result).toEqual(existingSettings);
      expect(dbQueries.getUserInsightSettings).toHaveBeenCalledWith("user-1");
      expect(dbQueries.updateUserInsightSettings).not.toHaveBeenCalled();
    });

    it("should create default settings when they don't exist", async () => {
      const defaultSettings: InsightSettings = {
        userId: "user-1",
        focusPeople: [],
        focusTopics: [],
        language: "",
        refreshIntervalMinutes: 30,
        lastMessageProcessedAt: null,
        lastActiveAt: null,
        activityTier: "low",
        aiSoulPrompt: null,
        identityIndustries: null,
        identityWorkDescription: null,
        lastUpdated: new Date(),
      };

      vi.mocked(dbQueries.getUserInsightSettings)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(defaultSettings);

      const result = await ensureUserInsightSettings("user-1");

      expect(dbQueries.updateUserInsightSettings).toHaveBeenCalledWith(
        "user-1",
        {
          focusPeople: [],
          focusTopics: [],
          language: "",
          refreshIntervalMinutes: 30,
          lastMessageProcessedAt: null,
          lastActiveAt: null,
          activityTier: "low",
        },
      );
      expect(result).toEqual(defaultSettings);
    });

    it("should throw error if settings cannot be loaded after creation", async () => {
      vi.mocked(dbQueries.getUserInsightSettings).mockResolvedValue(null);

      await expect(ensureUserInsightSettings("user-1")).rejects.toThrow(
        "Unable to load insight settings for user user-1",
      );
    });

    it("should normalize invalid activityTier", async () => {
      const settingsWithInvalidTier: InsightSettings = {
        userId: "user-1",
        focusPeople: [],
        focusTopics: [],
        language: "en",
        refreshIntervalMinutes: 60,
        lastMessageProcessedAt: null,
        lastActiveAt: null,
        activityTier: "invalid" as any,
        aiSoulPrompt: null,
        identityIndustries: null,
        identityWorkDescription: null,
        lastUpdated: new Date(),
      };

      vi.mocked(dbQueries.getUserInsightSettings).mockResolvedValue(
        settingsWithInvalidTier,
      );

      const result = await ensureUserInsightSettings("user-1");

      expect(result.activityTier).toBe("low");
    });

    it("should normalize null lastActiveAt", async () => {
      const settings: InsightSettings = {
        userId: "user-1",
        focusPeople: [],
        focusTopics: [],
        language: "en",
        refreshIntervalMinutes: 60,
        lastMessageProcessedAt: null,
        lastActiveAt: undefined as any,
        activityTier: "medium",
        aiSoulPrompt: null,
        identityIndustries: null,
        identityWorkDescription: null,
        lastUpdated: new Date(),
      };

      vi.mocked(dbQueries.getUserInsightSettings).mockResolvedValue(settings);

      const result = await ensureUserInsightSettings("user-1");

      expect(result.lastActiveAt).toBeNull();
    });
  });

  describe("computeInsightPayload", () => {
    it("should return empty array when user has no bots", async () => {
      vi.mocked(dbQueries.getBotsByUserId).mockResolvedValue({
        bots: [],
        hasMore: false,
      });

      const result = await computeInsightPayload("user-1");

      expect(result).toEqual({
        items: [],
        hasMore: false,
        percent: null,
        sessions: [],
      });
      expect(dbQueries.getBotsByUserId).toHaveBeenCalledWith({
        id: "user-1",
        limit: null,
        startingAfter: null,
        endingBefore: null,
        onlyEnable: false,
      });
    });

    it("should compute percent when sessions exist", async () => {
      const mockBots = [
        { id: "bot-1", userId: "user-1", platform: "slack" },
        { id: "bot-2", userId: "user-1", platform: "telegram" },
      ];

      vi.mocked(dbQueries.getBotsByUserId).mockResolvedValue({
        bots: mockBots as any,
        hasMore: false,
      });
      vi.mocked(dbQueries.getStoredInsightsByBotIds).mockResolvedValue({
        insights: [],
        hasMore: false,
      });
      vi.mocked(sessionContext.getInsightsSession)
        .mockResolvedValueOnce({ count: 3 })
        .mockResolvedValueOnce({ count: 5 });

      const result = await computeInsightPayload("user-1");

      // percent = (3 + 5) / (maxChunkSummaryCount * 2)
      // Assuming maxChunkSummaryCount is imported from constants
      expect(result.percent).toBeGreaterThan(0);
      expect(result.percent).toBeLessThanOrEqual(1);
    });

    it("should use custom historyDays option", async () => {
      vi.mocked(dbQueries.getBotsByUserId).mockResolvedValue({
        bots: [{ id: "bot-1", userId: "user-1" }] as any,
        hasMore: false,
      });
      vi.mocked(dbQueries.getStoredInsightsByBotIds).mockResolvedValue({
        insights: [],
        hasMore: false,
      });
      vi.mocked(sessionContext.getInsightsSession).mockResolvedValue(null);

      await computeInsightPayload("user-1", { historyDays: 7 });

      expect(dbQueries.getStoredInsightsByBotIds).toHaveBeenCalledWith({
        ids: ["bot-1"],
        days: 7,
      });
    });
  });
});
