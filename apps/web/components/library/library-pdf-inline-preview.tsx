"use client";

import type { RenderedPage } from "@/components/artifacts/pdf-preview";
import { cn } from "@/lib/utils";

interface LibraryPdfInlinePreviewProps {
  pages: RenderedPage[];
  className?: string;
}

/**
 * Simplified PDF inline preview for grid cards: renders first 3 pages at scale 0.4,
 * no pagination/zoom controls, scrollable.
 */
export function LibraryPdfInlinePreview({
  pages,
  className,
}: LibraryPdfInlinePreviewProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 overflow-auto p-2 bg-neutral-100 dark:bg-neutral-900",
        className,
      )}
    >
      {pages.map((page) => (
        <img
          key={page.index}
          src={page.dataUrl}
          alt={`Page ${page.index + 1}`}
          draggable={false}
          className="w-full object-contain shadow-md bg-white"
        />
      ))}
    </div>
  );
}
