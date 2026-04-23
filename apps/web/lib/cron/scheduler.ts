/**
 * Cron Scheduler - Core scheduling logic
 * Handles cron expression parsing and next run computation
 */

import { Cron } from "croner";
import type { ScheduleConfig } from "./types";

/**
 * Compute the next run time based on schedule configuration
 */
export function computeNextRun(
  config: ScheduleConfig,
  now: Date = new Date(),
): Date | null {
  if (config.type === "once") {
    // Handle both Date and string types
    const atDate =
      config.at instanceof Date ? config.at : new Date(config.at as string);
    // Check if the date is valid
    if (!atDate || Number.isNaN(atDate.getTime())) {
      return null;
    }
    return atDate > now ? atDate : null;
  }

  if (config.type === "interval-hours") {
    const totalMinutes = (config.hours ?? 1) * 60;
    const intervalMs = totalMinutes * 60 * 1000;
    return new Date(now.getTime() + intervalMs);
  }

  if (config.type === "interval-minutes") {
    const totalMinutes = config.minutes ?? 60;
    const intervalMs = totalMinutes * 60 * 1000;
    return new Date(now.getTime() + intervalMs);
  }

  if (config.type === "cron") {
    try {
      const cron = new Cron(config.expression, {
        timezone: config.timezone || "UTC",
      });
      const next = cron.nextRun(now);
      return next || null;
    } catch (error) {
      console.error(
        "[Cron] Invalid cron expression:",
        config.expression,
        error,
      );
      return null;
    }
  }

  return null;
}

/**
 * Validate a cron expression
 */
export function validateCronExpression(expression: string): boolean {
  try {
    const cron = new Cron(expression);
    return typeof cron.nextRun() !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Check if a job is due to run
 */
export function isJobDue(
  nextRunAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!nextRunAt) return false;
  return nextRunAt <= now;
}

/**
 * Format a date as ISO string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse a date from various formats
 */
export function parseDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  return new Date(input);
}
