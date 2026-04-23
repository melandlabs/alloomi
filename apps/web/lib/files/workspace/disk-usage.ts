import fs from "node:fs";
import path from "node:path";
import { getAppDir } from "@/lib/env/config/constants";

export interface DiskCategory {
  key: string;
  label: string;
  sizeBytes: number;
}

export interface DiskUsageOverview {
  totalBytes: number;
  categories: DiskCategory[];
}

export interface SessionInfo {
  taskId: string;
  sizeBytes: number;
  modifiedTime: string;
}

/** Recursively calculate directory size in bytes (does not follow symlinks) */
export function getDirectorySize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  try {
    const lstats = fs.lstatSync(dir);
    if (lstats.isFile()) return lstats.size;

    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      try {
        const s = fs.lstatSync(fullPath);
        // Skip symlinks to avoid counting linked content multiple times
        if (s.isSymbolicLink()) continue;
        if (s.isDirectory()) {
          total += getDirectorySize(fullPath);
        } else {
          total += s.size;
        }
      } catch {
        // skip inaccessible files
      }
    }
  } catch {
    return 0;
  }
  return total;
}

function getSessionModifiedTime(sessionPath: string): string {
  try {
    const stat = fs.statSync(sessionPath);
    return stat.mtime.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

/** List all sessions with their sizes and modification times */
export function listSessionsWithSizes(): SessionInfo[] {
  const sessionsDir = path.join(getAppDir(), "sessions");
  if (!fs.existsSync(sessionsDir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((e) => e.isDirectory())
    .map((e) => {
      const sessionPath = path.join(sessionsDir, e.name);
      return {
        taskId: e.name,
        sizeBytes: getDirectorySize(sessionPath),
        modifiedTime: getSessionModifiedTime(sessionPath),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime(),
    );
}

/** Delete a single session by taskId */
export function deleteSession(taskId: string): boolean {
  const sessionPath = path.join(getAppDir(), "sessions", taskId);
  if (!fs.existsSync(sessionPath)) return false;
  try {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/** Delete sessions older than N days */
export function deleteSessionsOlderThan(days: number): number {
  const sessions = listSessionsWithSizes();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const s of sessions) {
    if (new Date(s.modifiedTime).getTime() < cutoff) {
      if (deleteSession(s.taskId)) count++;
    }
  }
  return count;
}

/** Delete all sessions */
export function deleteAllSessions(): number {
  const sessions = listSessionsWithSizes();
  let count = 0;
  for (const s of sessions) {
    if (deleteSession(s.taskId)) count++;
  }
  return count;
}

/** Clean browser temp directories from all sessions (e.g. chrome-temp-profile) */
export function cleanBrowserTemp(): number {
  const sessionsDir = path.join(getAppDir(), "sessions");
  if (!fs.existsSync(sessionsDir)) return 0;

  let count = 0;
  const browserTempPatterns = ["chrome-temp-profile", "puppeteer-"];

  let entries: string[];
  try {
    entries = fs.readdirSync(sessionsDir);
  } catch {
    return 0;
  }

  for (const taskId of entries) {
    const sessionPath = path.join(sessionsDir, taskId);
    if (!fs.existsSync(sessionPath)) continue;

    let sessionEntries: string[];
    try {
      sessionEntries = fs.readdirSync(sessionPath);
    } catch {
      continue;
    }

    for (const entry of sessionEntries) {
      const isBrowserTemp = browserTempPatterns.some(
        (p) => entry.startsWith(p) || entry.includes("temp-profile"),
      );
      if (!isBrowserTemp) continue;

      const fullPath = path.join(sessionPath, entry);
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        count++;
      } catch {
        // skip
      }
    }
  }
  return count;
}

/** Clean log files older than N days (default 7) */
export function cleanLogs(olderThanDays = 7): number {
  const logsDir = path.join(getAppDir(), "logs");
  const dataLogsDir = path.join(getAppDir(), "data", "logs");
  let count = 0;
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  for (const dir of [logsDir, dataLogsDir]) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && stat.mtimeMs < cutoff) {
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

/** Get disk usage overview for all categories */
export function getDiskUsageOverview(): DiskUsageOverview {
  const home = getAppDir();

  const sessionsDir = path.join(home, "sessions");
  const logsDir = path.join(home, "logs");
  const dataDir = path.join(home, "data");
  const skillsDir = path.join(home, "skills");
  const agentBrowserDir = path.join(skillsDir, "agent-browser");

  const cacheDir = path.join(dataDir, "memory");
  const storageDir = path.join(dataDir, "storage");
  const databaseFile = path.join(dataDir, "data.db");

  const categories: DiskCategory[] = [
    {
      key: "sessions",
      label: "Sessions",
      sizeBytes: getDirectorySize(sessionsDir),
    },
    {
      key: "logs",
      label: "Logs",
      sizeBytes:
        getDirectorySize(logsDir) +
        getDirectorySize(path.join(dataDir, "logs")),
    },
    {
      key: "cache",
      label: "Cache",
      sizeBytes: getDirectorySize(cacheDir),
    },
    {
      key: "storage",
      label: "Storage",
      sizeBytes: getDirectorySize(storageDir),
    },
    {
      key: "database",
      label: "Database",
      sizeBytes: fs.existsSync(databaseFile)
        ? fs.statSync(databaseFile).size
        : 0,
    },
    {
      key: "skills",
      label: "Skills",
      sizeBytes: getDirectorySize(skillsDir),
    },
    {
      key: "agent-browser",
      label: "Agent Browser",
      sizeBytes: getDirectorySize(agentBrowserDir),
    },
  ];

  const totalBytes = categories.reduce((sum, c) => sum + c.sizeBytes, 0);

  return { totalBytes, categories };
}
