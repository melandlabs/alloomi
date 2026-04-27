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
    dailyFocusCollapseSection: "Collapse",
    dailyFocusExpandSection: "Expand",
    executionStatusRunning: "Running",
    executionStatusSuccess: "Completed",
    executionStatusTimeout: "Timed out",
    executionStatusError: "Failed",
    datePending: "Time pending",
    noOutput: "No output for this execution",
    taskListShowAll: "Show all",
    taskListOnlyFilesEmpty: "No tasks with file output yet",
    addMessageChannel: "Add message channel",
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
