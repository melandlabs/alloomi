import type {
  InsightFilterDefinition,
  InsightFilter,
  InsightFilterResponse,
  InsightFilterBinaryExpr,
  InsightFilterNotExpr,
} from "./filter-schema";
import { insightIsUrgent, insightIsImport } from "./focus-classifier";
import {
  normalizeImportanceOption,
  normalizePlatformOption,
  normalizeUrgencyOption,
} from "./option-normalizers";
import type { InsightBase } from "./types";

export type InsightFilterContext = {
  now?: Date;
  myNicknames?: string[];
  focusPeople?: string[];
};

type FilterMatchContext = InsightFilterContext;

export const DEFAULT_FIELDS_FOR_KEYWORDS = [
  "title",
  "description",
  "details",
  "sources",
  "groups",
  "insight_keywords",
  "people",
] as const;

function normalizeText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function normalizeList(values: string[] = []) {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function stringMatchesToken(
  haystack: string,
  needle: string,
  caseSensitive: boolean,
) {
  if (!caseSensitive) {
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }
  return haystack.includes(needle);
}

function getInsightTimestamp(insight: InsightBase) {
  if (insight.time instanceof Date) {
    return insight.time;
  }
  if (typeof insight.time === "string") {
    const parsed = new Date(insight.time);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  if (typeof insight.time === "number") {
    const parsed = new Date(insight.time);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return insight.createdAt ? new Date(insight.createdAt) : new Date(0);
}

function collectKeywordFields(insight: InsightBase, fields: string[]) {
  const collected: string[] = [];

  for (const field of fields) {
    switch (field) {
      case "title":
        collected.push(normalizeText(insight.title));
        break;
      case "description":
        collected.push(normalizeText(insight.description));
        break;
      case "details":
        if (Array.isArray(insight.details)) {
          for (const detail of insight.details) {
            collected.push(JSON.stringify(detail));
          }
        }
        break;
      case "sources":
        if (Array.isArray((insight as any).sources)) {
          for (const source of (insight as any).sources) {
            collected.push(JSON.stringify(source));
          }
        }
        break;
      case "groups":
        for (const group of insight.groups ?? []) {
          collected.push(group);
        }
        break;
      case "people":
        for (const people of insight.people ?? []) {
          collected.push(people);
        }
        break;
      case "insight_keywords":
        const keywords = insight.topKeywords;
        if (Array.isArray(keywords)) {
          for (const keyword of keywords) {
            if (keyword) collected.push(normalizeText(keyword));
          }
        } else if (typeof keywords === "string" && keywords) {
          // Handle case where topKeywords is stored as a JSON string
          try {
            const parsed = JSON.parse(keywords);
            if (Array.isArray(parsed)) {
              for (const keyword of parsed) {
                if (keyword) collected.push(normalizeText(keyword));
              }
            }
          } catch {
            // Not a JSON string, skip
          }
        }
        break;
      default:
        break;
    }
  }

  return collected.filter((value) => value.length > 0);
}

function matchPlatformCondition(
  insight: InsightBase,
  condition: Extract<
    InsightFilterDefinition["conditions"][number],
    { kind: "platform" }
  >,
) {
  const needles = normalizeList(condition.values)
    .map((value) => normalizePlatformOption(value)?.key)
    .filter((value): value is string => !!value);
  if (needles.length === 0) {
    return true;
  }
  const textBuckets = [
    insight.platform,
    ...(insight.details ?? []).map((d) => d.platform),
  ]
    .map((value) => normalizePlatformOption(value)?.key)
    .filter((value): value is string => !!value);
  if (textBuckets.length === 0) {
    return false;
  }
  const comparator = (token: string) =>
    textBuckets.some((chunk) => chunk.includes(token));

  return needles.some(comparator);
}

function matchKeywordCondition(
  insight: InsightBase,
  condition: Extract<
    InsightFilterDefinition["conditions"][number],
    { kind: "keyword" }
  >,
) {
  const needles = normalizeList(condition.values);
  if (needles.length === 0) {
    return true;
  }

  // Use condition.fields if provided, otherwise use DEFAULT_FIELDS_FOR_KEYWORDS
  const fieldsToSearch =
    condition.fields && condition.fields.length > 0
      ? condition.fields
      : [...DEFAULT_FIELDS_FOR_KEYWORDS];

  const textBuckets = collectKeywordFields(insight, fieldsToSearch);
  if (textBuckets.length === 0) {
    return false;
  }

  const comparator = (token: string) =>
    textBuckets.some((chunk) =>
      chunk.toLowerCase().includes(token.toLowerCase()),
    );

  return condition.match === "all"
    ? needles.every(comparator)
    : needles.some(comparator);
}

function mentionsMe(
  insight: InsightBase,
  context: Pick<FilterMatchContext, "myNicknames">,
) {
  const mentionFlag = (insight as { hasMyNickname?: boolean }).hasMyNickname;
  if (mentionFlag) return true;

  const nicknames = (context.myNicknames ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);

  if (nicknames.length === 0) return false;
  if (!Array.isArray(insight.people) || insight.people.length === 0) {
    return false;
  }

  const people = insight.people
    .map((person) => (person ?? "").toString().trim().toLowerCase())
    .filter((person) => person.length > 0);

  if (people.length === 0) return false;

  const nicknameSet = new Set(nicknames);
  return people.some((person) => nicknameSet.has(person));
}

function getPeopleTargets(
  condition: Extract<
    InsightFilterDefinition["conditions"][number],
    { kind: "people" }
  >,
  context: FilterMatchContext,
) {
  const explicit = normalizeList(condition.values);
  if (explicit.length > 0) return explicit;

  const focus = normalizeList(context.focusPeople ?? []);
  if (focus.length > 0) {
    return focus;
  }
  return [];
}

function hasTasks(insight: InsightBase, buckets: string[]) {
  for (const bucket of buckets) {
    switch (bucket) {
      case "myTasks":
        if ((insight.myTasks?.length ?? 0) > 0) return true;
        break;
      case "waitingForMe":
        if ((insight.waitingForMe?.length ?? 0) > 0) return true;
        break;
      case "waitingForOthers":
        if ((insight.waitingForOthers?.length ?? 0) > 0) return true;
        break;
      case "nextActions":
        if (((insight as any).nextActions?.length ?? 0) > 0) return true;
        break;
      default:
        break;
    }
  }
  return false;
}

/**
 * Determine whether an insight matches the filter definition.
 */
export function insightMatchesFilterDefinition<T extends InsightBase>(
  insight: T,
  definition: InsightFilterDefinition,
  context: FilterMatchContext = {},
) {
  const now = context.now ?? new Date();
  const evaluate = (
    condition: InsightFilterDefinition["conditions"][number],
  ) => {
    switch (condition.kind) {
      case "importance": {
        const normalizedInsight = normalizeImportanceOption(insight.importance);
        const value = normalizeText(insight.importance).toLowerCase();
        const matches = normalizeList(condition.values).some((item) => {
          const itemLowerCase = item.toLowerCase();
          const normalizedItem = normalizeImportanceOption(itemLowerCase);

          if (normalizedItem && normalizedInsight) {
            return normalizedItem.key === normalizedInsight.key;
          }

          if (normalizedItem) {
            return (
              normalizedItem.label.toLowerCase().includes(value) ||
              (insightIsImport(insight) &&
                insightIsImport({
                  importance: normalizedItem.label,
                }))
            );
          }

          return (
            itemLowerCase.includes(value) ||
            (insightIsImport(insight) &&
              insightIsImport({
                importance: item,
              }))
          );
        });
        return matches;
      }
      case "urgency": {
        const normalizedInsight = normalizeUrgencyOption(insight.urgency);
        const value = normalizeText(insight.urgency).toLowerCase();
        return normalizeList(condition.values).some((item) => {
          const normalizedItem = normalizeUrgencyOption(item);

          if (normalizedItem && normalizedInsight) {
            return normalizedItem.key === normalizedInsight.key;
          }

          if (normalizedItem) {
            return (
              normalizedItem.label.toLowerCase().includes(value) ||
              (insightIsUrgent(insight) &&
                insightIsUrgent({
                  urgency: normalizedItem.label,
                }))
            );
          }

          return (
            item.toLowerCase().includes(value) ||
            (insightIsUrgent(insight) &&
              insightIsUrgent({
                urgency: item,
              }))
          );
        });
      }
      case "task_label": {
        const value = normalizeText(insight.taskLabel).toLowerCase();
        if (!value) return false;
        return normalizeList(condition.values).some((item) =>
          item.toLowerCase().includes(value),
        );
      }
      case "account": {
        const value = normalizeText(insight.account);
        if (!value) return false;
        return normalizeList(condition.values).some((item) =>
          item.toLowerCase().includes(value.toLowerCase()),
        );
      }
      case "category": {
        if (!Array.isArray(insight.categories)) return false;
        const normalizedCategories = insight.categories.map((entry) =>
          entry.toLowerCase(),
        );
        if (normalizedCategories.length === 0) return false;
        const targets = normalizeList(condition.values).map((entry) =>
          entry.toLowerCase(),
        );
        return targets.some((target) => normalizedCategories.includes(target));
      }
      case "people": {
        if (!Array.isArray(insight.people) || insight.people.length === 0) {
          return false;
        }
        const candidates = insight.people
          .map((entry) => entry ?? "")
          .filter((entry): entry is string => entry.length > 0);
        if (candidates.length === 0) return false;
        const values = getPeopleTargets(condition, context);
        if (values.length === 0) return false;
        const matcher = (token: string) =>
          candidates.some((person) =>
            stringMatchesToken(person, token, condition.caseSensitive ?? false),
          );
        return condition.match === "all"
          ? values.every(matcher)
          : values.some(matcher);
      }
      case "groups": {
        if (!Array.isArray(insight.groups) || insight.groups.length === 0) {
          return false;
        }
        const normalizedGroups = insight.groups.map((entry) =>
          entry.toLowerCase(),
        );
        const targets = normalizeList(condition.values).map((entry) =>
          entry.toLowerCase(),
        );
        const matcher = (token: string) =>
          normalizedGroups.some((group) => group.includes(token));
        return condition.match === "all"
          ? targets.every(matcher)
          : targets.some(matcher);
      }
      case "platform":
        return matchPlatformCondition(insight, condition);
      case "keyword":
        return matchKeywordCondition(insight, condition);
      case "mentions_me":
        return mentionsMe(insight, context);
      case "time_window": {
        const timestamp = getInsightTimestamp(insight);
        const threshold =
          now.getTime() - condition.withinHours * 60 * 60 * 1000;
        return timestamp.getTime() >= threshold;
      }
      case "has_tasks":
        return hasTasks(insight, condition.values);
      default:
        return true;
    }
  };

  const conditions = definition.conditions;
  if (definition.match === "all") {
    return conditions.every(evaluate);
  }
  return conditions.some(evaluate);
}

export function insightMatchesFilter<T extends InsightBase>(
  insight: T,
  filter: InsightFilter,
  context: FilterMatchContext = {},
): boolean {
  if (isFilterDefinition(filter)) {
    return insightMatchesFilterDefinition(insight, filter, context);
  }

  if (isFilterNotExpr(filter)) {
    const operandMatch = insightMatchesFilter(insight, filter.operand, context);
    return !operandMatch;
  }

  if (isFilterBinaryExpr(filter)) {
    const leftMatch = insightMatchesFilter(insight, filter.left, context);
    const rightMatch = insightMatchesFilter(insight, filter.right, context);

    switch (filter.op) {
      case "and":
        return leftMatch && rightMatch;
      case "or":
        return leftMatch || rightMatch;
      default:
        // Bydefault is and
        return leftMatch && rightMatch;
    }
  }
  return false;
}

export function isFilterDefinition(
  filter: InsightFilter,
): filter is InsightFilterDefinition {
  return "conditions" in filter && "match" in filter && !("op" in filter);
}

export function isFilterBinaryExpr(
  filter: InsightFilter,
): filter is InsightFilterBinaryExpr {
  return (
    "op" in filter &&
    filter.op !== "not" &&
    "left" in filter &&
    "right" in filter
  );
}

export function isFilterNotExpr(
  filter: InsightFilter,
): filter is InsightFilterNotExpr {
  return "op" in filter && filter.op === "not" && "operand" in filter;
}

// ---------------------- Set Operation Utility Functions (Core) ----------------------
/**
 * Get the unique identifier of an Insight (customize this based on your project's actual needs, e.g., id/uid)
 * @param insight - The Insight item to retrieve the key for
 * @returns Unique key (string | number) for the Insight
 */
function getInsightKey<T extends InsightBase>(insight: T): string | number {
  return insight.id; // Modify this if the unique identifier is not 'id' in your project
}

/**
 * Compute the union of two Insight arrays (removes duplicates)
 * @param a - First Insight array
 * @param b - Second Insight array
 * @returns Union array containing elements from either array (no duplicates)
 */
function unionInsights<T extends InsightBase>(a: T[], b: T[]): T[] {
  const keyMap = new Map<string | number, T>();
  // Add elements from array 'a' first
  a.forEach((item) => keyMap.set(getInsightKey(item), item));
  // Add elements from array 'b' (duplicates will be overwritten to achieve deduplication)
  b.forEach((item) => keyMap.set(getInsightKey(item), item));
  // Convert map values back to an array and return
  return Array.from(keyMap.values());
}

/**
 * Compute the intersection of two Insight arrays (elements present in both arrays)
 * @param a - First Insight array
 * @param b - Second Insight array
 * @returns Intersection array containing elements that exist in both arrays
 */
function intersectInsights<T extends InsightBase>(a: T[], b: T[]): T[] {
  const aKeyMap = new Map<string | number, T>(
    a.map((item) => [getInsightKey(item), item]),
  );
  // Filter elements in 'b' that exist in 'a'
  return b.filter((item) => aKeyMap.has(getInsightKey(item)));
}

/**
 * Compute the complement of a target array relative to the original array
 * (elements in the original array that are NOT in the target array)
 * @param original - The original Insight array (full set)
 * @param target - The target Insight array (subset to exclude)
 * @returns Complement array containing elements from the original array not present in the target array
 */
function differenceInsights<T extends InsightBase>(
  original: T[],
  target: T[],
): T[] {
  const targetKeyMap = new Map<string | number, T>(
    target.map((item) => [getInsightKey(item), item]),
  );
  // Filter elements in the original array that do not exist in the target array
  return original.filter((item) => !targetKeyMap.has(getInsightKey(item)));
}

// ---------------------- Recursive Filter Expression Evaluator (Supports NOT) ----------------------
/**
 * Recursively evaluate a binary tree-style filter expression (returns an array of results)
 * @param insights - Original Insight array to filter
 * @param expr - Filter expression (atomic rule / logical combo)
 * @param context - Optional filter matching context
 * @returns Insight array that matches the expression logic
 */
function evaluateFilterExpr<T extends InsightBase>(
  insights: T[],
  expr: InsightFilter,
  context?: FilterMatchContext,
): T[] {
  // Case 1: Atomic filter rule → Filter the array directly with the rule
  if (!("op" in expr)) {
    return insights.filter((item) =>
      insightMatchesFilterDefinition(item, expr, context),
    );
  }

  // Case 2: Unary operator (NOT) → Evaluate the operand result, then compute the complement
  if (expr.op === "not") {
    // Recursively evaluate the NOT operand
    const operandResults = evaluateFilterExpr(insights, expr.operand, context);
    // Complement: Elements in the original array that are not in the operand results
    return differenceInsights(insights, operandResults);
  }

  // Case 3: Binary operators (AND/OR) → Evaluate left/right sub-expressions, then compute set operations
  const leftResults = evaluateFilterExpr(insights, expr.left, context);
  const rightResults = evaluateFilterExpr(insights, expr.right, context);

  switch (expr.op) {
    case "and":
      // AND → Intersection
      return intersectInsights(leftResults, rightResults);
    case "or":
      // OR → Union
      return unionInsights(leftResults, rightResults);
    default:
      throw new Error(`Unsupported logical operator: ${(expr as any).op}`);
  }
}

/**
 * Filter an Insight array using a nested logical expression (supports AND/OR/NOT)
 * @param insights - Original Insight array to filter
 * @param filter - Filter expression (atomic rule / AND/OR/NOT combo)
 * @param context - Optional filter matching context
 * @returns Filtered Insight array that matches the expression logic
 */
export function filterInsights<T extends InsightBase>(
  insights: T[],
  filter: InsightFilter,
  context?: FilterMatchContext,
): T[] {
  return evaluateFilterExpr(insights, filter, context);
}

export function toInsightFilterResponse(
  record: Record<string, any>,
): InsightFilterResponse {
  return {
    id: record.id,
    userId: record.userId,
    label: record.label,
    slug: record.slug,
    description: record.description ?? null,
    color: record.color ?? null,
    icon: record.icon ?? null,
    sortOrder: record.sortOrder,
    isPinned: record.isPinned,
    isArchived: record.isArchived,
    source: (record.source as InsightFilterResponse["source"]) ?? "user",
    definition: record.definition,
    createdAt: record.createdAt?.toISOString?.() ?? new Date(0).toISOString(),
    updatedAt: record.updatedAt?.toISOString?.() ?? new Date(0).toISOString(),
  };
}
