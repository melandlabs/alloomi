/**
 * Insight utility functions for use across packages.
 * These utilities work with InsightBase type and don't depend on app-specific types.
 */

import type { InsightBase, InsightTaskItem } from "./types";

/**
 * Check if an Insight has substantial content.
 * Used to filter out empty or meaningless Insights.
 *
 * @param insight - Insight object
 * @returns true if has substantial content, false if empty
 */
export const insightHasContent = (insight: InsightBase): boolean => {
  // Check if description has actual content (at least 10 characters)
  const hasDescription = !!(
    insight.description && insight.description.trim().length >= 10
  );

  // Check if there are active tasks
  const hasActiveTasks = [
    insight.myTasks,
    insight.waitingForMe,
    insight.waitingForOthers,
  ].some((tasks) => {
    if (!tasks || tasks.length === 0) return false;
    // Check if there are incomplete tasks
    return tasks.some(
      (task) => task.status === "pending" || task.status === "blocked",
    );
  });

  // Check if there is detailed conversation content
  const hasDetails = !!(insight.details && insight.details.length > 0);

  // Check if there are timeline events
  const hasTimeline = !!(insight.timeline && insight.timeline.length > 0);

  // Check if there are nextActions or followUps
  const hasNextActions = !!(
    (insight.nextActions && insight.nextActions.length > 0) ||
    (insight.followUps && insight.followUps.length > 0)
  );

  // At least one condition must be met to be considered having substantive content
  return (
    hasDescription ||
    hasActiveTasks ||
    hasDetails ||
    hasTimeline ||
    hasNextActions
  );
};

/**
 * Filter out empty Insights.
 * Used to remove Insights without substantial content.
 *
 * @param insights - Insight array
 * @returns Filtered Insight array
 */
export const filterEmptyInsights = <T extends InsightBase>(
  insights: T[],
): T[] => {
  if (!insights || insights.length === 0) {
    return [];
  }

  return insights.filter(insightHasContent);
};

/**
 * Check if insight has tasks due today.
 *
 * @param insight - Insight object
 * @param today - Today's date (00:00:00)
 * @returns true if has tasks due today
 */
export const hasTaskDueToday = (insight: InsightBase, today: Date): boolean => {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check tasks in myTasks and waitingForMe
  const taskLists = [insight.myTasks, insight.waitingForMe].filter(
    (tasks): tasks is NonNullable<typeof tasks> =>
      tasks != null && tasks.length > 0,
  );

  for (const tasks of taskLists) {
    for (const task of tasks) {
      // Only check tasks with pending or blocked status
      if (task.status === "completed" || task.status === "delegated") {
        continue;
      }

      // Check deadline
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        if (deadlineDate >= today && deadlineDate < tomorrow) {
          return true;
        }
      }

      // Check followUpAt
      if (task.followUpAt) {
        const followUpDate = new Date(task.followUpAt);
        if (followUpDate >= today && followUpDate < tomorrow) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Check if insight has overdue incomplete tasks.
 *
 * @param insight - Insight object
 * @param today - Today's date (00:00:00)
 * @returns true if has overdue incomplete tasks
 */
export const hasOverdueTasks = (insight: InsightBase, today: Date): boolean => {
  // Check tasks in myTasks and waitingForMe
  const taskLists = [insight.myTasks, insight.waitingForMe].filter(
    (tasks): tasks is NonNullable<typeof tasks> =>
      tasks != null && tasks.length > 0,
  );

  for (const tasks of taskLists) {
    for (const task of tasks) {
      // Only check tasks with pending or blocked status
      if (task.status === "completed" || task.status === "delegated") {
        continue;
      }

      // Check if deadline is overdue
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        if (deadlineDate < today) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Common insight deduplication function.
 *
 * @param list - Insight array
 * @param keyField - Field used for deduplication
 * @returns Deduplicated Insight array
 */
export const deduplicateInsights = <T extends InsightBase>(
  list: T[],
  keyField: keyof T = "title" as keyof T,
): T[] => {
  if (list && Array.isArray(list)) {
    const uniqueMap = new Map<string, T>();
    list.forEach((insight) => {
      const key =
        (insight[keyField] as string) || `__empty_${String(keyField)}_`;
      uniqueMap.set(key, insight);
    });

    return Array.from(uniqueMap.values());
  }
  return [];
};
