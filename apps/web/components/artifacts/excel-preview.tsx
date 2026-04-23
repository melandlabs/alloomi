"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import * as JSZipModule from "jszip";

/** JSZip module type (export = JSZip, has both constructor and static methods like loadAsync) */
type JSZipType = import("jszip");
const JSZip = ((JSZipModule as { default?: JSZipType }).default ??
  JSZipModule) as JSZipType;
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface ExcelSheet {
  name: string;
  data: string[][];
}

interface ExcelPreviewProps {
  artifact: {
    path: string;
    name: string;
  };
}

const MAX_PREVIEW_SIZE = 100 * 1024 * 1024; // 100MB

/**
 *
 * Supports .xlsx, .xls, .csv file preview
 * Uses SheetJS (xlsx) library to parse Excel files
 */
export function ExcelPreview({ artifact }: ExcelPreviewProps) {
  const { t } = useTranslation();
  const [sheets, setSheets] = useState<ExcelSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileTooLarge, setFileTooLarge] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [colCount, setColCount] = useState(0);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const handleOpenExternal = async () => {
    if (!artifact.path) return;
    try {
      const { openPathCustom } = await import("@/lib/tauri");
      await openPathCustom(artifact.path);
    } catch (err) {
      console.error("[ExcelPreview] Failed to open file:", err);
    }
  };

  const handleShowInFolder = async () => {
    if (!artifact.path) return;
    try {
      const { revealItemInDir } = await import("@/lib/tauri");
      await revealItemInDir(artifact.path);
    } catch (err) {
      console.error("[ExcelPreview] Failed to show in folder:", err);
    }
  };

  useEffect(() => {
    async function loadExcel() {
      if (!artifact.path) {
        setError("No Excel file path available");
        setLoading(false);
        return;
      }

      console.log("[ExcelPreview] Loading Excel from path:", artifact.path);

      try {
        // Only use custom commands in Tauri desktop environment
        const { readFileBinary, fileStat } = await import("@/lib/tauri");

        // Parse path: handle relative path cases
        const filePath = artifact.path;

        console.log("[ExcelPreview] Resolved file path:", filePath);

        // Check file size
        const fileInfo = await fileStat(filePath);
        if (!fileInfo) {
          setError("Failed to get file information");
          setLoading(false);
          return;
        }
        if (fileInfo.size > MAX_PREVIEW_SIZE) {
          console.log("[ExcelPreview] File too large:", fileInfo.size);
          setFileTooLarge(fileInfo.size);
          setLoading(false);
          return;
        }

        // Read file
        const data = await readFileBinary(filePath);
        if (!data) {
          setError("Failed to read file");
          setLoading(false);
          return;
        }
        // Create a proper Uint8Array slice with correct offset and length
        const sourceArray = new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength,
        );
        const arrayBuffer = sourceArray.buffer.slice(
          sourceArray.byteOffset,
          sourceArray.byteOffset + sourceArray.byteLength,
        ) as ArrayBuffer;

        console.log("[ExcelPreview] Loaded", arrayBuffer.byteLength, "bytes");

        // Check if this is a valid ZIP/XLSX file (should start with PK header: 50 4b)
        const headerView = new Uint8Array(arrayBuffer.slice(0, 4));
        const isZipFile = headerView[0] === 0x50 && headerView[1] === 0x4b; // "PK" signature

        // Parse Excel
        let workbook: XLSX.WorkBook;

        // Try direct parsing
        try {
          workbook = XLSX.read(arrayBuffer, { type: "array" });
        } catch (directError) {
          console.error("[ExcelPreview] Direct parse failed:", directError);

          // If not a ZIP file, try to parse as CSV/text
          if (!isZipFile) {
            console.warn(
              "[ExcelPreview] Not a valid ZIP/XLSX file, trying to parse as CSV/text",
            );
            try {
              const decoder = new TextDecoder("utf-8", { fatal: false });
              const textContent = decoder.decode(arrayBuffer);

              // Try to parse as CSV
              workbook = XLSX.read(textContent, { type: "string" });
              console.log("[ExcelPreview] Parsed as text/CSV successfully");
            } catch (textError) {
              console.error(
                "[ExcelPreview] Failed to parse as text:",
                textError,
              );
              throw new Error(
                `${t("common.excelPreview.parseError")}\n\n${t("common.excelPreview.notValidExcel")}\n\n${t("common.excelPreview.textParseError")}: ${
                  textError instanceof Error
                    ? textError.message
                    : String(textError)
                }`,
              );
            }
          } else {
            // Try using JSZip as fallback
            try {
              console.log("[ExcelPreview] Trying JSZip fallback...");
              const zip = await JSZip.loadAsync(arrayBuffer);

              // Re-compress to standard format
              const newZip = new JSZip();
              const fileNames = Object.keys(zip.files);

              for (const name of fileNames) {
                const file = zip.files[name];
                if (!file.dir) {
                  const content = await file.async("uint8array");
                  newZip.file(name, content);
                }
              }

              const recompressedData = await newZip.generateAsync({
                type: "uint8array",
                compression: "DEFLATE",
                compressionOptions: { level: 6 },
              });

              workbook = XLSX.read(recompressedData, { type: "array" });
              console.log("[ExcelPreview] JSZip fallback succeeded");
            } catch (zipError) {
              console.error(
                "[ExcelPreview] JSZip fallback also failed:",
                zipError,
              );
              throw new Error(
                `${t("common.excelPreview.parseError")}\n\n${t("common.excelPreview.directParseError")}: ${
                  directError instanceof Error
                    ? directError.message
                    : String(directError)
                }\n\n${t("common.excelPreview.zipFallbackError")}: ${
                  zipError instanceof Error
                    ? zipError.message
                    : String(zipError)
                }`,
              );
            }
          }
        }

        // Convert all worksheets
        const excelSheets: ExcelSheet[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];

          // Convert to 2D array
          const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
            header: 1,
            defval: "",
          });

          excelSheets.push({
            name: sheetName,
            data: jsonData,
          });
        });

        if (excelSheets.length === 0) {
          throw new Error(t("common.excelPreview.noWorksheet"));
        }

        console.log("[ExcelPreview] Parsed", excelSheets.length, "sheets");

        setSheets(excelSheets);

        // Set active worksheet row and column count
        if (excelSheets.length > 0) {
          const activeSheet = excelSheets[0];
          setRowCount(activeSheet.data.length);
          setColCount(
            activeSheet.data.length > 0 ? activeSheet.data[0]?.length || 0 : 0,
          );
        }

        setError(null);
        setErrorDetails(null);
      } catch (err) {
        console.error("[ExcelPreview] Failed to load Excel:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(t("common.excelPreview.loadFailed"));
        setErrorDetails(errorMsg);
      } finally {
        setLoading(false);
      }
    }

    loadExcel();
  }, [artifact.path]);

  // Switch worksheet
  const handleSheetChange = (index: number) => {
    setActiveSheetIndex(index);
    const sheet = sheets[index];
    setRowCount(sheet.data.length);
    setColCount(sheet.data.length > 0 ? sheet.data[0]?.length || 0 : 0);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <RemixIcon
          name="loader_2"
          size="size-8"
          className="text-muted-foreground animate-spin"
        />
        <p className="text-muted-foreground mt-4 text-sm">
          {t("common.excelPreview.loading")}
        </p>
      </div>
    );
  }

  // File too large
  if (fileTooLarge !== null) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <RemixIcon
              name="file_spreadsheet"
              size="size-10"
              className="text-green-500"
            />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {t("common.excelPreview.fileTooLargeDesc", {
              size: (fileTooLarge / 1024 / 1024).toFixed(1),
            })}
          </p>
          <button
            type="button"
            onClick={handleOpenExternal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <RemixIcon name="external_link" size="size-4" />
            {t("common.excelPreview.openInExcel")}
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (error || sheets.length === 0) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-lg flex-col items-center text-center">
          <div className="bg-red-500/10 mb-4 flex size-20 items-center justify-center rounded-full">
            <RemixIcon
              name="error_warning"
              size="size-10"
              className="text-red-500"
            />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {error || t("common.excelPreview.noSheetsAvailable")}
          </p>

          {/* Show detailed error info */}
          {errorDetails && (
            <details className="mb-4 w-full text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                {t("common.excelPreview.viewErrorDetails")}
              </summary>
              <pre className="mt-2 overflow-auto rounded-md bg-black/50 p-3 text-xs text-red-300">
                {errorDetails}
              </pre>
            </details>
          )}

          <button
            type="button"
            onClick={handleOpenExternal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <RemixIcon name="external_link" size="size-4" />
            {t("common.excelPreview.openInExcel")}
          </button>
        </div>
      </div>
    );
  }

  const activeSheet = sheets[activeSheetIndex];

  return (
    <div className="bg-muted/30 flex h-full flex-col">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="border-border bg-background shrink-0 border-b">
          <div className="flex gap-1 overflow-x-auto p-2">
            {sheets.map((sheet, index) => (
              <button
                key={sheet.name}
                type="button"
                onClick={() => handleSheetChange(index)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  index === activeSheetIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {sheet.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table display */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {activeSheet.data.map((row, rowIndex) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: Static Excel data without unique IDs
                key={`row-${rowIndex}`}
                className={cn(
                  "border-b border-border",
                  rowIndex === 0 && "bg-muted/50 font-medium",
                )}
              >
                {/* Row number */}
                <td className="sticky left-0 bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {rowIndex + 1}
                </td>

                {/* Cells */}
                {row.map((cell, cellIndex) => (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: Static Excel data without unique IDs
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className="border-r border-border px-3 py-1"
                  >
                    {cell !== null && cell !== undefined && cell !== ""
                      ? String(cell)
                      : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Row count statistics; "Show in Folder / Open in Excel" provided by {@link FilePreviewDrawerHeader} */}
      <div className="border-border bg-background shrink-0 border-t px-3 py-1.5 text-xs text-muted-foreground">
        {t("common.excelPreview.rowColCount", { rowCount, colCount })}
      </div>
    </div>
  );
}
