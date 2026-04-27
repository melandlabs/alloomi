"use client";

import { cn } from "@/lib/utils";

const BRIEF_CATEGORIES = [
  { key: "urgent" as const, count: 2 },
  { key: "important" as const, count: 3 },
  { key: "monitor" as const, count: 2 },
] as const;

/** Category skeleton styles: use design tokens to match actual tags */
const CATEGORY_TAG_STYLES: Record<"urgent" | "important" | "monitor", string> =
  {
    urgent: "bg-destructive/10 border-destructive/30",
    important: "bg-accent-brand/10 border-accent-brand/30",
    monitor: "bg-primary/10 border-primary/30",
  };

const CATEGORY_TEXT_STYLES: Record<"urgent" | "important" | "monitor", string> =
  {
    urgent: "text-destructive",
    important: "text-accent-brand",
    monitor: "text-primary",
  };

/**
 * Skeleton for Chat Panel - matches the actual chat layout structure
 * Includes: message bubbles (AI and user), and input area placeholder
 */
export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat messages area */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto px-4 pt-4 pb-4">
        <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4">
          {/* AI message bubble */}
          <div className="flex gap-3">
            <div className="shrink-0 size-8 rounded-full bg-muted/60 animate-pulse" />
            <div className="flex-1 min-w-0 space-y-2">
              <div
                className="h-4 bg-muted/60 rounded animate-pulse"
                style={{ width: "60%" }}
              />
              <div
                className="h-4 bg-muted/40 rounded animate-pulse"
                style={{ width: "80%" }}
              />
              <div
                className="h-4 bg-muted/40 rounded animate-pulse"
                style={{ width: "40%" }}
              />
            </div>
          </div>

          {/* User message bubble */}
          <div className="flex gap-3 justify-end">
            <div className="flex-1 min-w-0 space-y-2 flex flex-col items-end">
              <div
                className="h-10 bg-muted/60 rounded-2xl animate-pulse"
                style={{ width: "50%" }}
              />
            </div>
          </div>

          {/* AI message bubble 2 */}
          <div className="flex gap-3">
            <div className="shrink-0 size-8 rounded-full bg-muted/60 animate-pulse" />
            <div className="flex-1 min-w-0 space-y-2">
              <div
                className="h-4 bg-muted/60 rounded animate-pulse"
                style={{ width: "70%" }}
              />
              <div
                className="h-4 bg-muted/40 rounded animate-pulse"
                style={{ width: "50%" }}
              />
            </div>
          </div>

          {/* Loading indicator */}
          <div className="flex items-center gap-2 justify-center py-2">
            <div className="size-4 bg-muted/60 rounded-full animate-pulse" />
            <div className="h-4 w-20 bg-muted/60 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Input area placeholder */}
      <div className="shrink-0 px-4 pb-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center gap-2 p-3 rounded-2xl border bg-muted/20 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted/40 animate-pulse" />
            <div className="flex-1 h-8 bg-muted/40 rounded-full animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-muted/40 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for Brief Panel - matches the actual layout structure
 * Includes: stats area, category headers, and insight items with checkboxes
 */
export function PanelSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 w-full overflow-y-auto px-6 pt-0 pb-6">
        <div className="px-0 flex flex-col min-h-full h-full pb-4">
          {/* BriefPanelStats area skeleton */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/* Text line for message stats */}
            <div className="h-4 w-48 bg-muted/60 rounded animate-pulse" />
            {/* Platform icons */}
            <div className="flex items-center -space-x-1.5">
              <div className="relative flex items-center justify-center rounded-full border-2 border-card bg-muted size-5 animate-pulse" />
              <div
                className="relative flex items-center justify-center rounded-full border-2 border-card bg-muted size-5 animate-pulse"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="relative flex items-center justify-center rounded-full border-2 border-card bg-muted size-5 animate-pulse"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>

          {/* Category blocks */}
          {BRIEF_CATEGORIES.map(({ key, count }, index) => (
            <div key={key} className={cn(index > 0 && "mt-5")}>
              {/* Category header */}
              <div className="flex items-center justify-between gap-2 w-full min-w-0 mb-1">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shrink-0 animate-pulse",
                    CATEGORY_TAG_STYLES[key],
                  )}
                >
                  {/* Icon placeholder */}
                  <div
                    className={cn(
                      "size-3.5 rounded-sm opacity-60",
                      CATEGORY_TEXT_STYLES[key],
                    )}
                  />
                  {/* Category text placeholder */}
                  <div
                    className={cn(
                      "h-3 w-12 rounded-sm",
                      CATEGORY_TEXT_STYLES[key],
                      "opacity-80",
                    )}
                  />
                  {/* Count placeholder */}
                  <div
                    className={cn(
                      "h-3 w-5 rounded-sm",
                      CATEGORY_TEXT_STYLES[key],
                      "opacity-60",
                    )}
                  />
                </div>
                {/* "View more" button placeholder */}
                <div className="h-7 w-16 bg-muted/40 rounded-sm animate-pulse" />
              </div>

              {/* Insight items */}
              <div className="space-y-0">
                {count >= 1 && (
                  <div
                    key={`${key}-item-0`}
                    className="flex items-center gap-2 py-2 min-w-0"
                  >
                    <div className="shrink-0 size-4 bg-muted/60 rounded-sm animate-pulse" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div
                        className="h-4 bg-muted/60 rounded animate-pulse"
                        style={{ width: "65%" }}
                      />
                      <div className="h-3 bg-muted/40 rounded-sm animate-pulse w-20" />
                    </div>
                  </div>
                )}
                {count >= 2 && (
                  <div
                    key={`${key}-item-1`}
                    className="flex items-center gap-2 py-2 min-w-0"
                  >
                    <div className="shrink-0 size-4 bg-muted/60 rounded-sm animate-pulse" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div
                        className="h-4 bg-muted/60 rounded animate-pulse"
                        style={{ width: "75%" }}
                      />
                    </div>
                  </div>
                )}
                {count >= 3 && (
                  <div
                    key={`${key}-item-2`}
                    className="flex items-center gap-2 py-2 min-w-0"
                  >
                    <div className="shrink-0 size-4 bg-muted/60 rounded-sm animate-pulse" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div
                        className="h-4 bg-muted/60 rounded animate-pulse"
                        style={{ width: "85%" }}
                      />
                      <div className="h-3 bg-muted/40 rounded-sm animate-pulse w-20" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading more indicator skeleton */}
          <div className="flex items-center justify-center p-2 gap-2 mt-2">
            <div className="size-4 bg-muted/60 rounded-full animate-pulse" />
            <div className="h-4 w-12 bg-muted/60 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
