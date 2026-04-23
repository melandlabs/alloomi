"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import "@/styles/docx-preview.css";

interface DocxPreviewProps {
  artifact: {
    path: string;
    name: string;
  };
}

const MAX_PREVIEW_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Read DOCX binary data from path or URL (Tauri local path or http(s)).
 */
async function readDocxArrayBuffer(
  filePath: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): Promise<ArrayBuffer> {
  if (/^https?:\/\//i.test(filePath)) {
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(
        t("common.docxPreview.fetchFailed", { status: res.status }),
      );
    }
    return res.arrayBuffer();
  }

  const { readFileBinary, fileStat } = await import("@/lib/tauri");
  const fileInfo = await fileStat(filePath);
  if (!fileInfo) {
    throw new Error(t("common.docxPreview.getFileInfoFailed"));
  }
  if (fileInfo.size > MAX_PREVIEW_SIZE) {
    const e = new Error("FILE_TOO_LARGE");
    (e as Error & { fileSize?: number }).fileSize = fileInfo.size;
    throw e;
  }

  const data = await readFileBinary(filePath);
  if (!data) {
    throw new Error(t("common.docxPreview.readFileFailed"));
  }

  const sourceArray = new Uint8Array(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  );
  return sourceArray.buffer.slice(
    sourceArray.byteOffset,
    sourceArray.byteOffset + sourceArray.byteLength,
  ) as ArrayBuffer;
}

/**
 * Sanitize Mammoth output HTML, preserving tables and common formatting tags.
 */
function sanitizeMammothHtml(html: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/)/i,
  });
}

/**
 * DOCX preview: uses Mammoth to convert to HTML, tables will be output as real &lt;table&gt; (docx-preview has incomplete parsing for some Word structures).
 */
export function DocxPreview({ artifact }: DocxPreviewProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileTooLarge, setFileTooLarge] = useState<number | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  const handleOpenExternal = async () => {
    if (!artifact.path) return;

    const isTauri = !!(window as any).__TAURI__;

    if (!isTauri) {
      console.warn(
        "[DocxPreview] Opening files externally is only supported in desktop app",
      );
      return;
    }

    try {
      const { openPathCustom } = await import("@/lib/tauri");
      await openPathCustom(artifact.path);
    } catch (err) {
      console.error("[DocxPreview] Failed to open file:", err);
    }
  };

  const handleShowInFolder = async () => {
    if (!artifact.path) return;
    const isTauri = !!(window as any).__TAURI__;
    if (!isTauri) return;
    try {
      const { revealItemInDir } = await import("@/lib/tauri");
      await revealItemInDir(artifact.path);
    } catch (err) {
      console.error("[DocxPreview] Failed to show in folder:", err);
    }
  };

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    async function loadAndConvert() {
      if (!artifact.path) {
        setError(
          t("common.docxPreview.noPathAvailable", "No file path available"),
        );
        setLoading(false);
        return;
      }

      timeoutId = setTimeout(() => {
        if (!isCancelled) {
          setError(t("common.docxPreview.loadTimeout", "Loading timeout"));
          setLoading(false);
        }
      }, 60000);

      try {
        const arrayBuffer = await readDocxArrayBuffer(artifact.path, t);
        if (isCancelled) {
          return;
        }

        const mammothMod = await import("mammoth");
        const mammothLib = mammothMod.default ?? mammothMod;
        const result = await mammothLib.convertToHtml(
          { arrayBuffer },
          { convertImage: mammothLib.images.dataUri },
        );

        if (isCancelled) {
          return;
        }

        const raw = result.value?.trim() ?? "";
        if (!raw) {
          setError(
            t("common.docxPreview.noContent", "No document content found"),
          );
          setHtml(null);
        } else {
          setHtml(sanitizeMammothHtml(raw));
          setError(null);
        }

        if (result.messages?.length) {
          console.debug("[DocxPreview] mammoth messages:", result.messages);
        }
      } catch (err) {
        if (isCancelled) return;
        console.error("[DocxPreview] Failed to load DOCX:", err);
        if (
          err instanceof Error &&
          err.message === "FILE_TOO_LARGE" &&
          "fileSize" in err &&
          typeof (err as Error & { fileSize?: number }).fileSize === "number"
        ) {
          setFileTooLarge((err as Error & { fileSize: number }).fileSize);
          setError(null);
        } else {
          const errorMsg = err instanceof Error ? err.message : String(err);
          setError(errorMsg);
        }
        setHtml(null);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setError(null);
    setFileTooLarge(null);
    setHtml(null);

    loadAndConvert();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [artifact.path]);

  const showDoc =
    !loading && fileTooLarge === null && !error && html !== null && html !== "";

  return (
    <div className="bg-background flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="bg-muted/20 absolute inset-0 z-10 flex flex-col items-center justify-center p-8">
            <RemixIcon
              name="loader_2"
              size="size-8"
              className="text-muted-foreground animate-spin"
            />
            <p className="text-muted-foreground mt-4 text-sm">
              {t("common.docxPreview.loading", "Loading document...")}
            </p>
          </div>
        ) : null}

        {fileTooLarge !== null ? (
          <div className="bg-muted/20 absolute inset-0 z-10 flex flex-col items-center justify-center p-8">
            <div className="flex max-w-md flex-col items-center text-center">
              <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
                <RemixIcon
                  name="file_text"
                  size="size-10"
                  className="text-blue-500"
                />
              </div>
              <h3 className="text-foreground mb-2 text-lg font-medium">
                {artifact.name}
              </h3>
              <p className="text-muted-foreground mb-4 text-sm">
                {t("common.docxPreview.fileTooLargeDesc", {
                  size: (fileTooLarge / 1024 / 1024).toFixed(1),
                  defaultValue:
                    "This file ({{size}}MB) is too large to preview. Please open it in Microsoft Word.",
                })}
              </p>
              <button
                type="button"
                onClick={handleOpenExternal}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <RemixIcon name="external_link" size="size-4" />
                {t("common.docxPreview.openInWord", "Open in Word")}
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="bg-muted/20 absolute inset-0 z-10 flex flex-col items-center justify-center p-8">
            <div className="flex max-w-md flex-col items-center text-center">
              <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
                <RemixIcon
                  name="file_text"
                  size="size-10"
                  className="text-blue-500"
                />
              </div>
              <h3 className="text-foreground mb-2 text-lg font-medium">
                {artifact.name}
              </h3>
              <p className="text-muted-foreground mb-4 text-sm break-all whitespace-pre-wrap">
                {error}
              </p>
              <button
                type="button"
                onClick={handleOpenExternal}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <RemixIcon name="external_link" size="size-4" />
                {t("common.docxPreview.openInWord", "Open in Word")}
              </button>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "relative h-full overflow-auto p-6",
            !showDoc && "pointer-events-none invisible",
          )}
        >
          {showDoc ? (
            <div
              className="mammoth-docx-preview bg-card mx-auto max-w-[900px] rounded-md border border-border p-6"
              // Mammoth output is a fragment after DOMPurify processing of trusted workspace files
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : null}
        </div>
      </div>

      {showDoc ? (
        <div className="border-border bg-muted/30 shrink-0 border-t px-4 py-2">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleShowInFolder}
              className="bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <RemixIcon name="folder_open" size="size-3.5" />
              {t("common.preview.showInFolder", "Show in Folder")}
            </button>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <RemixIcon name="external_link" size="size-3.5" />
              {t("common.docxPreview.openInWord", "Open in Word")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
