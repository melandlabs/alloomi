"use client";

import { cn } from "@/lib/utils";

interface LibraryDocxInlinePreviewProps {
  html: string;
  className?: string;
}

/**
 * Simplified DOCX inline preview for grid cards: renders HTML from mammoth,
 * no external open button, scrollable.
 */
export function LibraryDocxInlinePreview({
  html,
  className,
}: LibraryDocxInlinePreviewProps) {
  return (
    <div
      className={cn(
        "overflow-auto p-3 bg-neutral-100 dark:bg-neutral-900",
        className,
      )}
    >
      <div
        className="mammoth-docx-preview bg-card mx-auto max-w-[900px] rounded-md border border-border p-4 text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
