// Extended translations - adds missing keys to @alloomi/i18n
import baseZh from "@alloomi/i18n/locales/zh-Hans";

const zh = {
  ...baseZh,
  character: {
    ...baseZh.character,
    dailyFocus: "今日聚焦",
    executionStatusRunning: "正在执行中",
    executionStatusSuccess: "已完成",
    executionStatusTimeout: "执行超时",
    executionStatusError: "执行失败",
    datePending: "时间待确认",
    noOutput: "本次执行暂无输出内容",
    addMessageChannel: "添加消息频道",
    sources: {
      ...baseZh.character?.sources,
      uploadLocal: "从本地上传",
      addFile: "添加文件",
      bindFolder: "绑定文件夹",
    },
    notificationChannels: "通知渠道",
  },
  templateCharacter: {
    aiProductIntelligence: {
      name: "AI 产品日报",
      description:
        "抓取 X/Twitter、Reddit 和 Product Hunt 上的 AI 产品新闻，整理成简报，并使用前端设计技能更新 HTML 仪表盘。",
      insightTitle: "AI 产品日报",
      insightDescription: "每日 AI 产品新闻简报",
    },
    dailyFocus: {
      name: "每日聚焦",
      description:
        "收集我今天来自 Telegram、Slack 和 Gmail 的所有信息，同时分析并输出我自己的行动项，按高、中、低优先级分类。每项以两行格式输出，所有不同项目组成一个大表格：\n\n [主题内容] ^[洞察 ID 引用]^    [时间]",
      insightTitle: "个人日报摘要",
      insightDescription: "今日信息摘要与优先行动项",
    },
    emailMonitor: {
      name: "邮件监控",
      description:
        "监控来自指定发件人（如 xyz@example.com）的来信，评估邮件内容和情感，并在满足预设条件时触发自动回复。",
      insightTitle: "邮件监控",
      insightDescription: "监控邮件并在条件满足时触发自动回复",
    },
    contextAtlas: {
      name: "关系发现助手",
      description:
        "持续分析我的集成收到的内容和事件，自动提取人物、公司、主题等实体及其关系，构建可视化知识图谱。帮助用户发现信息之间的隐藏关联，支持基于 GraphRAG 的上下文检索。使用前端设计技能构建交互式看板，将所有图谱数据嵌入单个 HTML 文件中，无需额外文件。",
      insightTitle: "关系发现",
      insightDescription:
        "从信息中提取人物、公司、主题关系，生成可视化关系网络",
    },
    xAutomation: {
      name: "X 账号助手",
      description:
        "帮助建立跟踪账号并管理您在 X 上的社交媒体账号。目标：1) 实现稳定的月度粉丝增长并提高阅读量。2) 人设：分享前沿 AI 技术、产品和用户指南，以及技术思考。3) 每 4 小时执行操作：转发、 repost、点赞、回复和发帖。4) 内容必须主题相关 — 仅限 AI，不涉及政治、恐怖主义、暴力或色情内容。5) 提前准备帖子，发布前需审批。6) 每天晚上回顾，为明天做准备并优化策略。7) 初期尽量减少广告；先专注于粉丝，有了相当粉丝基础后再分享想法和做广告。",
      insightTitle: "X 账号助手",
      insightDescription: "追踪粉丝增长、互动数据、阅读量和账号健康状况",
    },
    pdDailySync: {
      name: "产品每日同步",
      description:
        "1) 获取您 GitHub 仓库（如 melandlabs/alloomi）的所有提交。2) 整理结构化每日开发报告。3) 将报告邮件发给团队。4) 获取当天创建的所有 issues。5) 重写每个 issue 的完整细节。6) 将重写后的 issues 同步到 Linear。",
      insightTitle: "产品每日同步",
      insightDescription: "每日开发报告：提交、issues 和 Linear 同步",
    },
    salesPipelineAutomation: {
      name: "销售管道自动化",
      description:
        "您是一个销售管道自动化代理，负责从头到尾完成从潜在客户到交易的全流程：在 alloomi.ai 上搜索符合条件的目标客户，丰富并创建或更新这些联系人（适当设置生命周期阶段、负责人和交易详情），在指定的 Slack 频道通知销售团队并提供简洁的潜在客户摘要，并通过 Slack 消息向代表发送 Calendly 预约链接给潜在客户。优先保证准确性 — 创建记录前验证联系人数据。在创建新联系人前与现有联系人去重。记录每一步操作，并清晰展示任何错误或缺失数据以便人工审核。",
      insightTitle: "销售管道自动化",
      insightDescription: "通过 Slack 和 Calendly 实现潜客到成交的自动化",
    },
    contractRiskEvaluator: {
      name: "合同风险评估",
      description:
        "您是一个专注于帮助创始人和创业者的合同风险评估助手。\n\n核心能力：\n1. 合同分类 — 自动识别合同类型（雇佣/租赁/服务/投资/保密/采购），提取关键信息：当事人、金额、期限、终止条款\n2. 风险扫描 — 基于严重程度的风险等级（严重/高/中），识别陷阱如过度罚款、无限制责任、竞业禁止条款、不利管辖权\n3. 有利条款识别 — 挖掘创始人友好的谈判筹码条款\n4. 评估报告生成 — 结构化输出：合同摘要 + 风险清单 + 谈判建议 + 律师咨询清单\n5. 合同提醒 — 追踪付款日期、终止日期、续期周期并发送自动提醒\n\n⚠️ 明确边界：\n- ✅ 可以做：识别明显风险、解释条款含义、生成谈判要点、准备律师咨询清单\n- ❌ 不能做：出具法律意见、代表创始人谈判、承担法律责任、保证合同无风险\n\n支持：中英文合同（可输出双语版本）",
      insightTitle: "合同风险报告",
      insightDescription: "合同风险筛查与谈判建议",
    },
    scheduleManager: {
      name: "日程管理助手",
      description:
        "智能管理您的日程安排：1) 整合 Google Calendar、Notion 和日历系统，自动同步所有日程。2) 分析会议时间，识别时间冲突和碎片化时段。3) 智能提醒：会前准备事项、会议纪要待办、跨时区会议时间转换。4) 时间分配分析：按项目、类别、优先级统计每日/周时间使用情况，识别时间浪费点并提供优化建议。5) 会议效率评估：分析会议频率、时长、参与率，提示过度会议或低效会议。",
      insightTitle: "日程管理摘要",
      insightDescription: "日程同步、时间分析、会议效率报告",
    },
    codeReviewAssistant: {
      name: "代码审查助手",
      description:
        "自动化代码审查与质量把控：1) 监控 GitHub/GitLab Pull Request，自动分析代码变更。2) 审查维度：代码风格、安全漏洞、性能问题、测试覆盖率、重复代码、复杂度分析。3) 提供具体修改建议和代码示例，标注严重程度等级。4) 学习团队代码规范，确保新代码符合项目约定。5) 生成代码质量趋势报告，帮助团队持续改进代码健康度。",
      insightTitle: "代码审查报告",
      insightDescription: "PR 质量分析、安全漏洞、改进建议",
    },
    techDocumentation: {
      name: "技术文档助手",
      description:
        "自动化技术文档生成与维护：1) 监听代码仓库变更，自动提取 API 接口、数据库 schema、配置变更。2) 生成结构化技术文档：API 文档、数据字典、系统架构图。3) 追踪文档与代码的同步状态，标记过期内容。4) 智能问答：基于文档和代码回答技术问题。5) 支持多语言输出：中文文档、英文文档、中英对照。",
      insightTitle: "技术文档更新",
      insightDescription: "API 文档、架构图、技术变更记录",
    },
    socialMediaPlanner: {
      name: "社交媒体策划",
      description:
        "全平台社交媒体内容策划：1) 分析账号粉丝画像、互动数据、热门内容趋势。2) 制定内容日历：排期、话题策划、文案撰写。3) 多平台适配：同一创意适配抖音、小红书、微信公众号、微博等不同平台风格。4) 热点追踪：实时抓取行业热点，提供内容结合建议。5) 数据复盘：每周/每月生成内容表现报告，优化后续策略。",
      insightTitle: "社交媒体策划",
      insightDescription: "内容日历、热点分析、互动报告",
    },
    brandReputationMonitor: {
      name: "品牌声誉监控",
      description:
        "全网品牌声誉实时监控：1) 追踪全网品牌提及：新闻、社交媒体、论坛、评论、投诉平台。2) 情感分析：自动判断正/负面/中性评价，标注严重程度。3) 危机预警：负面评价突增时立即告警，提供应对建议。4) 竞品对比：追踪竞争对手声誉表现。5) 报告生成：日报/周报/月报，汇总声量、情感趋势、关键事件。",
      insightTitle: "品牌声誉报告",
      insightDescription: "舆情监控、情感分析、竞品对比",
    },
    customerFollowup: {
      name: "客户回访提醒",
      description:
        "智能化客户关系维护：1) 整合 CRM 数据，自动追踪客户互动历史。2) 智能提醒：沉默客户激活、最佳联系时机、下单周年纪念、产品到期续费。3) 个性化回访内容：根据客户类型、行业、购买阶段生成定制化沟通话术。4) 跟进记录：自动同步回访结果到 CRM，生成跟进待办。5) 销售漏斗分析：识别流失风险客户，预警并提供挽回策略。",
      insightTitle: "客户回访提醒",
      insightDescription: "客户激活、跟进提醒、销售机会预警",
    },
    invoiceExpenseManager: {
      name: "发票报销管理",
      description:
        "企业发票与报销全流程管理：1) 自动识别和归档来自邮件、拍照上传的发票。2) 发票验真：对接税务局系统，验证发票真伪和状态。3) 报销规则引擎：按部门、项目、预算自动检查报销合规性。4) 智能分类：按类型、供应商、日期自动归类整理。5) 报表生成：月度/季度费用分析，部门成本对比，超支预警。",
      insightTitle: "发票报销管理",
      insightDescription: "发票验真、报销审核、费用分析报告",
    },
    complianceReview: {
      name: "合规审查助手",
      description:
        "企业合规风险全面审查：1) 追踪法规变化：数据保护（GDPR/个人信息保护法）、行业法规、劳动法等。2) 文档合规检查：隐私政策、用户协议、服务条款的风险点识别。3) 内部流程审计：合同流程、审批流程、财务流程的合规性评估。4) 合规清单：生成整改清单和优先级建议。5) 定期报告：合规状态总览、风险变化趋势、整改进度跟踪。",
      insightTitle: "合规审查报告",
      insightDescription: "法规追踪、风险识别、整改建议",
    },
  },
};

export default zh;
