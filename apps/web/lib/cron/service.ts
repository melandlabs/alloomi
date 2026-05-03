/**
 * Scheduled Jobs Service
 * Manages cron jobs in the database
 * Compatible with both PostgreSQL (web) and SQLite (Tauri) modes
 */

import {
  eq,
  and,
  desc,
  asc,
  lt,
  isNotNull,
  or,
  sql,
  inArray,
} from "drizzle-orm";
import { db } from "../db/index";
import {
  scheduledJobs,
  jobExecutions,
  characters,
  type InsertScheduledJob,
  type InsertJobExecution,
} from "../db/schema";
import type {
  ScheduleConfig,
  JobConfig,
  JobExecutionResult,
  JobExecutionContext,
} from "./types";
import { computeNextRun } from "./scheduler";
import { deserializeJson, serializeJson } from "../db/queries";
import { DEFAULT_JOB_TIMEOUT_MS } from "../env/config/constants";

function legacyIntervalToMinutes(schedule: {
  hours?: number;
  minutes?: number;
}): number {
  return (schedule.hours ?? 0) * 60 + (schedule.minutes ?? 0) || 60;
}

/**
 * List all jobs for a user
 */
export async function listJobs(
  userId: string,
  opts: {
    includeDisabled?: boolean;
    view?: "all" | "active" | "executed";
  } = {},
) {
  const baseConditions = opts.includeDisabled
    ? eq(scheduledJobs.userId, userId)
    : and(eq(scheduledJobs.userId, userId), eq(scheduledJobs.enabled, true));

  let viewConditions = undefined;
  if (opts.view === "active") {
    // Active: recurring jobs OR one-time jobs with a pending next run.
    viewConditions = or(
      eq(scheduledJobs.scheduleType, "cron"),
      eq(scheduledJobs.scheduleType, "interval"),
      eq(scheduledJobs.scheduleType, "interval-hours"),
      eq(scheduledJobs.scheduleType, "interval-minutes"),
      and(
        eq(scheduledJobs.scheduleType, "once"),
        isNotNull(scheduledJobs.nextRunAt),
      ),
    );
  } else if (opts.view === "executed") {
    // Executed: one-time jobs with a terminal lastStatus (success/error), excluding running
    viewConditions = and(
      eq(scheduledJobs.scheduleType, "once"),
      or(
        eq(scheduledJobs.lastStatus, "success"),
        eq(scheduledJobs.lastStatus, "error"),
      ),
    );
  }
  // "all": no additional filter

  const conditions = viewConditions
    ? and(baseConditions, viewConditions)
    : baseConditions;

  const jobs = await db
    .select()
    .from(scheduledJobs)
    .where(conditions)
    .orderBy(asc(scheduledJobs.nextRunAt));

  // Fetch character names for jobs that have characterId in jobConfig
  const characterIds = jobs
    .map((job: typeof scheduledJobs.$inferSelect) => {
      const config =
        typeof job.jobConfig === "string"
          ? JSON.parse(job.jobConfig)
          : job.jobConfig;
      return config?.characterId as string | undefined;
    })
    .filter((id: string | undefined): id is string => Boolean(id));

  let characterNames: Record<string, string> = {};
  if (characterIds.length > 0) {
    const chars = await db
      .select({ id: characters.id, name: characters.name })
      .from(characters)
      .where(inArray(characters.id, characterIds));
    characterNames = Object.fromEntries(
      chars.map((c: { id: string; name: string }) => [c.id, c.name]),
    );
  }

  // Attach characterName to each job
  return jobs.map((job: typeof scheduledJobs.$inferSelect) => {
    const config =
      typeof job.jobConfig === "string"
        ? JSON.parse(job.jobConfig)
        : job.jobConfig;
    const characterId = config?.characterId as string | undefined;
    return {
      ...job,
      characterName: characterId ? (characterNames[characterId] ?? null) : null,
    };
  });
}

/**
 * Get a single job by ID
 */
export async function getJob(userId: string, jobId: string) {
  const jobs = await db
    .select()
    .from(scheduledJobs)
    .where(and(eq(scheduledJobs.userId, userId), eq(scheduledJobs.id, jobId)))
    .limit(1);

  if (!jobs[0]) return null;

  const job = jobs[0];
  // Deserialize jobConfig JSON string (needed for SQLite/Tauri mode)
  if (typeof job.jobConfig === "string") {
    (job as any).jobConfig = deserializeJson(job.jobConfig);
  }

  // Auto-fix stuck jobs: if status is running but exceeded timeout, mark as error
  if (job.lastStatus === "running" && job.lastRunAt) {
    const elapsed = Date.now() - new Date(job.lastRunAt).getTime();
    if (elapsed > DEFAULT_JOB_TIMEOUT_MS) {
      await db
        .update(scheduledJobs)
        .set({
          lastStatus: "error",
          lastError: "Job was stuck in running state, auto-marked as error",
          updatedAt: new Date(),
        })
        .where(eq(scheduledJobs.id, jobId));
      job.lastStatus = "error";
    }
  }

  return job;
}

/**
 * Create a new scheduled job
 */
export async function createJob(
  userId: string,
  input: {
    name: string;
    description?: string;
    schedule: ScheduleConfig;
    job: JobConfig;
    enabled?: boolean;
    timezone?: string;
  },
) {
  const now = new Date();
  const nextRun = computeNextRun(input.schedule, now);

  const jobData: InsertScheduledJob = {
    id: crypto.randomUUID(),
    userId,
    name: input.name,
    description: input.description ?? null,
    scheduleType: input.schedule.type,
    cronExpression:
      input.schedule.type === "cron" ? input.schedule.expression : null,
    intervalMinutes:
      input.schedule.type === "interval-minutes"
        ? input.schedule.minutes
        : input.schedule.type === "interval-hours"
          ? (input.schedule.hours ?? 1) * 60
          : input.schedule.type === "interval"
            ? legacyIntervalToMinutes(input.schedule)
            : null,
    scheduledAt:
      input.schedule.type === "once"
        ? input.schedule.at instanceof Date
          ? input.schedule.at
          : new Date(input.schedule.at as string)
        : null,
    jobType: input.job.type,
    jobConfig: serializeJson(input.job) as unknown as Record<string, unknown>,
    enabled: input.enabled ?? true,
    timezone: input.timezone || "UTC",
    nextRunAt: nextRun,
    createdAt: now,
    updatedAt: now,
    runCount: 0,
    failureCount: 0,
  };

  const [job] = await db.insert(scheduledJobs).values(jobData).returning();
  return job;
}

/**
 * Update an existing job
 */
export async function updateJob(
  userId: string,
  jobId: string,
  updates: Partial<{
    name: string;
    description: string;
    schedule: ScheduleConfig;
    job: JobConfig;
    enabled: boolean;
    timezone: string;
  }>,
) {
  const job = await getJob(userId, jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const updateData: Partial<InsertScheduledJob> = {
    updatedAt: new Date(),
  };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined)
    updateData.description = updates.description;
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
  if (updates.timezone !== undefined) updateData.timezone = updates.timezone;

  if (updates.schedule) {
    updateData.scheduleType = updates.schedule.type;
    if (updates.schedule.type === "cron") {
      updateData.cronExpression = updates.schedule.expression;
      updateData.intervalMinutes = null; // Clear old interval value when switching to cron
      updateData.scheduledAt = null; // Clear old once time when switching to cron
    } else if (updates.schedule.type === "interval-hours") {
      updateData.intervalMinutes = (updates.schedule.hours ?? 1) * 60;
      updateData.cronExpression = null; // Clear old cron expression when switching to interval
      updateData.scheduledAt = null; // Clear old once time when switching to interval
    } else if (updates.schedule.type === "interval-minutes") {
      updateData.intervalMinutes = updates.schedule.minutes;
      updateData.cronExpression = null; // Clear old cron expression when switching to interval
      updateData.scheduledAt = null; // Clear old once time when switching to interval
    } else if (updates.schedule.type === "interval") {
      updateData.intervalMinutes = legacyIntervalToMinutes(updates.schedule);
      updateData.cronExpression = null; // Clear old cron expression when switching to interval
      updateData.scheduledAt = null; // Clear old once time when switching to interval
    } else if (updates.schedule.type === "once") {
      // Handle both Date object and string (from JSON serialization)
      const atValue = updates.schedule.at;
      updateData.scheduledAt =
        atValue instanceof Date ? atValue : new Date(atValue as string);
      updateData.intervalMinutes = null; // Clear old interval value when switching to once
      updateData.cronExpression = null; // Clear old cron expression when switching to once
    }

    // Recompute next run time
    const nextRun = computeNextRun(updates.schedule, new Date());
    updateData.nextRunAt = nextRun;
    if (updates.schedule.type === "once" && nextRun) {
      updateData.lastStatus = null;
    }
  }

  if (updates.job) {
    updateData.jobConfig = serializeJson(updates.job) as unknown as Record<
      string,
      unknown
    >;
    updateData.jobType = updates.job.type;
  }

  const [updated] = await db
    .update(scheduledJobs)
    .set(updateData)
    .where(and(eq(scheduledJobs.userId, userId), eq(scheduledJobs.id, jobId)))
    .returning();

  return updated;
}

/**
 * Delete a job
 */
export async function deleteJob(userId: string, jobId: string) {
  await db
    .delete(scheduledJobs)
    .where(and(eq(scheduledJobs.userId, userId), eq(scheduledJobs.id, jobId)));
}

/**
 * Enable/disable a job
 */
export async function toggleJob(
  userId: string,
  jobId: string,
  enabled: boolean,
) {
  const updateData: Partial<InsertScheduledJob> = {
    enabled,
    updatedAt: new Date(),
  };

  if (enabled) {
    // Recompute next run when enabling
    const job = await getJob(userId, jobId);
    if (job) {
      let schedule: ScheduleConfig;

      if (job.scheduleType === "cron") {
        const expression = job.cronExpression;
        if (!expression) {
          throw new Error("Cron expression is required for cron jobs");
        }
        schedule = {
          type: "cron",
          expression,
          timezone: job.timezone,
        };
      } else if (
        job.scheduleType === "interval-hours" ||
        job.scheduleType === "interval-minutes" ||
        job.scheduleType === "interval"
      ) {
        // Legacy "interval" is converted to interval-hours or interval-minutes
        const minutes = job.intervalMinutes;
        if (typeof minutes !== "number") {
          throw new Error("Interval minutes is required for interval jobs");
        }
        const hours = minutes % 60 === 0 ? minutes / 60 : undefined;
        schedule = hours
          ? { type: "interval-hours", hours: Math.floor(hours) }
          : { type: "interval-minutes", minutes };
      } else {
        const scheduledAt = job.scheduledAt;
        if (!scheduledAt) {
          throw new Error("Scheduled at is required for once jobs");
        }
        schedule = { type: "once", at: scheduledAt };
      }

      updateData.nextRunAt = computeNextRun(schedule, new Date());
    }
  } else {
    updateData.nextRunAt = null;
  }

  const [updated] = await db
    .update(scheduledJobs)
    .set(updateData)
    .where(and(eq(scheduledJobs.userId, userId), eq(scheduledJobs.id, jobId)))
    .returning();

  return updated;
}

/**
 * Get jobs due to run for a specific user
 * Also auto-recovers stuck jobs (lastStatus=running but nextRunAt in the past)
 */
export async function getDueJobs(now: Date = new Date(), userId?: string) {
  const conditions = userId
    ? and(eq(scheduledJobs.enabled, true), eq(scheduledJobs.userId, userId))
    : eq(scheduledJobs.enabled, true);

  const jobs = await db
    .select()
    .from(scheduledJobs)
    .where(conditions)
    .orderBy(asc(scheduledJobs.nextRunAt));

  // Auto-recover stuck jobs: those with lastStatus=running but nextRunAt in the past
  // This handles cases where executeJob completed but failed to update scheduledJobs
  for (const job of jobs) {
    if (job.lastStatus === "running" && job.nextRunAt && job.nextRunAt <= now) {
      console.log(
        `[getDueJobs] Found stuck job ${job.id} (${job.name}), auto-recovering`,
      );

      // Compute new nextRunAt
      let newNextRun: Date | null = null;
      if (
        job.scheduleType === "interval-minutes" ||
        job.scheduleType === "interval"
      ) {
        const minutes = job.intervalMinutes || 60;
        newNextRun = computeNextRun({ type: "interval-minutes", minutes }, now);
      } else if (job.scheduleType === "interval-hours") {
        const hours = Math.floor((job.intervalMinutes || 60) / 60);
        newNextRun = computeNextRun({ type: "interval-hours", hours }, now);
      } else if (job.scheduleType === "cron" && job.cronExpression) {
        newNextRun = computeNextRun(
          {
            type: "cron",
            expression: job.cronExpression,
            timezone: job.timezone,
          },
          now,
        );
      }

      await db
        .update(scheduledJobs)
        .set({
          lastStatus: "error",
          lastError:
            "Job was stuck in running state, auto-recovered by scheduler",
          nextRunAt: newNextRun,
        })
        .where(eq(scheduledJobs.id, job.id));
    }
  }

  return jobs.filter(
    (job: { nextRunAt: Date | null; lastStatus: string | null }) =>
      job.nextRunAt && job.nextRunAt <= now && job.lastStatus !== "running", // Exclude jobs that are already running
  );
}

/**
 * Record job execution start
 */
export async function startJobExecution(context: JobExecutionContext) {
  const executionData: InsertJobExecution = {
    id: context.executionId, // Use the executionId from context instead of generating new one
    jobId: context.jobId,
    status: "running", // Will be updated to success/error on completion
    startedAt: new Date(),
    triggeredBy: context.triggeredBy,
  };

  const [execution] = await db
    .insert(jobExecutions)
    .values(executionData)
    .returning();

  // Get job info to check if it's a one-time job
  const jobs = await db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.id, context.jobId))
    .limit(1);

  const updateData: {
    lastRunAt: Date;
    lastStatus: "running";
    nextRunAt?: Date | null;
  } = {
    lastRunAt: new Date(),
    lastStatus: "running",
  };

  // For one-time jobs, immediately set nextRunAt to null to prevent re-execution
  if (jobs[0]?.scheduleType === "once") {
    updateData.nextRunAt = null;
  }

  // Update job state
  await db
    .update(scheduledJobs)
    .set(updateData)
    .where(eq(scheduledJobs.id, context.jobId));

  return execution;
}

/**
 * Record job execution completion
 * IMPORTANT: This function has error handling to ensure job status is never left stuck in "running" state.
 * If any database operation fails, it will attempt to at least mark the job as completed with an error.
 */
export async function completeJobExecution(
  context: JobExecutionContext,
  result: JobExecutionResult,
) {
  const completedAt = new Date();

  // Step 1: Update execution record
  try {
    await db
      .update(jobExecutions)
      .set({
        status: result.status,
        completedAt,
        durationMs: result.duration,
        output: result.output,
        error: result.error,
        result: result.result ? JSON.stringify(result.result) : null,
      })
      .where(eq(jobExecutions.id, context.executionId));
  } catch (error) {
    console.error(
      "[completeJobExecution] Failed to update execution record:",
      error,
    );
    // Continue anyway - the execution record failure should not block job status update
  }

  // Step 2: Update job state - wrapped in try-catch to ensure status is always updated
  try {
    const job = await db
      .select()
      .from(scheduledJobs)
      .where(eq(scheduledJobs.id, context.jobId))
      .limit(1);

    if (job[0]) {
      const nextRun = job[0].nextRunAt;
      let newNextRun = nextRun;

      // Compute next run if this is a recurring job
      if (job[0].scheduleType === "cron" && job[0].cronExpression) {
        const expression = job[0].cronExpression;
        if (expression) {
          const schedule: ScheduleConfig = {
            type: "cron",
            expression,
            timezone: job[0].timezone,
          };
          newNextRun = computeNextRun(schedule, completedAt);
        }
      } else if (
        (job[0].scheduleType === "interval-hours" ||
          job[0].scheduleType === "interval-minutes" ||
          job[0].scheduleType === "interval") &&
        job[0].intervalMinutes
      ) {
        const minutes = job[0].intervalMinutes;
        if (typeof minutes === "number") {
          const hours = minutes % 60 === 0 ? minutes / 60 : undefined;
          const schedule: ScheduleConfig = hours
            ? { type: "interval-hours", hours: Math.floor(hours) }
            : { type: "interval-minutes", minutes };
          newNextRun = computeNextRun(schedule, completedAt);
        }
      } else if (job[0].scheduleType === "once") {
        // One-time jobs should not run again
        newNextRun = null;
      }

      await db
        .update(scheduledJobs)
        .set({
          lastStatus: result.status,
          lastError: result.error,
          nextRunAt: newNextRun,
          runCount: (job[0].runCount || 0) + 1,
          failureCount:
            result.status === "error"
              ? (job[0].failureCount || 0) + 1
              : job[0].failureCount || 0,
          updatedAt: completedAt,
        })
        .where(eq(scheduledJobs.id, context.jobId));
    }
  } catch (error) {
    console.error("[completeJobExecution] Failed to update job status:", error);
    // Last resort: try to at least mark the job as error to prevent permanent stuck state
    try {
      await db
        .update(scheduledJobs)
        .set({
          lastStatus: "error",
          lastError: `Completion handler failed: ${error instanceof Error ? error.message : String(error)}`,
          updatedAt: completedAt,
        })
        .where(eq(scheduledJobs.id, context.jobId));
      console.log(
        "[completeJobExecution] Force-updated job status to error as fallback",
      );
    } catch (fallbackError) {
      console.error(
        "[completeJobExecution] FATAL: Even fallback status update failed:",
        fallbackError,
      );
    }
  }
}

/**
 * Get execution history for a job
 */
export async function getJobExecutions(
  jobId: string,
  options?: { limit?: number; offset?: number },
) {
  const { limit = 10, offset = 0 } = options ?? {};
  const [executions, [{ count }]] = await Promise.all([
    db
      .select()
      .from(jobExecutions)
      .where(eq(jobExecutions.jobId, jobId))
      .orderBy(desc(jobExecutions.startedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobExecutions)
      .where(eq(jobExecutions.jobId, jobId)),
  ]);
  return { executions, total: count };
}

/**
 * Recovery timeout in milliseconds
 * Jobs running longer than this are considered stuck
 * Uses the same timeout as job execution (DEFAULT_JOB_TIMEOUT_MS)
 */
const RECOVERY_TIMEOUT_MS = DEFAULT_JOB_TIMEOUT_MS;

/**
 * Cleanup timeout in milliseconds
 * Jobs running longer than this are considered zombie stuck jobs
 * These are cleaned up (deleted) without recovery
 */
const CLEANUP_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Recover stuck jobs that were left in "running" state due to app crash or unexpected shutdown.
 * Instead of just marking as error, this creates a new execution so the job can auto-recover.
 * Called periodically by the scheduler (every minute via checkAndExecuteDueJobs).
 */
export async function recoverStuckJobs(): Promise<number> {
  const now = new Date();
  const timeoutThreshold = new Date(now.getTime() - RECOVERY_TIMEOUT_MS);

  // Find running executions that started before the timeout threshold
  const stuckExecutions = await db
    .select()
    .from(jobExecutions)
    .where(
      and(
        eq(jobExecutions.status, "running"),
        lt(jobExecutions.startedAt, timeoutThreshold),
      ),
    );

  if (stuckExecutions.length === 0) {
    return 0;
  }

  console.log(
    `[CronService] Found ${stuckExecutions.length} stuck jobs to recover`,
  );

  let recoveredCount = 0;

  for (const execution of stuckExecutions) {
    // 1. Mark original execution as interrupted
    await db
      .update(jobExecutions)
      .set({
        status: "interrupted",
        completedAt: now,
        error: "Job was interrupted (computer sleep/crash), auto-recovered",
      })
      .where(eq(jobExecutions.id, execution.id));

    // 2. Create new execution with status "running" so scheduler picks it up
    const newExecutionId = crypto.randomUUID();
    await db.insert(jobExecutions).values({
      id: newExecutionId,
      jobId: execution.jobId,
      status: "running",
      startedAt: now,
      triggeredBy: "scheduler",
    });

    // 3. Update job status - set lastStatus so getDueJobs can find it
    //    Don't increase failureCount (interrupted is not a failure)
    //    Don't recalculate nextRunAt - let the scheduler handle it naturally
    const jobs = await db
      .select()
      .from(scheduledJobs)
      .where(eq(scheduledJobs.id, execution.jobId))
      .limit(1);

    if (jobs[0]) {
      await db
        .update(scheduledJobs)
        .set({
          lastStatus: "error", // Allow scheduler to pick this job up
          lastError:
            "Job was interrupted (computer sleep/crash), auto-recovered",
          // failureCount intentionally NOT increased
          updatedAt: now,
        })
        .where(eq(scheduledJobs.id, execution.jobId));

      console.log(
        `[CronService] Auto-recovered job: ${jobs[0].name} (ID: ${execution.jobId}), new execution: ${newExecutionId}`,
      );
      recoveredCount++;
    }
  }

  console.log(`[CronService] Auto-recovered ${recoveredCount} stuck jobs`);
  return recoveredCount;
}

/**
 * Cleanup zombie job executions that have been stuck in "running" state for too long.
 * Unlike recoverStuckJobs(), this function does NOT recover or restart the jobs -
 * it simply deletes the stuck execution records.
 * Use case: Jobs that were started but never completed due to crash/sleep/force-quit
 * and are now beyond any reasonable recovery window.
 */
export async function cleanupStuckJobs(): Promise<number> {
  const now = new Date();
  const timeoutThreshold = new Date(now.getTime() - CLEANUP_TIMEOUT_MS);

  // Find running executions that started before the timeout threshold
  const stuckExecutions = await db
    .select()
    .from(jobExecutions)
    .where(
      and(
        eq(jobExecutions.status, "running"),
        lt(jobExecutions.startedAt, timeoutThreshold),
      ),
    );

  if (stuckExecutions.length === 0) {
    return 0;
  }

  // First update scheduled_jobs to error status, then delete the zombie execution records
  for (const execution of stuckExecutions) {
    await db
      .update(scheduledJobs)
      .set({
        lastStatus: "error",
        lastError: "Job execution was cleaned up as zombie (stuck > 2 hours)",
        updatedAt: now,
      })
      .where(eq(scheduledJobs.id, execution.jobId));

    await db.delete(jobExecutions).where(eq(jobExecutions.id, execution.id));
  }

  console.log(
    `[CronService] Cleaned up ${stuckExecutions.length} stuck job executions`,
  );
  return stuckExecutions.length;
}
