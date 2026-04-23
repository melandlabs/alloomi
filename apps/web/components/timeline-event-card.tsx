"use client";

import { useEffect, useRef, useState } from "react";
import { RemixIcon } from "@/components/remix-icon";
import type { TimelineData } from "@/lib/ai/subagents/insights";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { normalizeTimestamp } from "@/lib/utils";

interface TimelineEventCardProps {
  event: TimelineData & {
    version?: number;
    changeCount?: number;
    lastUpdatedAt?: number;
  };
  locale?: "en" | "zh";
  showHistory?: () => void;
  hideDate?: boolean;
  isSelected?: boolean;
  isExpanded?: boolean;
  isHovered?: boolean;
  onToggleExpand?: () => void;
  /** Called when the user clicks on the action badge */
  onActionClick?: (action: string) => void;
}

/**
 * TimelineEventCard: Renders a single event card in the "changelog/timeline" view.
 * This component displays the event title, urgency level, and version/time information in the footer.
 */
export function TimelineEventCard({
  event,
  locale = "en",
  showHistory,
  hideDate = false,
  isSelected = false,
  isExpanded = false,
  isHovered = false,
  onToggleExpand,
  onActionClick,
}: TimelineEventCardProps) {
  const { t } = useTranslation();
  const summaryRef = useRef<HTMLHeadingElement | null>(null);
  const [canExpand, setCanExpand] = useState(false);

  // Determine urgency color and text
  const urgencyConfig = {
    urgent: {
      color: "text-red-600",
      label: t("insightDetail.timelineHistory.urgency.urgent"),
    },
    warning: {
      color: "text-yellow-600",
      label: t("insightDetail.timelineHistory.urgency.warning"),
    },
    normal: {
      color: "text-gray-600",
      label: "",
    },
  }[event.urgency || "normal"] || {
    color: "text-gray-600",
    label: "",
  };

  const dateLocale = locale === "zh" ? zhCN : enUS;

  /**
   * Format event display time, prefer event time first, then use update time.
   */
  const formatEventTime = () => {
    if (event.time) {
      return format(new Date(normalizeTimestamp(event.time)), "dd/MM HH:mm", {
        locale: dateLocale,
      });
    }
    if (event.lastUpdatedAt) {
      return format(
        new Date(normalizeTimestamp(event.lastUpdatedAt)),
        "dd/MM HH:mm",
        {
          locale: dateLocale,
        },
      );
    }
    return "";
  };

  /**
   * Detect if title exceeds 3 lines when collapsed, used to decide whether to show “expand/collapse” button.
   */
  useEffect(() => {
    if (isExpanded) return;
    const el = summaryRef.current;
    if (!el) return;

    const detectOverflow = () => {
      setCanExpand(el.scrollHeight - el.clientHeight > 1);
    };

    detectOverflow();
    window.addEventListener("resize", detectOverflow);
    return () => {
      window.removeEventListener("resize", detectOverflow);
    };
  }, [event.summary, isExpanded]);

  return (
    <div className="rounded-none border-0 border-transparent bg-transparent p-0 pr-0 transition-shadow">
      {/* Meta row: time is always visible, action + expand only on hover */}
      {!hideDate && (
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatEventTime()}</span>
          <div className="flex items-center gap-2">
            {event.action && (
              <button
                type="button"
                onClick={() => event.action && onActionClick?.(event.action)}
                className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
              >
                {event.action}
              </button>
            )}
            {isHovered && canExpand && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={onToggleExpand}
              >
                <RemixIcon
                  name={isExpanded ? "arrow_up_s" : "arrow_down_s"}
                  size="size-3"
                />
                <span>
                  {isExpanded
                    ? t("common.collapse", "Collapse")
                    : t("common.expand", "Expand")}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header: Urgency label + Title */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3
          ref={summaryRef}
          className={`flex-1 text-sm font-medium ${
            isSelected || isHovered
              ? "text-foreground"
              : "text-muted-foreground"
          }`}
          style={
            isExpanded
              ? undefined
              : {
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }
          }
        >
          {urgencyConfig.label && (
            <span className={`mr-2 ${urgencyConfig.color}`}>
              {urgencyConfig.label}：
            </span>
          )}
          {event.summary}
        </h3>

        {/* Update icon (if changed) */}
        {(event.changeCount || 0) > 0 && showHistory && (
          <button
            type="button"
            onClick={showHistory}
            className="flex items-center gap-1 text-teal-500 hover:text-teal-600 text-sm transition-colors"
          >
            <RemixIcon name="rotate_cw" size="size-4" />
            <span className="hidden sm:inline">
              {t("insightDetail.timelineHistory.update")}
            </span>
          </button>
        )}
      </div>

      {/* Footer: Version */}
      <div className="flex items-center justify-end text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {/* Version badge */}
          {event.version && event.version > 1 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t("insightDetail.timelineHistory.version")}
              {event.version}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
