import { db } from "@/lib/db/queries";
import {
  getInsightCompactionPlatform,
  type InsightCompactionPlatform,
} from "@/lib/insights/compaction-profile";

export type InsightCompactionDb = typeof db;

export type InsightCompactionRuntime = {
  platform: InsightCompactionPlatform;
  executeTransaction<T>(
    callback: (tx: InsightCompactionDb) => Promise<T>,
  ): Promise<T>;
};

// Web uses the database transaction helper directly because Postgres is the primary compaction runtime.
const WEB_RUNTIME: InsightCompactionRuntime = {
  platform: "web",
  async executeTransaction<T>(
    callback: (tx: InsightCompactionDb) => Promise<T>,
  ) {
    return await db.transaction(callback);
  },
};

// Desktop keeps the same callback shape, but leaves room for SQLite-specific transaction handling later.
const DESKTOP_RUNTIME: InsightCompactionRuntime = {
  platform: "desktop",
  async executeTransaction<T>(
    callback: (tx: InsightCompactionDb) => Promise<T>,
  ) {
    return await callback(db as InsightCompactionDb);
  },
};

export function getInsightCompactionRuntime(
  explicit?: InsightCompactionPlatform,
): InsightCompactionRuntime {
  return getInsightCompactionPlatform(explicit) === "desktop"
    ? DESKTOP_RUNTIME
    : WEB_RUNTIME;
}
