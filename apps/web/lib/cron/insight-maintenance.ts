/**
 * Insight Maintenance Scheduler
 * Handles weekly insight maintenance scheduling for desktop environment
 */

import {
  getUserInsightSettings,
  updateUserInsightSettings,
} from "../db/queries";
import { runWeeklyInsightMaintenance } from "@/lib/insights/maintenance";

const WEEKLY_MAINTENANCE_INTERVAL = 7 * 24 * 60 * 60 * 1000;

// Desktop caches the last successful maintenance run in memory, but also mirrors it to insight settings so restarts keep the same weekly window.
let lastInsightMaintenanceRunAt: Date | null = null;

export function getLastInsightMaintenanceRunAt(): Date | null {
  return lastInsightMaintenanceRunAt;
}

export function setLastInsightMaintenanceRunAt(date: Date | null) {
  lastInsightMaintenanceRunAt = date;
}

async function loadPersistedInsightMaintenanceRunAt(userId: string) {
  const settings = await getUserInsightSettings(userId);
  return settings?.lastInsightMaintenanceRunAt ?? null;
}

async function persistInsightMaintenanceRunAt(userId: string, runAt: Date) {
  await updateUserInsightSettings(userId, {
    lastInsightMaintenanceRunAt: runAt,
  });
}

// Run insight maintenance on the same minute loop as scheduled jobs, but only once per persisted weekly window per user.
export async function runInsightMaintenanceIfDue(
  schedulerUserId: string | undefined,
) {
  if (!schedulerUserId) {
    return;
  }

  if (!lastInsightMaintenanceRunAt) {
    lastInsightMaintenanceRunAt =
      await loadPersistedInsightMaintenanceRunAt(schedulerUserId);
  }

  const now = new Date();
  if (
    lastInsightMaintenanceRunAt &&
    now.getTime() - lastInsightMaintenanceRunAt.getTime() <
      WEEKLY_MAINTENANCE_INTERVAL
  ) {
    return;
  }

  console.log("[LocalScheduler] Running weekly insight maintenance");
  await runWeeklyInsightMaintenance({
    platform: "desktop",
    userId: schedulerUserId,
  });
  await persistInsightMaintenanceRunAt(schedulerUserId, now);
  lastInsightMaintenanceRunAt = now;
}
