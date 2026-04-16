"use client";

import { cn } from "@/lib/utils";
import type { ExcelSheet } from "@/hooks/use-library-preview-snapshot";

interface LibrarySpreadsheetInlinePreviewProps {
  sheets: ExcelSheet[];
  loading?: boolean;
  className?: string;
}

/**
 * Simplified spreadsheet inline preview for grid cards: renders first 50 rows × 20 columns,
 * simplified table header, scrollable.
 */
export function LibrarySpreadsheetInlinePreview({
  sheets,
  loading,
  className,
}: LibrarySpreadsheetInlinePreviewProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center p-4 bg-neutral-100 dark:bg-neutral-900",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!sheets || sheets.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center p-4 bg-neutral-100 dark:bg-neutral-900",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">No data</p>
      </div>
    );
  }

  const activeSheet = sheets[0];

  return (
    <div
      className={cn(
        "overflow-auto bg-neutral-100 dark:bg-neutral-900",
        className,
      )}
    >
      <table className="w-full border-collapse text-xs">
        <tbody>
          {activeSheet.data.map((row, ri) => (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: Snapshot rows have no stable id
              key={`row-${ri}`}
              className={cn(
                "border-b border-border",
                ri === 0 && "bg-muted/75 font-medium",
              )}
            >
              {row.map((cell, ci) => (
                <td
                  // biome-ignore lint/suspicious/noArrayIndexKey: Snapshot cells have no stable id
                  key={`cell-${ci}`}
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
  );
}
