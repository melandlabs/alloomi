"use client";

import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getToolRunningText } from "@/lib/utils/tool-names";

interface RunningIndicatorProps {
  isRunning: boolean;
  currentTool?: string;
  className?: string;
}

/**
 * Running status indicator.
 */
export function RunningIndicator({
  isRunning,
  currentTool,
  className,
}: RunningIndicatorProps) {
  const { t } = useTranslation();

  if (!isRunning) {
    return null;
  }

  const getActivityText = () => {
    if (!currentTool) {
      return t("common.runningIndicator.thinking");
    }

    return getToolRunningText(currentTool, t);
  };

  const getActivityIcon = () => {
    if (!currentTool) {
      return <RemixIcon name="search" size="size-4" />;
    }

    // Extract tool name without prefix
    const toolNameWithoutPrefix = currentTool.includes("__")
      ? currentTool.split("__").pop() || currentTool
      : currentTool;

    switch (toolNameWithoutPrefix) {
      case "Bash":
        return <RemixIcon name="terminal" size="size-4" />;
      case "WebSearch":
      case "WebFetch":
        return <RemixIcon name="globe" size="size-4" />;
      case "Read":
      case "Write":
      case "Edit":
        return <RemixIcon name="file_text" size="size-4" />;
      case "chatInsight":
      case "searchKnowledgeBase":
      case "getFullDocumentContent":
      case "listKnowledgeBaseDocuments":
      case "searchMemoryPath":
        return <RemixIcon name="search" size="size-4" />;
      case "queryContacts":
      case "queryIntegrations":
        return <RemixIcon name="user" size="size-4" />;
      case "sendReply":
        return <RemixIcon name="send_plane" size="size-4" />;
      case "createInsight":
      case "modifyInsight":
        return <RemixIcon name="message" size="size-4" />;
      case "getRawMessages":
      case "searchRawMessages":
        return <RemixIcon name="search" size="size-4" />;
      default:
        return <RemixIcon name="search" size="size-4" />;
    }
  };

  return (
    <div className={cn("flex items-center gap-2 py-2 text-sm", className)}>
      {/* Spinning loading icon */}
      <RemixIcon
        name="loader_2"
        size="size-4"
        className="animate-spin text-primary"
      />
      {/* Activity icon */}
      <span className="text-muted-foreground">{getActivityIcon()}</span>
      {/* Activity text */}
      <span className="text-muted-foreground">{getActivityText()}</span>
    </div>
  );
}
