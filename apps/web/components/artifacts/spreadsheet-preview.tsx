"use client";

import {
  useState,
  useEffect,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import * as XLSX from "xlsx";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { RemixIcon } from "@/components/remix-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { revealItemInDir } from "@/lib/tauri";

interface SheetData {
  name: string;
  data: string[][];
  rowCount: number;
  columnCount: number;
}

export interface UseSpreadsheetPreviewOptions {
  /** Local path: used for "Show in Folder" */
  path?: string;
  /** When false, do not initiate loading (consistent with PDF preview hook, for conditional enable in drawer) */
  enabled?: boolean;
}

/** useSpreadsheetPreview return value: shared by {@link SpreadsheetPreviewHeaderToolbar} and {@link SpreadsheetPreviewScrollBody} */
export interface SpreadsheetPreviewModel {
  loading: boolean;
  error: string | null;
  sheets: SheetData[];
  currentSheetIndex: number;
  setCurrentSheetIndex: Dispatch<SetStateAction<number>>;
  workbook: XLSX.WorkBook | null;
  handleExportCSV: () => void;
}

interface SpreadsheetPreviewProps {
  file: File | string;
  path?: string;
  className?: string;
  maxHeight?: string;
  /**
   * When true, keep embedded toolbar at the top of the component (scenarios without drawer header like Artifact embedding).
   * For drawer scenarios, set to false and put {@link SpreadsheetPreviewHeaderToolbar} into {@link FilePreviewDrawerHeader}.
   */
  embedToolbar?: boolean;
}

/**
 * Load and parse spreadsheet workbook, shared state between header toolbar and table area.
 */
export function useSpreadsheetPreview(
  file: File | string | null,
  options: UseSpreadsheetPreviewOptions = {},
): SpreadsheetPreviewModel {
  const { enabled = true } = options;
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || file == null) {
      setLoading(false);
      setWorkbook(null);
      setSheets([]);
      setCurrentSheetIndex(0);
      setError(null);
      return;
    }

    const fileSource: File | string = file;
    let cancelled = false;

    async function loadWorkbook() {
      setLoading(true);
      setError(null);

      try {
        let arrayBuffer: ArrayBuffer;

        if (typeof fileSource === "string") {
          const response = await fetch(fileSource);
          if (!response.ok) {
            throw new Error(`Failed to load file: ${response.statusText}`);
          }

          const contentLength = response.headers.get("content-length");
          if (
            contentLength &&
            Number.parseInt(contentLength) > 100 * 1024 * 1024
          ) {
            throw new Error("File too large (max 100MB)");
          }

          arrayBuffer = await response.arrayBuffer();
        } else {
          if (fileSource.size > 100 * 1024 * 1024) {
            throw new Error("File too large (max 100MB)");
          }
          arrayBuffer = await fileSource.arrayBuffer();
        }

        if (cancelled) return;

        const wb = XLSX.read(arrayBuffer, { type: "array" });

        if (cancelled) return;

        setWorkbook(wb);

        const sheetData: SheetData[] = [];
        wb.SheetNames.forEach((sheetName) => {
          const worksheet = wb.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
            header: 1,
            defval: "",
          });

          if (jsonData && jsonData.length > 0) {
            const rowCount = jsonData.length;
            const columnCount = Math.max(...jsonData.map((row) => row.length));

            sheetData.push({
              name: sheetName,
              data: jsonData as string[][],
              rowCount,
              columnCount,
            });
          }
        });

        setSheets(sheetData);
        setCurrentSheetIndex(0);
      } catch (err) {
        console.error("[SpreadsheetPreview] Failed to load workbook:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load spreadsheet file",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWorkbook();

    return () => {
      cancelled = true;
    };
  }, [file, enabled]);

  const handleExportCSV = useCallback(() => {
    if (!workbook || sheets.length === 0) return;

    const currentSheet = sheets[currentSheetIndex];
    const worksheet = workbook.Sheets[currentSheet.name];
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentSheet.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [workbook, sheets, currentSheetIndex]);

  return {
    loading,
    error,
    sheets,
    currentSheetIndex,
    setCurrentSheetIndex,
    workbook,
    handleExportCSV,
  };
}

/**
 * Spreadsheet preview header controls: consistent with {@link PdfPreviewHeaderToolbar} using ghost `size-8` and Tooltip, placed in {@link FilePreviewDrawerHeader} children.
 */
export function SpreadsheetPreviewHeaderToolbar({
  model,
  path,
  variant = "end",
  className,
}: {
  model: SpreadsheetPreviewModel;
  path?: string;
  variant?: "end" | "spread";
  className?: string;
}) {
  const { t } = useTranslation();

  if (model.loading || model.error || model.sheets.length === 0) {
    return null;
  }

  const current = model.sheets[model.currentSheetIndex];
  const canPrev = model.currentSheetIndex > 0;
  const canNext = model.currentSheetIndex < model.sheets.length - 1;

  const sheetNav = (
    <div className="flex min-w-0 max-w-[min(100%,240px)] items-center gap-0.5 sm:max-w-[min(100%,320px)]">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            disabled={!canPrev}
            onClick={() =>
              model.setCurrentSheetIndex((i) => Math.max(0, i - 1))
            }
          >
            <RemixIcon name="chevron_left" size="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("common.spreadsheetPreview.prevSheet", "Previous sheet")}</p>
        </TooltipContent>
      </Tooltip>
      <span
        className="min-w-0 flex-1 truncate text-center text-sm tabular-nums text-muted-foreground"
        title={current?.name}
      >
        {`${current?.name ?? ""} (${model.currentSheetIndex + 1} / ${model.sheets.length})`}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            disabled={!canNext}
            onClick={() =>
              model.setCurrentSheetIndex((i) =>
                Math.min(model.sheets.length - 1, i + 1),
              )
            }
          >
            <RemixIcon name="chevron_right" size="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("common.spreadsheetPreview.nextSheet", "Next sheet")}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  const sheetActions = (
    <div className="flex shrink-0 items-center gap-1">
      {path ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => revealItemInDir(path)}
            >
              <RemixIcon name="folder_open" size="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("common.filePreview.showInFolder", "Show in Folder")}</p>
          </TooltipContent>
        </Tooltip>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={model.handleExportCSV}
          >
            <RemixIcon name="download" size="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("common.spreadsheetPreview.exportCsv", "Export CSV")}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  if (variant === "spread") {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-2",
          className,
        )}
      >
        {sheetNav}
        {sheetActions}
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-wrap items-center justify-end gap-1", className)}
    >
      {sheetNav}
      {sheetActions}
    </div>
  );
}

/**
 * Table area and bottom statistics (no header): shares the same model with {@link SpreadsheetPreviewHeaderToolbar}.
 */
export function SpreadsheetPreviewScrollBody({
  model,
  className,
  maxHeight = "600px",
}: {
  model: SpreadsheetPreviewModel;
  className?: string;
  maxHeight?: string;
}) {
  if (model.loading) {
    return (
      <div
        className={cn("flex items-center justify-center p-8", className)}
        style={{ maxHeight }}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">
            Loading spreadsheet...
          </p>
        </div>
      </div>
    );
  }

  if (model.error) {
    return (
      <div
        className={cn("flex items-center justify-center p-8", className)}
        style={{ maxHeight }}
      >
        <div className="text-center text-destructive">
          <p className="mb-2 font-medium">Failed to load spreadsheet</p>
          <p className="text-sm text-muted-foreground">{model.error}</p>
        </div>
      </div>
    );
  }

  if (model.sheets.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center p-8", className)}
        style={{ maxHeight }}
      >
        <p className="text-muted-foreground">No sheets found</p>
      </div>
    );
  }

  const currentSheet = model.sheets[model.currentSheetIndex];

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {Array.from({ length: currentSheet.columnCount }).map(
                (_, colIndex) => {
                  const cellValue =
                    currentSheet.data[0]?.[colIndex] || `col-${colIndex}`;
                  return (
                    <th
                      key={cellValue}
                      className="min-w-[120px] border border-border px-4 py-2 text-left text-sm font-medium"
                    >
                      {currentSheet.data[0]?.[colIndex] ||
                        `Column ${colIndex + 1}`}
                    </th>
                  );
                },
              )}
            </tr>
          </thead>
          <tbody>
            {currentSheet.data.slice(1).map((row, rowIndex) => {
              const rowKey = `row-${rowIndex}-${row.slice(0, 3).join("|")}`;
              return (
                <tr key={rowKey} className="hover:bg-muted/50">
                  {Array.from({ length: currentSheet.columnCount }).map(
                    (_, colIndex) => {
                      const cellKey = `${rowKey}-col${colIndex}-${row[colIndex] || ""}`;
                      return (
                        <td
                          key={cellKey}
                          className="border border-border px-4 py-2 text-sm"
                        >
                          {row[colIndex] || ""}
                        </td>
                      );
                    },
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t bg-muted px-4 py-2 text-xs text-muted-foreground">
        {currentSheet.rowCount} rows × {currentSheet.columnCount} columns
      </div>
    </div>
  );
}

/**
 * Excel/Spreadsheet preview: supports .xlsx, .xls, .csv, .ods, etc.
 * For drawer, use {@link useSpreadsheetPreview} + {@link SpreadsheetPreviewHeaderToolbar} + {@link SpreadsheetPreviewScrollBody} with embedToolbar={false}.
 */
export function SpreadsheetPreview({
  file,
  path,
  className,
  maxHeight = "600px",
  embedToolbar = true,
}: SpreadsheetPreviewProps) {
  const model = useSpreadsheetPreview(file, { path, enabled: true });

  return (
    <div className={cn("flex flex-col", className)}>
      {embedToolbar ? (
        <div className="flex shrink-0 items-center border-b border-border/40 bg-background px-3 py-2">
          <SpreadsheetPreviewHeaderToolbar
            model={model}
            path={path}
            variant="spread"
          />
        </div>
      ) : null}
      <SpreadsheetPreviewScrollBody
        model={model}
        maxHeight={maxHeight}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
