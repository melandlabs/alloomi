"use client";

import { cn } from "@/lib/utils";
import { MarkdownWithCitations } from "@/components/markdown-with-citations";
import {
  injectHtmlPreviewScrollFix,
  injectHtmlPreviewSnapshotClamp,
} from "@/lib/html-preview-scroll-fix";
import type { LibraryGridCardVariant } from "@/components/library/library-types";
import type {
  LibraryPreviewKind,
  LibrarySpreadsheetSnapshot,
} from "@/hooks/use-library-preview-snapshot";
import type { RenderedPage } from "@/components/artifacts/pdf-preview";
import type { ExcelSheet } from "@/hooks/use-library-preview-snapshot";
import { LibraryPdfInlinePreview } from "@/components/library/library-pdf-inline-preview";
import { LibraryDocxInlinePreview } from "@/components/library/library-docx-inline-preview";
import { LibrarySpreadsheetInlinePreview } from "@/components/library/library-spreadsheet-inline-preview";

export interface LibraryGridPreviewPanelProps {
  /** Preview type: website snapshot, Markdown, or generic icon */
  previewKind: LibraryPreviewKind;
  /** Whether the snapshot is being fetched */
  loading: boolean;
  /** HTML snapshot (script tags removed), used for iframe srcDoc */
  snapshotHtml: string;
  /** Plain text/Markdown snapshot or fallback text */
  snapshotText: string;
  /** Title line fallback when no content */
  titleLine: string;
  /** File type icon URL (used for generic type) */
  fileIconSrc: string;
  /** i18n translation function */
  t: (key: string, fallback?: string) => string;
  /** iframe accessible name suffix (file name) */
  previewTitle: string;
  /** PDF first page thumbnail (PNG data URL); only used when `previewKind === "pdf"` */
  pdfThumbDataUrl?: string;
  /** Spreadsheet grid snapshot; only used when `previewKind === "spreadsheet"` */
  spreadsheetSnapshot?: LibrarySpreadsheetSnapshot | null;
  /** PPTX first slide thumbnail (PNG data URL); only used when `previewKind === "pptx"` */
  pptxThumbDataUrl?: string;
  /** DOCX first page thumbnail (PNG data URL); only used when `previewKind === "docx"` */
  docxThumbDataUrl?: string;
  /** Image data URL; only used when `previewKind === "image"` */
  imageDataUrl?: string;
  /**
   * `library`: Library-style 16:9 thumbnail snapshot with content cropped, non-scrollable.
   * `inline`: Inline scrollable preview area (consistent reading experience with preview drawer).
   */
  variant?: LibraryGridCardVariant;
  /** Workspace file path for inline full content preview */
  workspaceFilePath?: string;
  /** Workspace file task ID */
  workspaceFileTaskId?: string;
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
}

/**
 * Spreadsheet snapshot content: loading, parse failure, and mini table body.
 */
function LibrarySpreadsheetSnapshotBody({
  snapshot,
  loading,
  fileIconSrc,
  t,
  textSizeClass,
}: {
  snapshot: LibrarySpreadsheetSnapshot | null;
  loading: boolean;
  fileIconSrc: string;
  t: (key: string, fallback?: string) => string;
  textSizeClass: string;
}) {
  if (loading) {
    return (
      <p className={cn("leading-snug text-muted-foreground", textSizeClass)}>
        {t("common.loading", "Loading")}
      </p>
    );
  }
  if (!snapshot?.grid.length) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md">
        <img
          src={fileIconSrc}
          alt=""
          draggable={false}
          className="h-6 w-6 object-contain pointer-events-none"
          aria-hidden
        />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <p
        className={cn(
          "shrink-0 truncate border-b border-border/40 pb-0.5 font-medium text-muted-foreground",
          textSizeClass,
        )}
      >
        {snapshot.sheetName}
      </p>
      <div className="min-h-0 flex-1 overflow-hidden">
        <table
          className={cn(
            "w-full border-collapse text-foreground",
            textSizeClass,
          )}
        >
          <tbody>
            {snapshot.grid.map((row, ri) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: Snapshot rows have no stable id
                key={`snap-r-${ri}`}
                className={
                  ri === 0 ? "bg-muted/75 font-medium" : "hover:bg-muted/30"
                }
              >
                {row.map((cell, ci) => (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: Snapshot cells have no stable id
                    key={`snap-c-${ri}-${ci}`}
                    className="max-w-[5.5rem] truncate border border-border/45 px-1 py-0.5 align-top"
                    title={cell}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Preview area inside grid card: switches between "library snapshot" and "scrollable inline preview" based on `variant`.
 */
export function LibraryGridPreviewPanel({
  previewKind,
  loading,
  snapshotHtml,
  snapshotText,
  titleLine,
  fileIconSrc,
  t,
  previewTitle,
  pdfThumbDataUrl = "",
  spreadsheetSnapshot = null,
  pptxThumbDataUrl = "",
  docxThumbDataUrl = "",
  imageDataUrl = "",
  variant = "library",
  workspaceFilePath,
  workspaceFileTaskId,
  fullPdfPages,
  fullDocxHtml,
  fullSpreadsheetData,
  fullContentLoading,
  fullContentError,
}: LibraryGridPreviewPanelProps) {
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "min-h-[min(52vh,480px)] max-h-[min(65vh,560px)] w-full min-w-0 shrink-0 overflow-hidden rounded-none bg-muted/25",
        )}
      >
        {previewKind === "website" ? (
          <div className="flex h-[min(52vh,480px)] max-h-[min(65vh,560px)] w-full flex-col overflow-auto bg-background">
            {snapshotHtml ? (
              <iframe
                title={`${previewTitle}-inline-preview`}
                srcDoc={injectHtmlPreviewScrollFix(snapshotHtml)}
                className="block h-full w-full min-h-0 border-0 bg-card"
                scrolling="yes"
              />
            ) : (
              <div className="flex min-h-[200px] flex-1 items-start overflow-auto p-4">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {loading
                    ? t("common.loading", "Loading")
                    : snapshotText || titleLine}
                </p>
              </div>
            )}
          </div>
        ) : previewKind === "markdown" ? (
          <div className="h-[min(52vh,480px)] max-h-[min(65vh,560px)] w-full overflow-auto bg-card px-4 py-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading", "Loading")}
              </p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none text-card-foreground">
                <MarkdownWithCitations insights={[]}>
                  {snapshotText || titleLine}
                </MarkdownWithCitations>
              </div>
            )}
          </div>
        ) : previewKind === "pdf" ? (
          <div className="flex h-[min(52vh,480px)] max-h-[min(65vh,560px)] w-full items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-900">
            {fullContentLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading", "Loading")}
              </p>
            ) : fullPdfPages && fullPdfPages.length > 0 ? (
              <LibraryPdfInlinePreview
                pages={fullPdfPages}
                className="h-full w-full"
              />
            ) : pdfThumbDataUrl ? (
              <img
                src={pdfThumbDataUrl}
                alt=""
                draggable={false}
                className="max-h-full max-w-full object-contain pointer-events-none"
                aria-hidden
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/80 p-2 shadow-sm">
                <img
                  src={fileIconSrc}
                  alt=""
                  draggable={false}
                  className="h-8 w-8 object-contain pointer-events-none"
                  aria-hidden
                />
              </div>
            )}
          </div>
        ) : previewKind === "spreadsheet" ? (
          <div className="flex h-[min(52vh,480px)] max-h-[min(65vh,560px)] w-full flex-col overflow-hidden bg-card px-3 py-2">
            {fullContentLoading ? (
              <div className="flex items-center justify-center flex-1">
                <p className="text-sm text-muted-foreground">
                  {t("common.loading", "Loading")}
                </p>
              </div>
            ) : fullSpreadsheetData && fullSpreadsheetData.length > 0 ? (
              <LibrarySpreadsheetInlinePreview
                sheets={fullSpreadsheetData}
                className="flex-1"
              />
            ) : (
              <LibrarySpreadsheetSnapshotBody
                snapshot={spreadsheetSnapshot}
                loading={loading}
                fileIconSrc={fileIconSrc}
                t={t}
                textSizeClass="text-xs"
              />
            )}
          </div>
        ) : previewKind === "pptx" ? (
          <div className="flex h-[min(52vh,480px)] max-h-[min(65vh,560px)] w-full items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-900">
            {loading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading", "Loading")}
              </p>
            ) : pptxThumbDataUrl ? (
              <img
                src={pptxThumbDataUrl}
                alt=""
                draggable={false}
                className="max-h-full max-w-full object-contain pointer-events-none"
                aria-hidden
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/80 p-2 shadow-sm">
                <img
                  src={fileIconSrc}
                  alt=""
                  draggable={false}
                  className="h-8 w-8 object-contain pointer-events-none"
                  aria-hidden
                />
              </div>
            )}
          </div>
        ) : previewKind === "docx" ? (
          <div className="flex h-[min(52vh,480px)] max-h-[min(65vh,560px)] w-full items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-900">
            {fullContentLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading", "Loading")}
              </p>
            ) : fullDocxHtml ? (
              <LibraryDocxInlinePreview
                html={fullDocxHtml}
                className="h-full w-full"
              />
            ) : docxThumbDataUrl ? (
              <img
                src={docxThumbDataUrl}
                alt=""
                draggable={false}
                className="max-h-full max-w-full object-contain pointer-events-none"
                aria-hidden
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/80 p-2 shadow-sm">
                <img
                  src={fileIconSrc}
                  alt=""
                  draggable={false}
                  className="h-8 w-8 object-contain pointer-events-none"
                  aria-hidden
                />
              </div>
            )}
          </div>
        ) : previewKind === "image" ? (
          <div className="flex h-[min(52vh,480px)] max-h-[min(65vh,560px)] w-full items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-900">
            {loading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading", "Loading")}
              </p>
            ) : imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt=""
                draggable={false}
                className="max-h-full max-w-full object-contain pointer-events-none"
                aria-hidden
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/80 p-2 shadow-sm">
                <img
                  src={fileIconSrc}
                  alt=""
                  draggable={false}
                  className="h-8 w-8 object-contain pointer-events-none"
                  aria-hidden
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-[min(52vh,480px)] max-h-[min(65vh,560px)] min-h-[200px] w-full items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20 p-6">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/80 p-2 shadow-sm">
              <img
                src={fileIconSrc}
                alt=""
                draggable={false}
                className="h-8 w-8 object-contain pointer-events-none"
                aria-hidden
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-none border-0 overflow-hidden bg-muted/35">
      {previewKind === "website" ? (
        <div className="absolute inset-0 overflow-hidden bg-background">
          {snapshotHtml ? (
            <iframe
              title={`${previewTitle}-snapshot`}
              sandbox=""
              scrolling="no"
              className="h-full w-full scale-[0.62] origin-top-left pointer-events-none overflow-hidden [scrollbar-width:none]"
              style={{ width: "161%", height: "161%" }}
              srcDoc={injectHtmlPreviewSnapshotClamp(snapshotHtml)}
            />
          ) : (
            <div className="absolute inset-0 p-0">
              <div className="h-full w-full rounded p-2">
                <p className="text-[10px] leading-snug text-foreground line-clamp-5 whitespace-pre-wrap">
                  {loading
                    ? t("common.loading", "Loading")
                    : snapshotText || titleLine}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : previewKind === "markdown" ? (
        <div className="absolute inset-0 p-0">
          <div className="h-full w-full rounded p-2 overflow-hidden">
            {loading ? (
              <p className="text-[10px] leading-snug text-foreground line-clamp-5 whitespace-pre-wrap">
                {t("common.loading", "Loading")}
              </p>
            ) : (
              <div className="pointer-events-none h-full w-full overflow-hidden text-foreground">
                <div className="origin-top-left scale-[0.58] w-[172%] min-w-0">
                  <MarkdownWithCitations insights={[]}>
                    {snapshotText || titleLine}
                  </MarkdownWithCitations>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : previewKind === "text" ? (
        <div className="absolute inset-0 p-0">
          <div className="h-full w-full rounded p-2">
            <p className="text-[10px] leading-snug text-foreground line-clamp-5 whitespace-pre-wrap">
              {loading
                ? t("common.loading", "Loading")
                : snapshotText || titleLine}
            </p>
          </div>
        </div>
      ) : previewKind === "pdf" ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          {fullContentLoading ? (
            <p className="text-[10px] text-muted-foreground">
              {t("common.loading", "Loading")}
            </p>
          ) : fullPdfPages && fullPdfPages.length > 0 ? (
            <LibraryPdfInlinePreview
              pages={fullPdfPages}
              className="h-full w-full"
            />
          ) : pdfThumbDataUrl ? (
            <img
              src={pdfThumbDataUrl}
              alt=""
              draggable={false}
              className="h-full w-full object-contain pointer-events-none"
              aria-hidden
            />
          ) : (
            <div className="absolute inset-0 p-2 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20">
              <div className="rounded-md flex items-center justify-center size-10 shrink-0">
                <img
                  src={fileIconSrc}
                  alt=""
                  draggable={false}
                  className="h-6 w-6 object-contain pointer-events-none"
                  aria-hidden
                />
              </div>
            </div>
          )}
        </div>
      ) : previewKind === "spreadsheet" ? (
        <div
          className={cn(
            "absolute inset-0 overflow-hidden bg-background",
            fullContentLoading || loading || !spreadsheetSnapshot?.grid.length
              ? "flex items-center justify-center p-2"
              : "p-1.5",
          )}
        >
          {fullContentLoading ? (
            <p className="text-[10px] text-muted-foreground">
              {t("common.loading", "Loading")}
            </p>
          ) : fullSpreadsheetData && fullSpreadsheetData.length > 0 ? (
            <LibrarySpreadsheetInlinePreview
              sheets={fullSpreadsheetData}
              className="h-full w-full"
            />
          ) : loading || !spreadsheetSnapshot?.grid.length ? (
            <LibrarySpreadsheetSnapshotBody
              snapshot={spreadsheetSnapshot}
              loading={loading}
              fileIconSrc={fileIconSrc}
              t={t}
              textSizeClass="text-[10px]"
            />
          ) : (
            <div className="pointer-events-none h-full w-full min-h-0 min-w-0">
              <div className="h-full w-full min-h-0 min-w-0 origin-top-left scale-[0.56] overflow-visible">
                <div className="flex min-h-0 w-[178%] flex-col pr-1">
                  <LibrarySpreadsheetSnapshotBody
                    snapshot={spreadsheetSnapshot}
                    loading={false}
                    fileIconSrc={fileIconSrc}
                    t={t}
                    textSizeClass="text-[10px]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : previewKind === "pptx" ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          {loading ? (
            <p className="text-[10px] text-muted-foreground">
              {t("common.loading", "Loading")}
            </p>
          ) : pptxThumbDataUrl ? (
            <img
              src={pptxThumbDataUrl}
              alt=""
              draggable={false}
              className="h-full w-full object-contain pointer-events-none"
              aria-hidden
            />
          ) : (
            <div className="absolute inset-0 p-2 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20">
              <div className="rounded-md flex items-center justify-center size-10 shrink-0">
                <img
                  src={fileIconSrc}
                  alt=""
                  draggable={false}
                  className="h-6 w-6 object-contain pointer-events-none"
                  aria-hidden
                />
              </div>
            </div>
          )}
        </div>
      ) : previewKind === "docx" ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          {fullContentLoading ? (
            <p className="text-[10px] text-muted-foreground">
              {t("common.loading", "Loading")}
            </p>
          ) : fullDocxHtml ? (
            <LibraryDocxInlinePreview
              html={fullDocxHtml}
              className="h-full w-full"
            />
          ) : docxThumbDataUrl ? (
            <img
              src={docxThumbDataUrl}
              alt=""
              draggable={false}
              className="h-full w-full object-contain pointer-events-none"
              aria-hidden
            />
          ) : (
            <div className="absolute inset-0 p-2 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20">
              <div className="rounded-md flex items-center justify-center size-10 shrink-0">
                <img
                  src={fileIconSrc}
                  alt=""
                  draggable={false}
                  className="h-6 w-6 object-contain pointer-events-none"
                  aria-hidden
                />
              </div>
            </div>
          )}
        </div>
      ) : previewKind === "image" ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          {loading ? (
            <p className="text-[10px] text-muted-foreground">
              {t("common.loading", "Loading")}
            </p>
          ) : imageDataUrl ? (
            <img
              src={imageDataUrl}
              alt=""
              draggable={false}
              className="h-full w-full object-contain pointer-events-none"
              aria-hidden
            />
          ) : (
            <div className="absolute inset-0 p-2 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20">
              <div className="rounded-md flex items-center justify-center size-10 shrink-0">
                <img
                  src={fileIconSrc}
                  alt=""
                  draggable={false}
                  className="h-6 w-6 object-contain pointer-events-none"
                  aria-hidden
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 p-2 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20">
          <div className="rounded-md flex items-center justify-center size-10 shrink-0">
            <img
              src={fileIconSrc}
              alt=""
              draggable={false}
              className="h-6 w-6 object-contain pointer-events-none"
              aria-hidden
            />
          </div>
        </div>
      )}
    </div>
  );
}
