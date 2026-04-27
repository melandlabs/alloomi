"use client";

import { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ArchiveEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  children?: ArchiveEntry[];
}

export interface ArchivePreviewProps {
  /** Archive file URL (blob URL, file path, or HTTP URL) */
  src: string;
  /** Archive file name */
  filename?: string;
  /** Optional className */
  className?: string;
  /** Callback when a file inside the archive is clicked for preview */
  onFileClick?: (entry: ArchiveEntry, blob: Blob) => void;
  /** Supported preview extensions for files inside archive */
  supportedPreviewExtensions?: string[];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function getFileIcon(entry: ArchiveEntry): string {
  if (entry.isDirectory) return "folder";
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    // Images
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    svg: "image",
    webp: "image",
    bmp: "image",
    // Documents
    pdf: "file_text",
    doc: "file_type",
    docx: "file_type",
    txt: "file_text",
    md: "code",
    // Spreadsheets
    xls: "file_spreadsheet",
    xlsx: "file_spreadsheet",
    csv: "file_spreadsheet",
    // Code
    js: "code",
    ts: "code",
    py: "code",
    html: "code",
    css: "code",
    json: "code",
    // Video
    mp4: "video",
    webm: "video",
    mov: "video",
    // Audio
    mp3: "music_2",
    wav: "music_2",
    flac: "music_2",
    // Archives
    zip: "file_archive",
    rar: "file_archive",
    "7z": "file_archive",
    tar: "file_archive",
    gz: "file_archive",
  };
  return iconMap[ext] || "file";
}

function buildFileTree(
  entries: (JSZip.JSZipObject & { _data?: { uncompressedSize?: number } })[],
): ArchiveEntry[] {
  const root: ArchiveEntry[] = [];
  const pathMap = new Map<string, ArchiveEntry>();

  // Sort entries by name (path)
  const sortedEntries = [...entries].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const entry of sortedEntries) {
    const pathParts = entry.name.split("/").filter(Boolean);
    const name = pathParts[pathParts.length - 1] || entry.name;
    const isDirectory = entry.dir;

    // Access internal _data for size (JSZip doesn't expose this publicly)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entryAny = entry as any;
    const uncompressedSize = entryAny._data?.uncompressedSize || 0;

    const currentEntry: ArchiveEntry = {
      name,
      path: entry.name,
      size: isDirectory ? 0 : uncompressedSize,
      isDirectory,
      children: [],
    };

    if (pathParts.length === 1) {
      // Root level entry
      root.push(currentEntry);
      pathMap.set(entry.name, currentEntry);
    } else {
      // Nested entry - find parent
      const parentPath = pathParts.slice(0, -1).join("/");
      let parent = pathMap.get(parentPath);

      if (!parent) {
        // Create missing parent directories
        for (let i = 0; i < pathParts.length - 1; i++) {
          const partialPath = pathParts.slice(0, i + 1).join("/");
          const partialName = pathParts[i];

          if (!pathMap.has(partialPath)) {
            const dirEntry: ArchiveEntry = {
              name: partialName,
              path: partialPath,
              size: 0,
              isDirectory: true,
              children: [],
            };

            if (i === 0) {
              root.push(dirEntry);
            } else {
              const parentPartialPath = pathParts.slice(0, i).join("/");
              const parentDir = pathMap.get(parentPartialPath);
              parentDir?.children?.push(dirEntry);
            }
            pathMap.set(partialPath, dirEntry);
          }
          parent = pathMap.get(partialPath);
        }
      }

      parent?.children?.push(currentEntry);
      pathMap.set(entry.name, currentEntry);
    }
  }

  // Sort children: directories first, then by name
  const sortEntries = (entries: ArchiveEntry[]): ArchiveEntry[] => {
    entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      if (entry.children) {
        sortEntries(entry.children);
      }
    }
    return entries;
  };

  return sortEntries(root);
}

interface ArchiveEntryRowProps {
  entry: ArchiveEntry;
  depth: number;
  onClick: (entry: ArchiveEntry) => void;
  isExpandable: boolean;
}

function ArchiveEntryRow({
  entry,
  depth,
  onClick,
  isExpandable,
}: ArchiveEntryRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleClick = () => {
    if (entry.isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onClick(entry);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 cursor-pointer rounded-md group",
          depth === 0 ? "" : "",
        )}
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleClick();
          }
        }}
      >
        {entry.isDirectory ? (
          <RemixIcon
            name={isExpanded ? "folder_open" : "folder"}
            size="size-4"
            className="text-yellow-600 dark:text-yellow-400 flex-shrink-0"
          />
        ) : (
          <RemixIcon
            name={getFileIcon(entry)}
            size="size-4"
            className="text-muted-foreground flex-shrink-0"
          />
        )}
        <span
          className={cn(
            "truncate flex-1 text-sm",
            entry.isDirectory ? "font-medium" : "",
          )}
        >
          {entry.name}
        </span>
        {!entry.isDirectory && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatFileSize(entry.size)}
          </span>
        )}
        {!entry.isDirectory && (
          <RemixIcon
            name="download"
            size="size-3"
            className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          />
        )}
      </div>
      {entry.isDirectory && isExpanded && entry.children && (
        <div>
          {entry.children.map((child, idx) => (
            <ArchiveEntryRow
              key={`${child.path}-${idx}`}
              entry={child}
              depth={depth + 1}
              onClick={onClick}
              isExpandable={child.isDirectory || false}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Archive preview component using jszip
 * Supports: zip, rar, 7z, tar, gz
 */
export function ArchivePreview({
  src,
  filename,
  className,
  onFileClick,
  supportedPreviewExtensions = [
    "pdf",
    "doc",
    "docx",
    "txt",
    "md",
    "xls",
    "xlsx",
    "csv",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "svg",
    "webp",
    "mp4",
    "webm",
    "mov",
    "mp3",
    "wav",
    "flac",
    "py",
    "js",
    "ts",
    "tsx",
    "jsx",
    "css",
    "json",
    "html",
  ],
}: ArchivePreviewProps) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState(0);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    const loadArchive = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error("Failed to fetch archive");
        }
        const arrayBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const zipEntries: (JSZip.JSZipObject & {
          _data?: { uncompressedSize?: number };
        })[] = [];
        let total = 0;
        let count = 0;

        zip.forEach((relativePath, entry) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entryAny = entry as any;
          if (!entry.dir) {
            total += entryAny._data?.uncompressedSize || 0;
            count++;
          }
          zipEntries.push(entryAny);
        });

        const tree = buildFileTree(zipEntries);
        setEntries(tree);
        setTotalSize(total);
        setFileCount(count);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load archive");
      } finally {
        setIsLoading(false);
      }
    };

    if (src) {
      void loadArchive();
    }
  }, [src]);

  const handleFileClick = useCallback(
    async (entry: ArchiveEntry) => {
      if (!onFileClick) return;

      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const fileEntry = zip.file(entry.path);

        if (fileEntry) {
          const blob = await fileEntry.async("blob");
          onFileClick(entry, blob);
        }
      } catch (err) {
        console.error("Failed to extract file from archive:", err);
      }
    },
    [src, onFileClick],
  );

  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 text-center bg-neutral-50 dark:bg-neutral-900 rounded-lg",
          className,
        )}
      >
        <RemixIcon
          name="file_archive"
          size="size-12"
          className="text-neutral-400 mb-4"
        />
        <p className="text-neutral-600 dark:text-neutral-300 font-medium mb-2">
          {error}
        </p>
        {filename && <p className="text-neutral-500 text-sm">{filename}</p>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-neutral-50 dark:bg-neutral-900 rounded-lg overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <RemixIcon
          name="file_archive"
          size="size-6"
          className="text-neutral-400"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{filename || "Archive"}</p>
          <p className="text-xs text-muted-foreground">
            {fileCount} files, {formatFileSize(totalSize)}
          </p>
        </div>
      </div>

      {/* File list */}
      <ScrollArea className="flex-1 max-h-96">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RemixIcon
              name="loader_2"
              size="size-6"
              className="animate-spin text-muted-foreground"
            />
          </div>
        ) : entries.length > 0 ? (
          <div className="p-2">
            {entries.map((entry, idx) => (
              <ArchiveEntryRow
                key={`${entry.path}-${idx}`}
                entry={entry}
                depth={0}
                onClick={handleFileClick}
                isExpandable={entry.isDirectory}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <p className="text-sm">Empty archive</p>
          </div>
        )}
      </ScrollArea>

      {/* Supported formats hint */}
      {onFileClick && (
        <div className="p-3 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Click on a supported file to preview:{" "}
            {supportedPreviewExtensions.slice(0, 10).join(", ")}...
          </p>
        </div>
      )}
    </div>
  );
}
