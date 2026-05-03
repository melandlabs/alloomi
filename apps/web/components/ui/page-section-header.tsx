"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface PageSectionHeaderProps {
  /** Page title (string or custom ReactNode) */
  title: string | ReactNode;
  /** Optional subtitle under the title (muted body text) */
  description?: ReactNode;
  /** Right-side action area */
  children?: ReactNode;
  className?: string;
  /** Area below title (e.g., tabs, subtitle) */
  footer?: ReactNode;
}

/**
 * Unified page header component for single-column pages
 * Used for brief, automation, library, audit, personal settings, files, skills, etc., with styles consistent with AgentSectionHeader.
 * Style conventions: left/right padding 24px (px-6); white background (bg-card), no divider; title (when string) text-3xl font-serif font-semibold tracking-tight; consistent with AgentSectionHeader styles.
 */
export function PageSectionHeader({
  title,
  description,
  children,
  className,
  footer,
}: PageSectionHeaderProps) {
  const isTitleString = typeof title === "string";
  const hasFooter = footer !== undefined && footer !== null && footer !== false;
  const hasDescription =
    description !== undefined && description !== null && description !== false;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-card py-4 px-6 shrink-0",
        hasFooter ? "flex flex-col gap-3" : "flex flex-col",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full min-w-0 gap-4",
          hasDescription ? "items-start" : "items-center",
        )}
      >
        <div
          className={cn(
            "min-w-0",
            hasDescription ? "flex flex-1 flex-col gap-1.5" : "flex-1",
          )}
        >
          {isTitleString ? (
            <span className="truncate text-3xl font-serif font-semibold tracking-tight text-foreground leading-10">
              {title}
            </span>
          ) : (
            <div className="flex min-w-0 font-serif">{title}</div>
          )}
          {hasDescription && (
            <p className="max-w-full text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children ? (
          <div className="flex shrink-0 flex-shrink-0 items-center gap-2">
            {children}
          </div>
        ) : null}
      </div>
      {hasFooter && <div className="w-full">{footer}</div>}
    </header>
  );
}
