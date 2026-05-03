"use client";

import type React from "react";
import { RemixIcon } from "@/components/remix-icon";

export type AttachmentPreviewBadgeVariant =
  | "local"
  | "workspace"
  | "rag"
  | "uploading";

type AttachmentPreviewBadgeProps = {
  variant: AttachmentPreviewBadgeVariant;
  name: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
  actionsSlot?: React.ReactNode;
  isBusy?: boolean;
  removeAriaLabel?: string;
  showRemoveButton?: boolean;
  dataTestId?: string;
};

/**
 * Render attachment preview in a unified badge style.
 */
export function AttachmentPreviewBadge({
  variant,
  name,
  icon,
  onClick,
  onRemove,
  actionsSlot,
  isBusy = false,
  removeAriaLabel,
  showRemoveButton = true,
  dataTestId,
}: AttachmentPreviewBadgeProps) {
  /**
   * Keep a consistent badge max width across all attachment sources.
   */
  const containerMaxWidthClass = "max-w-[160px]";
  const contentClassName = `inline-flex h-8 min-w-0 ${containerMaxWidthClass} shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 text-xs`;
  const removeButton = showRemoveButton ? (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      disabled={isBusy}
      aria-label={removeAriaLabel}
    >
      {isBusy ? (
        <span className="animate-spin">
          <RemixIcon name="loader_4" size="size-3" />
        </span>
      ) : (
        <RemixIcon name="close" size="size-3" />
      )}
    </button>
  ) : null;
  const content = (
    <>
      <span className="shrink-0 text-muted-foreground">
        {icon ?? <RemixIcon name="file_text" size="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1 truncate font-normal text-foreground">
        {name}
      </span>
      {actionsSlot}
      {removeButton}
    </>
  );

  return (
    <div className="inline-flex min-w-0 shrink-0 items-center">
      {onClick ? (
        <button
          type="button"
          className={`${contentClassName} cursor-pointer transition-colors hover:bg-muted/60`}
          data-testid={dataTestId}
          onClick={onClick}
        >
          {content}
        </button>
      ) : (
        <div className={contentClassName} data-testid={dataTestId}>
          {content}
        </div>
      )}
    </div>
  );
}
