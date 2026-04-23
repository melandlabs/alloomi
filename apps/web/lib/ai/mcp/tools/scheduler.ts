/**
 * Scheduler tools - createScheduledJob, listScheduledJobs, deleteScheduledJob,
 *                   toggleScheduledJob, updateScheduledJob, executeScheduledJob
 */

import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { Session } from "next-auth";
import { AI_PROXY_BASE_URL } from "@/lib/env";

/**
 * Create the scheduler tools
 */
export function createSchedulerTools(
  session: Session,
  embeddingsAuthToken?: string,
) {
  return [
    // createScheduledJob tool
    tool(
      "createScheduledJob",
      [
        "Create a scheduled job (cron job) for recurring tasks.",
        "",
        "Supports multiple schedule types:",
        "- cron: Use cron expression for complex schedules (e.g., '0 * * * *' for every hour)",
        "- interval: Simple interval in minutes",
        "- once: One-time execution at specific time",
        "",
        "Supports multiple job types:",
        "- custom: Custom handler",
        "",
        "Parameters:",
        "- name (required): Task name",
        "- description (required): MUST preserve user's original request details including platform, recipient, and content",
        "- schedule (required): Schedule configuration with type, expression/minutes/at, timezone",
        "- job (required): Job configuration with type and type-specific fields",
        "- enabled (optional): Whether to enable the job, default true",
        "",
        "Common cron expressions:",
        "- '0 * * * *' - Every hour",
        "- '*/30 * * * *' - Every 30 minutes",
        "- '0 9 * * *' - Daily at 9am",
        "- '0 9 * * 1-5' - Weekdays at 9am",
        "- '0 0 * * 0' - Sunday midnight",
        "",
        "**CRITICAL: Preserve Original Request Details**",
        "",
        "The 'description' field MUST include all key details from user's request:",
        "- Platform: Telegram, Slack, Email, etc.",
        "- Recipient: user themselves or specific person",
        "- Content: the actual reminder message",
        "- Time: when the reminder should trigger",
        "",
        "✅ Good examples:",
        '- User: "Remind me to drink water at 8pm on Telegram"',
        '- description: "Remind me to drink water at 8pm on Telegram"',
        "",
        '- User: "Remind team to have standup meeting at 9am via Slack"',
        '- description: "Remind team to have standup meeting at 9am via Slack"',
        "",
        "❌ Bad examples (loses critical information):",
        '- User: "Remind me to drink water at 8pm on Telegram"',
        '- description: "Remind user to drink water at 8pm" ❌ Changed "me" to "user" and Missing "Telegram"',
        "",
        '- User: "Remind me of meeting at 9am"',
        '- description: "Scheduled reminder" ❌ Too vague, missing time and content',
        "",
        "**Guidelines:**",
        "- Always preserve the platform name (Telegram, Slack, Email, etc.)",
        "- Always preserve the recipient identity - if user says 'me', use 'myself', NOT 'user'",
        "- Always preserve the specific action/content (drink water, meeting, etc.)",
        "- Use user's original language and wording as much as possible",
        "- Description should be clear enough to understand WHAT, WHEN, WHERE, and TO WHOM",
        "- DO NOT rephrase or reinterpret - keep the original meaning intact",
        "",
        "**IMPORTANT:** The description should be a faithful representation of what the user said.",
        "If user says 'remind me', write 'remind me', NOT 'remind user' or 'remind myself'.",
      ].join("\n"),
      {
        name: z.string().describe("Task name"),
        description: z
          .string()
          .describe(
            "Task description - Use user's EXACT original wording. DO NOT translate or rephrase. Example: if user says 'Remind me to drink water at 8pm on Telegram', use exactly that, NOT 'Remind user to drink water at 8pm via Telegram'",
          ),
        schedule: z
          .object({
            type: z.enum([
              "cron",
              "interval-hours",
              "interval-minutes",
              "once",
            ]),
            expression: z
              .string()
              .optional()
              .describe("Cron expression (required for type='cron')"),
            hours: z
              .number()
              .optional()
              .describe(
                "Interval in hours (required for type='interval-hours')",
              ),
            minutes: z
              .number()
              .optional()
              .describe(
                "Interval in minutes (required for type='interval-minutes')",
              ),
            at: z
              .string()
              .optional()
              .describe("ISO datetime (required for type='once')"),
            timezone: z.string().optional().describe("Timezone (default: UTC)"),
          })
          .describe("Schedule configuration"),
        job: z
          .object({
            handler: z
              .string()
              .optional()
              .describe("Handler name (for custom)"),
          })
          .describe("Job configuration"),
        enabled: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to enable the job"),
      },
      async ({ name, description, schedule, job, enabled = true }) => {
        try {
          const { createJob } = await import("@/lib/cron/service");

          // Build schedule config
          let scheduleConfig:
            | { type: "cron"; expression: string; timezone?: string }
            | { type: "interval-hours"; hours: number }
            | { type: "interval-minutes"; minutes: number }
            | { type: "once"; at: Date };
          if (schedule.type === "cron") {
            if (!schedule.expression) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message: "Error: cron type requires 'expression' field",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }
            scheduleConfig = {
              type: "cron" as const,
              expression: schedule.expression,
              timezone: schedule.timezone,
            };
          } else if (schedule.type === "interval-hours") {
            if (typeof schedule.hours !== "number") {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message:
                          "Error: interval-hours type requires 'hours' field",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }
            scheduleConfig = {
              type: "interval-hours" as const,
              hours: schedule.hours,
            };
          } else if (schedule.type === "interval-minutes") {
            if (typeof schedule.minutes !== "number") {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message:
                          "Error: interval-minutes type requires 'minutes' field",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }
            scheduleConfig = {
              type: "interval-minutes" as const,
              minutes: schedule.minutes,
            };
          } else {
            if (!schedule.at) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message: "Error: once type requires 'at' field",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }
            scheduleConfig = {
              type: "once" as const,
              at: new Date(schedule.at),
            };
          }

          // Build job config
          const jobConfig: {
            type: "custom";
            handler: string;
          } = {
            type: "custom" as const,
            handler: job.handler || "default",
          };

          // Create the job
          const createdJob = await createJob(session.user.id, {
            name,
            description,
            schedule: scheduleConfig,
            job: jobConfig,
            enabled,
            timezone: schedule.timezone || "UTC",
          });

          const responseData = {
            success: true,
            message: `Successfully created scheduled job: ${name}`,
            job: {
              id: createdJob.id,
              name: createdJob.name,
              scheduleType: createdJob.scheduleType,
              jobType: createdJob.jobType,
              enabled: createdJob.enabled,
              nextRunAt: createdJob.nextRunAt?.toISOString(),
            },
          };

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(responseData, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    message: `Failed to create job: ${error instanceof Error ? error.message : String(error)}`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    ),

    // listScheduledJobs tool
    tool(
      "listScheduledJobs",
      [
        "List all scheduled jobs (cron jobs) for the current user.",
        "",
        "Parameters:",
        "- includeDisabled (optional): Include disabled jobs, default false",
        "- limit (optional): Maximum number of jobs to return, default 50",
      ].join("\n"),
      {
        includeDisabled: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include disabled jobs"),
        limit: z.coerce
          .number()
          .optional()
          .default(50)
          .describe("Maximum number of jobs to return"),
      },
      async ({ includeDisabled = false, limit = 50 }) => {
        try {
          const { listJobs } = await import("@/lib/cron/service");
          const jobs = await listJobs(session.user.id, { includeDisabled });

          const limitedJobs = jobs.slice(0, limit);

          const responseData = {
            success: true,
            message: `Successfully retrieved ${limitedJobs.length} job(s)`,
            jobs: limitedJobs.map((job: any) => ({
              id: job.id,
              name: job.name,
              description: job.description,
              scheduleType: job.scheduleType,
              cronExpression: job.cronExpression,
              intervalMinutes: job.intervalMinutes,
              scheduledAt: job.scheduledAt,
              jobType: job.jobType,
              enabled: job.enabled,
              lastRunAt: job.lastRunAt?.toISOString(),
              nextRunAt: job.nextRunAt?.toISOString(),
              runCount: job.runCount,
              failureCount: job.failureCount,
              characterName: job.characterName,
            })),
            count: limitedJobs.length,
          };

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(responseData, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    message: `Failed to list jobs: ${error instanceof Error ? error.message : String(error)}`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    ),

    // deleteScheduledJob tool
    tool(
      "deleteScheduledJob",
      [
        "Delete a scheduled job permanently.",
        "",
        "Parameters:",
        "- jobId (required): The ID of the job to delete",
        "",
        "Use listScheduledJobs first to get the job ID",
      ].join("\n"),
      {
        jobId: z.string().describe("Job ID to delete"),
      },
      async ({ jobId }) => {
        try {
          const { deleteJob: deleteCronJob } =
            await import("@/lib/cron/service");
          await deleteCronJob(session.user.id, jobId);

          const responseData = {
            success: true,
            message: `Successfully deleted job: ${jobId}`,
            jobId,
          };

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(responseData, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    message: `Failed to delete job: ${error instanceof Error ? error.message : String(error)}`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    ),

    // toggleScheduledJob tool
    tool(
      "toggleScheduledJob",
      [
        "Enable or disable a scheduled job without deleting it.",
        "",
        "Parameters:",
        "- jobId (required): The ID of the job to toggle",
        "- enabled (required): true to enable, false to disable",
      ].join("\n"),
      {
        jobId: z.string().describe("Job ID"),
        enabled: z.boolean().describe("Enable (true) or disable (false)"),
      },
      async ({ jobId, enabled }) => {
        try {
          const { toggleJob } = await import("@/lib/cron/service");
          const updatedJob = await toggleJob(session.user.id, jobId, enabled);

          const responseData = {
            success: true,
            message: `Successfully ${enabled ? "enabled" : "disabled"} job: ${updatedJob.name}`,
            job: {
              id: updatedJob.id,
              name: updatedJob.name,
              enabled: updatedJob.enabled,
            },
          };

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(responseData, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    message: `Failed to toggle job: ${error instanceof Error ? error.message : String(error)}`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    ),

    // updateScheduledJob tool
    tool(
      "updateScheduledJob",
      [
        "Update an existing scheduled job (cron job).",
        "",
        "All parameters are optional - only provide the fields you want to change.",
        "",
        "Parameters:",
        "- jobId (required): The ID of the job to update",
        "- name (optional): New task name",
        "- description (optional): New task description",
        "- schedule (optional): New schedule configuration with type, expression/minutes/at, timezone",
        "- enabled (optional): Enable or disable the job",
        "- timezone (optional): New timezone",
        "",
        "To get the job ID, use listScheduledJobs first.",
        "",
        "Examples:",
        "- Update schedule: update job's cron expression to '0 9 * * *'",
        "- Update name: rename the job",
        "- Update description: change what the job does",
        "- Disable job: set enabled to false",
      ].join("\n"),
      {
        jobId: z.string().describe("Job ID to update"),
        name: z.string().optional().describe("New task name"),
        description: z.string().optional().describe("New task description"),
        schedule: z
          .object({
            type: z.enum([
              "cron",
              "interval-hours",
              "interval-minutes",
              "once",
            ]),
            expression: z
              .string()
              .optional()
              .describe("Cron expression (required for type='cron')"),
            hours: z
              .number()
              .optional()
              .describe(
                "Interval in hours (required for type='interval-hours')",
              ),
            minutes: z
              .number()
              .optional()
              .describe(
                "Interval in minutes (required for type='interval-minutes')",
              ),
            at: z
              .string()
              .optional()
              .describe("ISO datetime (required for type='once')"),
            timezone: z.string().optional().describe("Timezone (default: UTC)"),
          })
          .optional()
          .describe("New schedule configuration"),
        enabled: z.boolean().optional().describe("Enable or disable the job"),
        timezone: z.string().optional().describe("New timezone"),
      },
      async ({ jobId, name, description, schedule, enabled, timezone }) => {
        try {
          const { updateJob, getJob } = await import("@/lib/cron/service");

          // First verify the job exists
          const existingJob = await getJob(session.user.id, jobId);
          if (!existingJob) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: false,
                      message: `Job not found: ${jobId}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }

          // Build update payload
          const updates: Parameters<typeof updateJob>[2] = {};

          if (name !== undefined) updates.name = name;
          if (description !== undefined) updates.description = description;
          if (enabled !== undefined) updates.enabled = enabled;
          if (timezone !== undefined) updates.timezone = timezone;

          if (schedule) {
            // Validate schedule based on type
            if (schedule.type === "cron" && !schedule.expression) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message: "Cron type requires 'expression' field",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }
            if (schedule.type === "interval-hours" && !schedule.hours) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message: "interval-hours type requires 'hours' field",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }
            if (schedule.type === "interval-minutes" && !schedule.minutes) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message:
                          "interval-minutes type requires 'minutes' field",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }
            if (schedule.type === "once" && !schedule.at) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        success: false,
                        message: "Once type requires 'at' field",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }

            // Build schedule config (fields are already validated above)
            let scheduleConfig:
              | { type: "cron"; expression: string; timezone?: string }
              | { type: "interval-hours"; hours: number }
              | { type: "interval-minutes"; minutes: number }
              | { type: "once"; at: Date };

            if (schedule.type === "cron") {
              const expression = schedule.expression as string;
              scheduleConfig = {
                type: "cron" as const,
                expression,
                timezone: schedule.timezone,
              };
            } else if (schedule.type === "interval-hours") {
              const hours = schedule.hours as number;
              scheduleConfig = {
                type: "interval-hours" as const,
                hours,
              };
            } else if (schedule.type === "interval-minutes") {
              const minutes = schedule.minutes as number;
              scheduleConfig = {
                type: "interval-minutes" as const,
                minutes,
              };
            } else {
              const at = schedule.at as string;
              scheduleConfig = {
                type: "once" as const,
                at: new Date(at),
              };
            }

            updates.schedule = scheduleConfig;
          }

          const updatedJob = await updateJob(session.user.id, jobId, updates);

          const responseData = {
            success: true,
            message: `Successfully updated job: ${updatedJob.name}`,
            job: {
              id: updatedJob.id,
              name: updatedJob.name,
              description: updatedJob.description,
              scheduleType: updatedJob.scheduleType,
              cronExpression: updatedJob.cronExpression,
              intervalMinutes: updatedJob.intervalMinutes,
              scheduledAt: updatedJob.scheduledAt,
              enabled: updatedJob.enabled,
              timezone: updatedJob.timezone,
              nextRunAt: updatedJob.nextRunAt,
            },
          };

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(responseData, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    message: `Failed to update job: ${error instanceof Error ? error.message : String(error)}`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    ),

    // executeScheduledJob tool
    tool(
      "executeScheduledJob",
      [
        "Trigger immediate execution of a scheduled job. The job runs asynchronously in the background.",
        "",
        "Parameters:",
        "- jobId (required): The ID of the job to execute",
        "",
        "Note: This triggers async execution and returns immediately after starting.",
        "The job runs in the background and does not block the current conversation.",
        "Use listScheduledJobs to see updated run statistics.",
      ].join("\n"),
      {
        jobId: z.string().describe("Job ID to execute"),
      },
      async ({ jobId }) => {
        try {
          const { getJob } = await import("@/lib/cron/service");
          const { executeJob } = await import("@/lib/cron/executor");
          const { startJobExecution, completeJobExecution } =
            await import("@/lib/cron/service");
          const { isTauriMode } = await import("@/lib/env/constants");

          const job = await getJob(session.user.id, jobId);
          if (!job) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: false,
                      message: `Job not found: ${jobId}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }

          // Detect environment (must be declared before modelConfig usage)
          const isTauri = isTauriMode();

          // Build modelConfig from cloud auth token (same as local-scheduler does)
          // This ensures scheduled jobs use the correct API config instead of falling back
          // to ~/.claude/settings.json which may have wrong model/endpoint
          const selectedModel = (job as any)?.jobConfig?.modelConfig?.model;
          const modelConfig =
            isTauri && embeddingsAuthToken
              ? {
                  baseUrl: AI_PROXY_BASE_URL,
                  apiKey: embeddingsAuthToken,
                  ...(typeof selectedModel === "string"
                    ? { model: selectedModel }
                    : {}),
                }
              : undefined;

          const context = {
            userId: session.user.id,
            jobId: job.id,
            executionId: crypto.randomUUID(),
            triggeredBy: "manual" as const,
            modelConfig,
          };

          // Start execution tracking
          await startJobExecution(context);

          // Get job config
          const jobConfigStr =
            typeof job.jobConfig === "string"
              ? job.jobConfig
              : JSON.stringify(job.jobConfig);

          console.log("[executeScheduledJob] Executing job in environment:", {
            jobId: job.id,
            isTauri,
            jobType: job.jobType,
          });

          // Execute job asynchronously (don't await)
          (async () => {
            try {
              const result = await executeJob(
                context,
                jobConfigStr,
                job.description || undefined,
              );
              await completeJobExecution(context, result);
            } catch (error) {
              await completeJobExecution(context, {
                status: "error",
                output: "",
                error: error instanceof Error ? error.message : String(error),
                duration: 0,
              });
            }
          })();

          const responseData = {
            success: true,
            message: `Job "${job.name}" started executing (running asynchronously in background)`,
            executionId: context.executionId,
            triggeredBy: "manual",
            status: "started",
            job: {
              id: job.id,
              name: job.name,
            },
          };

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(responseData, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    message: `Failed to execute job: ${error instanceof Error ? error.message : String(error)}`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      },
    ),
  ];
}
