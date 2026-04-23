"use client";

import { useTranslation } from "react-i18next";
import "../../i18n";
import type { BriefMessageStats } from "@/hooks/use-brief-panel-state";

export interface BriefPanelStatsProps {
  messageStats: BriefMessageStats;
  assistantName?: string;
  insightCount?: number;
}

/**
 * Brief panel stats text: number of information sources processed in the past 24 hours (displayed in header)
 */
export function BriefPanelStats({ messageStats }: BriefPanelStatsProps) {
  const { t } = useTranslation();
  const count = messageStats.messageCount;

  return (
    <p className="text-sm text-muted-foreground pt-0">
      {t("brief.stats.messageCountShort", { messageCount: count })}
    </p>
  );
}
