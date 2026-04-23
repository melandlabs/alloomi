/**
 * Workspace Sessions Manager
 *
 */

import {
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { promises as fs } from "node:fs";
import { join, dirname, resolve, sep, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { workspaceLogger } from "@/lib/utils/logger";

export const SESSIONS_DIR_NAME = "sessions";
export const TASKS_DIR_NAME = "tasks";

/**
 * Get application data directory
 * macOS/Linux: ~/.alloomi
 * Windows: %USERPROFILE%\.alloomi
 */
export function getAppDataDir(): string {
  const home = homedir();
  return join(home, ".alloomi");
}

/**
 * Get sessions directory path
 */
export function getSessionsDir(): string {
  return join(getAppDataDir(), SESSIONS_DIR_NAME);
}

/**
 * Get session directory for specified task
 */
export function getTaskSessionDir(taskId: string): string {
  return join(getSessionsDir(), taskId);
}

/**
 * Initialize application data directory structure
 */
export function initializeWorkspace(): void {
  const appDataDir = getAppDataDir();
  const sessionsDir = getSessionsDir();

  // Create main directory
  if (!existsSync(appDataDir)) {
    mkdirSync(appDataDir, { recursive: true });
    workspaceLogger.info("Created app data directory", appDataDir);
  }

  // Create sessions directory
  if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
    workspaceLogger.info("Created sessions directory", sessionsDir);
  }
}

/**
 * Create new task session directory
 */
export function createTaskSession(taskId: string): string {
  initializeWorkspace();

  const sessionDir = getTaskSessionDir(taskId);

  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
    workspaceLogger.info("Created task session", sessionDir);
  }

  return sessionDir;
}

/**
 * Check if task session exists
 */
export function hasTaskSession(taskId: string): boolean {
  const sessionDir = getTaskSessionDir(taskId);
  return existsSync(sessionDir);
}

/**
 * Delete task session directory
 */
export function deleteTaskSession(taskId: string): boolean {
  const sessionDir = getTaskSessionDir(taskId);

  if (!existsSync(sessionDir)) {
    return false;
  }

  try {
    rmSync(sessionDir, { recursive: true, force: true });
    workspaceLogger.info("Deleted task session", sessionDir);
    return true;
  } catch (error) {
    workspaceLogger.error("Failed to delete task session:", error);
    return false;
  }
}

/**
 * Get list of files in session directory
 */
export interface SessionFile {
  name: string;
  path: string;
  /** Absolute path to the file (for direct file access like preview) */
  absolutePath?: string;
  size: number;
  isDirectory: boolean;
  modifiedTime: Date;
  type?: string; // File extension (e.g., "html", "js", "css")
}

export function listSessionFiles(
  taskId: string,
  relativePath = "",
): SessionFile[] {
  const sessionDir = getTaskSessionDir(taskId);
  const targetPath = relativePath ? join(sessionDir, relativePath) : sessionDir;

  if (!existsSync(targetPath)) {
    return [];
  }

  const files: SessionFile[] = [];
  const entries = readdirSync(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden files
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = join(targetPath, entry.name);
    const stats = statSync(fullPath);

    // Extract file extension as type
    const ext = entry.name.includes(".")
      ? entry.name.split(".").pop()?.toLowerCase()
      : "";

    files.push({
      name: entry.name,
      path: fullPath,
      size: stats.size,
      isDirectory: entry.isDirectory(),
      modifiedTime: stats.mtime,
      type: entry.isDirectory() ? undefined : ext || undefined,
    });
  }

  // Sort by modification time (newest first)
  return files.sort((a, b) => {
    const timeA = a.modifiedTime?.getTime() ?? 0;
    const timeB = b.modifiedTime?.getTime() ?? 0;
    return timeB - timeA;
  });
}

/**
 * Read session file content (text)
 */
function validatePath(taskId: string, filePath: string): string | null {
  const sessionDir = resolve(getTaskSessionDir(taskId));

  // If filePath is already an absolute path within the session directory, use it directly
  if (isAbsolute(filePath)) {
    const resolved = resolve(filePath);
    if (resolved.startsWith(sessionDir + sep) || resolved === sessionDir) {
      return resolved;
    }
    workspaceLogger.error("Absolute path outside session directory:", filePath);
    return null;
  }

  // Relative path: join with session directory
  const fullPath = resolve(join(sessionDir, filePath));

  // Must be within sessionDir to read
  if (!fullPath.startsWith(sessionDir + sep)) {
    workspaceLogger.error("Path traversal attempt detected:", filePath);
    return null;
  }

  return fullPath;
}

export function readSessionFile(
  taskId: string,
  filePath: string,
): string | null {
  const fullPath = validatePath(taskId, filePath);
  if (!fullPath) {
    return null;
  }

  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const { readFileSync } = require("node:fs");
    return readFileSync(fullPath, "utf-8");
  } catch (error) {
    workspaceLogger.error("Failed to read file:", error);
    return null;
  }
}

/**
 * Read session binary file content
 */
export function readSessionFileBinary(
  taskId: string,
  filePath: string,
): Buffer | null {
  const fullPath = validatePath(taskId, filePath);
  if (!fullPath) {
    return null;
  }

  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const { readFileSync } = require("node:fs");
    return readFileSync(fullPath) as Buffer;
  } catch (error) {
    workspaceLogger.error("Failed to read binary file:", error);
    return null;
  }
}

/**
 * Check if file exists
 */
export function sessionFileExists(taskId: string, filePath: string): boolean {
  const fullPath = join(getTaskSessionDir(taskId), filePath);
  return existsSync(fullPath);
}

/**
 * Get file size
 */
export function getSessionFileSize(
  taskId: string,
  filePath: string,
): number | null {
  const fullPath = join(getTaskSessionDir(taskId), filePath);

  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const { statSync } = require("node:fs");
    const stats = statSync(fullPath);
    return stats.size;
  } catch (error) {
    workspaceLogger.error("Failed to get file size:", error);
    return null;
  }
}

/**
 * Write session file
 */
export function writeSessionFile(
  taskId: string,
  filePath: string,
  content: string,
): boolean {
  const fullPath = join(getTaskSessionDir(taskId), filePath);

  try {
    const { writeFileSync } = require("node:fs");
    const dir = dirname(fullPath);

    // Ensure directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, "utf-8");
    workspaceLogger.debug("Written file", fullPath);
    return true;
  } catch (error) {
    workspaceLogger.error("Failed to write file:", error);
    return false;
  }
}

/**
 * Delete a single session file safely within the session directory boundary.
 */
export function deleteSessionFile(taskId: string, filePath: string): boolean {
  const fullPath = validatePath(taskId, filePath);
  if (!fullPath) {
    return false;
  }

  if (!existsSync(fullPath)) {
    return false;
  }

  try {
    const stats = statSync(fullPath);
    if (!stats.isFile()) {
      return false;
    }
    unlinkSync(fullPath);
    workspaceLogger.debug("Deleted file", fullPath);
    return true;
  } catch (error) {
    workspaceLogger.error("Failed to delete file:", error);
    return false;
  }
}

/**
 * Get session directory size
 */
export function getSessionSize(taskId: string): number {
  const sessionDir = getTaskSessionDir(taskId);

  if (!existsSync(sessionDir)) {
    return 0;
  }

  let totalSize = 0;

  function calculateSize(dirPath: string) {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const stats = statSync(fullPath);

      if (entry.isDirectory()) {
        calculateSize(fullPath);
      } else {
        totalSize += stats.size;
      }
    }
  }

  try {
    calculateSize(sessionDir);
  } catch (error) {
    workspaceLogger.error("Failed to calculate size:", error);
  }

  return totalSize;
}

/**
 * List all sessions
 */
export function listAllSessions(): string[] {
  const sessionsDir = getSessionsDir();

  if (!existsSync(sessionsDir)) {
    return [];
  }

  try {
    const entries = readdirSync(sessionsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    workspaceLogger.error("Failed to list sessions:", error);
    return [];
  }
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Recursively get all files in session directory (including subdirectories)
 * Returns flat file list for building file tree
 */
export function getAllFilesRecursive(taskId: string): SessionFile[] {
  const sessionDir = getTaskSessionDir(taskId);

  if (!existsSync(sessionDir)) {
    return [];
  }

  const allFiles: SessionFile[] = [];

  function traverseDir(currentPath: string, relativePath: string) {
    const entries = readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files
      if (entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = join(currentPath, entry.name);
      const fileRelativePath = relativePath
        ? join(relativePath, entry.name)
        : entry.name;
      const stats = statSync(fullPath);

      // Extract file extension as type
      const ext = entry.name.includes(".")
        ? entry.name.split(".").pop()?.toLowerCase()
        : "";

      allFiles.push({
        name: entry.name,
        path: fileRelativePath, // Use relative path (relative to task session directory)
        absolutePath: fullPath, // Absolute path for direct file access
        size: stats.size,
        isDirectory: entry.isDirectory(),
        modifiedTime: stats.mtime,
        type: entry.isDirectory() ? undefined : ext || undefined,
      });

      // If directory, recursively traverse
      if (entry.isDirectory()) {
        traverseDir(fullPath, fileRelativePath);
      }
    }
  }

  try {
    traverseDir(sessionDir, "");
  } catch (error) {
    workspaceLogger.error("Failed to traverse directory:", error);
  }

  // Sort by modification time (newest first)
  return allFiles.sort((a, b) => {
    const timeA = a.modifiedTime?.getTime() ?? 0;
    const timeB = b.modifiedTime?.getTime() ?? 0;
    return timeB - timeA;
  });
}

/**
 * Recursively get all files in a given absolute session directory path.
 * Used when the session directory is known (e.g., from execution result)
 * rather than being derived from taskId.
 */
export function getAllFilesAtPath(sessionDir: string): SessionFile[] {
  if (!existsSync(sessionDir)) {
    return [];
  }

  const allFiles: SessionFile[] = [];

  function traverseDir(currentPath: string, relativePath: string) {
    const entries = readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = join(currentPath, entry.name);
      const fileRelativePath = relativePath
        ? join(relativePath, entry.name)
        : entry.name;
      const stats = statSync(fullPath);

      const ext = entry.name.includes(".")
        ? entry.name.split(".").pop()?.toLowerCase()
        : "";

      allFiles.push({
        name: entry.name,
        path: fileRelativePath,
        // Store absolute path for direct file access (preview, etc.)
        absolutePath: join(sessionDir, fileRelativePath),
        size: stats.size,
        isDirectory: entry.isDirectory(),
        modifiedTime: stats.mtime,
        type: entry.isDirectory() ? undefined : ext || undefined,
      });

      if (entry.isDirectory()) {
        traverseDir(fullPath, fileRelativePath);
      }
    }
  }

  try {
    traverseDir(sessionDir, "");
  } catch (error) {
    workspaceLogger.error("Failed to traverse directory:", error);
  }

  return allFiles.sort((a, b) => {
    const timeA = a.modifiedTime?.getTime() ?? 0;
    const timeB = b.modifiedTime?.getTime() ?? 0;
    return timeB - timeA;
  });
}

/**
 * Workspace-level file item (includes taskId, path is relative to that task session directory, for use with readSessionFile)
 */
export interface WorkspaceFileItem {
  taskId: string;
  name: string;
  path: string;
  type?: string;
  size?: number;
  isDirectory?: boolean;
  /** Modification time, for grouping/sorting by time */
  modifiedTime?: string;
}

/**
 * Recursively list all files in all sessions in the workspace
 * Used for scenarios like "add file from workspace" that require searching the entire workspace
 * @param taskIdFilter - Optional set of task IDs to limit traversal to (for performance)
 * @returns Flat list, each item includes taskId and path relative to that task directory
 */
export async function getAllWorkspaceFilesRecursive(
  taskIdFilter?: Set<string>,
): Promise<WorkspaceFileItem[]> {
  const allTaskIds = listAllSessions();
  const taskIds = taskIdFilter
    ? allTaskIds.filter((id) => taskIdFilter.has(id))
    : allTaskIds;

  const skipDirs = new Set([
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".next",
    ".nuxt",
    ".cache",
    "dist",
    "build",
    ".venv",
    "venv",
    "vendor",
    "target",
  ]);

  // Process sessions in parallel
  const sessionResults = await Promise.all(
    taskIds.map(async (taskId) => {
      const sessionDir = getTaskSessionDir(taskId);
      if (!existsSync(sessionDir)) return [];

      const files: WorkspaceFileItem[] = [];
      await traverseDir(sessionDir, "", taskId, files);
      return files;
    }),
  );

  const result = sessionResults.flat();

  return result.sort((a, b) => {
    const taskCmp = a.taskId.localeCompare(b.taskId);
    if (taskCmp !== 0) return taskCmp;
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  async function traverseDir(
    currentPath: string,
    relativePath: string,
    taskId: string,
    files: WorkspaceFileItem[],
  ) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      // Process entries in parallel: stat all files, then recurse directories
      const fileInfos = await Promise.all(
        entries
          .filter((e) => !e.name.startsWith("."))
          .filter((e) => !e.isDirectory() || !skipDirs.has(e.name))
          .map(async (entry) => {
            const fullPath = join(currentPath, entry.name);
            const fileRelativePath = relativePath
              ? join(relativePath, entry.name)
              : entry.name;
            const stats = await fs.stat(fullPath);
            const ext = entry.name.includes(".")
              ? entry.name.split(".").pop()?.toLowerCase()
              : "";
            return { entry, fullPath, fileRelativePath, stats, ext };
          }),
      );

      for (const {
        entry,
        fullPath,
        fileRelativePath,
        stats,
        ext,
      } of fileInfos) {
        files.push({
          taskId,
          name: entry.name,
          path: fileRelativePath,
          type: entry.isDirectory() ? undefined : ext || undefined,
          size: stats.size,
          isDirectory: entry.isDirectory(),
          modifiedTime: stats.mtime.toISOString(),
        });

        if (entry.isDirectory()) {
          await traverseDir(fullPath, fileRelativePath, taskId, files);
        }
      }
    } catch (err) {
      workspaceLogger.error("Failed to traverse session", { taskId, err });
    }
  }
}
