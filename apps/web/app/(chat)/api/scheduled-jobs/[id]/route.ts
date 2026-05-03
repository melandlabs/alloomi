/**
 * Single Scheduled Job API
 * GET /api/scheduled-jobs/[id] - Get a job
 * PATCH /api/scheduled-jobs/[id] - Update a job
 * DELETE /api/scheduled-jobs/[id] - Delete a job
 * POST /api/scheduled-jobs/[id]/execute - Manually execute a job
 */

import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getJob,
  updateJob,
  deleteJob as deleteCronJob,
  toggleJob,
} from "@/lib/cron/service";
import { executeJob } from "@/lib/cron/executor";
import { startJobExecution, completeJobExecution } from "@/lib/cron/service";
import { createJobExecutionStreamResponse } from "@/lib/cron/stream-response";
import { isTauriMode } from "@/lib/env";
import { AI_PROXY_BASE_URL } from "@/lib/env/constants";
import type { JobExecutionContext } from "@/lib/cron/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const job = await getJob(session.user.id, id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("[ScheduledJobs] GET by ID error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get job" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { id } = await params;

    const updatedJob = await updateJob(session.user.id, id, body);

    return NextResponse.json({ job: updatedJob });
  } catch (error) {
    console.error("[ScheduledJobs] PATCH error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update job",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    await deleteCronJob(session.user.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ScheduledJobs] DELETE error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete job",
      },
      { status: 500 },
    );
  }
}

// POST for actions like execute, enable, disable
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const shouldStream = url.searchParams.get("stream") === "true";
    const { id } = await params;

    // Parse body for execute action
    let body: Record<string, unknown> = {};
    if (action === "execute") {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }

    if (action === "execute") {
      // Manually execute the job
      console.log("[ScheduledJobs] Executing job:", id);
      const job = await getJob(session.user.id, id);
      if (!job) {
        console.error("[ScheduledJobs] Job not found:", id);
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      if (job.lastStatus === "running") {
        return NextResponse.json(
          { error: "Job is already running" },
          { status: 409 },
        );
      }

      console.log("[ScheduledJobs] Job details:", {
        id: job.id,
        name: job.name,
        jobType: job.jobType,
        jobConfig: job.jobConfig,
      });

      // Extract characterId from jobConfig if this job belongs to a character
      let characterIdFromJob: string | undefined;
      try {
        const parsedConfig =
          typeof job.jobConfig === "string"
            ? JSON.parse(job.jobConfig)
            : (job.jobConfig as Record<string, unknown>);
        characterIdFromJob = parsedConfig?.characterId as string | undefined;
      } catch {
        // ignore parse errors
      }

      const context: JobExecutionContext = {
        userId: session.user.id,
        jobId: job.id,
        executionId: crypto.randomUUID(),
        triggeredBy: "manual" as const,
        ...(characterIdFromJob && { characterId: characterIdFromJob }),
        timezone: job.timezone,
        modelConfig: {
          baseUrl: AI_PROXY_BASE_URL,
          ...(body.modelConfig || {}),
        },
      };

      await startJobExecution(context);

      // Serialize jobConfig to string for executeJob
      const jobConfigStr =
        typeof job.jobConfig === "string"
          ? job.jobConfig
          : JSON.stringify(job.jobConfig);

      console.log("[ScheduledJobs] Executing with config:", jobConfigStr);

      // Check if running in Tauri mode (using environment variable)
      const isTauriRequest = isTauriMode();

      console.log("[ScheduledJobs] Request environment:", {
        isTauriRequest,
        deploymentMode: process.env.DEPLOYMENT_MODE,
        isTauri: process.env.IS_TAURI,
      });

      if (shouldStream) {
        const userMessageId = crypto.randomUUID();
        const assistantMessageId = crypto.randomUUID();
        let fallbackMessage = "";
        try {
          const parsedConfig = JSON.parse(jobConfigStr) as { handler?: string };
          fallbackMessage =
            typeof parsedConfig.handler === "string"
              ? parsedConfig.handler
              : "";
        } catch {
          // ignore malformed config, executeJob will handle it
        }
        const messageText = job.description || fallbackMessage;

        return createJobExecutionStreamResponse(async (send) => {
          send({
            type: "execution_start",
            chatId: context.jobId,
            executionId: context.executionId,
            message: messageText,
            userMessageId,
            assistantMessageId,
          });

          try {
            const result = await executeJob(
              context,
              jobConfigStr,
              job.description || undefined,
              {
                userMessageId,
                assistantMessageId,
                onAgentEvent: send,
              },
            );
            await completeJobExecution(context, result);
            send({
              type: "execution_done",
              executionId: context.executionId,
              status: result.status,
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            await completeJobExecution(context, {
              status: "error",
              error: errorMessage,
              output: "",
              duration: 0,
            });
            send({ type: "error", content: errorMessage });
            send({
              type: "execution_done",
              executionId: context.executionId,
              status: "error",
            });
          }
        });
      }

      // Execute job asynchronously - don't wait for completion
      // This allows the UI to update immediately
      console.log("[ScheduledJobs] Starting async execution...");
      executeJob(context, jobConfigStr, job.description || undefined)
        .then(async (result) => {
          console.log(
            "[ScheduledJobs] Execution completed, updating database:",
            {
              executionId: context.executionId,
              status: result.status,
              hasResult: !!result.result,
              hasChatId: !!result.result?.chatId,
            },
          );
          try {
            await completeJobExecution(context, result);
          } catch (dbError) {
            console.error(
              "[ScheduledJobs] Failed to update database:",
              dbError,
            );
          }
        })
        .catch((error) => {
          console.error("[ScheduledJobs] Execution failed:", error);
          // Still mark as completed with error
          completeJobExecution(context, {
            status: "error",
            error: error instanceof Error ? error.message : String(error),
            output: "",
            duration: 0,
          })
            .then(() => {})
            .catch((dbError) => {
              console.error(
                "[ScheduledJobs] Failed to mark as error:",
                dbError,
              );
            });
        });

      // Return immediately with execution ID
      return NextResponse.json({
        success: true,
        executionId: context.executionId,
        jobId: context.jobId,
        message: "Job execution started",
      });
    }

    if (action === "enable") {
      const updatedJob = await toggleJob(session.user.id, id, true);
      return NextResponse.json({ job: updatedJob });
    }

    if (action === "disable") {
      const updatedJob = await toggleJob(session.user.id, id, false);
      return NextResponse.json({ job: updatedJob });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[ScheduledJobs] POST error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to perform action",
      },
      { status: 500 },
    );
  }
}
