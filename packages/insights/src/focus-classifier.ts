/**
 * Event tag type
 */
export type InsightTag =
  | "important"
  | "urgent"
  | "action-items"
  | "mentions-me";

/**
 * Focus classification type
 */
export type FocusCategory =
  | "immediate" // Needs immediate handling
  | "high-priority" // High priority todo
  | "important-info" // Important information
  | "follow-up" // Needs follow-up
  | null; // Don't display

/**
 * Classification metadata
 */
export interface FocusCategoryMeta {
  category: FocusCategory;
  icon: string;
  labelKey: string;
}

export const insightIsImport = (insight: {
  importance?: string | null;
  urgency?: string | null;
  hasMyNickname?: boolean;
  hasActions?: boolean;
}) => {
  return (
    insight.importance === "Important" ||
    insight.importance === "important" ||
    insight.importance === "High" ||
    insight.importance === "high"
  );
};

export const insightIsUrgent = (insight: {
  importance?: string | null;
  urgency?: string | null;
  hasMyNickname?: boolean;
  hasActions?: boolean;
}) => {
  return (
    insight.urgency === "Urgent" ||
    insight.urgency === "urgent" ||
    insight.urgency === "As soon as possible" ||
    insight.urgency === "as soon as possible" ||
    insight.urgency === "ASAP" ||
    insight.urgency === "asap" ||
    insight.urgency === "Immediate" ||
    insight.urgency === "immediate"
  );
};

export const insightIsImportOrUrgent = (insight: {
  importance?: string | null;
  urgency?: string | null;
  hasMyNickname?: boolean;
  hasActions?: boolean;
}) => insightIsImport(insight) || insightIsUrgent(insight);

/**
 * Extract tags from Insight
 * Extract corresponding tags based on Insight properties for subsequent classification
 *
 * Tag types:
 * - "important": when importance is "Important" or "important"
 * - "urgent": when urgency is "As soon as possible" or "as soon as possible"
 * - "mentions-me": when hasMyNickname is true
 * - "action-items": when hasActions is true
 *
 * @param insight - Insight object, containing properties like importance, urgency, whether mentions me, whether unreplied, whether has action items
 * @returns Tag array, may include: important, urgent, unreplied, action-items, mentions-me
 */
export function extractInsightTags(insight: {
  importance?: string | null;
  urgency?: string | null;
  hasMyNickname?: boolean;
  hasActions?: boolean;
  isUnreplied?: boolean;
}): InsightTag[] {
  const tags: InsightTag[] = [];

  // Importance tag
  if (insightIsImport(insight)) {
    tags.push("important");
  }

  // Urgency tag
  if (insightIsUrgent(insight)) {
    tags.push("urgent");
  }

  // Mentions me tag
  if (insight.hasMyNickname) {
    tags.push("mentions-me");
  }

  // Action items tag (combined: unreplied OR has actions)
  if (insight.hasActions || insight.isUnreplied) {
    tags.push("action-items");
  }

  return tags;
}

/**
 * Insight data type (for classification)
 */
export type InsightForClassification = {
  importance?: string | null;
  urgency?: string | null;
  hasMyNickname?: boolean;
  hasActions?: boolean;
  isUnreplied?: boolean;
  myTasks?: Array<any> | null;
};

/**
 * Check if there are incomplete tasks in myTasks
 * @param myTasks - Task array
 * @returns Whether there are incomplete tasks
 */
function hasIncompleteTasks(myTasks: Array<any> | null | undefined): boolean {
  if (!myTasks || myTasks.length === 0) {
    return false;
  }

  // Check if there are tasks with status not equal to "completed"
  return myTasks.some((task) => task.status !== "completed");
}

/**
 * Classify events based on tag array
 * Evaluate according to optimized rules in order, return immediately after matching
 *
 * Classification rules (in priority order):
 * 1. Needs immediate handling: contains "urgent" (regardless of action items)
 * 2. Important Todo: contains "myTasks" and has incomplete tasks
 * 3. Important info: contains "important" and no incomplete tasks and not urgent
 * 4. Follow-up: contains "mentions-me"
 * 5. Don't display: tags are empty
 *
 * @param insight - Insight object
 * @returns Classification result, null means do not display
 */
export function classifyFocusInsight(
  insight: InsightForClassification,
): FocusCategory {
  // Extract tags first
  const tags = extractInsightTags(insight);

  // Rule 1: Needs immediate handling
  // Condition: contains "urgent"
  // Reason: all urgent messages should be handled immediately, regardless of explicit action items
  if (tags.includes("urgent")) {
    return "immediate";
  }

  // Rule 2: Important Todo
  // Condition: contains "myTasks" and has incomplete tasks
  // Reason: only incomplete tasks are to-do items, completed tasks should be classified as important info
  if (insight.myTasks && insight.myTasks.length > 0) {
    if (hasIncompleteTasks(insight.myTasks)) {
      return "high-priority";
    }
    // If all tasks are completed, continue checking if should be classified as "important-info"
  }

  // Rule 3: Important info
  // Condition: contains "important" and no incomplete tasks and not urgent
  // Reason: important but no immediate action needed, for reference and understanding
  if (tags.includes("important")) {
    return "important-info";
  }

  // Rule 4: Follow-up
  // Condition: contains "mentions-me"
  // Reason: messages mentioning the user need attention, even if not urgent or important
  if (tags.includes("mentions-me")) {
    return "follow-up";
  }

  // Rule 5: Don't display
  // Condition: tags are empty
  return null;
}

/**
 * Get classification metadata (icon, label key)
 * @param category - Classification type
 * @returns Classification metadata
 */
export function getFocusCategoryMeta(
  category: FocusCategory,
): FocusCategoryMeta | null {
  if (!category) return null;

  const metaMap: Record<Exclude<FocusCategory, null>, FocusCategoryMeta> = {
    immediate: {
      category: "immediate",
      icon: "🚨",
      labelKey: "insight.focus.immediate",
    },
    "high-priority": {
      category: "high-priority",
      icon: "⚡",
      labelKey: "insight.focus.highPriority",
    },
    "important-info": {
      category: "important-info",
      icon: "💡",
      labelKey: "insight.focus.importantInfo",
    },
    "follow-up": {
      category: "follow-up",
      icon: "👀",
      labelKey: "insight.focus.followUp",
    },
  };

  return metaMap[category];
}

export const getInsightPlatforms = (insight: {
  platform: string | null;
  account: string | null;
  details:
    | {
        time?: number | null | undefined;
        person?: string | undefined;
        platform?: string | null | undefined;
        channel?: string | undefined;
        content?: string | undefined;
        attachments?:
          | {
              name: string;
              url: string;
              contentType: string;
              downloadUrl?: string | undefined;
              sizeBytes?: number | undefined;
              blobPath?: string | undefined;
              source?: string | undefined;
              expired?: boolean | undefined;
              expiredAt?: string | undefined;
            }[]
          | null
          | undefined;
      }[]
    | null;
}) => {
  if (!insight) return [];
  const platformList: string[] = [
    ...(insight.platform ? [insight.platform] : []),
    ...(insight.details
      ?.map((detail) => detail.platform)
      .filter((platform): platform is string => !!platform) || []),
  ];

  const uniquePlatforms = [...new Set(platformList)];
  return uniquePlatforms.map((platform) => ({
    platform,
    label: platform,
  }));
};
