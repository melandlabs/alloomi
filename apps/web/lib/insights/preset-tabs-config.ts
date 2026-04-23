/**
 * Preset grouping configuration file
 * Centralize management of all preset Insight Tab grouping configurations
 */

import type { InsightTab } from "@/hooks/use-insight-tabs";
import type { TFunction } from "i18next";

/**
 * Preset grouping configuration factory function
 * @param t - i18n translation function
 * @returns Preset grouping configuration array
 */
export function getPresetTabsConfig(t: TFunction): InsightTab[] {
  return [
    // Focus
    {
      id: "preset:focus",
      name: t("insight.tabs.preset.focus"),
      title: t("insight.tabs.preset.focus"),
      description: t("insight.tabs.preset.focusDesc"),
      filter: {
        match: "any",
        conditions: [
          {
            kind: "urgency",
            values: [
              "ASAP",
              "As soon as possible",
              "Within 24 hours",
              "Within 24 hours",
              "Handle ASAP",
              "Urgent",
              "Urgent",
              "urgent",
              "ASAP",
              "asap",
              "Immediate",
              "immediate",
            ],
          },
          {
            kind: "importance",
            values: ["Important", "important", "High", "high"],
          },
          {
            kind: "has_tasks",
            values: ["myTasks", "waitingForMe", "waitingForOthers"],
          },
          {
            kind: "mentions_me",
            values: [],
          },
        ],
      },
      type: "preset",
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      tag: "",
      isDefault: true,
      modifiable: true,
      rules: {
        canModifyKind: true,
        canModifyValues: true,
        modifiableFields: ["urgency", "importance", "has_tasks", "mentions_me"],
      },
    },
    // Important people grouping
    {
      id: "preset:important-people",
      name: t("insight.tabs.preset.importantPeople", "Important people"),
      title: t("insight.tabs.preset.importantPeople", "Important people"),
      description: t(
        "insight.tabs.preset.importantPeopleDesc",
        "Filter information from important people, you can customize the important people list",
      ),
      filter: {
        match: "any",
        conditions: [
          {
            kind: "people",
            values: [],
            match: "any",
            caseSensitive: false,
          },
        ],
      },
      type: "preset",
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      tag: "",
      isDefault: true,
      modifiable: true,
      rules: {
        canModifyKind: false, // Cannot modify condition type (must be people)
        canModifyValues: true, // Can modify people list
      },
    },

    // Contact me grouping
    {
      id: "preset:mentions-me",
      name: t("insight.tabs.preset.mentions", "Mentions"),
      title: t("insight.tabs.preset.mentions", "Mentions"),
      description: t(
        "insight.tabs.preset.mentionsDesc",
        "Automatically match @mentions or direct messages, no extra configuration needed",
      ),
      filter: {
        match: "all",
        conditions: [
          {
            kind: "mentions_me",
            values: [],
          },
        ],
      },
      type: "preset",
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      tag: "",
      isDefault: true,
      modifiable: false,
      rules: {
        canModifyKind: false,
        canModifyValues: false,
      },
    },

    // Important grouping
    {
      id: "preset:important",
      name: t("insight.tabs.preset.important", "Important"),
      title: t("insight.tabs.preset.important", "Important"),
      description: t(
        "insight.tabs.preset.importantDesc",
        "Filter information marked as important, including various language importance markers",
      ),
      filter: {
        match: "all",
        conditions: [
          {
            kind: "importance",
            values: ["Important", "High", "high"],
          },
        ],
      },
      type: "preset",
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      tag: "",
      isDefault: true,
      modifiable: false,
      rules: {
        canModifyKind: false,
        canModifyValues: false,
      },
    },

    // Opinion monitoring
    //{
    //  id: "preset:opinion-monitoring",
    //  name: t("insight.tabs.preset.opinionMonitoring", "Opinion Monitoring"),
    //  title: t("insight.tabs.preset.opinionMonitoring", "Opinion Monitoring"),
    //  description: t(
    //    "insight.tabs.preset.opinionMonitoringDesc",
    //    "Filter opinion-related information, including sentiment tracking, sentiment analysis, user feedback, etc.",
    //  ),
    //  filter: {
    //    match: "any",
    //    conditions: [
    //      {
    //        kind: "category",
    //        values: ["Opinion", "Sentiment"],
    //      },
    //    ],
    //  },
    //  type: "preset",
    //  enabled: true,
    //  createdAt: 0,
    //  updatedAt: 0,
    //  tag: "",
    //  isDefault: false,
    //  modifiable: false,
    //  rules: {
    //    canModifyKind: false,
    //    canModifyValues: false,
    //  },
    //},
  ];
}

/**
 * Preset grouping ID list (for quick judgment)
 */
export const PRESET_TAB_IDS = [
  "preset:focus",
  "preset:important-people",
  "preset:mentions-me",
  "preset:important",
  "preset:opinion-monitoring",
] as const;

/**
 * Preset grouping ID type
 */
export type PresetTabId = (typeof PRESET_TAB_IDS)[number];

/**
 * Determine if the given ID is a preset grouping
 * @param id - Tab ID
 * @returns Whether it is a preset grouping
 */
export function isPresetTabId(id: string): id is PresetTabId {
  return PRESET_TAB_IDS.includes(id as PresetTabId);
}

/**
 * Get preset grouping ID to name mapping
 * @param t - i18n translation function
 * @returns Preset grouping ID to name mapping object
 */
export function getPresetTabIdToNameMap(
  t: TFunction,
): Record<PresetTabId, string> {
  return {
    "preset:focus": t("insight.tabs.preset.focus", "Focus"),
    "preset:important-people": t(
      "insight.tabs.preset.importantPeople",
      "Important people",
    ),
    "preset:mentions-me": t("insight.tabs.preset.mentions", "Mentions"),
    "preset:important": t("insight.tabs.preset.important", "Important"),
    "preset:opinion-monitoring": t(
      "insight.tabs.preset.opinionMonitoring",
      "Opinion monitoring",
    ),
  };
}

/**
 * Get name by preset grouping ID
 * @param id - Preset grouping ID
 * @param t - i18n translation function
 * @returns Grouping name, returns undefined if not a preset grouping
 */
export function getPresetTabName(id: string, t: TFunction): string | undefined {
  const map = getPresetTabIdToNameMap(t);
  return map[id as PresetTabId];
}
