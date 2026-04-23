"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";

/**
 * Statistics data type
 */
export interface InsightStats {
  totalMessages: number;
  urgentCount: number;
  mentionsCount: number;
  actionItemsCount: number;
}

/**
 * Stats bar component props
 */
export interface InsightStatsBarProps {
  /**
   * Statistics data
   */
  stats: InsightStats;
  /**
   * Currently active filter
   */
  activeFilter?: string;
  /**
   * Filter change callback
   */
  onFilterChange?: (filter: string) => void;
}

/**
 * Focus stats bar component
 * Displays event statistics, supports click to toggle filtering
 *
 * @param props - Component props
 * @returns Stats bar component
 */
export function InsightStatsBar({
  stats,
  activeFilter,
  onFilterChange,
}: InsightStatsBarProps) {
  const { t } = useTranslation();

  /**
   * Stats item configuration
   */
  const statItems = [
    {
      key: "all",
      iconName: "inbox",
      label: t("insight.filter.all"),
      count: stats.totalMessages,
      color: "",
    },
    {
      key: "priority",
      iconName: "error_warning",
      label: t("insight.filter.priority"),
      count: stats.urgentCount,
      color: "text-red-600",
    },
    {
      key: "mentions",
      iconName: "at_sign",
      label: t("insight.filter.mentions"),
      count: stats.mentionsCount,
      color: "",
    },
    {
      key: "actionItems",
      iconName: "circle_check",
      label: t("insight.filter.actionItems"),
      count: stats.actionItemsCount,
      color: "text-green-600",
    },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 md:p-4 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs md:text-sm">
        {statItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onFilterChange?.(item.key)}
            className={`flex flex-col items-center cursor-pointer transition-colors rounded-md p-2 ${
              activeFilter === item.key
                ? "bg-primary/10 text-primary"
                : "hover:bg-gray-50"
            }`}
          >
            <div className="text-gray-500 flex items-center mb-1">
              <RemixIcon
                name={item.iconName}
                size="size-4"
                className={cn("mr-1", item.color)}
              />
              {item.label}
            </div>
            <div className={`font-medium ${item.color || ""}`}>
              {item.count}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
