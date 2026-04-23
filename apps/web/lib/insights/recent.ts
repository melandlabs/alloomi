import type { Insight } from "@/lib/db/schema";

const STORAGE_KEY = "recent_insights";
const MAX_RECENT_INSIGHTS = 20;

/**
 * Recently viewed insight item
 */
export interface RecentInsight {
  id: string;
  title: string;
  description?: string;
  time: string;
  platform?: string;
  viewedAt: number; // View timestamp
}

/**
 * Add a recently viewed insight
 * @param insight - The Insight object to add
 */
export function addRecentInsight(insight: Insight): void {
  if (typeof window === "undefined") return;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const recentInsights: RecentInsight[] = stored ? JSON.parse(stored) : [];

    // Remove existing items with the same ID
    const filtered = recentInsights.filter((item) => item.id !== insight.id);

    // Add new item to the beginning
    const newItem: RecentInsight = {
      id: insight.id,
      title: insight.title || "Untitled event",
      description: insight.description || undefined,
      time:
        typeof insight.time === "string"
          ? insight.time
          : insight.time.toISOString(),
      platform: insight.platform || undefined,
      viewedAt: Date.now(),
    };

    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_INSIGHTS);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("[RecentInsights] Failed to add recent insight:", error);
  }
}

/**
 * Get list of recently viewed insights
 * @returns Array of recently viewed insights
 */
export function getRecentInsights(): RecentInsight[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    return JSON.parse(stored) as RecentInsight[];
  } catch (error) {
    console.error("[RecentInsights] Failed to get recent insights:", error);
    return [];
  }
}

/**
 * Clear recently viewed insights
 */
export function clearRecentInsights(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("[RecentInsights] Failed to clear recent insights:", error);
  }
}
