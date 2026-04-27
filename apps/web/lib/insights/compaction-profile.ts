import { isTauriMode } from "@/lib/env/constants";

export type InsightCompactionPlatform = "web" | "desktop";

export type InsightCompactionProfile = {
  platform: InsightCompactionPlatform;
  label: string;
  olderThanDays: number;
  minGroupSize: number;
  compactabilityThreshold: number;
  pendingDeletionRetentionDays: number;
  weeklyCronExpression: string;
};

// Web keeps the canonical schedule and retention settings for the shared pipeline.
const WEB_PROFILE: InsightCompactionProfile = {
  platform: "web",
  label: "web/postgres",
  olderThanDays: 14,
  minGroupSize: 2,
  compactabilityThreshold: 0.68,
  pendingDeletionRetentionDays: 180,
  // 03:00 UTC every Sunday
  weeklyCronExpression: "0 3 * * 0",
};

// Desktop starts aligned with web, but lives in its own profile so SQLite-specific tuning can drift later.
const DESKTOP_PROFILE: InsightCompactionProfile = {
  platform: "desktop",
  label: "desktop/sqlite",
  olderThanDays: 14,
  minGroupSize: 2,
  compactabilityThreshold: 0.68,
  pendingDeletionRetentionDays: 180,
  // Same cadence for now; can diverge later without touching shared logic.
  weeklyCronExpression: "0 3 * * 0",
};

export function getInsightCompactionPlatform(
  explicit?: InsightCompactionPlatform,
): InsightCompactionPlatform {
  if (explicit) return explicit;
  // Default to the active runtime so call sites do not have to branch on environment.
  return isTauriMode() ? "desktop" : "web";
}

export function getInsightCompactionProfile(
  explicit?: InsightCompactionPlatform,
): InsightCompactionProfile {
  return getInsightCompactionPlatform(explicit) === "desktop"
    ? DESKTOP_PROFILE
    : WEB_PROFILE;
}
