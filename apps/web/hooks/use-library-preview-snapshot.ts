"use client";

import { useEffect, useState } from "react";
import type { LibraryItem } from "@/components/library/library-types";
import {
  buildLibrarySpreadsheetSnapshot,
  type LibrarySpreadsheetInput,
  type LibrarySpreadsheetSnapshot,
} from "@/lib/library/spreadsheet-preview-snapshot";
import type { RenderedPage } from "@/components/artifacts/pdf-preview";
import type * as XLSXType from "xlsx";

export type LibraryPreviewKind =
  | "website"
  | "markdown"
  | "text"
  | "pdf"
  | "spreadsheet"
  | "pptx"
  | "docx"
  | "image"
  | "generic";

export type { LibrarySpreadsheetSnapshot };

interface LibraryPreviewSnapshot {
  text: string;
  html?: string;
  updatedAt: number;
}

export interface ExcelSheet {
  name: string;
  data: string[][];
}

const LIBRARY_PREVIEW_SNAPSHOT_STORAGE_KEY = "library_preview_snapshot_v2";
const previewSnapshotMemoryCache = new Map<string, LibraryPreviewSnapshot>();

/** PDF first page thumbnail only cached in memory (to avoid localStorage quota and size) */
const libraryPdfThumbMemoryCache = new Map<
  string,
  { dataUrl: string; updatedAt: number }
>();

/** Spreadsheet grid snapshot memory cache (consistent with PDF thumbnail strategy) */
const librarySpreadsheetSnapMemoryCache = new Map<
  string,
  { snapshot: LibrarySpreadsheetSnapshot; updatedAt: number }
>();

/** PPTX first page thumbnail memory cache */
const libraryPptxThumbMemoryCache = new Map<
  string,
  { dataUrl: string; updatedAt: number }
>();

/** DOCX first page thumbnail memory cache */
const libraryDocxThumbMemoryCache = new Map<
  string,
  { dataUrl: string; updatedAt: number }
>();

/** Image data URL memory cache */
const libraryImageDataUrlMemoryCache = new Map<
  string,
  { dataUrl: string; updatedAt: number }
>();

/**
 * Determines the rendering type for library thumbnail/inline preview based on file extension.
 */
export function getLibraryPreviewKindFromExt(ext: string): LibraryPreviewKind {
  const e = ext.toLowerCase();
  if (["html", "htm", "h5"].includes(e)) return "website";
  if (e === "md") return "markdown";
  if (["txt", "text"].includes(e)) return "text";
  if (e === "pdf") return "pdf";
  if (["csv", "xlsx", "xls", "xlsm", "ods"].includes(e)) return "spreadsheet";
  if (e === "pptx") return "pptx";
  if (e === "docx") return "docx";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(e))
    return "image";
  return "generic";
}

/**
 * Parse extension from library item (consistent logic with {@link getExtFromItem}, to avoid hook reverse dependency on component files).
 */
function previewExtFromItem(item: LibraryItem): string {
  if (item.workspaceFile?.type) return item.workspaceFile.type.toLowerCase();
  if (item.kind === "workspace_file" && item.title.includes(".")) {
    return item.title.split(".").pop()?.toLowerCase() ?? "";
  }
  if (item.kind === "knowledge_file" && item.title.includes(".")) {
    return item.title.split(".").pop()?.toLowerCase() ?? "";
  }
  return "";
}

/**
 * Fetch raw data for spreadsheet snapshot: workspace CSV uses JSON text, others use binary.
 */
async function fetchLibrarySpreadsheetInput(
  item: LibraryItem,
  ext: string,
): Promise<LibrarySpreadsheetInput | null> {
  const e = ext.toLowerCase();
  if (item.kind === "workspace_file" && item.workspaceFile) {
    const { taskId, path } = item.workspaceFile;
    if (e === "csv") {
      const res = await fetch(
        `/api/workspace/file/${encodeURIComponent(taskId)}/${encodeURIComponent(path)}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { content?: string };
      return { mode: "utf8", text: data.content ?? "" };
    }
    const res = await fetch(
      `/api/workspace/file/${encodeURIComponent(taskId)}/${encodeURIComponent(path)}?binary=true`,
    );
    if (!res.ok) return null;
    return { mode: "bytes", bytes: new Uint8Array(await res.arrayBuffer()) };
  }
  if (item.kind === "knowledge_file" && item.knowledgeFile?.id) {
    const res = await fetch(
      `/api/rag/documents/${encodeURIComponent(item.knowledgeFile.id)}/binary`,
    );
    if (!res.ok) return null;
    return { mode: "bytes", bytes: new Uint8Array(await res.arrayBuffer()) };
  }
  return null;
}

/**
 * Fetch binary data for library item (workspace file API or knowledge base binary interface).
 */
async function fetchLibraryItemBytes(
  item: LibraryItem,
): Promise<Uint8Array | null> {
  if (item.kind === "workspace_file" && item.workspaceFile) {
    const { taskId, path } = item.workspaceFile;
    const res = await fetch(
      `/api/workspace/file/${encodeURIComponent(taskId)}/${encodeURIComponent(path)}?binary=true`,
    );
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
  if (item.kind === "knowledge_file" && item.knowledgeFile?.id) {
    const res = await fetch(
      `/api/rag/documents/${encodeURIComponent(item.knowledgeFile.id)}/binary`,
    );
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
  return null;
}

function toMarkdownSnapshotText(raw: string): string {
  // Only match YAML frontmatter: --- at absolute start of file (with optional leading whitespace),
  // followed by content, then closing --- on its own line
  const withoutFrontmatter = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
  // Remove markdown thematic breaks (--- on its own line) as they render as <hr> in preview
  const withoutThematicBreaks = withoutFrontmatter.replace(/^---$/gm, "");
  const withoutScripts = withoutThematicBreaks.replace(
    /<script[\s\S]*?<\/script>/gi,
    " ",
  );
  const withoutStyles = withoutScripts.replace(
    /<style[\s\S]*?<\/style>/gi,
    " ",
  );
  const withoutHtmlTags = withoutStyles.replace(/<[^>]+>/g, " ");
  return withoutHtmlTags.replace(/\r\n/g, "\n").trim();
}

function toHtmlSnapshotText(raw: string): string {
  const withoutScripts = raw.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyles = withoutScripts.replace(
    /<style[\s\S]*?<\/style>/gi,
    " ",
  );
  const withoutTags = withoutStyles.replace(/<[^>]+>/g, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
}

function toSafeHtmlSnapshot(raw: string): string {
  return raw.replace(/<script[\s\S]*?<\/script>/gi, " ");
}

function getLibraryPreviewCacheKey(item: LibraryItem): string | null {
  if (item.kind === "workspace_file" && item.workspaceFile) {
    return `wf:${item.workspaceFile.taskId}:${item.workspaceFile.path}`;
  }
  if (item.kind === "knowledge_file" && item.knowledgeFile?.id) {
    return `kf:${item.knowledgeFile.id}`;
  }
  return null;
}

function readLibraryPreviewSnapshot(
  key: string,
  updatedAt: number,
): LibraryPreviewSnapshot | null {
  const memory = previewSnapshotMemoryCache.get(key);
  if (
    memory &&
    memory.updatedAt === updatedAt &&
    typeof memory.text === "string"
  ) {
    return memory;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      LIBRARY_PREVIEW_SNAPSHOT_STORAGE_KEY,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, LibraryPreviewSnapshot>;
    const snapshot = parsed[key];
    if (!snapshot || snapshot.updatedAt !== updatedAt) return null;
    if (typeof snapshot.text !== "string") {
      return null;
    }
    previewSnapshotMemoryCache.set(key, snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

function writeLibraryPreviewSnapshot(
  key: string,
  snapshot: LibraryPreviewSnapshot,
): void {
  previewSnapshotMemoryCache.set(key, snapshot);
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(
      LIBRARY_PREVIEW_SNAPSHOT_STORAGE_KEY,
    );
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, LibraryPreviewSnapshot>)
      : {};
    parsed[key] = snapshot;
    window.localStorage.setItem(
      LIBRARY_PREVIEW_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(parsed),
    );
  } catch {
    // Ignore storage write failures.
  }
}

/**
 * Fetch HTML/Markdown snapshot text for library grid cards (with localStorage cache), used for inline large card scroll preview.
 */
export function useLibraryPreviewSnapshot(
  item: LibraryItem,
  previewKind: LibraryPreviewKind,
  enabled: boolean,
): {
  snapshotText: string;
  snapshotHtml: string;
  snapshotLoading: boolean;
  /** PDF first page PNG data URL; empty string when not PDF or not generated */
  pdfThumbDataUrl: string;
  /** Spreadsheet snapshot; null when not spreadsheet type or parsing failed */
  spreadsheetSnapshot: LibrarySpreadsheetSnapshot | null;
  /** PPTX first slide PNG data URL; empty string when not PPTX or not generated */
  pptxThumbDataUrl: string;
  /** DOCX first page PNG data URL; empty string when not DOCX or not generated */
  docxThumbDataUrl: string;
  /** Image data URL; empty string when not image or not generated */
  imageDataUrl: string;
  /** Full PDF content: first 3 pages rendered as images */
  fullPdfPages?: RenderedPage[];
  /** Full DOCX content: HTML from mammoth (truncated to 50KB) */
  fullDocxHtml?: string;
  /** Full spreadsheet content: first 50 rows × 20 columns */
  fullSpreadsheetData?: ExcelSheet[];
  /** Whether full content is loading */
  fullContentLoading?: boolean;
  /** Error loading full content */
  fullContentError?: string;
} {
  const [snapshotText, setSnapshotText] = useState("");
  const [snapshotHtml, setSnapshotHtml] = useState("");
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [pdfThumbDataUrl, setPdfThumbDataUrl] = useState("");
  const [spreadsheetSnapshot, setSpreadsheetSnapshot] =
    useState<LibrarySpreadsheetSnapshot | null>(null);
  const [pptxThumbDataUrl, setPptxThumbDataUrl] = useState("");
  const [docxThumbDataUrl, setDocxThumbDataUrl] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [fullPdfPages, setFullPdfPages] = useState<
    RenderedPage[] | undefined
  >();
  const [fullDocxHtml, setFullDocxHtml] = useState<string | undefined>();
  const [fullSpreadsheetData, setFullSpreadsheetData] = useState<
    ExcelSheet[] | undefined
  >();
  const [fullContentLoading, setFullContentLoading] = useState(false);
  const [fullContentError, setFullContentError] = useState<
    string | undefined
  >();

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setPdfThumbDataUrl("");
      setSpreadsheetSnapshot(null);
      setPptxThumbDataUrl("");
      setDocxThumbDataUrl("");
      setImageDataUrl("");
      setSnapshotLoading(false);
      return;
    }

    if (previewKind === "pdf") {
      setSpreadsheetSnapshot(null);
      setPptxThumbDataUrl("");
      setDocxThumbDataUrl("");
      setImageDataUrl("");
      const updatedAt = item.date.getTime();
      const baseKey = getLibraryPreviewCacheKey(item);
      const thumbKey = baseKey ? `${baseKey}:pdf_thumb` : null;

      if (thumbKey) {
        const hit = libraryPdfThumbMemoryCache.get(thumbKey);
        if (hit && hit.updatedAt === updatedAt && hit.dataUrl) {
          setPdfThumbDataUrl(hit.dataUrl);
          setSnapshotLoading(false);
          return;
        }
      }

      const loadPdfThumb = async () => {
        setSnapshotLoading(true);
        setPdfThumbDataUrl("");
        try {
          const bytes = await fetchLibraryItemPdfBytes(item);
          if (cancelled || !bytes?.length) return;
          const { renderPdfFirstPageToPngDataUrl } =
            await import("@/lib/files/pdf-first-page-thumb");
          const dataUrl = await renderPdfFirstPageToPngDataUrl(bytes, 0.42);
          if (cancelled) return;
          setPdfThumbDataUrl(dataUrl);
          if (thumbKey) {
            libraryPdfThumbMemoryCache.set(thumbKey, {
              dataUrl,
              updatedAt,
            });
          }
        } catch {
          if (!cancelled) setPdfThumbDataUrl("");
        } finally {
          if (!cancelled) setSnapshotLoading(false);
        }
      };

      void loadPdfThumb();
      return () => {
        cancelled = true;
      };
    }

    setPdfThumbDataUrl("");

    if (previewKind === "spreadsheet") {
      setPptxThumbDataUrl("");
      setDocxThumbDataUrl("");
      setImageDataUrl("");
      const updatedAt = item.date.getTime();
      const baseKey = getLibraryPreviewCacheKey(item);
      const snapKey = baseKey ? `${baseKey}:sheet_snap` : null;
      const ext = previewExtFromItem(item);

      if (snapKey) {
        const hit = librarySpreadsheetSnapMemoryCache.get(snapKey);
        if (
          hit &&
          hit.updatedAt === updatedAt &&
          hit.snapshot.grid.length > 0
        ) {
          setSpreadsheetSnapshot(hit.snapshot);
          setSnapshotLoading(false);
          return;
        }
      }

      const loadSheetSnap = async () => {
        setSnapshotLoading(true);
        setSpreadsheetSnapshot(null);
        try {
          const input = await fetchLibrarySpreadsheetInput(item, ext);
          if (cancelled || !input) return;
          const snapshot = await buildLibrarySpreadsheetSnapshot(ext, input);
          if (cancelled) return;
          setSpreadsheetSnapshot(snapshot);
          if (snapKey && snapshot) {
            librarySpreadsheetSnapMemoryCache.set(snapKey, {
              snapshot,
              updatedAt,
            });
          }
        } catch {
          if (!cancelled) setSpreadsheetSnapshot(null);
        } finally {
          if (!cancelled) setSnapshotLoading(false);
        }
      };

      void loadSheetSnap();
      return () => {
        cancelled = true;
      };
    }

    setSpreadsheetSnapshot(null);

    // PPTX thumbnail
    if (previewKind === "pptx") {
      const updatedAt = item.date.getTime();
      const baseKey = getLibraryPreviewCacheKey(item);
      const thumbKey = baseKey ? `${baseKey}:pptx_thumb` : null;

      if (thumbKey) {
        const hit = libraryPptxThumbMemoryCache.get(thumbKey);
        if (hit && hit.updatedAt === updatedAt && hit.dataUrl) {
          setPptxThumbDataUrl(hit.dataUrl);
          setSnapshotLoading(false);
          return;
        }
      }

      const loadPptxThumb = async () => {
        setSnapshotLoading(true);
        setPptxThumbDataUrl("");
        try {
          const bytes = await fetchLibraryItemBytes(item);
          if (cancelled || !bytes?.length) return;
          const { renderPptxFirstPageToPngDataUrl } =
            await import("@/lib/files/pptx-first-page-thumb");
          const dataUrl = await renderPptxFirstPageToPngDataUrl(
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ) as ArrayBuffer,
            0.42,
          );
          if (cancelled) return;
          setPptxThumbDataUrl(dataUrl);
          if (thumbKey) {
            libraryPptxThumbMemoryCache.set(thumbKey, {
              dataUrl,
              updatedAt,
            });
          }
        } catch {
          if (!cancelled) setPptxThumbDataUrl("");
        } finally {
          if (!cancelled) setSnapshotLoading(false);
        }
      };

      void loadPptxThumb();
      return () => {
        cancelled = true;
      };
    }

    // DOCX thumbnail
    if (previewKind === "docx") {
      const updatedAt = item.date.getTime();
      const baseKey = getLibraryPreviewCacheKey(item);
      const thumbKey = baseKey ? `${baseKey}:docx_thumb` : null;

      if (thumbKey) {
        const hit = libraryDocxThumbMemoryCache.get(thumbKey);
        if (hit && hit.updatedAt === updatedAt && hit.dataUrl) {
          setDocxThumbDataUrl(hit.dataUrl);
          setSnapshotLoading(false);
          return;
        }
      }

      const loadDocxThumb = async () => {
        setSnapshotLoading(true);
        setDocxThumbDataUrl("");
        try {
          const bytes = await fetchLibraryItemBytes(item);
          if (cancelled || !bytes?.length) return;
          const { renderDocxFirstPageToPngDataUrl } =
            await import("@/lib/files/docx-first-page-thumb");
          const dataUrl = await renderDocxFirstPageToPngDataUrl(
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ) as ArrayBuffer,
            0.42,
          );
          if (cancelled) return;
          setDocxThumbDataUrl(dataUrl);
          if (thumbKey) {
            libraryDocxThumbMemoryCache.set(thumbKey, {
              dataUrl,
              updatedAt,
            });
          }
        } catch {
          if (!cancelled) setDocxThumbDataUrl("");
        } finally {
          if (!cancelled) setSnapshotLoading(false);
        }
      };

      void loadDocxThumb();
      return () => {
        cancelled = true;
      };
    }

    // Image data URL
    if (previewKind === "image") {
      const updatedAt = item.date.getTime();
      const baseKey = getLibraryPreviewCacheKey(item);
      const imgKey = baseKey ? `${baseKey}:img_data` : null;
      const ext = previewExtFromItem(item);

      if (imgKey) {
        const hit = libraryImageDataUrlMemoryCache.get(imgKey);
        if (hit && hit.updatedAt === updatedAt && hit.dataUrl) {
          setImageDataUrl(hit.dataUrl);
          setSnapshotLoading(false);
          return;
        }
      }

      const loadImageDataUrl = async () => {
        setSnapshotLoading(true);
        setImageDataUrl("");
        try {
          const bytes = await fetchLibraryItemBytes(item);
          if (cancelled || !bytes?.length) return;
          const { bytesToImageDataUrl } =
            await import("@/lib/files/image-data-url");
          const dataUrl = await bytesToImageDataUrl(bytes, ext);
          if (cancelled) return;
          setImageDataUrl(dataUrl);
          if (imgKey) {
            libraryImageDataUrlMemoryCache.set(imgKey, {
              dataUrl,
              updatedAt,
            });
          }
        } catch {
          if (!cancelled) setImageDataUrl("");
        } finally {
          if (!cancelled) setSnapshotLoading(false);
        }
      };

      void loadImageDataUrl();
      return () => {
        cancelled = true;
      };
    }

    if (!["website", "markdown", "text"].includes(previewKind)) {
      setSnapshotLoading(false);
      return;
    }
    const updatedAt = item.date.getTime();
    const cacheKey = getLibraryPreviewCacheKey(item);
    if (cacheKey) {
      const cached = readLibraryPreviewSnapshot(cacheKey, updatedAt);
      if (cached) {
        setSnapshotText(cached.text);
        setSnapshotHtml(cached.html ?? "");
        setSnapshotLoading(false);
        return;
      }
    }

    const loadSnapshot = async () => {
      setSnapshotLoading(true);
      try {
        let content = "";
        if (item.kind === "workspace_file" && item.workspaceFile) {
          const { taskId, path } = item.workspaceFile;
          const res = await fetch(
            `/api/workspace/file/${encodeURIComponent(taskId)}/${encodeURIComponent(path)}`,
          );
          if (res.ok) {
            const data = (await res.json()) as { content?: string };
            content = data.content ?? "";
          }
        } else if (item.kind === "knowledge_file" && item.knowledgeFile?.id) {
          const res = await fetch(
            `/api/rag/documents/${encodeURIComponent(item.knowledgeFile.id)}`,
          );
          if (res.ok) {
            const data = (await res.json()) as {
              document?: {
                chunks?: Array<{ content: string; chunkIndex: number }>;
              };
            };
            const chunks = (data.document?.chunks ?? []).sort(
              (a, b) => a.chunkIndex - b.chunkIndex,
            );
            content = chunks.map((c) => c.content).join("\n");
          }
        }

        if (!cancelled) {
          let textSnapshot: string;
          if (previewKind === "website") {
            textSnapshot = toHtmlSnapshotText(content);
          } else if (previewKind === "markdown") {
            textSnapshot = toMarkdownSnapshotText(content);
          } else {
            // "text" - plain text file, use content as-is with minimal processing
            textSnapshot = content.replace(/\r\n/g, "\n").trim();
          }
          const htmlSnapshot =
            previewKind === "website" ? toSafeHtmlSnapshot(content) : "";
          setSnapshotText(textSnapshot);
          setSnapshotHtml(htmlSnapshot);
          if (cacheKey) {
            writeLibraryPreviewSnapshot(cacheKey, {
              text: textSnapshot,
              html: htmlSnapshot,
              updatedAt,
            });
          }
        }
      } catch {
        if (!cancelled) {
          setSnapshotText("");
          setSnapshotHtml("");
        }
      } finally {
        if (!cancelled) setSnapshotLoading(false);
      }
    };

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [item, previewKind, enabled]);

  // Load full content for grid inline preview (PDF, DOCX, spreadsheet)
  useEffect(() => {
    let cancelled = false;

    // Only load full content for workspace files in grid view
    if (
      !enabled ||
      item.kind !== "workspace_file" ||
      !item.workspaceFile?.path
    ) {
      setFullPdfPages(undefined);
      setFullDocxHtml(undefined);
      setFullSpreadsheetData(undefined);
      setFullContentLoading(false);
      setFullContentError(undefined);
      return;
    }

    const loadFullContent = async () => {
      setFullContentLoading(true);
      setFullContentError(undefined);

      try {
        if (previewKind === "pdf") {
          const bytes = await fetchLibraryItemBytes(item);
          if (cancelled || !bytes?.length) return;

          const pdfjsLib = await import("pdfjs-dist");
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          }

          const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
          const totalPages = Math.min(doc.numPages, 3); // Limit to 3 pages
          const pages: RenderedPage[] = [];

          for (let i = 1; i <= totalPages; i++) {
            if (cancelled) return;
            const page = await doc.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 });
            const canvas = document.createElement("canvas");
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            await page.render({ canvasContext: ctx, viewport } as any).promise;

            const blob = await new Promise<Blob | null>((res) =>
              canvas.toBlob(res, "image/png"),
            );
            if (!blob) continue;

            const buf = await blob.arrayBuffer();
            const dataUrl = `data:image/png;base64,${uint8ToBase64(new Uint8Array(buf))}`;
            pages.push({
              index: i - 1,
              dataUrl,
              width: viewport.width,
              height: viewport.height,
            });
          }

          if (!cancelled) setFullPdfPages(pages);
        } else if (previewKind === "docx") {
          const bytes = await fetchLibraryItemBytes(item);
          if (cancelled || !bytes?.length) return;

          const mammothMod = await import("mammoth");
          const mammothLib = mammothMod.default ?? mammothMod;
          const result = await mammothLib.convertToHtml(
            {
              arrayBuffer: bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
              ) as ArrayBuffer,
            },
            { convertImage: mammothLib.images.dataUri },
          );

          if (cancelled) return;

          // Limit HTML to 50KB
          let html = result.value ?? "";
          const MAX_HTML_SIZE = 50 * 1024;
          if (html.length > MAX_HTML_SIZE) {
            html = html.substring(0, MAX_HTML_SIZE);
          }

          if (!cancelled) setFullDocxHtml(html);
        } else if (previewKind === "spreadsheet") {
          const ext = previewExtFromItem(item);
          const input = await fetchLibrarySpreadsheetInput(item, ext);
          if (cancelled || !input) return;

          const XLSX = await import("xlsx");
          let workbook: XLSXType.WorkBook;
          if (input.mode === "utf8") {
            workbook = XLSX.read(input.text, { type: "string" });
          } else {
            workbook = XLSX.read(input.bytes, { type: "array" });
          }

          if (cancelled) return;

          const MAX_ROWS = 50;
          const MAX_COLS = 20;
          const sheets: ExcelSheet[] = [];

          workbook.SheetNames.forEach((sheetName: string) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
              header: 1,
              defval: "",
            });

            // Limit rows and columns
            const limitedData = jsonData
              .slice(0, MAX_ROWS)
              .map((row: string[]) =>
                Array.isArray(row) ? row.slice(0, MAX_COLS) : row,
              );

            sheets.push({
              name: sheetName,
              data: limitedData as string[][],
            });
          });

          if (!cancelled) setFullSpreadsheetData(sheets);
        }
      } catch (err) {
        if (!cancelled) {
          setFullContentError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setFullContentLoading(false);
      }
    };

    void loadFullContent();
    return () => {
      cancelled = true;
    };
  }, [item, previewKind, enabled]);

  return {
    snapshotText,
    snapshotHtml,
    snapshotLoading,
    pdfThumbDataUrl,
    spreadsheetSnapshot,
    pptxThumbDataUrl,
    docxThumbDataUrl,
    imageDataUrl,
    fullPdfPages,
    fullDocxHtml,
    fullSpreadsheetData,
    fullContentLoading,
    fullContentError,
  };
}

/**
 * Fetch PDF binary for library item (workspace file API or knowledge base binary interface).
 */
function uint8ToBase64(uint8Array: Uint8Array): string {
  const len = uint8Array.byteLength;
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    binary += String.fromCharCode.apply(
      null,
      Array.from(uint8Array.slice(i, end)) as unknown as number[],
    );
  }
  return btoa(binary);
}

/**
 * Fetch PDF binary for library item (workspace file API or knowledge base binary interface).
 */
async function fetchLibraryItemPdfBytes(
  item: LibraryItem,
): Promise<Uint8Array | null> {
  if (item.kind === "workspace_file" && item.workspaceFile) {
    const { taskId, path } = item.workspaceFile;
    const res = await fetch(
      `/api/workspace/file/${encodeURIComponent(taskId)}/${encodeURIComponent(path)}?binary=true`,
      { headers: { Accept: "application/pdf" } },
    );
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
  if (item.kind === "knowledge_file" && item.knowledgeFile?.id) {
    const res = await fetch(
      `/api/rag/documents/${encodeURIComponent(item.knowledgeFile.id)}/binary`,
    );
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
  return null;
}
