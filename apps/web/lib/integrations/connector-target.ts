import type { IntegrationId } from "@/hooks/use-integrations";

type ConnectorActionLike = {
  type?: string;
  label?: string;
  content?: string;
  params?: Record<string, unknown>;
};

export type ConnectorTargetAction = {
  type: "add_integration";
  label: string;
  content?: string;
  params?: { platform?: IntegrationId };
  requiresConfirmation: false;
};

export const CONNECTOR_PLATFORM_IDS = [
  "telegram",
  "whatsapp",
  "slack",
  "discord",
  "gmail",
  "outlook",
  "linkedin",
  "instagram",
  "twitter",
  "google_calendar",
  "outlook_calendar",
  "teams",
  "facebook_messenger",
  "google_drive",
  "google_docs",
  "hubspot",
  "notion",
  "github",
  "asana",
  "jira",
  "linear",
  "imessage",
  "feishu",
  "dingtalk",
  "qqbot",
  "weixin",
] as const satisfies readonly IntegrationId[];

const CONNECTOR_PLATFORM_SET = new Set<string>(CONNECTOR_PLATFORM_IDS);

const PLATFORM_ALIASES: Record<string, IntegrationId> = {
  telegram: "telegram",
  tg: "telegram",
  whatsapp: "whatsapp",
  whats_app: "whatsapp",
  slack: "slack",
  discord: "discord",
  gmail: "gmail",
  google_mail: "gmail",
  outlook: "outlook",
  outlook_mail: "outlook",
  linkedin: "linkedin",
  instagram: "instagram",
  twitter: "twitter",
  x: "twitter",
  x_twitter: "twitter",
  xtwitter: "twitter",
  tweet: "twitter",
  tweets: "twitter",
  推特: "twitter",
  google_calendar: "google_calendar",
  gcal: "google_calendar",
  outlook_calendar: "outlook_calendar",
  teams: "teams",
  microsoft_teams: "teams",
  facebook_messenger: "facebook_messenger",
  messenger: "facebook_messenger",
  google_drive: "google_drive",
  gdrive: "google_drive",
  google_docs: "google_docs",
  gdocs: "google_docs",
  hubspot: "hubspot",
  notion: "notion",
  github: "github",
  asana: "asana",
  jira: "jira",
  linear: "linear",
  imessage: "imessage",
  feishu: "feishu",
  lark: "feishu",
  dingtalk: "dingtalk",
  qq: "qqbot",
  qq_bot: "qqbot",
  qqbot: "qqbot",
  wechat: "weixin",
  weixin: "weixin",
  wechat_work: "weixin",
  wecom: "weixin",
  微信: "weixin",
  企业微信: "weixin",
  飞书: "feishu",
  钉钉: "dingtalk",
};

const CONNECTOR_INTENT_PATTERN = new RegExp(
  [
    "连接",
    "链接",
    "接入",
    "授权",
    "绑定",
    "添加平台",
    "新增平台",
    "添加连接器",
    "新增连接器",
    "\\b(?:connect|link|authorize|authorise|auth|bind|integration|connector|platform)\\b",
  ].join("|"),
  "i",
);

const DISCONNECTED_INTEGRATION_PATTERN = new RegExp(
  [
    "未连接",
    "未链接",
    "未授权",
    "未绑定",
    "未接入",
    "未集成",
    "尚未连接",
    "尚未链接",
    "尚未授权",
    "尚未绑定",
    "尚未接入",
    "尚未集成",
    "没有连接",
    "没有授权",
    "无法连接",
    "无法执行",
    "请连接",
    "请授权",
    "connect",
    "authorize",
    "authorise",
    "not connected",
    "not authorized",
    "not authorised",
    "not integrated",
    "missing integration",
    "integration required",
  ].join("|"),
  "i",
);

function normalizePlatformText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[()[\]{}"'`]/g, " ")
    .replace(/[-\s/]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function compactPlatformText(value: string) {
  return normalizePlatformText(value).replace(/_/g, "");
}

export function normalizeIntegrationPlatform(
  value: unknown,
): IntegrationId | null {
  if (typeof value !== "string") return null;
  const normalized = normalizePlatformText(value);
  if (!normalized) return null;

  if (/\bx\b/i.test(value) && /twitter|tweet|推特/i.test(value)) {
    return "twitter";
  }

  if (CONNECTOR_PLATFORM_SET.has(normalized)) {
    return normalized as IntegrationId;
  }

  const exact = PLATFORM_ALIASES[normalized];
  if (exact) return exact;

  if (value.includes("推特")) return "twitter";

  const compact = compactPlatformText(value);
  const aliasEntries = Object.entries(PLATFORM_ALIASES).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [alias, platform] of aliasEntries) {
    const compactAlias = compactPlatformText(alias);
    if (compactAlias.length < 3) continue;
    if (compact.includes(compactAlias)) return platform;
  }

  return null;
}

export function resolveSuggestedActionIntegrationPlatform(
  action: ConnectorActionLike,
): IntegrationId | null {
  const params = action.params ?? {};
  for (const key of ["platform", "integration", "connector", "provider"]) {
    const platform = normalizeIntegrationPlatform(params[key]);
    if (platform) return platform;
  }

  return (
    normalizeIntegrationPlatform(action.content) ??
    normalizeIntegrationPlatform(action.label)
  );
}

export function isIntegrationConnectAction(action: ConnectorActionLike) {
  if (action.type === "add_integration") return true;
  if (action.type !== "custom") return false;

  const text = [action.label, action.content]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  if (CONNECTOR_INTENT_PATTERN.test(text)) return true;

  return false;
}

export function shouldHideConnectedIntegrationAction(
  action: ConnectorActionLike,
  connectedPlatforms: ReadonlySet<IntegrationId>,
) {
  const platform = resolveSuggestedActionIntegrationPlatform(action);
  if (!platform) return false;
  return connectedPlatforms.has(platform);
}

function hasDisconnectedIntegrationSignal(text: string) {
  return DISCONNECTED_INTEGRATION_PATTERN.test(text);
}

function isEnglishLanguage(language?: string | null): boolean {
  return language?.toLowerCase().startsWith("en") ?? false;
}

function getPlatformLabel(
  platform: IntegrationId | null,
  language?: string | null,
) {
  if (platform === "twitter") return "X/Twitter";
  if (platform === "google_calendar") return "Google Calendar";
  if (platform === "outlook_calendar") return "Outlook Calendar";
  if (platform === "facebook_messenger") return "Facebook Messenger";
  if (platform === "google_drive") return "Google Drive";
  if (platform === "google_docs") return "Google Docs";
  if (platform === "imessage") return "iMessage";
  if (platform === "qqbot") return "QQ";
  if (platform === "weixin")
    return isEnglishLanguage(language) ? "WeChat" : "微信";
  if (platform === "feishu")
    return isEnglishLanguage(language) ? "Lark/Feishu" : "Lark/飞书";
  if (platform === "dingtalk")
    return isEnglishLanguage(language) ? "DingTalk" : "钉钉";
  if (!platform) return isEnglishLanguage(language) ? "platform" : "平台";
  return platform
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getConnectActionLabel(
  platform: IntegrationId | null,
  language?: string | null,
) {
  const platformLabel = getPlatformLabel(platform, language);
  return isEnglishLanguage(language)
    ? `Connect ${platformLabel}`
    : `连接${platformLabel}`;
}

export function resolveDisconnectedIntegrationPlatformFromText(
  text: string,
): IntegrationId | null {
  if (!hasDisconnectedIntegrationSignal(text)) return null;
  return normalizeIntegrationPlatform(text);
}

export function buildMissingIntegrationActionFromText(
  text: string,
  options?: { language?: string | null },
): ConnectorTargetAction | null {
  if (!hasDisconnectedIntegrationSignal(text)) return null;
  const platform = normalizeIntegrationPlatform(text);
  const label = getConnectActionLabel(platform, options?.language);
  return {
    type: "add_integration",
    label,
    content: platform ?? undefined,
    params: platform ? { platform } : undefined,
    requiresConfirmation: false,
  };
}

export function buildConnectorUrl(platform?: IntegrationId | null) {
  const params = new URLSearchParams({ addPlatform: "true" });
  if (platform) params.set("platform", platform);
  return `/connectors?${params.toString()}`;
}
