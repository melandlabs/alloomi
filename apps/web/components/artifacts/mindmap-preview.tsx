"use client";

import { useEffect, useRef } from "react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";

export interface MindMapPreviewProps {
  /** Markdown content for the mind map */
  content: string;
  /** Optional file name */
  filename?: string;
  /** Optional className */
  className?: string;
  /** Optional max height */
  maxHeight?: string;
}

/**
 * Mind map preview component using markmap
 */
export function MindMapPreview({
  content,
  filename,
  className,
  maxHeight = "500px",
}: MindMapPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);

  useEffect(() => {
    if (!svgRef.current || !content?.trim()) return;

    const transformer = new Transformer();
    const { root } = transformer.transform(content);

    if (markmapRef.current) {
      markmapRef.current.destroy();
    }

    markmapRef.current = Markmap.create(
      svgRef.current,
      { autoFit: true, initialExpandLevel: 99 },
      root,
    );

    // Auto-fit the mind map to fill available space
    setTimeout(() => {
      if (markmapRef.current) {
        markmapRef.current.fit();
      }
    }, 0);

    return () => {
      if (markmapRef.current) {
        markmapRef.current.destroy();
        markmapRef.current = null;
      }
    };
  }, [content]);

  if (!content?.trim()) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 text-center bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800",
        )}
      >
        <RemixIcon
          name="mind-map"
          size="size-12"
          className="text-neutral-400 mb-4"
        />
        <p className="text-neutral-600 dark:text-neutral-300 font-medium mb-2">
          No content
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm",
        className,
      )}
    >
      {/* Header */}
      {filename && (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-900 shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm">
            <RemixIcon name="mind-map" size="size-4" className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
              {filename}
            </p>
          </div>
        </div>
      )}

      {/* Mind map container */}
      <div className="flex-1 overflow-auto p-4 min-h-0" style={{ maxHeight }}>
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  );
}
