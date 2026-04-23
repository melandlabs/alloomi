import { type NextRequest, NextResponse } from "next/server";
import {
  cleanLogs,
  deleteAllSessions,
  cleanBrowserTemp,
} from "@/lib/files/workspace/disk-usage";
import { getAppDir } from "@/lib/env/config/constants";
import fs from "node:fs";
import path from "node:path";

function deleteAllOfCategory(category: string): number {
  const home = getAppDir();

  switch (category) {
    case "logs": {
      const logsDir = path.join(home, "logs");
      const dataLogsDir = path.join(home, "data", "logs");
      let count = 0;
      for (const dir of [logsDir, dataLogsDir]) {
        if (!fs.existsSync(dir)) continue;
        try {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            try {
              if (fs.statSync(fullPath).isFile()) {
                fs.unlinkSync(fullPath);
                count++;
              }
            } catch {
              // skip
            }
          }
        } catch {
          // skip
        }
      }
      return count;
    }
    case "sessions": {
      return deleteAllSessions();
    }
    case "cache": {
      const cacheDir = path.join(home, "data", "memory");
      if (!fs.existsSync(cacheDir)) return 0;
      let count = 0;
      try {
        const entries = fs.readdirSync(cacheDir);
        for (const entry of entries) {
          fs.rmSync(path.join(cacheDir, entry), {
            recursive: true,
            force: true,
          });
          count++;
        }
      } catch {
        return 0;
      }
      return count;
    }
    default:
      return 0;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { category } = body as { category?: string };

    if (!category) {
      return NextResponse.json(
        { error: "category is required" },
        { status: 400 },
      );
    }

    const validCategories = ["sessions", "logs", "cache", "browser-temp"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (category === "logs") {
      cleanLogs(0);
    }

    if (category === "browser-temp") {
      const deleted = cleanBrowserTemp();
      return NextResponse.json({ category, deleted });
    }

    const deleted = deleteAllOfCategory(category);
    return NextResponse.json({ category, deleted });
  } catch (err) {
    console.error("[cleanup] POST error:", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
