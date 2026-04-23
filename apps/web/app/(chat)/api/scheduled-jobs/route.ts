/**
 * Scheduled Jobs API
 * GET /api/scheduled-jobs - List all jobs
 * POST /api/scheduled-jobs - Create a new job
 */

import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { listJobs, createJob } from "@/lib/cron/service";
import type { ScheduleConfig, JobConfig } from "@/lib/cron/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const includeDisabled = url.searchParams.get("includeDisabled") === "true";
    const view = (url.searchParams.get("view") || "all") as
      | "all"
      | "active"
      | "executed";

    const jobs = await listJobs(session.user.id, { includeDisabled, view });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("[ScheduledJobs] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list jobs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (!body.schedule || typeof body.schedule !== "object") {
      return NextResponse.json(
        { error: "schedule is required" },
        { status: 400 },
      );
    }

    if (!body.job || typeof body.job !== "object") {
      return NextResponse.json({ error: "job is required" }, { status: 400 });
    }

    // Validate schedule
    const validScheduleTypes = [
      "cron",
      "interval",
      "interval-hours",
      "interval-minutes",
      "once",
    ];
    if (
      !body.schedule.type ||
      !validScheduleTypes.includes(body.schedule.type)
    ) {
      return NextResponse.json(
        {
          error: `schedule.type must be one of: ${validScheduleTypes.join(", ")}`,
        },
        { status: 400 },
      );
    }

    let schedule: ScheduleConfig;

    if (body.schedule.type === "cron") {
      schedule = {
        type: "cron",
        expression: body.schedule.expression,
        timezone: body.schedule.timezone,
      };
    } else if (body.schedule.type === "interval-hours") {
      schedule = {
        type: "interval-hours",
        hours: body.schedule.hours,
      };
    } else if (body.schedule.type === "interval-minutes") {
      schedule = {
        type: "interval-minutes",
        minutes: body.schedule.minutes,
      };
    } else if (body.schedule.type === "interval") {
      schedule = {
        type: "interval",
        minutes: body.schedule.minutes,
      };
    } else {
      schedule = {
        type: "once",
        at: new Date(body.schedule.at),
      };
    }

    // Validate job config
    const validJobTypes = ["agent", "webhook", "insight_refresh", "custom"];
    if (!body.job.type || !validJobTypes.includes(body.job.type)) {
      return NextResponse.json(
        { error: `job.type must be one of: ${validJobTypes.join(", ")}` },
        { status: 400 },
      );
    }

    const job: JobConfig = {
      ...(body.job as JobConfig),
      modelConfig: body.modelConfig,
    };

    const createdJob = await createJob(session.user.id, {
      name: body.name,
      description: body.description,
      schedule,
      job,
      enabled: body.enabled,
      timezone: body.timezone,
    });

    return NextResponse.json({ job: createdJob }, { status: 201 });
  } catch (error) {
    console.error("[ScheduledJobs] POST error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create job",
      },
      { status: 500 },
    );
  }
}
