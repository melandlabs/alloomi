// Extended translations - adds missing keys to @alloomi/i18n
import baseEn from "@alloomi/i18n/locales/en-US";

const en = {
  ...baseEn,
  nav: {
    ...baseEn.nav,
    termsAndPolicies: "Terms & Policies",
  },
  character: {
    ...baseEn.character,
    newCharacter: "New Mate",
    namePlaceholder: "Mate Name",
    dailyFocus: "Daily Focus",
    dailyFocusLoading: "Loading...",
    dailyFocusEmpty: "No focus data yet",
    dailyFocusNothingMajor: "Nothing major happened today",
    dailyFocusNoData: "No data",
    dailyFocusAnalysisComplete: "Daily focus analysis complete",
    dailyFocusItemsAnalyzed: "{{count}} items analyzed",
    dailyFocusV1Summary:
      "{{urgent}} urgent, {{important}} important, {{monitor}} monitoring",
    dailyFocusReasoningChain: "Reasoning Chain ({{count}})",
    dailyFocusRawContent: "Raw Content",
    dailyFocusActionPrefix: "Action: {{label}}",
    dailyFocusTodayBadge: "Today",
    dailyFocusDeadline: "Due {{deadline}}",
    dailyFocusOverdueDeadline: "Overdue · {{deadline}}",
    dailyFocusCollapseSection: "Collapse",
    dailyFocusExpandSection: "Expand",
    executionStatusRunning: "Running",
    executionStatusSuccess: "Completed",
    executionStatusTimeout: "Timed out",
    executionStatusError: "Failed",
    datePending: "Time pending",
    noOutput: "No output for this execution",
    taskListShowAll: "Show all",
    taskListOnlyWithResults: "Only show items with results",
    taskListOnlyFilesEmpty: "No tasks with file output yet",
    addMessageChannel: "Add message channel",
    taskLabel: "Mate's Task",
    avatarHint: "Click to customize the mate avatar",
    taskHint: "Tell your mate what you want it to help you with",
    taskPlaceholder: "For example: Summarize AI industry news every morning.",
    taskScheduleLabel: "Task Schedule",
    taskScheduleHint:
      "Tell your mate when you want it to execute tasks for you.",
    completionNotificationLabel: "Completion Notification",
    completionNotificationHint:
      "When your mate completes a task, the result will be synced to you through the following channels.",
    moreConfig: "More configuration",
    tooltips: {
      selectModel: "Select model",
      selectSkill:
        "Loading different skills helps your mate gain specialized capabilities.",
      addMessageChannel:
        "Connecting different channels gives your mate a more precise message scope.",
      addFile:
        "Uploading different files gives your mate more task background context.",
    },
    sources: {
      ...baseEn.character?.sources,
      uploadLocal: "Upload from local",
      addFile: "Add File",
      bindFolder: "Bind Folder",
    },
    notificationChannels: "Notification Channels",
    marketplaceGroupAll: "All",
    marketplaceGroup: {
      office: "Office",
      product: "Product",
      marketing: "Marketing",
      sales: "Sales",
      finance: "Finance",
      legal: "Legal",
    },
  },
  templateCharacter: {
    ...baseEn.templateCharacter,
  },
};

export default en;
