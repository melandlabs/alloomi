/**
 * Local file system storage adapter
 * Used for local storage
 */

import { existsSync, mkdirSync } from "node:fs";
import {
  writeFile,
  unlink as unlinkCb,
  readdir,
  stat,
  readFile,
} from "node:fs";
import { promisify } from "node:util";
import { join, relative } from "node:path";

const writeFileAsync = promisify(writeFile);
const unlinkAsync = promisify(unlinkCb);
const readdirAsync = promisify(readdir);
const statAsync = promisify(stat);
const readFileAsync = promisify(readFile);

export type LocalUploadResult = {
  url: string;
  pathname: string;
  downloadUrl?: string;
};

export type LocalFileMeta = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
};

/**
 * Upload file to local file system
 */
export async function uploadToLocalFs(
  pathname: string,
  data: ArrayBuffer | Buffer,
  _contentType: string, // Kept for interface consistency, but not used for local file system
  storageBasePath: string,
): Promise<LocalUploadResult> {
  const fullPath = join(storageBasePath, pathname);

  // Ensure directory exists
  const dir = join(fullPath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write file
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await writeFileAsync(fullPath, buffer);

  // Generate local access URL (using proxy API)
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(pathname)}`;

  return {
    url: downloadUrl,
    pathname,
    downloadUrl,
  };
}

/**
 * Delete file from local file system
 */
export async function deleteFromLocalFs(
  pathname: string,
  storageBasePath: string,
): Promise<void> {
  const fullPath = join(storageBasePath, pathname);

  if (existsSync(fullPath)) {
    await unlinkAsync(fullPath);
  }
}

/**
 * List files in local file system
 */
export async function listLocalFiles(
  storageBasePath: string,
  prefix?: string,
): Promise<LocalFileMeta[]> {
  const searchPath = prefix ? join(storageBasePath, prefix) : storageBasePath;

  if (!existsSync(searchPath)) {
    return [];
  }

  const files: LocalFileMeta[] = [];
  const entries = await readdirAsync(searchPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Recursively process subdirectories
      const subPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      const subFiles = await listLocalFiles(storageBasePath, subPrefix);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const fullPath = join(searchPath, entry.name);
      const stats = await statAsync(fullPath);
      const relativePath = relative(storageBasePath, fullPath);

      files.push({
        url: `/api/files/download?path=${encodeURIComponent(relativePath)}`,
        pathname: relativePath,
        size: stats.size,
        uploadedAt: stats.mtime,
      });
    }
  }

  return files;
}

/**
 * Read local file
 */
export async function readLocalFile(
  pathname: string,
  storageBasePath: string,
): Promise<Buffer> {
  const fullPath = join(storageBasePath, pathname);

  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${pathname}`);
  }

  // Explicitly pass encoding: null to ensure we get a Buffer, not a string
  return await readFileAsync(fullPath, null);
}

/**
 * Check if local file exists
 */
export function localFileExists(
  pathname: string,
  storageBasePath: string,
): boolean {
  const fullPath = join(storageBasePath, pathname);
  return existsSync(fullPath);
}
