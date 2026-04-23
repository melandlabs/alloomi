// Extended translations - adds missing keys to @alloomi/i18n
import baseEn from "@alloomi/i18n/locales/en-US";

const en = {
  ...baseEn,
  character: {
    ...baseEn.character,
    dailyFocus: "Daily Focus",
    executionStatusRunning: "Running",
    executionStatusSuccess: "Completed",
    executionStatusTimeout: "Timed out",
    executionStatusError: "Failed",
    datePending: "Time pending",
    noOutput: "No output for this execution",
    addMessageChannel: "Add message channel",
    sources: {
      ...baseEn.character?.sources,
      uploadLocal: "Upload from local",
      addFile: "Add File",
      bindFolder: "Bind Folder",
    },
    notificationChannels: "Notification Channels",
  },
  templateCharacter: {
    aiProductIntelligence: {
      name: "AI Product Daily Digest",
      description:
        "Scrape X/Twitter, Reddit, and Product Hunt for AI product news, summarize into a briefing, and update an HTML dashboard using the frontend-design skill.",
      insightTitle: "AI Product Daily Digest",
      insightDescription: "Daily AI product news briefing",
    },
    dailyFocus: {
      name: "Daily Focus",
      description:
        "Collect all my today's information from Telegram, Slack, and Gmail, while analyzing and outputting my own Action items categorized by High, Medium, and Low priority. Each item outputs in a two-line format, with all different items composing a large table: \n\n [Topic Content] ^[Insight ID Reference]^    [Time]",
      insightTitle: "Personal Daily Digest",
      insightDescription: "Today's info summary with prioritized action items",
    },
    emailMonitor: {
      name: "Email Monitor",
      description:
        "Monitor incoming emails from specified sender (e.g., xyz@example.com), evaluate email content and sentiment, and trigger automated replies when defined conditions are met.",
      insightTitle: "Email Monitor",
      insightDescription:
        "Monitor emails and trigger auto-replies on conditions",
    },
    contextAtlas: {
      name: "Relationship Discovery",
      description:
        "Continuously analyze collected my content and events, automatically extracting entities such as people, companies, topics, and their relationships to build a visualized knowledge graph. Help users discover hidden connections between information and support GraphRAG-based contextual retrieval. Use the frontend-design skill to build an interactive kanban board, embedding all graph data within a single HTML file without any additional files.",
      insightTitle: "Relationship Discovery",
      insightDescription:
        "Extract people, companies, and topic relationships from your information and generate a visual relationship network",
    },
    xAutomation: {
      name: "X Account Assistant",
      description:
        "Help set up a tracking account and manage your social media account on X. Objectives: 1) Achieve stable monthly follower growth and increase readership. 2) Persona: Sharing cutting-edge AI technologies, products, and user guides, along with thoughts on technology. 3) Perform operations every 4 hours: retweet, repost, like, reply, and post. 4) Content must stay on-topic — AI only, no politics, terrorism, violence, or pornography. 5) Prepare posts in advance, require approval before publishing. 6) Review daily in the evening to prepare tomorrow and optimize strategy. 7) Initially minimize ads; focus on followers first, share thoughts and advertise once you have a decent following.",
      insightTitle: "X Account Assistant",
      insightDescription:
        "Track follower growth, engagement metrics, readership, and account health",
    },
    pdDailySync: {
      name: "PD Daily Sync",
      description:
        "1) Fetch all commits from your GitHub repo (e.g. melandlabs/alloomi). 2) Compile a structured daily dev report. 3) Email the report to your team. 4) Fetch all issues created that day. 5) Rewrite each issue with full detail. 6) Sync rewritten issues to Linear.",
      insightTitle: "PD Daily Sync",
      insightDescription: "Daily dev report: commits, issues, and Linear sync",
    },
    salesPipelineAutomation: {
      name: "Sales Pipeline Automation",
      description:
        "You are a sales pipeline automation agent. Your job is to run the full lead-to-deal handoff end to end: search alloomi.ai for prospects matching given criteria, enrich and create or update those contacts in the created excel (setting lifecycle stage, owner, and deal details as appropriate), notify the sales team in a designated Slack channel with a concise prospect summary, and send a Calendly booking link to the prospect via a Slack message to the rep. Prioritize accuracy — verify contact data before creating records. Deduplicate against existing contacts before creating new ones. Log every action taken and surface any errors or missing data clearly so a human can review.",
      insightTitle: "Sales Pipeline Automation",
      insightDescription: "Lead-to-deal automation with Slack and Calendly",
    },
    contractRiskEvaluator: {
      name: "Contract Risk Evaluator",
      description:
        "You are a contract risk evaluation assistant focused on helping founders and startup operators.\n\nCore Capabilities:\n1. Contract Classification — Auto-identify contract type (employment/lease/service/investment/NDA/procurement), extract key info: parties, amount, term, termination clauses\n2. Risk Scanning — Severity-based risk levels (critical/high/medium), identify traps like excessive penalties, unlimited liability, non-compete clauses, unfavorable jurisdiction\n3. Favorable Clause Identification — Surface founder-friendly terms for negotiation leverage\n4. Evaluation Report Generation — Structured output: contract summary + risk inventory + negotiation suggestions + lawyer consultation checklist\n5. Contract Reminders — Track payment dates, termination dates, renewal periods with automated alerts\n\n⚠️ Clear Boundaries:\n- ✅ CAN DO: Identify obvious risks, explain clause implications, generate negotiation talking points, prepare lawyer consultation checklist\n- ❌ CANNOT DO: Issue legal opinions, negotiate on behalf of the founder, assume legal liability, guarantee contract is risk-free\n\nSupported: Chinese and English contracts (bilingual output available)",
      insightTitle: "Contract Risk Report",
      insightDescription: "Contract risk screening with negotiation tips",
    },
    scheduleManager: {
      name: "Schedule Manager",
      description:
        "Intelligent schedule management: 1) Integrate Google Calendar, Notion and calendar systems, auto-sync all schedules. 2) Analyze meeting times, identify conflicts and fragmented time slots. 3) Smart reminders: pre-meeting prep items, meeting notes todos, cross-timezone conversions. 4) Time allocation analysis: statistics by project, category, priority for daily/weekly usage, identify waste points with optimization suggestions. 5) Meeting efficiency assessment: analyze frequency, duration, participation rate, flag over-meeting or inefficient meetings.",
      insightTitle: "Schedule Summary",
      insightDescription:
        "Calendar sync, time analysis, meeting efficiency report",
    },
    codeReviewAssistant: {
      name: "Code Review Assistant",
      description:
        "Automated code review and quality control: 1) Monitor GitHub/GitLab Pull Requests, automatically analyze code changes. 2) Review dimensions: code style, security vulnerabilities, performance issues, test coverage, duplicate code, complexity analysis. 3) Provide specific modification suggestions and code examples with severity levels. 4) Learn team code standards, ensure new code follows project conventions. 5) Generate code quality trend reports to help teams continuously improve code health.",
      insightTitle: "Code Review Report",
      insightDescription:
        "PR quality analysis, security vulnerabilities, improvement suggestions",
    },
    techDocumentation: {
      name: "Tech Documentation",
      description:
        "Automated technical documentation generation and maintenance: 1) Monitor code repository changes, automatically extract API interfaces, database schemas, configuration changes. 2) Generate structured technical docs: API documentation, data dictionaries, system architecture diagrams. 3) Track documentation-code sync status, flag outdated content. 4) Smart Q&A: Answer technical questions based on docs and code. 5) Multi-language support: Chinese docs, English docs, bilingual output.",
      insightTitle: "Tech Documentation Update",
      insightDescription:
        "API docs, architecture diagrams, technical change logs",
    },
    socialMediaPlanner: {
      name: "Social Media Planner",
      description:
        "Full-platform social media content planning: 1) Analyze account follower demographics, engagement data, trending content. 2) Develop content calendar: scheduling, topic planning, copywriting. 3) Multi-platform adaptation: same creative adapted for Douyin, Xiaohongshu, WeChat Official Account, Weibo etc. 4) Trend tracking: real-time industry trend monitoring with content integration suggestions. 5) Data review: weekly/monthly content performance reports to optimize future strategy.",
      insightTitle: "Social Media Planning",
      insightDescription:
        "Content calendar, trend analysis, engagement reports",
    },
    brandReputationMonitor: {
      name: "Brand Reputation Monitor",
      description:
        "Real-time brand reputation monitoring across the web: 1) Track brand mentions: news, social media, forums, reviews, complaint platforms. 2) Sentiment analysis: auto-classify positive/negative/neutral reviews with severity levels. 3) Crisis alerts: immediate notifications when negative reviews spike, with response suggestions. 4) Competitor comparison: track competitor reputation performance. 5) Report generation: daily/weekly/monthly reports summarizing volume, sentiment trends, key events.",
      insightTitle: "Brand Reputation Report",
      insightDescription:
        "Sentiment monitoring, trend analysis, competitor comparison",
    },
    customerFollowup: {
      name: "Customer Follow-up",
      description:
        "Intelligent customer relationship management: 1) Integrate CRM data, automatically track customer interaction history. 2) Smart reminders: dormant customer activation, optimal contact timing, purchase anniversary, renewal notices. 3) Personalized follow-up content: generate customized communication scripts based on customer type, industry, purchase stage. 4) Follow-up records: auto-sync results to CRM, generate follow-up todos. 5) Sales funnel analysis: identify at-risk customers, alert and provide retention strategies.",
      insightTitle: "Customer Follow-up Reminders",
      insightDescription:
        "Customer activation, follow-up alerts, sales opportunity warnings",
    },
    invoiceExpenseManager: {
      name: "Invoice & Expense Manager",
      description:
        "Enterprise invoice and expense management: 1) Auto-identify and archive invoices from email and photo uploads. 2) Invoice verification: connect to tax authority systems to verify authenticity and status. 3) Expense rules engine: auto-check compliance by department, project, budget. 4) Smart categorization: auto-classify by type, supplier, date. 5) Report generation: monthly/quarterly expense analysis, department cost comparison, over-budget alerts.",
      insightTitle: "Invoice & Expense Report",
      insightDescription:
        "Invoice verification, expense audit, cost analysis reports",
    },
    complianceReview: {
      name: "Compliance Review",
      description:
        "Comprehensive enterprise compliance review: 1) Track regulatory changes: data protection (GDPR/PIPL), industry regulations, labor laws, etc. 2) Document compliance check: privacy policies, terms of service, identify risk points. 3) Internal process audit: contract flows, approval workflows, financial process compliance assessment. 4) Compliance checklist: generate remediation list with priority recommendations. 5) Regular reports: compliance status overview, risk change trends, remediation progress tracking.",
      insightTitle: "Compliance Review Report",
      insightDescription:
        "Regulatory tracking, risk identification, remediation suggestions",
    },
  },
};

export default en;
