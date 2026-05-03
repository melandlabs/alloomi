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
    namePlaceholder: "伙伴名称",
    avatarHint: "点击自定义伙伴头像",
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
    dailyFocusDeadline: "截止 {{deadline}}",
    dailyFocusOverdueDeadline: "已逾期 · {{deadline}}",
    dailyFocusCollapseSection: "收起",
    dailyFocusExpandSection: "展开",
    executionStatusRunning: "正在执行中",
    executionStatusSuccess: "已完成",
    executionStatusTimeout: "执行超时",
    executionStatusError: "执行失败",
    datePending: "时间待确认",
    noOutput: "本次执行暂无输出内容",
    taskListShowAll: "显示全部",
    taskListOnlyWithResults: "只展示有结果记录",
    taskListOnlyFilesEmpty: "暂无有文件输出的任务",
    addMessageChannel: "添加消息频道",
    newCharacter: "新建伙伴",
    taskLabel: "伙伴任务",
    taskHint: "告诉伙伴你希望让它帮你做的事情",
    taskPlaceholder: "例如：每天早上整理 AI 行业新闻。",
    taskScheduleLabel: "任务计划",
    taskScheduleHint: "告诉伙伴你希望它在哪些时间帮你执行任务",
    completionNotificationLabel: "完成通知",
    completionNotificationHint:
      "当伙伴完成任务后，将通过以下方式将结果同步给你",
    moreConfig: "更多配置",
    tooltips: {
      selectModel: "选择模型",
      selectSkill: "加载不同的技能可以让伙伴掌握更多专项能力",
      addMessageChannel: "连接不同的渠道可以让伙伴获得更精准的消息范围",
      addFile: "上传不同的文件可以给伙伴更多任务背景",
    },
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
