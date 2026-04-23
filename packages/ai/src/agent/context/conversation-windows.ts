import {
  COMPACTION_EMERGENCY_RATIO,
  COMPACTION_HARD_RATIO,
  COMPACTION_SOFT_RATIO,
  type CompactionLevel,
} from "../compaction";
import { estimateTokens } from "../billing";

export type ConversationWindowRole = "user" | "assistant" | "system";

export interface ConversationWindowMessage {
  role: ConversationWindowRole;
  content: string;
  timestamp?: number;
}

export interface ConversationWindowConfig {
  maxTokens: number;
  recentWindowMs?: number;
  warmWindowMs?: number;
  coldWindowMs?: number;
  keepRecentTokensRatio?: number;
  keepWarmTokensRatio?: number;
}

export interface TokenizedConversationWindowMessage extends ConversationWindowMessage {
  tokens: number;
  bucket: ConversationWindowBucket;
  ageMs: number;
}

export type ConversationWindowBucket =
  | "recent"
  | "warm"
  | "cold"
  | "archive"
  | "unknown";

export interface ConversationWindowBucketStats {
  messages: number;
  tokens: number;
}

export interface ConversationWindowResult {
  immediate: TokenizedConversationWindowMessage[];
  candidatesForCompaction: TokenizedConversationWindowMessage[];
  deferred: TokenizedConversationWindowMessage[];
  totalTokens: number;
  immediateTokens: number;
  compactionCandidateTokens: number;
  usageRatio: number;
  level: CompactionLevel | null;
  bucketStats: Record<ConversationWindowBucket, ConversationWindowBucketStats>;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Default windows favor preserving very recent context in full text while
// gradually pushing older history toward async compaction.
export const DEFAULT_CONVERSATION_WINDOW_CONFIG: Required<ConversationWindowConfig> =
  {
    maxTokens: 40_000,
    recentWindowMs: HOUR_MS,
    warmWindowMs: DAY_MS,
    coldWindowMs: 7 * DAY_MS,
    keepRecentTokensRatio: 0.5,
    keepWarmTokensRatio: 0.3,
  };

function clampRatio(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function normalizeConfig(
  config: ConversationWindowConfig,
): Required<ConversationWindowConfig> {
  return {
    maxTokens: Math.max(1, config.maxTokens),
    recentWindowMs:
      config.recentWindowMs ??
      DEFAULT_CONVERSATION_WINDOW_CONFIG.recentWindowMs,
    warmWindowMs:
      config.warmWindowMs ?? DEFAULT_CONVERSATION_WINDOW_CONFIG.warmWindowMs,
    coldWindowMs:
      config.coldWindowMs ?? DEFAULT_CONVERSATION_WINDOW_CONFIG.coldWindowMs,
    keepRecentTokensRatio: clampRatio(
      config.keepRecentTokensRatio ??
        DEFAULT_CONVERSATION_WINDOW_CONFIG.keepRecentTokensRatio,
      DEFAULT_CONVERSATION_WINDOW_CONFIG.keepRecentTokensRatio,
    ),
    keepWarmTokensRatio: clampRatio(
      config.keepWarmTokensRatio ??
        DEFAULT_CONVERSATION_WINDOW_CONFIG.keepWarmTokensRatio,
      DEFAULT_CONVERSATION_WINDOW_CONFIG.keepWarmTokensRatio,
    ),
  };
}

export function estimateConversationTokens(
  conversation: Array<{ content: string }>,
): number {
  return conversation.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0,
  );
}

export function getConversationBucket(
  timestamp: number | undefined,
  now: number,
  config: Required<ConversationWindowConfig>,
): ConversationWindowBucket {
  if (!timestamp) return "unknown";

  const ageMs = Math.max(0, now - timestamp);
  if (ageMs <= config.recentWindowMs) return "recent";
  if (ageMs <= config.warmWindowMs) return "warm";
  if (ageMs <= config.coldWindowMs) return "cold";
  return "archive";
}

function getCompactionLevel(
  usageRatio: number,
  hasOldHistory: boolean,
): CompactionLevel | null {
  if (usageRatio >= COMPACTION_EMERGENCY_RATIO) return "emergency";
  if (usageRatio >= COMPACTION_HARD_RATIO) return "hard";
  if (usageRatio >= COMPACTION_SOFT_RATIO || hasOldHistory) return "soft";
  return null;
}

function pushStats(
  stats: Record<ConversationWindowBucket, ConversationWindowBucketStats>,
  message: TokenizedConversationWindowMessage,
) {
  stats[message.bucket].messages += 1;
  stats[message.bucket].tokens += message.tokens;
}

function createBucketStats(): Record<
  ConversationWindowBucket,
  ConversationWindowBucketStats
> {
  return {
    recent: { messages: 0, tokens: 0 },
    warm: { messages: 0, tokens: 0 },
    cold: { messages: 0, tokens: 0 },
    archive: { messages: 0, tokens: 0 },
    unknown: { messages: 0, tokens: 0 },
  };
}

function keepNewestWithinBudget(
  messages: TokenizedConversationWindowMessage[],
  budget: number,
): {
  kept: TokenizedConversationWindowMessage[];
  dropped: TokenizedConversationWindowMessage[];
  tokens: number;
} {
  if (budget <= 0 || messages.length === 0) {
    return { kept: [], dropped: [...messages], tokens: 0 };
  }

  let tokens = 0;
  const kept: TokenizedConversationWindowMessage[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (tokens + msg.tokens > budget) break;
    tokens += msg.tokens;
    kept.unshift(msg);
  }

  if (kept.length === 0 && messages.length > 0) {
    const newest = messages[messages.length - 1];
    return {
      kept: [newest],
      dropped: messages.slice(0, -1),
      tokens: newest.tokens,
    };
  }

  const keptSet = new Set(kept);
  const dropped = messages.filter((msg) => !keptSet.has(msg));

  return { kept, dropped, tokens };
}

export function prepareConversationWindows(
  conversation: ConversationWindowMessage[],
  config: ConversationWindowConfig,
  now = Date.now(),
): ConversationWindowResult {
  const normalized = normalizeConfig(config);
  const tokenized = conversation.map((message) => {
    const bucket = getConversationBucket(message.timestamp, now, normalized);
    const ageMs = message.timestamp ? Math.max(0, now - message.timestamp) : 0;
    return {
      ...message,
      tokens: estimateTokens(message.content),
      bucket,
      ageMs,
    };
  });

  const bucketStats = createBucketStats();
  for (const message of tokenized) {
    pushStats(bucketStats, message);
  }

  const totalTokens = tokenized.reduce((sum, msg) => sum + msg.tokens, 0);
  const usageRatio = totalTokens / normalized.maxTokens;

  const recent = tokenized.filter(
    (msg) => msg.bucket === "recent" || msg.bucket === "unknown",
  );
  const warm = tokenized.filter((msg) => msg.bucket === "warm");
  const cold = tokenized.filter((msg) => msg.bucket === "cold");
  const archive = tokenized.filter((msg) => msg.bucket === "archive");

  const recentBudget = Math.max(
    1,
    Math.floor(normalized.maxTokens * normalized.keepRecentTokensRatio),
  );
  const warmBudget = Math.max(
    0,
    Math.floor(normalized.maxTokens * normalized.keepWarmTokensRatio),
  );

  const recentSelection = keepNewestWithinBudget(recent, recentBudget);
  const warmSelection = keepNewestWithinBudget(warm, warmBudget);

  const immediatePool = [...recentSelection.kept, ...warmSelection.kept].sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
  );

  const immediatePoolTokens = immediatePool.reduce(
    (sum, msg) => sum + msg.tokens,
    0,
  );
  const remainingBudget = Math.max(
    0,
    normalized.maxTokens - immediatePoolTokens,
  );

  const coldAndArchive = [...cold, ...archive].sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
  );
  const coldSelection = keepNewestWithinBudget(coldAndArchive, remainingBudget);

  const immediate = [...immediatePool, ...coldSelection.kept].sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
  );

  const candidatesForCompaction = [
    ...recentSelection.dropped,
    ...warmSelection.dropped,
    ...coldSelection.dropped,
  ].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  const candidateSet = new Set(candidatesForCompaction);
  const immediateSet = new Set(immediate);
  const deferred = tokenized.filter(
    (msg) => !candidateSet.has(msg) && !immediateSet.has(msg),
  );

  const hasOldHistory = archive.length > 0 || cold.length > 0;
  const level = getCompactionLevel(usageRatio, hasOldHistory);

  return {
    immediate,
    candidatesForCompaction,
    deferred,
    totalTokens,
    immediateTokens: immediate.reduce((sum, msg) => sum + msg.tokens, 0),
    compactionCandidateTokens: candidatesForCompaction.reduce(
      (sum, msg) => sum + msg.tokens,
      0,
    ),
    usageRatio,
    level,
    bucketStats,
  };
}
