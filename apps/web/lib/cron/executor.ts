/**
 * Job Executor
 * Executes custom scheduled jobs using the agent
 */

import type {
  JobConfig,
  JobExecutionResult,
  JobExecutionContext,
} from "./types";
// Note: createClaudeAgent is imported lazily inside executeJob to avoid
// loading the AI provider chain (which requires LLM_MODEL env var) on startup
import {
  prepareConversationWindows,
  triggerCompactionAsync,
  type CompactionPlatform,
} from "@/lib/ai";
import { preprocessCompactionMessages } from "@alloomi/ai/agent";
import { formatAgentStreamErrorForUser } from "@/lib/ai/runtime/format-error";
import {
  saveChat,
  saveMessages,
  getMessageById,
  updateMessageFileMetadata,
  saveChatInsights,
  replaceMessagesWithCompactionSummary,
} from "@/lib/db/queries";
import { db } from "../db/index";
import {
  characters,
  insight,
  message as messageTable,
  jobExecutions,
  scheduledJobs,
} from "../db/schema";
import { desc, eq } from "drizzle-orm";
import { generateUUID } from "@/lib/utils";
import { stripMalformedToolCalls } from "@/lib/utils/tool-names";
import { parseStructuredOutput } from "@/lib/types/execution-result";
import { platform, homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_JOB_TIMEOUT_MS } from "../env/config/constants";
import { APP_DIR_NAME } from "../env/config/constants";
import { DEFAULT_AI_MODEL, AI_PROXY_BASE_URL } from "@/lib/env/constants";

const MAX_JOB_HISTORY_TOKENS = 50_000;
const JOB_HISTORY_LIMIT = 100;

// Registry for custom job handlers
export const customJobHandlers: Record<
  string,
  (context: JobExecutionContext) => Promise<JobExecutionResult>
> = {};

/**
 * Register a custom job handler
 */
export function registerCustomHandler(
  name: string,
  handler: (context: JobExecutionContext) => Promise<JobExecutionResult>,
) {
  customJobHandlers[name] = handler;
}

function extractTextFromParts(parts: any): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => p?.type === "text" && typeof p?.text === "string")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

function normalizeRole(role: unknown): "user" | "assistant" {
  return role === "user" ? "user" : "assistant";
}

function stringifyToolPayload(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildToolUseContent(part: Record<string, unknown>): string {
  const toolName =
    typeof part.toolName === "string" && part.toolName.trim().length > 0
      ? part.toolName
      : "UnknownTool";
  const toolInput = stringifyToolPayload(part.toolInput);

  return toolInput
    ? `[TOOL_USE] ${toolName}\n${toolInput}`
    : `[TOOL_USE] ${toolName}`;
}

function buildToolResultContent(part: Record<string, unknown>): string {
  const toolName =
    typeof part.toolName === "string" && part.toolName.trim().length > 0
      ? part.toolName
      : "UnknownTool";
  const status =
    typeof part.status === "string" && part.status.trim().length > 0
      ? part.status
      : "completed";
  const toolOutput = stringifyToolPayload(part.toolOutput);
  const errorLine = part.isError === true ? "\n[ERROR]" : "";

  return toolOutput
    ? `[TOOL_RESULT] ${toolName} (${status})${errorLine}\n${toolOutput}`
    : `[TOOL_RESULT] ${toolName} (${status})${errorLine}`;
}

type JobHistoryMessage = {
  id: string;
  sourceMessageId: string;
  role: "user" | "assistant";
  content: string;
  messageType: "message" | "tool_use" | "tool_result";
  timestamp?: number;
};

function isCompactionSummaryMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }
  return (metadata as Record<string, unknown>).type === "compaction_summary";
}

function extractCompactionMessagesFromParts(row: any): JobHistoryMessage[] {
  // Scheduler chats persist assistant output as mixed "parts", so we expand a
  // single DB row into message/tool_use/tool_result items before preprocessing.
  const parts = Array.isArray(row.parts) ? row.parts : [];
  const role = normalizeRole(row.role);
  const timestamp = row.createdAt
    ? new Date(row.createdAt).getTime()
    : undefined;
  const sourceMessageId = String(row.id);
  const messages: JobHistoryMessage[] = [];

  parts.forEach((part: any, index: number) => {
    if (part?.type === "text" && typeof part.text === "string") {
      const content = part.text.trim();
      if (!content) return;
      messages.push({
        id: `${sourceMessageId}:text:${index}`,
        sourceMessageId,
        role,
        content,
        messageType: "message",
        timestamp,
      });
    }
  });

  if (messages.length > 0) {
    return messages;
  }

  const fallbackContent = extractTextFromParts(row.parts);
  if (!fallbackContent) {
    return [];
  }

  return [
    {
      id: `${sourceMessageId}:fallback:0`,
      sourceMessageId,
      role,
      content: fallbackContent,
      messageType: "message",
      timestamp,
    },
  ];
}

function compareJobHistoryMessages(
  a: Pick<JobHistoryMessage, "timestamp" | "sourceMessageId" | "id">,
  b: Pick<JobHistoryMessage, "timestamp" | "sourceMessageId" | "id">,
): number {
  const timestampDiff = (a.timestamp ?? 0) - (b.timestamp ?? 0);
  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  const sourceDiff = a.sourceMessageId.localeCompare(b.sourceMessageId);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }

  return a.id.localeCompare(b.id);
}

/**
 * Execute a job based on its configuration
 */
export async function executeJob(
  context: JobExecutionContext,
  jobConfigStr: string,
  jobDescription?: string,
): Promise<JobExecutionResult> {
  const startTime = Date.now();

  try {
    // Parse job configuration
    const jobConfig: JobConfig = JSON.parse(jobConfigStr);
    console.log("[JobExecutor] Executing job:", {
      jobId: context.jobId,
      type: jobConfig.type,
      config: jobConfig,
      description: jobDescription,
    });

    // Only custom type is supported
    const result = await executeCustomJob(context, jobConfig, jobDescription);

    result.duration = Date.now() - startTime;
    return result;
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Execute a custom job
 * For custom jobs, we use the agent chat API to execute the task
 */
async function executeCustomJob(
  context: JobExecutionContext,
  config: Extract<JobConfig, { type: "custom" }>,
  jobDescription?: string,
): Promise<JobExecutionResult> {
  // Phase 1.1: Check Character status before executing
  let char: (typeof characters.$inferSelect & Record<string, unknown>) | null =
    null;
  let charSources: Array<{ type: string; name: string; id?: string }> = [];
  let charNotificationChannels: string[] = [];
  let charSystemNotification = true;
  if (context.characterId) {
    [char] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, context.characterId))
      .limit(1);

    // Parse sources (stored as JSON string in DB)
    if (char?.sources) {
      charSources =
        typeof char.sources === "string"
          ? JSON.parse(char.sources)
          : Array.isArray(char.sources)
            ? char.sources
            : [];
    }

    // Parse notification channels (stored as JSON string in DB)
    if (char?.notificationChannels) {
      charNotificationChannels =
        typeof char.notificationChannels === "string"
          ? JSON.parse(char.notificationChannels)
          : Array.isArray(char.notificationChannels)
            ? char.notificationChannels
            : [];
    }

    // Parse system notification toggle (default true for backward compatibility)
    if (
      char?.systemNotification !== undefined &&
      char?.systemNotification !== null
    ) {
      charSystemNotification =
        typeof char.systemNotification === "number"
          ? char.systemNotification === 1
          : char.systemNotification === true;
    }

    if (char && char.status !== "active") {
      console.log(
        `[JobExecutor] Character ${context.characterId} is "${char.status}", skipping execution`,
      );
      return {
        status: "success",
        output: "Skipped: character is paused",
        duration: 0,
      };
    }

    // Phase 1.3: Auto-create missing insight
    if (char) {
      const [existingInsight] = await db
        .select()
        .from(insight)
        .where(eq(insight.id, char.insightId))
        .limit(1);

      if (!existingInsight) {
        console.log(
          `[JobExecutor] Bound insight ${char.insightId} not found for character ${context.characterId}, recreating...`,
        );
        const now = new Date();
        await db.insert(insight).values({
          id: char.insightId,
          botId: char.jobId,
          taskLabel: "Character Execution",
          title: `Character Insight: ${char.name}`,
          description: "",
          importance: "medium",
          urgency: "medium",
          platform: "manual",
          time: now,
        });
      }
    }
  }

  // Build character context section for the system prompt
  const characterContextSection = char
    ? `

**CHARACTER CONTEXT:**
- characterName: ${char.name}
- insightId: ${char.insightId}
${charSources.length > 0 ? `- Monitored Sources:\n${charSources.map((s) => `  - [${s.type}] ${s.name}`).join("\n")}` : "- Monitored Sources: none"}
${charNotificationChannels.length > 0 ? `- Notification Channels:\n${charNotificationChannels.map((ch) => `  - ${ch}`).join("\n")}` : "- Notification Channels: none"}

**INSIGHT ATTACHMENT HANDLING (MANDATORY):**
After calling chatInsight with withDetail=true, if any insights have attachments:
1. You MUST download ALL attachments immediately using downloadInsightAttachment tool
2. Save them to the session workDir so they are available for the task
3. Do NOT proceed with the task until all attachments are downloaded

**OUTPUT RULES (STRICT — unless user specifies otherwise):**
- If the user explicitly specifies an output format, structure, or length in their request, follow their specification instead of the rules below
- Direct output only — no explanations, no process description, no "Here's what I found..."
- Output conclusions directly — give the key takeaway/conclusion without sentence count restrictions
- If nothing significant happened, say "No updates" (under 10 words)
- Prefer short bullet points (under 15 words each) over paragraphs
- Never start with "Sure", "Of course", "I'll", "Let me", "Here's", "The task..."
- Never explain what you did — only state the result
- **SOURCE ATTRIBUTION (CRITICAL):** When outputting information from insights, ALWAYS prefix with source attribution in brackets:
  - Format: [SourceType SourceName] content
  - Examples:
    - [Slack #team-engineering] Critical bug in production - Alex investigating
    - [Notion Q2 Goals Doc] Marketing spend approval pending review
    - [Direct Message Alex] Project Orion hiring sync scheduled for Mon 10 AM
    - [Gmail] Payment confirmation received from Stripe
    - [Calendar Company Webinar] Optional event on Thursday
  - SourceType options: Slack, Notion, Gmail, Calendar, Telegram, Discord, Direct Message, or the actual channel/doc name
  - If the insight has a specific group/channel (from insight.groups), use that name
  - If content came from a document/file, use the document name
  - If from a direct message, use [Direct Message PersonName]
  - **Do NOT omit source attribution** — every bullet point should have it

**BOUND INSIGHT UPDATE (ONLY IF THERE IS CONTENT):**
- ONLY call modifyInsight if there is actual content to record (e.g., new data, events, results)
- If the task completed without producing any new information to track, DO NOT call modifyInsight
- When calling modifyInsight, you MUST pass the updates object with the fields you want to change:
  - modifyInsight({ insightId: "${char.insightId}", updates: { timeline: [{ summary: "...", tags: [...], label: "..." }] } })
  - NEVER call modifyInsight without the updates parameter`
    : "";

  try {
    // Lazily import createClaudeAgent to avoid loading AI providers at module init
    const { createClaudeAgent } = await import("@/lib/ai/extensions");

    // Prepare the message from job description
    // The job description should contain the full message/task to execute
    const messageText: string = jobDescription || config.handler || "";

    // Use jobId as chatId - all executions of the same job share the same chat
    // This allows the agent to maintain context across executions
    const chatId = context.jobId;

    // Build model config for agent
    // Use default proxy baseUrl instead of database-stored config.modelConfig.baseUrl
    const defaultBaseUrl = AI_PROXY_BASE_URL || process.env.LLM_BASE_URL;
    const rawModelConfig = context.modelConfig || config.modelConfig;
    const modelConfig = {
      ...rawModelConfig,
      baseUrl: defaultBaseUrl || rawModelConfig?.baseUrl,
      model:
        rawModelConfig?.model ||
        (config as any).modelConfig?.model ||
        process.env.LLM_MODEL ||
        DEFAULT_AI_MODEL,
    };

    const agent = createClaudeAgent({
      provider: "claude",
      ...modelConfig,
    });

    // Extract authToken for business-tools MCP server (used for embeddings API)
    const authToken = modelConfig?.apiKey;

    // Track insight IDs created/modified during this execution for chat association
    const createdInsightIds: string[] = [];
    const onInsightChange = (data: {
      action: "create" | "update" | "delete";
      insightId?: string;
      insight?: Record<string, unknown>;
    }) => {
      if (
        (data.action === "create" || data.action === "update") &&
        data.insightId &&
        !createdInsightIds.includes(data.insightId)
      ) {
        createdInsightIds.push(data.insightId);
      }
    };

    const sessionId = chatId; // Use jobId as sessionId
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    // Determine platform for system notifications
    const osPlatform = platform();
    const isMacOS = osPlatform === "darwin";
    const isLinux = osPlatform === "linux";
    const isWindows = osPlatform === "win32";

    let platformNotificationSection = "";
    let platformNotificationWorkflow = "";
    let platformNotificationExamples = "";
    let platformNotificationName: string = osPlatform;

    if (charSystemNotification) {
      if (isMacOS) {
        platformNotificationName = "macOS";
        platformNotificationSection = `**macOS Notification (ALWAYS send if no platform specified):**
- dialog: (sleep 18 && osascript -e 'display dialog "Notification content" buttons {"OK"} default button 1 with title "Alloomi Reminder"') &
- notification: (sleep 18 && osascript -e 'display notification "Notification content" with title "Alloomi Reminder"') &`;
        platformNotificationWorkflow =
          "5. macOS notification - ALWAYS use the delayed notification pattern: (sleep 18 && osascript -e 'display notification ...' with title \"Alloomi Reminder\") & AND also (sleep 18 && osascript -e 'display dialog ...' with title \"Alloomi Reminder\") & - BOTH commands must be used with proper background delay execution (the & at the end makes it run in background)";
        platformNotificationExamples = `- Task: "Remind me to attend meeting at 9 AM every day" (no platform specified)
  - Platforms: ALL available platforms + macOS notification
  - Reminder: "Time for meeting!"

- Task: "Remind me to submit weekly report every Friday" (no platform specified)
  - Platforms: ALL available platforms + macOS notification
  - Reminder: "Time to submit weekly report!"`;
      } else if (isLinux) {
        platformNotificationName = "Linux";
        platformNotificationSection = `**Linux Notification (ALWAYS send if no platform specified):**
- Use the Bash tool to send system notification: (sleep 18 && notify-send "Alloomi Reminder" "Notification content") &
- Alternative: (sleep 18 && zenity --info --text="Notification content" --title="Alloomi Reminder") &`;
        platformNotificationWorkflow =
          '5. Linux notification - ALWAYS use the delayed notification pattern: (sleep 18 && notify-send "Alloomi Reminder" "Notification content") & - must run in background with & at the end';
        platformNotificationExamples = `- Task: "Remind me to attend meeting at 9 AM every day" (no platform specified)
  - Platforms: ALL available platforms + Linux notification
  - Reminder: "Time for meeting!"

- Task: "Remind me to submit weekly report every Friday" (no platform specified)
  - Platforms: ALL available platforms + Linux notification
  - Reminder: "Time to submit weekly report!"`;
      } else if (isWindows) {
        platformNotificationName = "Windows";
        platformNotificationSection = `**Windows Notification (ALWAYS send if no platform specified):**
- Use PowerShell: Start-Process powershell -ArgumentList '-Command', 'Start-Sleep -Seconds 18; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show(\"Notification content\", \"Alloomi Reminder\")'`;
        platformNotificationWorkflow =
          "5. Windows notification - ALWAYS use the delayed notification pattern: Start-Process powershell -ArgumentList '-Command', 'Start-Sleep -Seconds 18; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show(\"Notification content\", \"Alloomi Reminder\")' - must run in background";
        platformNotificationExamples = `- Task: "Remind me to attend meeting at 9 AM every day" (no platform specified)
  - Platforms: ALL available platforms + Windows notification
  - Reminder: "Time for meeting!"

- Task: "Remind me to submit weekly report every Friday" (no platform specified)
  - Platforms: ALL available platforms + Windows notification
  - Reminder: "Time to submit weekly report!"`;
      } else {
        platformNotificationName = "your system";
        platformNotificationSection = `**System Notification:**
Current platform (${osPlatform}) system notification is not configured. Only send to connected platforms.`;
        platformNotificationWorkflow =
          "5. System notification - send to connected platforms only";
        platformNotificationExamples = `- Task: "Remind me to attend meeting at 9 AM every day" (no platform specified)
  - Platforms: ALL available platforms
  - Reminder: "Time for meeting!"`;
      }
    } // end charSystemNotification

    // Add system prompt as first assistant message to guide behavior
    messages.push({
      role: "assistant",
      content: `**SCHEDULED TASK EXECUTION**

You are executing a scheduled task on **${platformNotificationName} (${osPlatform})**.

**TASK DESCRIPTION:**
"${jobDescription}"

**YOUR JOB:**
Parse the task description and execute it. If it asks for a report or dashboard, write the output to a file.

**OUTPUT RULES (Conclusion First):**
- Start with the key conclusion/takeaway — NOT background, methodology, or "Here's what I found"
- If the task is "generate report" or "generate dashboard/kanban": write output to a file in session workDir
- For dashboards/kanbans: use frontend-design skill to create embedded HTML
- Then update the bound insight with modifyInsight

**REMINDER RULES (if sending notification):**
- Send the reminder to the USER (yourself), NOT others
- Keep reminder message SHORT and FRIENDLY (e.g., "Time to drink water!")
- DO NOT send the task description itself as the message

**INSIGHT/EVENT/TRACK UPDATE RULES (CRITICAL):**
When the task description mentions or is associated with a specific insight, event, or track:
- If the task says things like "update my [X] tracking", "add to [X]", "log to [X] insight", etc.
- The user has explicitly associated this scheduled task with an existing insight/event/track
- **ALWAYS use modifyInsight (with the correct insightId) to UPDATE the existing insight/event/track**
- **DO NOT create a new insight using createInsight**
- The insightId may be provided in the task description, or you should query the user's insights to find the matching one
- When adding timeline updates, be specific in the summary — describe exactly what happened, what data changed, what trends emerged
- Add **tags** for categorization and **action** for next steps (e.g., "Review competitor update", "Schedule follow-up", "Share with team")

**PLATFORM SELECTION:**
1. First, use queryIntegrations to check which platforms the user has connected
2. If the task specifies a platform (e.g., "Remind me on Telegram"), only use that platform
3. If no platform is specified, ONLY send to the user's configured Notification Channels (from CHARACTER CONTEXT):
   - Send to each channel listed in Notification Channels using sendReply
   - Do NOT send to platforms not in Notification Channels
${charSystemNotification ? `   - System notification (${platformNotificationName}) is still sent if configured` : "   - Do NOT send system/desktop notifications"}

**EXECUTION WORKFLOW:**
1. queryIntegrations - Verify the configured Notification Channels are available
2. Determine target platforms based on task description:
   - If platform specified (e.g., "Telegram reminder") -> use that platform only (must be in Notification Channels)
   - If no platform specified -> use ONLY the Notification Channels configured for this character
3. Determine recipient for each platform:
   - **For Telegram: Use "me" directly as the contact identifier** - "me" refers to your own Telegram account and will always work without needing to look up contacts
   - For other platforms: Find the user's own contact via queryContacts (the recipient is the user themselves)
4. sendReply - Send the reminder message to the user via each configured Notification Channel
5. If the task description references an existing insight/event/track -> use modifyInsight to update it
${platformNotificationWorkflow}

${platformNotificationSection}

**EXAMPLES:**
- Task: "Remind me to drink water at 8 PM every day on Telegram"
  - Platforms: Telegram only (specified)
  - Contact: Use "me" as the contact identifier
  - Reminder: "Time to drink water!"

- Task: "Every day at 9 PM, update my 'Gym Progress' tracking with today's workout"
  - The user has associated this task with the "Gym Progress" insight
  - Action: Use modifyInsight to add a timeline event to the existing "Gym Progress" insight
  - DO NOT create a new insight

- Task: "Log my daily reading to 'Book Tracker' every evening"
  - The user has associated this task with the "Book Tracker" insight
  - Action: Use modifyInsight to add a timeline event to the existing "Book Tracker" insight

${platformNotificationExamples}

**IMPORTANT:**
- Recipient is always the USER (yourself), not other people
- Send a short, actionable reminder message, NOT the task description
- If the task is associated with a specific insight/event/track, ALWAYS update the existing one - never create a new insight
- After sending the reminder and completing all actions, respond with a concise conclusion summarizing the result. Focus on the key outcome rather than step-by-step details. If the output is too long or complex, save it to a file and just respond with the file path instead.
${characterContextSection}

**STRUCTURED OUTPUT (REQUIRED):**
After completing the task, you MUST append a structured JSON block at the very end of your response, wrapped in <structured-output> tags.
The format must be:
<structured-output>
{
  "summary": "不超过20字的中文摘要",
  "subtitle": "不超过40字的补充描述（可选，描述量化指标或上下文）",
  "reasoningChain": [
    {
      "summary": "步骤简短总结",
      "description": "步骤详细描述",
      "sourceType": "email|wechat|file|slack|telegram|whatsapp|feishu|dingtalk|notion|web|google-drive|linear|jira",
      "sourceId": "来源标识（发件人邮箱、联系人名等）",
      "files": [{"name": "文件名", "path": "路径", "type": "类型"}]
    }
  ],
  "suggestedActions": [
    {
      "type": "open_file",
      "label": "打开文件",
      "content": "文件路径（向后兼容）",
      "params": { "path": "/absolute/path/to/file.txt", "name": "file.txt", "type": "txt" },
      "requiresConfirmation": false
    },
    {
      "type": "open_link",
      "label": "打开链接",
      "content": "URL（向后兼容）",
      "params": { "url": "https://example.com" },
      "requiresConfirmation": false
    },
    {
      "type": "download_file",
      "label": "下载文件",
      "content": "文件路径（向后兼容）",
      "params": { "path": "/absolute/path/to/file.txt" },
      "requiresConfirmation": false
    },
    {
      "type": "reply_email|send_message|create_task|schedule_reminder|custom",
      "label": "操作描述（用于按钮显示）",
      "content": "操作的具体内容",
      "params": {},
      "requiresConfirmation": true
    }
  ]
}
</structured-output>

Rules for structured output:
- summary: REQUIRED, no more than 20 Chinese characters
  - Must use an action-object phrase (verb-object), e.g. "确认面试时间", "处理账单异常", "回复关键客户"
  - Preferred style: first state key outcome, then highlight the priority focus for user action (e.g. "筛出3份匹配简历，张明明优先跟进")
  - Prioritize what the USER should pay attention to and execute next, not what the AI has done
  - Align with this Character's configured task intent to reflect the user's true goal
  - Make it immediately clear at a glance: what should the user care about now
  - Avoid process narration such as "已完成分析", "执行完毕", "已处理邮件"
- subtitle: OPTIONAL, no more than 40 Chinese characters, describing quantitative metrics or supplementary context (e.g. "已处理 47 封邮件", "涉及 3 个数据源")
- reasoningChain: REQUIRED, at least one item describing key analysis steps
- sourceType must be one of: email, wechat, file, slack, telegram, whatsapp, feishu, dingtalk, notion, web, google-drive, linear, jira
- suggestedActions: can be an empty array [], only add when there are genuinely useful recommended actions
- suggestedActions type specific rules:
  - open_file: params MUST include "path", optionally "name" and "type"
  - open_link: params MUST include "url"
  - download_file: params MUST include "path"
  - reply_email/send_message: requiresConfirmation MUST be true
- suggestedActions content field: always set to the same value as the primary params field (e.g. for open_file, content = params.path) for backward compatibility
- This block MUST be the last thing in your response`,
    });

    console.log(
      "[JobExecutor] Starting native agent execution with sessionId:",
      chatId,
    );

    let lastTextContent = ""; // Track only the last text for output
    let hasError = false;
    let errorMessage = "";

    try {
      // Get job name for chat title
      const { getJob } = await import("@/lib/cron/service");
      const job = await getJob(context.userId, context.jobId);

      // Get user settings (including aiSoulPrompt and language)
      const { getUserInsightSettings } = await import("@/lib/db/queries");
      const userSettings = context.userId
        ? await getUserInsightSettings(context.userId)
        : null;

      // Pull the newest rows first to keep the history query bounded, then
      // restore chronological order before windowing/compaction.
      const historyRowsDescRaw = await db
        .select()
        .from(messageTable)
        .where(eq(messageTable.chatId, chatId))
        .orderBy(desc(messageTable.createdAt))
        .limit(JOB_HISTORY_LIMIT);

      const historyRows = [...historyRowsDescRaw]
        .map((row: any) => {
          let parts = row.parts;
          if (typeof parts === "string") {
            try {
              parts = JSON.parse(parts);
            } catch {
              parts = [];
            }
          }

          let metadata = row.metadata;
          if (typeof metadata === "string") {
            try {
              metadata = JSON.parse(metadata);
            } catch {
              metadata = null;
            }
          }

          return {
            ...row,
            parts,
            metadata,
          };
        })
        .reverse();
      const compactionSummarySourceMessageIds = new Set(
        historyRows
          .filter((row: any) => isCompactionSummaryMetadata(row.metadata))
          .map((row: any) => String(row.id)),
      );
      const historyConversation: JobHistoryMessage[] = historyRows.flatMap(
        (row: any) => extractCompactionMessagesFromParts(row),
      );

      const preparedHistory = prepareConversationWindows(historyConversation, {
        maxTokens: MAX_JOB_HISTORY_TOKENS,
      });

      const compactionCandidates =
        preparedHistory.candidatesForCompaction as Array<
          JobHistoryMessage & {
            tokens: number;
            bucket: string;
            ageMs: number;
          }
        >;
      const immediateHistory = preparedHistory.immediate as Array<
        JobHistoryMessage & {
          tokens: number;
          bucket: string;
          ageMs: number;
        }
      >;

      // Existing compaction summaries should stay visible to the agent but must
      // never be fed back into a second compaction pass.
      const protectedFromCompaction = compactionCandidates.filter((message) =>
        compactionSummarySourceMessageIds.has(message.sourceMessageId),
      );
      const compactionCandidatePool = compactionCandidates.filter(
        (message) =>
          !compactionSummarySourceMessageIds.has(message.sourceMessageId),
      );

      const immediateSourceIds = new Set(
        immediateHistory.map((message) => message.sourceMessageId),
      );
      // A single stored DB message can expand into multiple synthetic history
      // items, so keep partially-overlapping rows on the immediate side to
      // avoid deleting only half of a persisted message.
      const overlappingSourceMessageIds = new Set(
        compactionCandidatePool
          .filter((message) => immediateSourceIds.has(message.sourceMessageId))
          .map((message) => message.sourceMessageId),
      );
      const safeCompactionCandidates = compactionCandidatePool.filter(
        (message) => !overlappingSourceMessageIds.has(message.sourceMessageId),
      );
      const safeImmediateHistory = [
        ...immediateHistory,
        ...protectedFromCompaction,
        ...compactionCandidatePool.filter((message) =>
          overlappingSourceMessageIds.has(message.sourceMessageId),
        ),
      ].sort(compareJobHistoryMessages);

      if (
        safeCompactionCandidates.length > 10 &&
        preparedHistory.level &&
        authToken
      ) {
        const preprocessedCandidates = preprocessCompactionMessages(
          safeCompactionCandidates.map(({ role, content, messageType }) => ({
            role,
            type: messageType,
            content,
          })),
        );

        if (preprocessedCandidates.flattened.length > 0) {
          void triggerCompactionAsync({
            messages: preprocessedCandidates.flattened.map(
              ({ role, content }) => ({
                role,
                content,
              }),
            ),
            level: preparedHistory.level,
            platform: "scheduler" as CompactionPlatform,
            authToken,
            persistSummary: async (result) => {
              const candidateTimestamps = safeCompactionCandidates
                .map((message) => message.timestamp)
                .filter(
                  (timestamp): timestamp is number => timestamp !== undefined,
                );
              const createdAt =
                candidateTimestamps.length > 0
                  ? new Date(Math.max(...candidateTimestamps))
                  : new Date();
              const rangeStart =
                candidateTimestamps.length > 0
                  ? new Date(Math.min(...candidateTimestamps))
                      .toISOString()
                      .slice(0, 10)
                  : new Date().toISOString().slice(0, 10);
              const rangeEnd =
                candidateTimestamps.length > 0
                  ? new Date(Math.max(...candidateTimestamps))
                      .toISOString()
                      .slice(0, 10)
                  : new Date().toISOString().slice(0, 10);

              await replaceMessagesWithCompactionSummary({
                chatId,
                messageIds: [
                  ...new Set(
                    safeCompactionCandidates.map(
                      ({ sourceMessageId }) => sourceMessageId,
                    ),
                  ),
                ],
                summary: result.summary,
                createdAt,
                compactedMessageCount: result.messageCount,
                compactedRangeStart: rangeStart,
                compactedRangeEnd: rangeEnd,
                level: result.level,
              });
            },
          }).catch((error) => {
            console.error("[JobExecutor] Async compaction failed:", error);
          });
        }
      }

      const preprocessedHistory = preprocessCompactionMessages(
        safeImmediateHistory.map(({ role, content, messageType }) => ({
          role,
          type: messageType,
          content,
        })),
      );

      const runtimeConversation: Array<{
        role: "user" | "assistant";
        content: string;
      }> = [
        ...preprocessedHistory.flattened.map(({ role, content }) => ({
          role: normalizeRole(role),
          content,
        })),
        ...messages,
      ];

      // Save chat to database
      try {
        await saveChat({
          id: chatId,
          userId: context.userId,
          title: `Scheduled Job: ${job?.name || context.jobId.slice(0, 8)}`,
        });
      } catch (error) {
        // Ignore UNIQUE constraint error - chat may already exist
        if (
          (error as Error).message &&
          !(error as Error).message.includes("UNIQUE")
        ) {
          console.error("[JobExecutor] Failed to save chat:", error);
        }
      }

      // Save user message
      const userMessageId = generateUUID();
      await saveMessages({
        messages: [
          {
            chatId,
            id: userMessageId,
            role: "user",
            parts: [{ type: "text", text: messageText }],
            attachments: [],
            createdAt: new Date(),
            metadata: undefined,
          },
        ],
      });

      // Run the agent with timeout
      // Use bypassPermissions mode - same as normal execution
      // Use stream: false for non-streaming mode (reference handleAgentRuntime in shared.ts)
      const generator = agent.run(messageText, {
        sessionId,
        taskId: chatId, // Pass chatId as taskId to ensure workspace files are stored at ~/.alloomi/sessions/{chatId}/
        conversation: runtimeConversation,
        permissionMode: "bypassPermissions", // Full permissions for scheduled tasks
        stream: false, // Non-stream mode, simpler message handling
        excludeTools: ["createScheduledJob"], // Exclude createScheduledJob to prevent recursive job creation
        session: {
          user: { id: context.userId, type: "pro" },
          expires: new Date(Date.now() + 3600000), // 1 hour
        } as any,
        authToken, // Pass auth token for business-tools MCP server (embeddings API)
        onInsightChange, // Track created insights for chat association
        skillsConfig: {
          enabled: true,
          userDirEnabled: true,
          appDirEnabled: false,
        },
        aiSoulPrompt: jobDescription
          ? `${jobDescription}\n\n${userSettings?.aiSoulPrompt ?? ""}`
          : (userSettings?.aiSoulPrompt ?? null),
        language: userSettings?.language ?? null,
        timezone: context.timezone ?? null,
      });

      // Track messages for real-time saving and final output
      const assistantMessages: Array<{ id: string; content: string }> = [];
      const timeout = DEFAULT_JOB_TIMEOUT_MS;
      const startTime = Date.now();
      let toolCallCount = 0;
      const maxToolCalls = 200; // Prevent infinite loops

      // Current assistant message being built - like chat-context.tsx
      // All tool calls and text are accumulated in parts array of a single message
      let currentMessageId = generateUUID();
      let currentParts: Array<any> = [];
      let hasSavedCurrentMessage = false;

      // Save the current assistant message with all accumulated parts
      const saveCurrentAssistantMessage = async () => {
        if (currentParts.length > 0) {
          await saveMessages({
            messages: [
              {
                chatId,
                id: currentMessageId,
                role: "assistant",
                parts: currentParts,
                attachments: [],
                createdAt: new Date(),
                metadata: undefined,
              },
            ],
          });
          // Extract text content for output (only once)
          if (!hasSavedCurrentMessage) {
            const textPart = currentParts.find((p) => p.type === "text");
            if (textPart) {
              assistantMessages.push({
                id: currentMessageId,
                content: textPart.text,
              });
            }
            hasSavedCurrentMessage = true;
          }
        }
      };

      // Reset for next assistant message
      const resetCurrentMessage = () => {
        currentMessageId = generateUUID();
        currentParts = [];
        hasSavedCurrentMessage = false;
      };

      for await (const message of generator) {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          console.error("[JobExecutor] Agent execution timeout");
          hasError = true;
          errorMessage = "Agent execution timeout (1200 minutes)";
          break;
        }

        // Check tool call count
        if (message.type === "tool_use") {
          toolCallCount++;
          if (toolCallCount > maxToolCalls) {
            console.error("[JobExecutor] Too many tool calls:", toolCallCount);
            hasError = true;
            errorMessage = `Too many tool calls (${maxToolCalls})`;
            break;
          }
        }

        if (message.type === "text") {
          // With stream: false, text messages are complete (not incremental deltas)
          // Use the complete text directly without accumulation
          const textContent = message.content || "";

          lastTextContent = textContent;

          // Save complete text message
          currentParts.push({ type: "text", text: textContent });
          await saveCurrentAssistantMessage();
          resetCurrentMessage();
        } else if (message.type === "tool_use") {
          // Don't save here - let tool calls accumulate in the same message
          // Only save when we have text content that user needs to see

          // Skip if no message id
          if (!message.id) {
            console.log("[JobExecutor] Skipping tool_use - no message id");
          } else {
            // Add tool call to current parts (same message)
            currentParts.push({
              type: "tool-native",
              toolName: message.name || "",
              toolUseId: message.id,
              toolInput: message.input,
              status: "executing",
            });

            // Save immediately
            await saveCurrentAssistantMessage();
          }

          // Don't reset here - let multiple tool calls accumulate in same message
          // Only reset when starting a new assistant message (on text or explicit reset)
        } else if (message.type === "tool_result") {
          // Update the corresponding tool call part with result
          // This updates the in-memory currentParts, then saves

          // Skip if no tool use id
          if (!message.toolUseId) {
            console.log("[JobExecutor] Skipping tool_result - no tool use id");
          } else {
            // Find and update the tool-native part in currentParts
            let found = false;
            currentParts = currentParts.map((part) => {
              if (
                part.type === "tool-native" &&
                part.toolUseId === message.toolUseId
              ) {
                found = true;
                return {
                  ...part,
                  status: message.isError ? "error" : "completed",
                  toolOutput: message.output,
                  isError: message.isError,
                };
              }
              return part;
            });

            if (found) {
              // Save the updated message
              await saveCurrentAssistantMessage();
            } else {
              // Tool result came for a tool that was saved in a previous message
              // Need to update the previous message in DB
              console.log(
                "[JobExecutor] Tool result for previous message, updating DB:",
                {
                  toolUseId: message.toolUseId,
                  currentMessageId,
                },
              );

              try {
                // Use currentMessageId to query the message, not toolUseId
                const existingMessages = await getMessageById({
                  id: currentMessageId,
                });
                const existingMessage = existingMessages?.[0];

                if (
                  existingMessage?.parts &&
                  Array.isArray(existingMessage.parts)
                ) {
                  const updatedParts = existingMessage.parts.map(
                    (part: any) => {
                      if (
                        part.type === "tool-native" &&
                        part.toolUseId === message.toolUseId
                      ) {
                        return {
                          ...part,
                          status: message.isError ? "error" : "completed",
                          toolOutput: message.output,
                          isError: message.isError,
                        };
                      }
                      return part;
                    },
                  );

                  await updateMessageFileMetadata({
                    messageId: currentMessageId,
                    attachments: existingMessage.attachments || [],
                    parts: updatedParts,
                  });
                }
              } catch (error) {
                console.error(
                  "[JobExecutor] Failed to update tool result in DB:",
                  error,
                );
              }
            }
          }
        } else if (message.type === "error") {
          // Convert raw error code to user-friendly message
          const rawError = message.message || "Unknown error";
          const userFriendlyError = formatAgentStreamErrorForUser(
            "scheduler",
            rawError,
          );

          // Add error to current parts
          currentParts.push({
            type: "text",
            text: `**Error:** ${userFriendlyError}`,
          });

          hasError = true;
          errorMessage = userFriendlyError;
          console.error("[JobExecutor] Native agent error:", rawError);

          // Save error message
          await saveCurrentAssistantMessage();

          // Reset for next message
          resetCurrentMessage();
        } else if (message.type === "done") {
          // Save any remaining parts before done
          await saveCurrentAssistantMessage();
        }
      }

      // Save any remaining message
      await saveCurrentAssistantMessage();

      // Associate created insights with the job's chat
      if (createdInsightIds.length > 0) {
        try {
          await saveChatInsights({
            chatId,
            insightIds: createdInsightIds,
          });
          console.log(
            `[JobExecutor] Associated ${createdInsightIds.length} insight(s) with chat ${chatId}: ${createdInsightIds.join(", ")}`,
          );
        } catch (error) {
          console.error("[JobExecutor] Failed to save chat insights:", error);
        }
      }
    } catch (error) {
      console.error("[JobExecutor] Native agent execution failed:", error);
      hasError = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    // Compute session directory path (same logic as agent's getSessionWorkDir with taskId)
    const sessionDir = join(homedir(), APP_DIR_NAME, "sessions", chatId);

    // --- Extract structured output from agent response ---
    const { data: structuredData, cleanText } =
      parseStructuredOutput(lastTextContent);
    const hasStructuredOutput =
      (structuredData.summary && structuredData.summary.length > 0) ||
      (structuredData.reasoningChain &&
        structuredData.reasoningChain.length > 0) ||
      (structuredData.suggestedActions &&
        structuredData.suggestedActions.length > 0);

    if (hasStructuredOutput) {
      console.log(
        "[JobExecutor] Parsed structured output from agent response:",
        JSON.stringify(structuredData).slice(0, 200),
      );
    }

    const jobResult: JobExecutionResult = {
      status: (hasError ? "error" : "success") as "error" | "success",
      // Use cleanText (structured-output block stripped) for display
      output: stripMalformedToolCalls(cleanText) || "Task completed",
      error: hasError ? errorMessage : undefined,
      result: {
        chatId,
        message: messageText,
        executionId: context.executionId,
        sessionDir,
        // Embed structured metadata when available
        ...(hasStructuredOutput ? structuredData : {}),
      },
      duration: 0,
    };

    // Directly update execution record and job status in DB before returning.
    // This ensures the status is correct even if the caller's .then() callback
    // is interrupted (e.g. by process exit, hot reload, or navigation).
    // The caller's completeJobExecution() will re-write these rows as a no-op.
    try {
      await db
        .update(jobExecutions)
        .set({
          status: jobResult.status,
          completedAt: new Date(),
          durationMs: jobResult.duration,
          output: jobResult.output,
          error: jobResult.error,
          result: jobResult.result ? JSON.stringify(jobResult.result) : null,
        })
        .where(eq(jobExecutions.id, context.executionId));

      // Update scheduled_jobs.lastStatus so that getDueJobs correctly
      // excludes/completes this job.
      await db
        .update(scheduledJobs)
        .set({
          lastStatus: jobResult.status,
          lastRunAt: new Date(),
          lastError: jobResult.error ?? null,
          updatedAt: new Date(),
        })
        .where(eq(scheduledJobs.id, context.jobId));
    } catch (e) {
      console.error(
        "[JobExecutor] Failed to update execution/job status in DB (caller's completeJobExecution will retry):",
        e,
      );
    }

    return jobResult;
  } catch (error) {
    console.error("[JobExecutor] Custom job error:", error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}
