// Extended translations - adds missing keys to @alloomi/i18n
import baseZh from "@alloomi/i18n/locales/zh-Hans";

const zh = {
  ...baseZh,
  nav: {
    ...baseZh.nav,
    termsAndPolicies: "条款与政策",
  },
  character: {
    ...baseZh.character,
    dailyFocus: "今日聚焦",
    dailyFocusLoading: "加载中...",
    dailyFocusEmpty: "暂无聚焦数据",
    dailyFocusNothingMajor: "今日无重要事项",
    dailyFocusNoData: "暂无数据",
    dailyFocusAnalysisComplete: "今日聚焦分析完成",
    dailyFocusItemsAnalyzed: "{{count}} 条事项已分析",
    dailyFocusV1Summary:
      "{{urgent}} 条紧急、{{important}} 条重要、{{monitor}} 条监控",
    dailyFocusReasoningChain: "思维链 ({{count}})",
    dailyFocusRawContent: "原始信息",
    dailyFocusActionPrefix: "操作: {{label}}",
    dailyFocusTodayBadge: "今天",
    dailyFocusCollapseSection: "收起",
    dailyFocusExpandSection: "展开",
    executionStatusRunning: "正在执行中",
    executionStatusSuccess: "已完成",
    executionStatusTimeout: "执行超时",
    executionStatusError: "执行失败",
    datePending: "时间待确认",
    noOutput: "本次执行暂无输出内容",
    taskListShowAll: "显示全部",
    taskListOnlyFilesEmpty: "暂无有文件输出的任务",
    addMessageChannel: "添加消息频道",
    sources: {
      ...baseZh.character?.sources,
      uploadLocal: "从本地上传",
      addFile: "添加文件",
      bindFolder: "绑定文件夹",
    },
    notificationChannels: "通知渠道",
    marketplaceGroupAll: "全部",
    marketplaceGroup: {
      office: "办公",
      product: "产研",
      marketing: "营销",
      sales: "销售",
      finance: "财务",
      legal: "法务",
    },
  },
  templateCharacter: {
    ...baseZh.templateCharacter,
  },
};

export default zh;
