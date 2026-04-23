"use client";

import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import { useChatContext } from "./chat-context";
import { useGlobalInsightDrawer } from "@/components/global-insight-drawer";
import { cn } from "@/lib/utils";

/**
 * Focused Insight Badge component displayed inside the input field
 * Displayed as rounded badge, shows only title, width limited to 160px
 * Left side click opens insight drawer, right side X button removes focus
 */
export function FocusedInsightBadges() {
  const { t } = useTranslation();
  const { focusedInsights, removeFocusedInsight } = useChatContext();
  const { openDrawer } = useGlobalInsightDrawer();

  if (focusedInsights.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-2 pb-1">
      {focusedInsights.map((insight) => (
        <div
          key={insight.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-[10px] px-3 py-1.5",
            "max-w-[160px] min-w-0",
            "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700",
            "border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
            "text-xs font-medium text-foreground",
            "transition-colors cursor-pointer",
            "group",
          )}
          title={insight.title}
        >
          <button
            type="button"
            onClick={() => openDrawer(insight)}
            className="truncate flex-1 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer text-foreground"
            title={insight.title}
          >
            {insight.title}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeFocusedInsight(insight.id);
            }}
            className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0 bg-transparent border-0 p-0 cursor-pointer text-foreground"
            aria-label={t("insight.removeFocus", "Remove this focus")}
          >
            <RemixIcon name="close" size="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
