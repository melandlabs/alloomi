/**
 * Feishu WebSocket Long Connection Listener (Bot Mode, based on OpenClaw)
 *
 * Unlike Telegram/iMessage "self-message mode": Feishu uses **bot mode**.
 * - User chats with "Feishu app/bot"; Alloomi listens to messages received by the bot and replies as the bot.
 * - One im.message.receive_v1 = one user message sent to the bot; processes only this message, no session history.
 * - Filtering: only processes sender_type=user (user to bot); ignores sender_type=app (bot's own messages to avoid treating its own replies as new messages).
 */
import * as Lark from "@larksuiteoapi/node-sdk";
import {
  bulkUpsertContacts,
  getIntegrationAccountsByUserId,
  loadIntegrationCredentials,
} from "@/lib/db/queries";
import { getCloudAuthToken } from "@/lib/auth/token-manager";
import { handleFeishuInboundMessage } from "./handler";

const DEBUG = process.env.DEBUG_FEISHU === "true";

type FeishuCredentials = {
  appId?: string;
  appSecret?: string;
  domain?: "feishu" | "lark";
};

/** Per-connection context (bot backend: each account corresponds to one Feishu app, Tauri uses authToken to call cloud AI) */
interface FeishuConnection {
  accountId: string;
  userId: string;
  account: Awaited<ReturnType<typeof getIntegrationAccountsByUserId>>[number];
  wsClient: Lark.WSClient | null;
  /** Cloud token for bot to call AI in Tauri mode (Alloomi user's cloud token) */
  authToken?: string;
  /** Used for fast response within 3 seconds (reaction), etc. */
  appId: string;
  appSecret: string;
}

/** Global: maintain connections by accountId for easy reconnect/destroy */
const connections = new Map<string, FeishuConnection>();

/** Deduplicate processed messages (based on OpenClaw PR #22675: deduplicate before dispatch to avoid duplicate replies from redelivery) key = `${accountId}:${messageId}`, value = processing timestamp */
const processedMessageIds = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEDUP_MAX_SIZE = 5000;

function pruneProcessedMessageIds(): void {
  if (processedMessageIds.size <= DEDUP_MAX_SIZE) return;
  const now = Date.now();
  for (const [key, ts] of processedMessageIds.entries()) {
    if (now - ts > DEDUP_TTL_MS) processedMessageIds.delete(key);
  }
  if (processedMessageIds.size > DEDUP_MAX_SIZE) {
    const entries = [...processedMessageIds.entries()].sort(
      (a, b) => a[1] - b[1],
    );
    const toRemove = entries
      .slice(0, Math.floor(entries.length / 2))
      .map((e) => e[0]);
    toRemove.forEach((k) => processedMessageIds.delete(k));
  }
}

/** Logging: print when event is received for troubleshooting "only process current session" and "filter who sent" */
const LOG_FEISHU_EVENT = process.env.DEBUG_FEISHU === "true";

function logEvent(label: string, obj: Record<string, unknown> | unknown): void {
  if (!LOG_FEISHU_EVENT) return;
  try {
    const s =
      typeof obj === "object" && obj !== null
        ? JSON.stringify(obj, null, 0).slice(0, 800)
        : String(obj);
    console.log(`[Feishu] ${label}`, s);
  } catch {
    console.log(`[Feishu] ${label}`, "(serialize error)");
  }
}

/** Reaction request timeout (Feishu requires response within 3 seconds, leaving ~2s for the API call) */
const REACTION_TIMEOUT_MS = 2000;

/**
 * Fast "received" acknowledgment to Feishu after receiving a message (based on nanobot feishu.py)
 * Feishu requires a response within 3 seconds; should be called and awaited immediately after getting message_id to ensure the request is sent.
 */
async function addFeishuReaction(
  appId: string,
  appSecret: string,
  messageId: string,
): Promise<void> {
  const client = new Lark.Client({ appId, appSecret });
  return (client as any).im.v1.messageReaction
    .create({
      path: { message_id: messageId },
      data: { reaction_type: { emoji_type: "THUMBSUP" } },
    })
    .then(() => {
      console.log("[Feishu] Added reaction to message_id=%s", messageId);
    })
    .catch((err: unknown) => {
      console.warn(
        "[Feishu] Failed to add reaction message_id=%s",
        messageId,
        err,
      );
    });
}

/**
 * Parse text from Feishu event payload
 * content is JSON, e.g. {"text":"hello"} or {"text":"","elements":[...]}
 */
function extractTextFromContent(content: string): string {
  if (!content?.trim()) return "";
  try {
    const obj = JSON.parse(content) as { text?: string };
    return (obj?.text ?? "").trim();
  } catch {
    return content.trim();
  }
}

/**
 * Start WebSocket connection for a single Feishu account (one bot)
 * @param authToken Cloud auth token passed from frontend in Tauri mode, used for bot to call cloud AI when receiving messages
 */
export async function startFeishuConnection(
  account: Awaited<ReturnType<typeof getIntegrationAccountsByUserId>>[number],
  authToken?: string,
): Promise<void> {
  if (account.platform !== "feishu") return;

  const credentials = loadIntegrationCredentials<FeishuCredentials>(account);
  const appId = credentials?.appId?.trim();
  const appSecret = credentials?.appSecret?.trim();
  if (!appId || !appSecret) {
    if (DEBUG)
      console.warn(
        `[Feishu] Account ${account.id} missing appId/appSecret, skipping`,
      );
    return;
  }

  const accountId = account.id;
  const existing = connections.get(accountId);
  if (existing) {
    if (authToken?.trim()) {
      existing.authToken = authToken.trim();
      if (DEBUG)
        console.log(
          `[Feishu] Account ${accountId} already connected, authToken updated`,
        );
    } else if (DEBUG) {
      console.log(
        `[Feishu] Account ${accountId} already connected, init did not carry token, use conn and global getCloudAuthToken`,
      );
    }
    return;
  }

  // SDK requires passing an object of "eventType -> handler function" to register, cannot pass two params (eventType, handler)
  const eventDispatcher = new Lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data: {
      message?: {
        chat_id?: string;
        message_id?: string;
        content?: string;
        chat_type?: string;
      };
      sender?: {
        sender_id?: { open_id?: string; user_id?: string };
        sender_type?: string;
      };
    }) => {
      // Print event_id and time first when event is received for easy log lookup
      const raw = data as any;
      const eventId = raw?.header?.event_id ?? raw?.event_id ?? "";
      const createTime = raw?.header?.create_time ?? raw?.create_time ?? "";
      const timeStr =
        createTime && !Number.isNaN(Number(createTime))
          ? new Date(Number(createTime)).toISOString()
          : String(createTime) || "(none)";
      console.log(
        "[Feishu] Event received event_id=%s create_time=%s (%s)",
        eventId || "(empty)",
        createTime || "(empty)",
        timeStr,
      );

      const conn = connections.get(accountId);
      if (!conn) return;

      const message = data?.message ?? (data as any).message;
      const messageId = message?.message_id ?? "";

      // Send "received" acknowledgment to Feishu as quickly as possible (within 3 seconds), then do filtering and business logic
      if (messageId) {
        await Promise.race([
          addFeishuReaction(conn.appId, conn.appSecret, messageId),
          new Promise<void>((_, reject) =>
            setTimeout(
              () => reject(new Error("reaction_timeout")),
              REACTION_TIMEOUT_MS,
            ),
          ),
        ]).catch((e) => {
          if ((e as Error)?.message === "reaction_timeout") {
            console.warn(
              "[Feishu] reaction did not complete within %dms, continuing processing",
              REACTION_TIMEOUT_MS,
            );
          }
        });
      }

      // Logging: raw structure of received event (to confirm field positions like sender)
      logEvent("Event received - raw data keys and key fields", {
        keys: Object.keys(data as object),
        message: (data as any)?.message,
        sender: (data as any)?.sender,
      });

      const sender = data?.sender ?? (data as any).sender;
      const chatId = message?.chat_id;
      const content = message?.content ?? "";
      const rawChatType =
        message?.chat_type ?? (data as any).message?.chat_type ?? "";
      const chatType: "p2p" | "group" =
        rawChatType === "group" || rawChatType === "topic_group"
          ? "group"
          : "p2p";
      const mentions: unknown =
        (message as any)?.mentions ?? (data as any)?.message?.mentions;
      const senderType =
        sender?.sender_type ?? (sender as any)?.sender_type ?? "";
      const openId =
        sender?.sender_id?.open_id ??
        sender?.sender_id?.user_id ??
        (sender as any)?.sender_id?.open_id ??
        "";
      const text = extractTextFromContent(content);

      if (!chatId) {
        if (DEBUG) console.warn("[Feishu] Event missing chat_id", data);
        return;
      }

      // Logging: parsed fields for troubleshooting "who sent" filtering
      console.log(
        "[Feishu] Parsed message_id=%s chat_id=%s chat_type=%s sender_type=%s sender_open_id=%s content length=%d content preview=%s",
        messageId,
        chatId,
        rawChatType || "(empty)",
        senderType || "(empty)",
        openId || "(empty)",
        text.length,
        text.slice(0, 80),
      );

      // Bot mode filter: only process "user to bot" messages (sender_type=user); ignore "bot's own messages" (sender_type=app)
      if (senderType === "app") {
        console.log(
          "[Feishu] Filtered: ignoring sender_type=app (bot's own message) message_id=%s",
          messageId,
        );
        return;
      }
      if (senderType !== "user") {
        console.log(
          "[Feishu] Filtered: ignoring sender_type=%s (only process user) message_id=%s",
          senderType || "(empty)",
          messageId,
        );
        return;
      }

      // Group chat: only trigger subsequent processing when message contains @ info (e.g. user @mentions bot in group)
      if (chatType === "group") {
        const mentionList = Array.isArray(mentions) ? mentions : [];
        if (mentionList.length === 0) {
          console.log(
            "[Feishu] Filtered: group message without @ mention, ignoring message_id=%s",
            messageId,
          );
          return;
        }
      }

      console.log(
        "[Feishu] Bot received user message message_id=%s content=%s",
        messageId,
        text.slice(0, 120),
      );

      // Deduplicate before dispatch (based on OpenClaw): mark as processed only here to avoid duplicate replies from Feishu redelivery or dual events
      const dedupKey = `${accountId}:${messageId}`;
      if (processedMessageIds.has(dedupKey)) {
        console.log(
          "[Feishu] Deduplication: already processed message_id=%s, skipping",
          messageId,
        );
        return;
      }
      processedMessageIds.set(dedupKey, Date.now());
      pruneProcessedMessageIds();

      // Business logic runs in next event loop tick to avoid blocking the event callback return
      const payload = {
        chatId,
        messageId,
        senderId: openId,
        text,
        chatType,
      } as const;
      // Connection may have been established during server cold start (no token); init writes token to memory, merge here to avoid calling model with empty token briefly after restart
      const effectiveAuthToken =
        conn.authToken?.trim() || getCloudAuthToken()?.trim();
      const auth = { authToken: effectiveAuthToken };
      // Sync Feishu conversation to user contacts table for later session-based history retrieval to generate Insight
      const accountRecord = conn.account;
      const botId = accountRecord.bot?.id;
      if (botId) {
        bulkUpsertContacts([
          {
            userId: accountRecord.userId,
            contactId: chatId,
            contactName: chatId,
            type: chatType,
            botId,
            contactMeta: {
              platform: "feishu",
              chatId,
              chatType,
            },
          },
        ]).catch((err) => {
          console.error(
            "[Feishu] Failed to sync Feishu conversation to user_meta_contacts:",
            err,
          );
        });
      }

      setImmediate(() => {
        handleFeishuInboundMessage(conn.account, payload, auth).catch((err) => {
          console.error(
            "[Feishu] Async inbound message processing failed:",
            err,
          );
        });
      });
    },
  });

  const wsClient = new Lark.WSClient({
    appId,
    appSecret,
    loggerLevel: DEBUG ? Lark.LoggerLevel.debug : Lark.LoggerLevel.info,
  });

  const conn: FeishuConnection = {
    accountId,
    userId: account.userId,
    account,
    wsClient,
    authToken: authToken?.trim() || undefined,
    appId,
    appSecret,
  };
  connections.set(accountId, conn);

  try {
    await wsClient.start({ eventDispatcher });
    if (DEBUG)
      console.log(`[Feishu] WebSocket connected accountId=${accountId}`);
  } catch (err) {
    console.error(
      `[Feishu] WebSocket connection failed accountId=${accountId}`,
      err,
    );
    connections.delete(accountId);
  }
}

/**
 * Stop Feishu connection for a single account
 */
export function stopFeishuConnection(accountId: string): void {
  const conn = connections.get(accountId);
  if (!conn) return;
  try {
    if (conn.wsClient && typeof (conn.wsClient as any).stop === "function") {
      (conn.wsClient as any).stop();
    }
  } catch (e) {
    console.warn("[Feishu] stop exception", e);
  }
  connections.delete(accountId);
  if (DEBUG) console.log(`[Feishu] Disconnected accountId=${accountId}`);
}

/**
 * Start connections for all Feishu bots under a given Alloomi user (one bot per account, one connection per bot)
 * @param authToken Cloud auth token passed from frontend in Tauri mode, used for bot to call AI
 */
export async function startFeishuListenersForUser(
  userId: string,
  authToken?: string,
): Promise<void> {
  const accounts = await getIntegrationAccountsByUserId({ userId });
  const feishuAccounts = accounts.filter((a) => a.platform === "feishu");
  for (const account of feishuAccounts) {
    await startFeishuConnection(account, authToken);
  }
}

/**
 * Start connections for all existing Feishu accounts (called during service startup)
 */
export async function startAllFeishuListeners(): Promise<void> {
  const { db } = await import("@/lib/db");
  const { integrationAccounts } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const feishuRows = await db
    .select({ userId: integrationAccounts.userId })
    .from(integrationAccounts)
    .where(eq(integrationAccounts.platform, "feishu"));

  const userIdList: string[] = feishuRows
    .map((row: { userId: string | null }) => row.userId)
    .filter(
      (id: string | null): id is string =>
        typeof id === "string" && id.length > 0,
    );
  const uniqueUserIds: string[] = Array.from(new Set<string>(userIdList));
  let total = 0;
  for (const userId of uniqueUserIds) {
    await startFeishuListenersForUser(userId);
    const accounts = await getIntegrationAccountsByUserId({ userId });
    total += accounts.filter((a) => a.platform === "feishu").length;
  }
  if (DEBUG)
    console.log(`[Feishu] Started ${total} Feishu WebSocket connections`);
}
