"use client";

import { useMemo, lazy, Suspense } from "react";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { injectHtmlPreviewScrollFix } from "@/lib/files/html-preview-scroll-fix";

// Bundle optimization: Dynamically import large preview components
const CodePreview = lazy(() =>
  import("./code-preview").then((mod) => ({ default: mod.CodePreview })),
);
const PptxPreview = lazy(() =>
  import("./pptx-preview").then((mod) => ({ default: mod.PptxPreview })),
);
const DocxPreview = lazy(() =>
  import("./docx-preview").then((mod) => ({ default: mod.DocxPreview })),
);
const SpreadsheetPreview = lazy(() =>
  import("./spreadsheet-preview").then((mod) => ({
    default: mod.SpreadsheetPreview,
  })),
);
const CsvPreview = lazy(() =>
  import("./csv-preview").then((mod) => ({ default: mod.CsvPreview })),
);
const PdfPreview = lazy(() =>
  import("./pdf-preview").then((mod) => ({ default: mod.PdfPreview })),
);
const MarkdownPreview = lazy(() =>
  import("../markdown-preview").then((mod) => ({
    default: mod.MarkdownPreview,
  })),
);

export type ArtifactType =
  | "code"
  | "html"
  | "markdown"
  | "text"
  | "image"
  | "pdf"
  | "document"
  | "presentation"
  | "spreadsheet"
  | "video"
  | "audio"
  | "unknown";

export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  content?: string;
  path?: string;
  url?: string;
  fileSize?: number;
}

interface ArtifactPreviewProps {
  artifact: Artifact;
  className?: string;
  maxHeight?: string;
}

/**
 * Mapping from file extension to Artifact type
 */
const EXTENSION_MAP: Record<string, ArtifactType> = {
  // Code files
  js: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  py: "code",
  rb: "code",
  go: "code",
  rs: "code",
  java: "code",
  cpp: "code",
  c: "code",
  cs: "code",
  php: "code",
  sh: "code",
  bash: "code",

  // Web files
  html: "html",
  htm: "html",
  css: "code",
  scss: "code",
  json: "code",
  xml: "code",
  yaml: "code",
  yml: "code",

  // Document files
  md: "markdown",
  markdown: "markdown",
  txt: "text",
  pdf: "pdf",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",

  // Presentations
  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation",

  // Spreadsheets
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  csv: "spreadsheet",
  ods: "spreadsheet",

  // Media files
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  svg: "image",
  webp: "image",
  bmp: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  avi: "video",
  mkv: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  aac: "audio",
};

/**
 * Infer Artifact type from filename
 */
function getArtifactType(filename: string): ArtifactType {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return "unknown";

  return EXTENSION_MAP[ext] || "unknown";
}

/**
 * Get file icon name (RemixIcon name)
 */
function getFileIconName(type: ArtifactType): string {
  switch (type) {
    case "code":
    case "html":
    case "markdown":
    case "text":
    case "document":
      return "file_text";
    case "spreadsheet":
      return "table";
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "music_2";
    default:
      return "file_present";
  }
}

/**
 * Format file size
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return "";

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
 * Artifact preview component
 *
 * Automatically selects the appropriate preview method based on file type
 */
export function ArtifactPreview({
  artifact,
  className,
  maxHeight,
}: ArtifactPreviewProps) {
  const { type, name, content, path, url, fileSize } = artifact;

  // Auto infer type (if not specified)
  const inferredType = useMemo(() => {
    const inferred = type !== "unknown" ? type : getArtifactType(name);
    console.log("[ArtifactPreview] Type inference:", {
      name,
      originalType: type,
      inferredType: inferred,
      hasContent: !!content,
    });
    return inferred;
  }, [type, name]);

  const fileIconName = getFileIconName(inferredType);

  // Code/text preview
  if (inferredType === "code" || inferredType === "text") {
    if (!content) {
      return (
        <div
          className={cn(
            "flex items-center gap-3 p-4 rounded-lg bg-muted",
            className,
          )}
        >
          <RemixIcon
            name={fileIconName}
            size="size-8"
            className="text-muted-foreground"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{name}</p>
            {fileSize && (
              <p className="text-sm text-muted-foreground">
                {formatFileSize(fileSize)}
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={cn("rounded-lg overflow-hidden border", className)}>
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
          <span className="font-medium text-sm truncate">{name}</span>
          {fileSize && (
            <span className="text-xs text-muted-foreground ml-2">
              {formatFileSize(fileSize)}
            </span>
          )}
        </div>
        <Suspense
          fallback={
            <div className="p-4 flex items-center justify-center">
              <RemixIcon
                name="loader_2"
                size="size-5"
                className="animate-spin"
              />
            </div>
          }
        >
          <CodePreview code={content} filename={name} maxHeight={maxHeight} />
        </Suspense>
      </div>
    );
  }

  // Markdown preview (special handling: supports preview and source toggle)
  if (inferredType === "markdown") {
    if (!content) {
      return (
        <div
          className={cn(
            "flex items-center gap-3 p-4 rounded-lg bg-muted",
            className,
          )}
        >
          <RemixIcon
            name={fileIconName}
            size="size-8"
            className="text-muted-foreground"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{name}</p>
            {fileSize && (
              <p className="text-sm text-muted-foreground">
                {formatFileSize(fileSize)}
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={cn("rounded-lg overflow-hidden border", className)}>
        <Suspense
          fallback={
            <div className="p-4 flex items-center justify-center">
              <RemixIcon
                name="loader_2"
                size="size-5"
                className="animate-spin"
              />
            </div>
          }
        >
          <MarkdownPreview content={content} filename={name} filePath={path} />
        </Suspense>
      </div>
    );
  }

  // HTML preview (iframe)
  if (inferredType === "html" && content) {
    return (
      <div className={cn("rounded-lg overflow-hidden border", className)}>
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
          <span className="font-medium text-sm">{name}</span>
        </div>
        <iframe
          srcDoc={injectHtmlPreviewScrollFix(content)}
          className="w-full bg-white"
          style={{ maxHeight }}
          sandbox="allow-same-origin"
          title={name}
        />
      </div>
    );
  }

  // Word document preview
  if (inferredType === "document") {
    const fileSource = path || url || "";

    return (
      <div className={cn("rounded-lg overflow-hidden border", className)}>
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
          <span className="font-medium text-sm">{name}</span>
          {fileSize && (
            <span className="text-xs text-muted-foreground ml-2">
              {formatFileSize(fileSize)}
            </span>
          )}
        </div>
        <Suspense
          fallback={
            <div className="p-4 flex items-center justify-center">
              <RemixIcon
                name="loader_2"
                size="size-5"
                className="animate-spin"
              />
            </div>
          }
        >
          <DocxPreview
            artifact={{ path: fileSource, name: name || "document" }}
          />
        </Suspense>
      </div>
    );
  }

  // PPT preview
  if (inferredType === "presentation") {
    const fileSource = path || url || "";

    return (
      <div className={cn("rounded-lg overflow-hidden border", className)}>
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
          <span className="font-medium text-sm">{name}</span>
          {fileSize && (
            <span className="text-xs text-muted-foreground ml-2">
              {formatFileSize(fileSize)}
            </span>
          )}
        </div>
        <Suspense
          fallback={
            <div className="p-4 flex items-center justify-center">
              <RemixIcon
                name="loader_2"
                size="size-5"
                className="animate-spin"
              />
            </div>
          }
        >
          <PptxPreview
            artifact={{ path: fileSource, name: name || "presentation" }}
          />
        </Suspense>
      </div>
    );
  }

  // Spreadsheet preview (CSV with inline content uses papaparse table, otherwise uses SheetJS URL/file)
  if (inferredType === "spreadsheet") {
    const isCsvFile = name.toLowerCase().endsWith(".csv");
    if (isCsvFile && content?.trim()) {
      return (
        <div className={cn("rounded-lg overflow-hidden border", className)}>
          <Suspense
            fallback={
              <div className="p-4 flex items-center justify-center">
                <RemixIcon
                  name="loader_2"
                  size="size-5"
                  className="animate-spin"
                />
              </div>
            }
          >
            <CsvPreview
              content={content}
              filename={name}
              maxHeight={maxHeight}
            />
          </Suspense>
        </div>
      );
    }

    const fileSource = path || url || "";

    return (
      <div className={cn("rounded-lg overflow-hidden border", className)}>
        <Suspense
          fallback={
            <div className="p-4 flex items-center justify-center">
              <RemixIcon
                name="loader_2"
                size="size-5"
                className="animate-spin"
              />
            </div>
          }
        >
          <SpreadsheetPreview
            file={fileSource}
            path={path}
            maxHeight={maxHeight}
          />
        </Suspense>
      </div>
    );
  }

  // PDF preview
  if (inferredType === "pdf") {
    const fileSource = path || url || content || "";

    return (
      <div className={cn("rounded-lg overflow-hidden border", className)}>
        <Suspense
          fallback={
            <div className="p-4 flex items-center justify-center">
              <RemixIcon
                name="loader_2"
                size="size-5"
                className="animate-spin"
              />
            </div>
          }
        >
          <PdfPreview file={fileSource} maxHeight={maxHeight} path={path} />
        </Suspense>
      </div>
    );
  }

  // Image preview
  if (inferredType === "image" && (url || path)) {
    return (
      <div className={cn("rounded-lg overflow-hidden border", className)}>
        <img
          src={url || path}
          alt={name}
          className="w-full h-auto"
          style={{ maxHeight }}
        />
      </div>
    );
  }

  // Default file display
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg bg-muted border",
        className,
      )}
    >
      <RemixIcon
        name={fileIconName}
        size="size-8"
        className="text-muted-foreground flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{name}</p>
        {fileSize && (
          <p className="text-sm text-muted-foreground">
            {formatFileSize(fileSize)}
          </p>
        )}
        {(url || path) && (
          <a
            href={url || path}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline mt-1 inline-block"
          >
            Open in new tab
          </a>
        )}
      </div>
    </div>
  );
}
