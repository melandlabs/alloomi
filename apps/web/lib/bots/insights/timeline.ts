import type { TimelineData } from "@/lib/ai/subagents/insights";
import type { GeneratedInsightPayload } from "@/lib/insights/transform";
import { normalizeTimestamp } from "@/lib/utils";

/**
 * Generate a unique ID for a timeline event
 */
export function generateEventId(event: TimelineData): string {
  const timeStr = (event.time ?? Date.now()).toString();
  const summaryStr = (event.summary ?? "").slice(0, 50);
  return `${timeStr}-${hashString(summaryStr)}`;
}

/**
 * Simple hash function for generating event IDs
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Detect if a timeline event has changed
 */
export function detectEventChange(
  old: TimelineData,
  updated: TimelineData,
): boolean {
  return (
    old.summary !== updated.summary ||
    old.label !== updated.label ||
    Math.abs((old.time || 0) - (updated.time || 0)) > 60000
  ); // 1 minute threshold
}

export function getInsightCacheKey(insight: GeneratedInsightPayload): string {
  if (insight.dedupeKey && insight.dedupeKey.length > 0) {
    return insight.dedupeKey;
  }
  return `${insight.taskLabel}|${insight.title}|${coerceTimeMs(insight.time)}`;
}

export function coerceTimeMs(time: GeneratedInsightPayload["time"]): number {
  if (!time) return 0;
  if (time instanceof Date) return time.getTime();
  const parsed = new Date(time);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

/**
 * Merge timelines from two insight payloads with deduplication
 * Now includes version control and history tracking
 */
export async function mergeTimelines(
  existing: GeneratedInsightPayload,
  incoming: GeneratedInsightPayload,
  insightId?: string,
): Promise<TimelineData[] | null> {
  const existingTimeline = existing.timeline ?? [];
  const incomingTimeline = incoming.timeline ?? [];

  // Time deduplication window (1 hour)
  const DEDUPE_WINDOW_MS = 60 * 60 * 1000;

  const merged: TimelineData[] = [];
  const processedIds = new Set<string>();

  for (const newEvent of incomingTimeline) {
    // Generate ID for new event
    const eventId = newEvent.id ?? generateEventId(newEvent);

    // Find if there's a similar existing event
    const existingEvent = existingTimeline.find((existing) => {
      if (existing.time === null || existing.time === undefined) {
        return false;
      }
      if (newEvent.time === null || newEvent.time === undefined) {
        return false;
      }
      const existingTime = existing.time;
      const newEventTime = newEvent.time;
      const timeDiff = Math.abs(newEventTime - existingTime);
      if (timeDiff > DEDUPE_WINDOW_MS) {
        return false;
      }

      // Content similarity check (simple keyword matching)
      const newSummary = (newEvent.summary ?? "").toLowerCase();
      const existingSummary = (existing.summary ?? "").toLowerCase();
      return (
        newSummary.includes(existingSummary) ||
        existingSummary.includes(newSummary)
      );
    });

    if (existingEvent) {
      // Event exists - check if it has changed
      const hasChanged = detectEventChange(existingEvent, newEvent);

      if (hasChanged && insightId) {
        // Record history for the change
        const { timelineHistoryService } =
          await import("@/lib/insights/timeline-history");
        const changeReason = await timelineHistoryService.generateChangeReason(
          existingEvent,
          newEvent,
        );

        await timelineHistoryService.recordTimelineEventUpdate(
          insightId,
          existingEvent.id || generateEventId(existingEvent),
          existingEvent,
          {
            ...newEvent,
            id: existingEvent.id || generateEventId(existingEvent),
            version: (existingEvent.version ?? 1) + 1,
            lastUpdatedAt: Date.now(),
            changeCount: (existingEvent.changeCount ?? 0) + 1,
          },
          changeReason,
        );

        // Update event with version info
        merged.push({
          ...existingEvent,
          ...newEvent,
          id: existingEvent.id || generateEventId(existingEvent),
          version: (existingEvent.version ?? 1) + 1,
          lastUpdatedAt: Date.now(),
          changeCount: (existingEvent.changeCount ?? 0) + 1,
        });
      } else {
        // No change, keep existing event
        merged.push(existingEvent);
      }
    } else {
      // New event - record creation
      if (insightId) {
        const { timelineHistoryService } =
          await import("@/lib/insights/timeline-history");
        const eventWithId = {
          ...newEvent,
          id: eventId,
          version: 1,
          lastUpdatedAt: Date.now(),
          changeCount: 0,
        };

        await timelineHistoryService.recordTimelineEventCreation(
          insightId,
          eventWithId,
        );

        merged.push(eventWithId);
      } else {
        // No insightId, just add the event
        merged.push({
          ...newEvent,
          id: eventId,
          version: 1,
          lastUpdatedAt: Date.now(),
          changeCount: 0,
        });
      }
    }

    processedIds.add(eventId);
  }

  // Add existing events that were not in the incoming timeline
  for (const oldEvent of existingTimeline) {
    const oldEventId = oldEvent.id ?? generateEventId(oldEvent);
    if (!processedIds.has(oldEventId)) {
      merged.push(oldEvent);
    }
  }

  // Sort by time (oldest first for chronological order)
  // Normalize timestamps before sorting (handle mixed second/millisecond precision)
  return merged.sort(
    (a, b) => normalizeTimestamp(a.time) - normalizeTimestamp(b.time),
  );
}

/**
 * Deduplicate insights by group, ensuring only the latest insight is kept per group
 * For chat platforms, use platform + group as dedupe key
 * For non-chat platforms, use title + taskLabel as fallback
 */
export function deduplicateInsightsByGroup(
  insights: GeneratedInsightPayload[],
): GeneratedInsightPayload[] {
  if (!Array.isArray(insights) || insights.length === 0) {
    return insights;
  }

  const dedupeMap = new Map<string, GeneratedInsightPayload>();

  for (const insight of insights) {
    const platform = insight.platform ?? "";
    const groups =
      Array.isArray(insight.groups) && insight.groups.length > 0
        ? insight.groups
        : null;

    const isChatPlatform = [
      "slack",
      "discord",
      "telegram",
      "whatsapp",
      "facebook_messenger",
      "teams",
      "linkedin",
      "instagram",
      "twitter",
      "imessage",
      "feishu",
      "dingtalk",
    ].includes(platform);

    let key: string;
    if (isChatPlatform && groups && groups.length > 0) {
      // For chat platforms, use platform + group as dedupe key
      const groupName = groups[0];
      key = `${platform}:group:${groupName}`;
    } else if (platform === "gmail" && insight.dedupeKey) {
      // For Gmail, use stable dedupeKey (based on sender email)
      key = insight.dedupeKey;
    } else {
      // For other non-chat platforms, use title + taskLabel as fallback
      key = `${insight.taskLabel ?? ""}|${insight.title ?? ""}`;
    }

    // Keep the latest insight (compare by time)
    const existing = dedupeMap.get(key);
    const insightTime = coerceTimeMs(insight.time);
    const existingTime = existing ? coerceTimeMs(existing.time) : 0;

    if (!existing || insightTime > existingTime) {
      dedupeMap.set(key, insight);
    }
  }

  return Array.from(dedupeMap.values());
}
