"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PdfPreviewProps {
  file: File | string | ArrayBuffer | Uint8Array;
  className?: string;
  maxHeight?: string;
  path?: string;
}

export interface RenderedPage {
  index: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface UsePdfPreviewOptions {
  path?: string;
  downloadFileName?: string;
  /** When false, do not load or occupy state (for reusing the same hook call in non-PDF views) */
  enabled?: boolean;
}

/** usePdfPreview return value: shared by {@link PdfPreviewHeaderToolbar} and {@link PdfPreviewScrollBody} */
export interface PdfPreviewModel {
  loading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  scale: number;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  pages: RenderedPage[];
  handleDownload: () => void;
  handleShowInFolder: () => Promise<void>;
  handleOpenWithDefaultApp: () => Promise<void>;
  hasPath: boolean;
}

async function loadPdfData(
  file: File | string | ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  if (typeof file === "string") {
    if (
      file.startsWith("blob:") ||
      file.startsWith("http://") ||
      file.startsWith("https://") ||
      file.startsWith("/")
    ) {
      const res = await fetch(file);
      if (!res.ok) {
        throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    }
    throw new Error("Unsupported string path");
  }
  if (file instanceof File) {
    return new Uint8Array(await file.arrayBuffer());
  }
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file);
  }
  return new Uint8Array(file);
}

async function renderPdfToImages(
  data: Uint8Array,
  scale: number,
  onPage: (page: RenderedPage, current: number, total: number) => void,
  onError: (err: Error) => void,
) {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }

    const doc = await pdfjsLib.getDocument({ data: data }).promise;
    const total = doc.numPages;

    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas 2D context");
      await page.render({ canvasContext: ctx, viewport } as any).promise;

      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/png"),
      );
      if (!blob) {
        onError(new Error(`Failed to render page ${i}`));
        return;
      }

      const buf = await blob.arrayBuffer();
      const dataUrl = `data:image/png;base64,${uint8ToBase64(new Uint8Array(buf))}`;
      onPage(
        {
          index: i - 1,
          dataUrl,
          width: viewport.width,
          height: viewport.height,
        },
        i,
        total,
      );
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

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
 * PDF preview state and rendering logic: shared between drawer header and body to avoid maintaining two sets of controls in chat space / My Files.
 */
export function usePdfPreview(
  file: File | string | ArrayBuffer | Uint8Array | null,
  options?: UsePdfPreviewOptions,
): PdfPreviewModel {
  const path = options?.path;
  const downloadFileName = options?.downloadFileName ?? "document.pdf";
  const enabled = (options?.enabled ?? true) && file != null;

  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const blobUrlRef = useRef<string | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!enabled || !file) {
      setPages([]);
      setLoading(false);
      setError(null);
      setCurrentPage(1);
      setTotalPages(0);
      dataRef.current = null;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);
    setCurrentPage(1);
    setScale(1.5);

    (async () => {
      try {
        const data = await loadPdfData(file);
        if (cancelled) return;
        dataRef.current = data;

        const rendered: RenderedPage[] = [];
        await renderPdfToImages(
          data,
          1.5,
          (page) => {
            if (!cancelled) {
              rendered.push(page);
              setPages([...rendered]);
              setTotalPages(page.index + 1);
            }
          },
          (err) => {
            if (!cancelled) setError(err.message);
          },
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, enabled]);

  useEffect(() => {
    if (!enabled || !dataRef.current || pages.length === 0) return;

    let cancelled = false;
    const rendered: RenderedPage[] = [];
    setPages([]);

    renderPdfToImages(
      dataRef.current,
      scale,
      (page) => {
        if (!cancelled) {
          rendered.push(page);
          setPages([...rendered]);
        }
      },
      (err) => {
        if (!cancelled) setError(err.message);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [scale, enabled]);

  useEffect(() => {
    if (!enabled || !file) return;

    (async () => {
      try {
        const data = await loadPdfData(file);
        // Create proper ArrayBuffer from Uint8Array for Blob constructor
        const arrayBuffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(arrayBuffer).set(data);
        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = URL.createObjectURL(blob);
      } catch {
        // ignore
      }
    })();

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [file, enabled]);

  const handleDownload = useCallback(() => {
    const url = blobUrlRef.current;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [downloadFileName]);

  const handleShowInFolder = useCallback(async () => {
    if (!path) return;
    if (!(window as any).__TAURI__) return;
    try {
      const { revealItemInDir } = await import("@/lib/tauri");
      await revealItemInDir(path);
    } catch (err) {
      console.error("[PdfPreview] Failed to show in folder:", err);
    }
  }, [path]);

  const handleOpenWithDefaultApp = useCallback(async () => {
    if (!path) return;
    if (!(window as any).__TAURI__) return;
    try {
      const { openPathCustom } = await import("@/lib/tauri");
      await openPathCustom(path);
    } catch (err) {
      console.error("[PdfPreview] Failed to open path:", err);
    }
  }, [path]);

  const handleZoomIn = useCallback(
    () => setScale((s) => Math.min(s + 0.25, 4)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setScale((s) => Math.max(s - 0.25, 0.5)),
    [],
  );

  const hasPath = Boolean(path);

  return {
    loading,
    error,
    totalPages,
    currentPage,
    setCurrentPage,
    scale,
    handleZoomIn,
    handleZoomOut,
    pages,
    handleDownload,
    handleShowInFolder,
    handleOpenWithDefaultApp,
    hasPath,
  };
}

/**
 * PDF controls inside drawer header: pagination, zoom, show in folder, open with default app, download; button style consistent with Markdown/HTML preview drawer.
 * @param variant end: controls on the right (embedded in FilePreviewDrawerHeader); spread: left-center-right sections when embedded in gray bar.
 */
export function PdfPreviewHeaderToolbar({
  model,
  className,
  variant = "end",
}: {
  model: PdfPreviewModel;
  className?: string;
  variant?: "end" | "spread";
}) {
  const { t } = useTranslation();
  const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI__;
  const busy = model.loading || model.totalPages === 0;
  const tp = model.totalPages;
  const canPrev = !busy && model.currentPage > 1;
  const canNext = !busy && tp > 0 && model.currentPage < tp;

  const pageBlock = (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={!canPrev}
            onClick={() => model.setCurrentPage((p) => Math.max(p - 1, 1))}
          >
            <RemixIcon name="arrow-left" size="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("common.pdfPreview.prevPage", "Previous page")}</p>
        </TooltipContent>
      </Tooltip>
      <span className="text-sm min-w-[3.25rem] text-center tabular-nums text-muted-foreground">
        {busy ? "…" : `${model.currentPage} / ${tp}`}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={!canNext}
            onClick={() => model.setCurrentPage((p) => Math.min(p + 1, tp))}
          >
            <RemixIcon name="arrow-right" size="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("common.pdfPreview.nextPage", "Next page")}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  const zoomBlock = (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy || model.scale <= 0.5}
            onClick={model.handleZoomOut}
          >
            <RemixIcon name="zoom-out" size="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("common.pdfPreview.zoomOut", "Zoom out")}</p>
        </TooltipContent>
      </Tooltip>
      <span className="text-sm min-w-[2.75rem] text-center tabular-nums text-muted-foreground">
        {busy ? "…" : `${Math.round(model.scale * 100)}%`}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy || model.scale >= 4}
            onClick={model.handleZoomIn}
          >
            <RemixIcon name="zoom-in" size="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("common.pdfPreview.zoomIn", "Zoom in")}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  const actionsBlock = (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {model.hasPath && isTauri ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => void model.handleShowInFolder()}
              >
                <RemixIcon name="folder_open" size="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("common.filePreview.showInFolder", "Show in Folder")}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => void model.handleOpenWithDefaultApp()}
              >
                <RemixIcon name="external_link" size="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {t(
                  "common.filePreview.openWithDefaultApp",
                  "Open with Default App",
                )}
              </p>
            </TooltipContent>
          </Tooltip>
        </>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy}
            onClick={model.handleDownload}
          >
            <RemixIcon name="download" size="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("common.filePreview.download", "Download")}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  if (variant === "spread") {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 flex-wrap items-center justify-between gap-2",
          className,
        )}
      >
        {pageBlock}
        {zoomBlock}
        {actionsBlock}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex max-w-full flex-wrap items-center justify-end gap-x-1 gap-y-1",
        className,
      )}
    >
      {pageBlock}
      <div className="mx-0.5 hidden h-6 w-px shrink-0 bg-border/60 sm:block" />
      {zoomBlock}
      <div className="mx-0.5 hidden h-6 w-px shrink-0 bg-border/60 sm:block" />
      {actionsBlock}
    </div>
  );
}

/**
 * PDF page scroll area (no header): shares the same model with {@link PdfPreviewHeaderToolbar}.
 */
export function PdfPreviewScrollBody({
  model,
  className,
  maxHeight = "800px",
}: {
  model: PdfPreviewModel;
  className?: string;
  maxHeight?: string;
}) {
  const { t } = useTranslation();

  if (model.error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 h-full min-h-[200px]",
          className,
        )}
        style={maxHeight !== "100%" ? { maxHeight } : undefined}
      >
        <RemixIcon
          name="error_warning"
          size="size-12"
          className="text-destructive mb-4"
        />
        <p className="font-medium mb-2 text-center">
          {t("common.pdfPreview.loadFailed")}
        </p>
        <p className="text-sm text-muted-foreground text-center">
          {model.error}
        </p>
      </div>
    );
  }

  if (model.loading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 h-full min-h-[200px] gap-3",
          className,
        )}
        style={maxHeight !== "100%" ? { maxHeight } : undefined}
      >
        <RemixIcon
          name="loader_2"
          size="size-8"
          className="animate-spin text-primary"
        />
        <p className="text-sm text-muted-foreground">
          {t("common.filePreview.loading") || "Loading PDF..."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      style={maxHeight !== "100%" ? { maxHeight } : undefined}
    >
      <div className="min-h-0 flex-1 overflow-auto bg-gray-100 dark:bg-gray-900">
        {model.pages.length > 0 && (
          <div className="flex flex-col items-center gap-4 p-4">
            {model.pages.map((page) => (
              <div
                key={page.index}
                className={cn(
                  "flex justify-center",
                  page.index + 1 !== model.currentPage && "hidden sm:flex",
                )}
              >
                <img
                  src={page.dataUrl}
                  alt={`Page ${page.index + 1}`}
                  className="max-w-full shadow-md bg-white"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * PDF preview (embedded gray toolbar). For drawer scenarios, use {@link usePdfPreview} + {@link PdfPreviewHeaderToolbar} + {@link PdfPreviewScrollBody}.
 */
export function PdfPreview({
  file,
  className,
  maxHeight = "800px",
  path,
}: PdfPreviewProps) {
  const downloadName =
    file instanceof File
      ? file.name
      : typeof file === "string"
        ? file.split("/").pop() || "document.pdf"
        : "document.pdf";

  const model = usePdfPreview(file, {
    path,
    downloadFileName: downloadName,
    enabled: true,
  });

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col", className)}
      style={maxHeight !== "100%" ? { maxHeight } : undefined}
    >
      <div className="flex shrink-0 items-center border-b bg-muted px-3 py-2">
        <PdfPreviewHeaderToolbar model={model} variant="spread" />
      </div>
      <PdfPreviewScrollBody
        model={model}
        maxHeight="100%"
        className="min-h-0 flex-1"
      />
    </div>
  );
}
