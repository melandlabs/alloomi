/**
 * Filesystem Sync Layer
 *
 * In Tauri environment, sync operations to filesystem (data/memory/)
 * This allows Native Agent's Read/Write/Edit tools to directly operate on these files
 *
 * Directory structure:
 * data/memory/
 *   ├── people/       # Person information
 *   ├── projects/     # Project documents
 *   ├── notes/        # Notes
 *   └── strategy/     # Strategy documents
 */

import { isTauriMode } from "@/lib/env";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAppDataDir, joinPath } from "@/lib/utils/path";

/**
 * Get filesystem path of memory directory
 * Consistent with Rust-side get_data_dir() logic
 */
export async function getMemoryFsPath(): Promise<string> {
  if (!isTauriMode()) {
    throw new Error("Filesystem sync is only available in Tauri mode");
  }

  // Same logic as Rust side: <appDataDir>/data/memory
  const memoryPath = joinPath(getAppDataDir(), "data", "memory");
  return memoryPath;
}

/**
 * Create filesystem directory
 */
export async function createDirectory(fsPath: string): Promise<void> {
  if (!isTauriMode()) return;
  await fs.promises.mkdir(fsPath, { recursive: true });
}

/**
 * Write file to filesystem
 */
export async function writeFile(
  fsPath: string,
  content: string,
): Promise<void> {
  if (!isTauriMode()) return;
  // Ensure parent directory exists
  const dirPath = path.dirname(fsPath);
  await createDirectory(dirPath);

  await fs.promises.writeFile(fsPath, content, "utf-8");
}
