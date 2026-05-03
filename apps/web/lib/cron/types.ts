/**
 * Cron Job Types and Interfaces
 */

import type { ScheduledJob } from "../db/schema";

/**
 * Schedule configuration types
 */
export type ScheduleConfig =
  | { type: "cron"; expression: string; timezone?: string }
  | { type: "interval-hours"; hours: number }
  | { type: "interval-minutes"; minutes: number }
  | { type: "interval"; hours?: number; minutes?: number } // Legacy support
  | { type: "once"; at: Date | string };

/**
 * Job configuration types
 */
export type JobConfig = {
  type: "custom";
  handler: string;
  modelConfig?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  /** Back-link to character that owns this job */
  characterId?: string;
};

/**
 * Job execution context
 */
export interface JobExecutionContext {
  userId: string;
  jobId: string;
  executionId: string;
  triggeredBy: "scheduler" | "manual" | "api";
  modelConfig?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  /** Back-link to character that owns this job */
  characterId?: string;
  /** User's timezone for date/time operations */
  timezone?: string;
}

/**
 * Job execution result
 */
export interface JobExecutionResult {
  status: "success" | "error" | "timeout";
  output?: string;
  error?: string;
  result?: Record<string, unknown>;
  duration: number;
}

/**
 * Streamed events emitted by manual job executions for interactive chat UI.
 */
export type JobAgentStreamEvent =
  | {
      type: "execution_start";
      chatId: string;
      executionId: string;
      message: string;
      userMessageId: string;
      assistantMessageId: string;
    }
  | { type: "text"; content: string; messageId?: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: unknown;
      messageId?: string;
    }
  | {
      type: "tool_result";
      toolUseId: string;
      output: unknown;
      isError?: boolean;
      messageId?: string;
    }
  | { type: "error"; content: string }
  | {
      type: "execution_done";
      executionId: string;
      status: "success" | "error" | "timeout";
    };

export interface ExecuteJobOptions {
  userMessageId?: string;
  assistantMessageId?: string;
  onAgentEvent?: (event: JobAgentStreamEvent) => void | Promise<void>;
  abortController?: AbortController;
}

/**
 * Cron job with computed fields
 */
export interface CronJob extends ScheduledJob {
  computedNextRun?: Date;
}

/**
 * Scheduler events
 */
export type SchedulerEvent =
  | { type: "job.started"; jobId: string; executionId: string }
  | {
      type: "job.completed";
      jobId: string;
      executionId: string;
      result: JobExecutionResult;
    }
  | { type: "job.failed"; jobId: string; executionId: string; error: string }
  | { type: "scheduler.started" }
  | { type: "scheduler.stopped" };

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  enabled: boolean;
  maxConcurrentJobs?: number;
  jobTimeoutMs?: number;
  onError?: (error: Error, context: JobExecutionContext) => void;
  onEvent?: (event: SchedulerEvent) => void;
}
