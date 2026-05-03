/**
 * Execution Result Structured Output Types
 *
 * These types describe the structured metadata that the agent appends
 * to its response via <structured-output> tags during scheduled task execution.
 * The data is stored in `job_executions.result` (jsonb) alongside chatId/sessionDir.
 */

import { z } from "zod";
import {
  buildMissingIntegrationActionFromText,
  resolveSuggestedActionIntegrationPlatform,
} from "@/lib/integrations/connector-target";

// ---------------------------------------------------------------------------
// Reasoning Chain
// ---------------------------------------------------------------------------

export const REASONING_SOURCE_TYPES = [
  "email",
  "wechat",
  "file",
  "slack",
  "telegram",
  "whatsapp",
  "feishu",
  "dingtalk",
  "notion",
  "web",
  "google-drive",
  "linear",
  "jira",
  "tool",
  "system",
  "unknown",
] as const;

export type ReasoningSourceType = (typeof REASONING_SOURCE_TYPES)[number];

export interface ReasoningFile {
  name: string;
  path?: string;
  url?: string;
  type?: string;
  role?: "input" | "output" | "reference";
}

export const ReasoningFileSchema = z.object({
  name: z.string(),
  path: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
  role: z.enum(["input", "output", "reference"]).optional(),
});

export interface ReasoningStep {
  summary: string;
  description?: string;
  sourceType: ReasoningSourceType;
  sourceId?: string;
  sourceLabel?: string;
  stepType?:
    | "input"
    | "collect"
    | "analyze"
    | "generate"
    | "deliver"
    | "verify";
  files?: ReasoningFile[];
}

export const ReasoningStepSchema = z.object({
  summary: z.string(),
  description: z.string().optional(),
  sourceType: z
    .string()
    .catch("unknown")
    .transform((value) => normalizeReasoningSourceType(value, "unknown")),
  sourceId: z.string().optional(),
  sourceLabel: z.string().optional(),
  stepType: z
    .enum(["input", "collect", "analyze", "generate", "deliver", "verify"])
    .optional(),
  files: z.array(ReasoningFileSchema).optional(),
});

// ---------------------------------------------------------------------------
// Suggested Actions
// ---------------------------------------------------------------------------

export const SUGGESTED_ACTION_TYPES = [
  "reply_email",
  "send_message",
  "create_task",
  "schedule_reminder",
  "download_file",
  "open_link",
  "open_file",
  "add_integration",
  "custom",
] as const;

export type SuggestedActionType = (typeof SUGGESTED_ACTION_TYPES)[number];

export interface SuggestedAction {
  type: SuggestedActionType;
  label: string;
  content?: string;
  params?: Record<string, unknown>;
  requiresConfirmation?: boolean;
}

export const SuggestedActionSchema = z.object({
  type: z.enum(SUGGESTED_ACTION_TYPES).catch("custom" as const),
  label: z.string(),
  content: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  requiresConfirmation: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Top-level Structured Output
// ---------------------------------------------------------------------------

export interface StructuredExecutionOutput {
  summary?: string;
  /** Supplementary context line, e.g. "Processed 47 emails". */
  subtitle?: string;
  outcome?: string;
  reasoningChain?: ReasoningStep[];
  files?: ReasoningFile[];
  suggestedActions?: SuggestedAction[];
  diagnostics?: {
    source: "model" | "system" | "repaired";
    warnings: string[];
  };
}

export const StructuredExecutionOutputSchema = z
  .object({
    summary: z
      .string()
      .optional()
      .transform((s) => s?.trim()),
    subtitle: z
      .string()
      .optional()
      .transform((s) => s?.trim()),
    outcome: z.string().optional(),
    reasoningChain: z.array(ReasoningStepSchema).optional(),
    files: z.array(ReasoningFileSchema).optional(),
    suggestedActions: z.array(SuggestedActionSchema).optional(),
    diagnostics: z
      .object({
        source: z.enum(["model", "system", "repaired"]),
        warnings: z.array(z.string()),
      })
      .optional(),
  })
  .partial();

// ---------------------------------------------------------------------------
// System-generated execution report
// ---------------------------------------------------------------------------

export interface ExecutionTraceEvent {
  type: "task_received" | "tool_used" | "tool_result" | "completed" | "error";
  title?: string;
  detail?: string;
  toolName?: string;
  status?: "running" | "completed" | "error";
  timestamp?: string;
}

export interface ExecutionReportInput {
  structuredData: StructuredExecutionOutput;
  cleanText: string;
  rawText: string;
  taskText?: string;
  traceEvents?: ExecutionTraceEvent[];
  sessionFiles?: ReasoningFile[];
  hasError?: boolean;
  errorMessage?: string;
  language?: string | null;
}

function truncateText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function firstNonEmptyLine(value: string): string | undefined {
  return value
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

const MAX_FALLBACK_SUMMARY_LENGTH = 80;

function isEnglishLanguage(language?: string | null): boolean {
  return language?.toLowerCase().startsWith("en") ?? false;
}

function getExecutionReportCopy(language?: string | null) {
  if (isEnglishLanguage(language)) {
    return {
      taskCompleted: "Task completed",
      generatedFiles: (count: number) =>
        `Generated ${count} ${count === 1 ? "file" : "files"}`,
      openFile: (name: string) => `Open ${name}`,
      toolSummary: (
        toolTypeCount: number,
        toolCallCount: number,
        failedCount: number,
      ) =>
        `Called ${toolTypeCount} tool ${toolTypeCount === 1 ? "type" : "types"} ${toolCallCount} ${toolCallCount === 1 ? "time" : "times"}${
          failedCount > 0
            ? `, with ${failedCount} ${failedCount === 1 ? "failure" : "failures"}`
            : ""
        }`,
      taskReceived: "Task received",
      taskConfig: "Task configuration",
      taskDescription: "Read this mate run's task goal.",
      collectWithTools: "Collected information with tools",
      toolExecution: "Tool execution",
      organizeResult: "Organized execution result",
      organizeResultDescription:
        "Organized the key result from tool returns and the final response.",
      systemSummary: "System summary",
      generateFiles: "Generated files",
      generatedFileDescription: (count: number, names: string[]) =>
        `Generated ${count} ${count === 1 ? "file" : "files"}: ${names.join(", ")}${count > 3 ? ", etc." : ""}.`,
      outputFiles: "Output files",
      recordError: "Recorded error",
      errorDescription: "An error occurred during this run.",
      executionStatus: "Execution status",
      runCompleted: "Run completed",
      executionResult: "Execution result",
    };
  }

  return {
    taskCompleted: "Task completed",
    generatedFiles: (count: number) =>
      `Generated ${count} ${count === 1 ? "file" : "files"}`,
    openFile: (name: string) => `Open ${name}`,
    toolSummary: (
      toolTypeCount: number,
      toolCallCount: number,
      failedCount: number,
    ) =>
      `Called ${toolTypeCount} ${toolTypeCount === 1 ? "tool type" : "tool types"} ${toolCallCount} ${toolCallCount === 1 ? "time" : "times"}${
        failedCount > 0
          ? `, with ${failedCount} ${failedCount === 1 ? "failure" : "failures"}`
          : ""
      }`,
    taskReceived: "Task received",
    taskConfig: "Task configuration",
    taskDescription: "Read this run's task goal.",
    collectWithTools: "Collected information with tools",
    toolExecution: "Tool execution",
    organizeResult: "Organized execution result",
    organizeResultDescription:
      "Organized the key result from tool returns and the final response.",
    systemSummary: "System summary",
    generateFiles: "Generated files",
    generatedFileDescription: (count: number, names: string[]) =>
      `Generated ${count} ${count === 1 ? "file" : "files"}: ${names.join(", ")}${count > 3 ? ", etc." : ""}.`,
    outputFiles: "Output files",
    recordError: "Recorded error",
    errorDescription: "An error occurred during this run.",
    executionStatus: "Execution status",
    runCompleted: "Run completed",
    executionResult: "Execution result",
  };
}

export function normalizeReasoningSourceType(
  value: unknown,
  fallback: ReasoningSourceType = "system",
): ReasoningSourceType {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");

  if ((REASONING_SOURCE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as ReasoningSourceType;
  }

  const aliases: Record<string, ReasoningSourceType> = {
    browser: "web",
    search: "web",
    webpage: "web",
    website: "web",
    url: "web",
    link: "web",
    document: "file",
    doc: "file",
    docx: "file",
    ppt: "file",
    pptx: "file",
    pdf: "file",
    spreadsheet: "file",
    xls: "file",
    xlsx: "file",
    "local-file": "file",
    workspace: "file",
    task: "system",
    agent: "system",
    scheduler: "system",
  };

  return aliases[normalized] ?? fallback;
}

function normalizeReasoningFile(file: ReasoningFile): ReasoningFile | null {
  const name = file.name?.trim();
  const path = file.path?.trim();
  const url = file.url?.trim();
  if (!name && !path && !url) return null;
  const derivedName = name || path?.split("/").pop() || url || "file";
  return {
    name: derivedName,
    path,
    url,
    type: file.type?.trim() || derivedName.split(".").pop(),
    role: file.role ?? "output",
  };
}

function dedupeFiles(files: ReasoningFile[]): ReasoningFile[] {
  const seen = new Set<string>();
  const result: ReasoningFile[] = [];

  for (const file of files) {
    const normalized = normalizeReasoningFile(file);
    if (!normalized) continue;
    const key = `${normalized.path ?? ""}:${normalized.url ?? ""}:${normalized.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function normalizeSuggestedActions(
  actions: SuggestedAction[] | undefined,
): SuggestedAction[] {
  if (!actions) return [];
  return actions
    .filter((action) => action?.label?.trim())
    .map((action) => ({
      ...action,
      type: action.type ?? "custom",
      label: action.label.trim(),
    }));
}

function buildFileActions(
  files: ReasoningFile[],
  existingActions: SuggestedAction[],
  language?: string | null,
): SuggestedAction[] {
  const copy = getExecutionReportCopy(language);
  const existingPaths = new Set(
    existingActions
      .map((action) =>
        typeof action.params?.path === "string"
          ? action.params.path
          : undefined,
      )
      .filter((path): path is string => Boolean(path)),
  );

  return files
    .filter((file) => file.path && !existingPaths.has(file.path))
    .slice(0, 3)
    .map((file) => ({
      type: "open_file" as const,
      label: copy.openFile(file.name),
      content: file.path,
      params: { path: file.path, name: file.name, type: file.type },
      requiresConfirmation: false,
    }));
}

function buildMissingIntegrationActions(
  texts: Array<string | undefined | null>,
  existingActions: SuggestedAction[],
  language?: string | null,
): SuggestedAction[] {
  if (
    existingActions.some(
      (action) =>
        action.type === "add_integration" ||
        resolveSuggestedActionIntegrationPlatform(action),
    )
  ) {
    return [];
  }

  const action = buildMissingIntegrationActionFromText(
    texts.filter(Boolean).join("\n"),
    { language },
  );
  return action ? [action] : [];
}

function normalizeReasoningSteps(
  steps: ReasoningStep[] | undefined,
): ReasoningStep[] {
  if (!steps) return [];

  return steps
    .filter((step) => step?.summary?.trim())
    .map((step) => {
      const files = dedupeFiles(step.files ?? []);
      return {
        ...step,
        summary: step.summary.trim(),
        description: step.description?.trim(),
        sourceType: normalizeReasoningSourceType(step.sourceType),
        sourceId: step.sourceId?.trim(),
        sourceLabel: step.sourceLabel?.trim() || step.sourceId?.trim(),
        files: files.length > 0 ? files : undefined,
      };
    });
}

function buildToolSummary(
  traceEvents: ExecutionTraceEvent[],
  language?: string | null,
): string | null {
  const toolEvents = traceEvents.filter(
    (event) => event.type === "tool_used" && event.toolName,
  );
  if (toolEvents.length === 0) return null;
  const copy = getExecutionReportCopy(language);

  const uniqueTools = [...new Set(toolEvents.map((event) => event.toolName))];
  const failedCount = traceEvents.filter(
    (event) => event.type === "tool_result" && event.status === "error",
  ).length;
  return copy.toolSummary(uniqueTools.length, toolEvents.length, failedCount);
}

export function buildStructuredExecutionReport(
  input: ExecutionReportInput,
): StructuredExecutionOutput {
  const copy = getExecutionReportCopy(input.language);
  const structured = input.structuredData ?? {};
  const warnings: string[] = [...(structured.diagnostics?.warnings ?? [])];
  const modelSteps = normalizeReasoningSteps(structured.reasoningChain);
  const modelActions = normalizeSuggestedActions(structured.suggestedActions);
  const files = dedupeFiles([
    ...(structured.files ?? []),
    ...(modelSteps.flatMap((step) => step.files ?? []) ?? []),
    ...(input.sessionFiles ?? []),
  ]);

  let summary = structured.summary?.trim();
  if (!summary) {
    const line =
      firstNonEmptyLine(input.cleanText) ||
      firstNonEmptyLine(input.rawText) ||
      input.taskText?.trim();
    summary = line
      ? truncateText(line, MAX_FALLBACK_SUMMARY_LENGTH)
      : copy.taskCompleted;
    warnings.push("model_summary_missing");
  }

  const subtitle =
    structured.subtitle?.trim() ||
    (files.length > 0 ? copy.generatedFiles(files.length) : undefined);
  const traceEvents = input.traceEvents ?? [];
  const toolSummary = buildToolSummary(traceEvents, input.language);
  const steps: ReasoningStep[] = [
    {
      stepType: "input",
      summary: copy.taskReceived,
      description: input.taskText
        ? truncateText(input.taskText, 120)
        : copy.taskDescription,
      sourceType: "system",
      sourceLabel: copy.taskConfig,
    },
  ];

  if (toolSummary) {
    steps.push({
      stepType: "collect",
      summary: copy.collectWithTools,
      description: toolSummary,
      sourceType: "tool",
      sourceLabel: copy.toolExecution,
    });
  }

  if (modelSteps.length > 0) {
    steps.push(
      ...modelSteps.slice(0, 4).map((step) => ({
        ...step,
        stepType: step.stepType ?? "analyze",
        sourceType:
          step.sourceType === "unknown" ? ("system" as const) : step.sourceType,
      })),
    );
  } else {
    warnings.push("model_reasoning_missing");
    steps.push({
      stepType: "analyze",
      summary: copy.organizeResult,
      description:
        firstNonEmptyLine(input.cleanText) || copy.organizeResultDescription,
      sourceType: "system",
      sourceLabel: copy.systemSummary,
    });
  }

  if (files.length > 0) {
    const fileNames = files.slice(0, 3).map((file) => file.name);
    steps.push({
      stepType: "generate",
      summary: copy.generateFiles,
      description: copy.generatedFileDescription(files.length, fileNames),
      sourceType: "file",
      sourceLabel: copy.outputFiles,
      files,
    });
  }

  if (input.hasError) {
    steps.push({
      stepType: "verify",
      summary: copy.recordError,
      description: input.errorMessage || copy.errorDescription,
      sourceType: "system",
      sourceLabel: copy.executionStatus,
    });
  } else {
    steps.push({
      stepType: "deliver",
      summary: copy.runCompleted,
      description: structured.outcome || summary,
      sourceType: "system",
      sourceLabel: copy.executionResult,
    });
  }

  const actions = [
    ...modelActions,
    ...buildMissingIntegrationActions(
      [
        summary,
        subtitle,
        structured.outcome,
        input.cleanText,
        input.rawText,
        input.errorMessage,
      ],
      modelActions,
      input.language,
    ),
    ...buildFileActions(files, modelActions, input.language),
  ];
  const hasModelStructuredOutput =
    Boolean(structured.summary) ||
    modelSteps.length > 0 ||
    modelActions.length > 0;

  return {
    ...structured,
    summary,
    subtitle,
    outcome: structured.outcome,
    reasoningChain: steps,
    files,
    suggestedActions: actions,
    diagnostics: {
      source:
        warnings.length === 0 && hasModelStructuredOutput
          ? "model"
          : "repaired",
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// Parser helper
// ---------------------------------------------------------------------------

const STRUCTURED_TAG = "<structured-output>";
const STRUCTURED_TAG_END = "</structured-output>";
const STRUCTURED_TAG_PATTERN =
  /<structured-output\b[^>]*>|<structured-out[^>]*>/i;
const STRUCTURED_TRAILING_TAG_PATTERN =
  /^\s*(?:<\/structured-output>|<\/parameter>|```)/i;

export interface ParsedStructuredOutput {
  /** Parsed & validated structured data (may be empty object if nothing valid was found). */
  data: StructuredExecutionOutput;
  /** The original text with the structured-output block stripped out. */
  cleanText: string;
}

/**
 * Extract the `<structured-output>` JSON block from agent response text.
 * Returns both the parsed data and the cleaned text (with the block removed).
 */
export function parseStructuredOutput(rawText: string): ParsedStructuredOutput {
  if (!rawText) return { data: {}, cleanText: rawText };

  const tagMatch = findStructuredTag(rawText);
  const tagStart = tagMatch?.index ?? -1;

  // Tag not found
  if (!tagMatch || tagStart === -1) {
    return { data: {}, cleanText: rawText };
  }

  let data: StructuredExecutionOutput = {};
  const jsonStart = rawText.indexOf("{", tagMatch.end);
  const jsonEnd =
    jsonStart === -1 ? -1 : findBalancedJsonObjectEnd(rawText, jsonStart);
  const tagEnd = rawText.indexOf(STRUCTURED_TAG_END, tagMatch.end);

  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      const jsonStr = rawText.slice(jsonStart, jsonEnd).trim();
      const raw = JSON.parse(jsonStr);
      const result = StructuredExecutionOutputSchema.safeParse(raw);
      if (result.success) {
        data = result.data;
      } else if (process.env.NODE_ENV === "development") {
        console.warn(
          "[parseStructuredOutput] Schema validation failed:",
          result.error.issues,
        );
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[parseStructuredOutput] JSON parse failed:", e);
      }
    }
  }

  // Strip the structured block from display text even if the JSON could not be
  // parsed. The model sometimes emits malformed tags such as </parameter>, and
  // user-visible raw JSON is worse than falling back to a repaired report.
  const blockEnd = getStructuredBlockEnd(rawText, {
    markerEnd: tagMatch.end,
    jsonEnd,
    tagEnd,
  });
  const cleanText = (
    rawText.slice(0, tagStart) + rawText.slice(blockEnd)
  ).trim();

  return { data, cleanText };
}

function findStructuredTag(
  rawText: string,
): { index: number; end: number } | null {
  const exactIndex = rawText.lastIndexOf(STRUCTURED_TAG);
  if (exactIndex !== -1) {
    return { index: exactIndex, end: exactIndex + STRUCTURED_TAG.length };
  }

  const matches = [
    ...rawText.matchAll(new RegExp(STRUCTURED_TAG_PATTERN.source, "gi")),
  ];
  const match = matches[matches.length - 1];
  return match?.index === undefined
    ? null
    : { index: match.index, end: match.index + match[0].length };
}

function findBalancedJsonObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }

  return -1;
}

function getStructuredBlockEnd(
  rawText: string,
  input: { markerEnd: number; jsonEnd: number; tagEnd: number },
): number {
  if (input.jsonEnd !== -1) {
    let end = input.jsonEnd;
    while (end < rawText.length) {
      const rest = rawText.slice(end);
      const match = rest.match(STRUCTURED_TRAILING_TAG_PATTERN);
      if (!match) break;
      end += match[0].length;
    }
    return end;
  }

  if (input.tagEnd !== -1) {
    return input.tagEnd + STRUCTURED_TAG_END.length;
  }

  const malformedEnd = rawText.indexOf("</parameter>", input.markerEnd);
  if (malformedEnd !== -1) {
    return malformedEnd + "</parameter>".length;
  }

  return rawText.length;
}
