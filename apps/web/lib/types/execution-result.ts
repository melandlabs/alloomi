/**
 * Execution Result Structured Output Types
 *
 * These types describe the structured metadata that the agent appends
 * to its response via <structured-output> tags during scheduled task execution.
 * The data is stored in `job_executions.result` (jsonb) alongside chatId/sessionDir.
 */

import { z } from "zod";

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
  /** Supplementary context line, e.g. "已处理 47 封邮件". */
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
    taskCompleted: "任务已完成",
    generatedFiles: (count: number) => `生成 ${count} 个文件`,
    openFile: (name: string) => `打开 ${name}`,
    toolSummary: (
      toolTypeCount: number,
      toolCallCount: number,
      failedCount: number,
    ) =>
      `调用 ${toolTypeCount} 类工具共 ${toolCallCount} 次${
        failedCount > 0 ? `，其中 ${failedCount} 次失败` : ""
      }`,
    taskReceived: "接收任务",
    taskConfig: "任务配置",
    taskDescription: "读取本次伙伴运行的任务目标。",
    collectWithTools: "调用工具收集信息",
    toolExecution: "工具执行",
    organizeResult: "整理执行结果",
    organizeResultDescription: "根据工具返回和最终回复整理本次运行的关键结果。",
    systemSummary: "系统整理",
    generateFiles: "生成文件",
    generatedFileDescription: (count: number, names: string[]) =>
      `本次运行生成 ${count} 个文件：${names.join("、")}${
        count > 3 ? " 等" : ""
      }。`,
    outputFiles: "输出文件",
    recordError: "记录异常",
    errorDescription: "本次运行过程中出现异常。",
    executionStatus: "执行状态",
    runCompleted: "完成运行",
    executionResult: "执行结果",
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
  const warnings: string[] = [];
  const copy = getExecutionReportCopy(input.language);
  const structured = input.structuredData ?? {};
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

  const tagStart = rawText.lastIndexOf(STRUCTURED_TAG);
  const tagEnd = rawText.lastIndexOf(STRUCTURED_TAG_END);

  // Tag not found or malformed
  if (tagStart === -1 || tagEnd === -1 || tagEnd <= tagStart) {
    return { data: {}, cleanText: rawText };
  }

  let data: StructuredExecutionOutput = {};

  try {
    const jsonStr = rawText
      .slice(tagStart + STRUCTURED_TAG.length, tagEnd)
      .trim();
    const raw = JSON.parse(jsonStr);
    const result = StructuredExecutionOutputSchema.safeParse(raw);
    if (result.success) {
      data = result.data;
    } else {
      console.warn(
        "[parseStructuredOutput] Schema validation failed:",
        result.error.issues,
      );
    }
  } catch (e) {
    console.warn("[parseStructuredOutput] JSON parse failed:", e);
  }

  // Strip the block from display text
  const cleanText = (
    rawText.slice(0, tagStart) +
    rawText.slice(tagEnd + STRUCTURED_TAG_END.length)
  ).trim();

  return { data, cleanText };
}
