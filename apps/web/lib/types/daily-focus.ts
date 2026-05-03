/**
 * Daily Focus — Type Definitions & Zod Schemas
 *
 * These types describe the structured output of a Daily Focus analysis execution.
 * The data is stored in `job_executions.output` as JSON.
 *
 * version 2 introduces rich event metadata, reasoning chains, and suggested actions.
 */

import { z } from "zod";
import {
  REASONING_SOURCE_TYPES,
  type ReasoningSourceType,
} from "./execution-result";

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export const FOCUS_PRIORITIES = [
  "urgent",
  "high_priority",
  "potential",
] as const;

export type FocusPriority = (typeof FOCUS_PRIORITIES)[number];

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export interface FocusSource {
  type: ReasoningSourceType;
  label: string;
  id?: string;
}

export const FocusSourceSchema = z.object({
  type: z.enum(REASONING_SOURCE_TYPES).catch("unknown" as const),
  label: z.string(),
  id: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Suggested Action
// ---------------------------------------------------------------------------

export const FOCUS_ACTION_TYPES = [
  "approve",
  "reject",
  "view",
  "reply",
  "annotate",
  "open_link",
  "open_file",
  "download_file",
  "add_integration",
  "execute_task",
  "view_insight",
  "send_message",
  "reply_email",
  "custom",
] as const;

export type FocusActionType = (typeof FOCUS_ACTION_TYPES)[number];

export interface FocusAction {
  id: string;
  type: FocusActionType;
  label: string;
  requiresConfirmation?: boolean;
  params?: Record<string, unknown>;
}

export const FocusActionSchema = z.object({
  id: z.string(),
  type: z.enum(FOCUS_ACTION_TYPES).catch("custom" as const),
  label: z.string(),
  requiresConfirmation: z.boolean().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Reasoning Step
// ---------------------------------------------------------------------------

export interface FocusReasoningFile {
  name: string;
  path?: string;
  url?: string;
  type?: string;
}

export const FocusReasoningFileSchema = z.object({
  name: z.string(),
  path: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
});

export interface FocusSourceLink {
  label: string;
  url: string;
}

export const FocusSourceLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

export interface FocusReasoningStep {
  time: string;
  summary: string;
  content: string;
  source: FocusSource;
  rawContent?: string;
  confidence?: number;
  files?: FocusReasoningFile[];
  links?: FocusSourceLink[];
}

export const FocusReasoningStepSchema = z.object({
  time: z.string(),
  summary: z.string(),
  content: z.string(),
  source: FocusSourceSchema,
  rawContent: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  files: z.array(FocusReasoningFileSchema).optional(),
  links: z.array(FocusSourceLinkSchema).optional(),
});

// ---------------------------------------------------------------------------
// Event (single focus event)
// ---------------------------------------------------------------------------

export const FOCUS_EVENT_TYPES = [
  "task",
  "reply",
  "deadline",
  "next_action",
  "info",
] as const;

export type FocusEventType = (typeof FOCUS_EVENT_TYPES)[number];

export const FOCUS_DEADLINE_PRECISIONS = ["day", "minute"] as const;

export type FocusDeadlinePrecision = (typeof FOCUS_DEADLINE_PRECISIONS)[number];

export interface DailyFocusEvent {
  id: string;
  insightId?: string;
  candidateIds?: string[];
  sourceDetailIds?: string[];
  sourceFiles?: FocusReasoningFile[];
  sourceLinks?: FocusSourceLink[];
  deadlineAt?: string;
  deadlinePrecision?: FocusDeadlinePrecision;
  eventType?: FocusEventType;
  priority: FocusPriority;
  summary: string;
  sources: FocusSource[];
  isDeadlineToday: boolean;
  overview: string;
  suggestedActions: FocusAction[];
  reasoningChain: FocusReasoningStep[];
}

export const DailyFocusEventSchema = z.object({
  id: z.string(),
  insightId: z.string().optional(),
  candidateIds: z.array(z.string()).optional(),
  sourceDetailIds: z.array(z.string()).optional(),
  sourceFiles: z.array(FocusReasoningFileSchema).optional(),
  sourceLinks: z.array(FocusSourceLinkSchema).optional(),
  deadlineAt: z.string().optional(),
  deadlinePrecision: z.enum(FOCUS_DEADLINE_PRECISIONS).optional(),
  eventType: z.enum(FOCUS_EVENT_TYPES).optional(),
  priority: z.enum(FOCUS_PRIORITIES).catch("potential" as const),
  summary: z.string(),
  sources: z.array(FocusSourceSchema).default([]),
  isDeadlineToday: z.boolean().default(false),
  overview: z.string().default(""),
  suggestedActions: z.array(FocusActionSchema).default([]),
  reasoningChain: z.array(FocusReasoningStepSchema).default([]),
});

// ---------------------------------------------------------------------------
// Snapshot (top-level snapshot — generated once per execution)
// ---------------------------------------------------------------------------

export interface DailyFocusSnapshot {
  type: "daily-focus-snapshot";
  version: 2;
  generatedAt: string;
  summary: string;
  events: DailyFocusEvent[];
  totalCount: number;
}

export const DailyFocusSnapshotSchema = z.object({
  type: z.literal("daily-focus-snapshot"),
  version: z.literal(2),
  generatedAt: z.string(),
  summary: z.string(),
  events: z.array(DailyFocusEventSchema).default([]),
  totalCount: z.number().default(0),
});

// ---------------------------------------------------------------------------
// Parser helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Daily Focus snapshot from raw JSON string.
 * Returns null if parsing fails or version is not 2.
 */
export function parseDailyFocusSnapshot(
  raw: string | null | undefined,
): DailyFocusSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const result = DailyFocusSnapshotSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

const GENERIC_DAILY_FOCUS_SUMMARY_RE =
  /^(\d+\s+items?\s+analy[sz]ed|no data|nothing major happened today)$/i;

/**
 * Build a short, content-oriented summary for execution history list items.
 */
export function buildDailyFocusHistorySummary(
  events: DailyFocusEvent[] | null | undefined,
): string {
  if (!events || events.length === 0) return "No focus items today";

  const urgent = events.filter((event) => event.priority === "urgent");
  const highPriority = events.filter(
    (event) => event.priority === "high_priority",
  );
  const pool =
    urgent.length > 0
      ? urgent
      : highPriority.length > 0
        ? highPriority
        : events;
  const topics = pool
    .map(getDailyFocusEventTopic)
    .filter((topic): topic is string => Boolean(topic))
    .slice(0, 2);

  if (topics.length === 0) return "No clear focus today";

  const prefix =
    urgent.length > 0
      ? urgent.some((event) => event.isDeadlineToday)
        ? "Due today"
        : "Needs priority"
      : highPriority.length > 0
        ? "Today's focus"
        : "Today's attention";
  const remaining = Math.max(0, pool.length - topics.length);
  const suffix =
    remaining > 0 ? ` and ${pool.length - topics.length} more` : "";

  return truncateDailyFocusSummary(`${prefix}: ${topics.join(", ")}${suffix}`);
}

export function isGenericDailyFocusSummary(
  summary: string | null | undefined,
): boolean {
  return GENERIC_DAILY_FOCUS_SUMMARY_RE.test(summary?.trim() ?? "");
}

/**
 * Extract the summary from a snapshot output JSON string.
 * Works for both v1 and v2 formats.
 */
export function extractSnapshotSummary(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.summary ?? null;
  } catch {
    return null;
  }
}

function getDailyFocusEventTopic(event: DailyFocusEvent): string | null {
  const actionLabel = event.suggestedActions.find(
    (action) => action.type !== "view_insight",
  )?.label;
  const raw =
    cleanDailyFocusText(event.summary) ||
    cleanDailyFocusText(actionLabel) ||
    cleanDailyFocusText(event.overview);
  if (!raw) return null;

  return raw
    .replace(/^(handle|execute|view|reply|follow-up|confirm)[：:\s]+/iu, "")
    .replace(/[。.!?？；;，,].*$/u, "")
    .trim()
    .slice(0, 18);
}

function cleanDailyFocusText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[`*_#[\]()]/g, "")
    .trim();
}

function truncateDailyFocusSummary(value: string): string {
  return value.length > 60 ? `${value.slice(0, 59)}…` : value;
}
