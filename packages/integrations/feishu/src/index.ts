/**
 * Feishu (Lark) platform adapter
 * Send messages via Feishu Open Platform API using app_id / app_secret
 * Needs to work with Feishu WebSocket long-poll listener to receive messages
 */
import { MessagePlatformAdapter } from "@alloomi/integrations/channels";
import type { Messages, Message, Image } from "@alloomi/integrations/channels";
import type {
  MessageEvent,
  MessageTarget,
} from "@alloomi/integrations/channels";
import type {
  Friend,
  Group,
  GroupMember,
} from "@alloomi/integrations/channels";
import { Permission } from "@alloomi/integrations/channels";
import * as Lark from "@larksuiteoapi/node-sdk";
import type { ExtractedMessageInfo } from "@alloomi/integrations/channels/sources/types";

const DEBUG = process.env.DEBUG_FEISHU === "true";

export type FeishuCredentials = {
  appId: string;
  appSecret: string;
  /** International Lark tenant (consistent with device code registration domain) */
  domain?: "feishu" | "lark";
};

function isPlainText(m: Message): m is string {
  return typeof m === "string";
}

function isImageMessage(message: Message): message is Image {
  return (
    typeof message === "object" &&
    message !== null &&
    "url" in message &&
    typeof (message as Image).url === "string" &&
    (message as Image).url.length > 0
  );
}

/**
 * Convert Alloomi Messages to Feishu-sendable text (merge multiple segments into one, images temporarily as placeholders or skipped)
 */
function messagesToFeishuText(messages: Messages): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (isPlainText(m)) {
      parts.push(m);
    } else if (isImageMessage(m)) {
      parts.push("[Image]");
    } else {
      parts.push("[Content]");
    }
  }
  return parts.join("\n").trim() || "";
}

/**
 * Extract plain text from Feishu content field (content is JSON string)
 */
function extractTextFromContent(content: string | undefined | null): string {
  const raw = content ?? "";
  if (!raw.trim()) return "";
  try {
    const obj = JSON.parse(raw) as { text?: string };
    return (obj?.text ?? "").trim();
  } catch {
    return raw.trim();
  }
}

export class FeishuAdapter extends MessagePlatformAdapter {
  name = "Feishu";
  private client: Lark.Client | null = null;
  private credentials: FeishuCredentials;
  private botId: string;
  /** Open API base path (including /open-apis), used for token refresh and direct GET */
  private readonly openApisBase: string;
  private tenantTokenCache: { token: string; expiresAtMs: number } | null =
    null;

  constructor(opts: {
    botId: string;
    appId: string;
    appSecret: string;
    domain?: "feishu" | "lark";
  }) {
    super();
    this.botId = opts.botId ?? "";
    this.credentials = {
      appId: opts.appId,
      appSecret: opts.appSecret,
      ...(opts.domain ? { domain: opts.domain } : {}),
    };
    this.openApisBase =
      opts.domain === "lark"
        ? "https://open.larksuite.com/open-apis"
        : "https://open.feishu.cn/open-apis";
    this.client = new Lark.Client({
      appId: this.credentials.appId,
      appSecret: this.credentials.appSecret,
    });
  }

  private getClient(): Lark.Client {
    if (!this.client) {
      this.client = new Lark.Client({
        appId: this.credentials.appId,
        appSecret: this.credentials.appSecret,
      });
    }
    return this.client;
  }

  private async getTenantAccessToken(): Promise<string> {
    const now = Date.now();
    if (
      this.tenantTokenCache &&
      this.tenantTokenCache.expiresAtMs - now > 60_000
    ) {
      return this.tenantTokenCache.token;
    }

    const resp = await fetch(
      `${this.openApisBase}/auth/v3/tenant_access_token/internal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          app_id: this.credentials.appId,
          app_secret: this.credentials.appSecret,
        }),
      },
    );

    const json = (await resp.json().catch(() => null)) as {
      tenant_access_token?: string;
      expire?: number;
      code?: number;
      msg?: string;
    } | null;

    if (!resp.ok || !json?.tenant_access_token) {
      const msg = json?.msg ?? `HTTP ${resp.status}`;
      throw new Error(
        `[FeishuAdapter] Failed to get tenant_access_token: ${msg}`,
      );
    }

    const expireSec = typeof json.expire === "number" ? json.expire : 3600;
    this.tenantTokenCache = {
      token: json.tenant_access_token,
      expiresAtMs: now + expireSec * 1000,
    };
    return json.tenant_access_token;
  }

  private async feishuGet<T>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const token = await this.getTenantAccessToken();
    const url = new URL(`${this.openApisBase}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
    const json = (await resp.json().catch(() => null)) as any;
    if (!resp.ok || (typeof json?.code === "number" && json.code !== 0)) {
      const msg = json?.msg ?? `HTTP ${resp.status}`;
      throw new Error(`[FeishuAdapter] GET ${path} failed: ${msg}`);
    }
    return json as T;
  }

  /**
   * Feishu uses chat_id as conversation identifier (both private and group chats have chat_id)
   * Simply use chat_id for receive_id_type
   */
  async sendMessages(
    target: MessageTarget,
    id: string,
    messages: Messages,
  ): Promise<void> {
    const text = messagesToFeishuText(messages);
    if (!text) {
      if (DEBUG) console.log("[FeishuAdapter] No text content, skipping send");
      return;
    }
    const client = this.getClient();
    try {
      await client.im.v1.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: id,
          msg_type: "text",
          content: JSON.stringify({ text }),
        },
      });
      if (DEBUG) console.log(`[FeishuAdapter] Sent to chat_id=${id}`);
    } catch (err) {
      console.error("[FeishuAdapter] Send failed:", err);
      throw err;
    }
  }

  async replyMessages(
    event: MessageEvent,
    messages: Messages,
    _quoteOrigin = false,
  ): Promise<void> {
    const chatId =
      event.sourcePlatformObject?.event?.message?.chat_id ??
      event.sourcePlatformObject?.message?.chat_id;
    const messageId =
      event.sourcePlatformObject?.event?.message?.message_id ??
      event.sourcePlatformObject?.message?.message_id;
    if (!chatId) {
      await this.sendMessages(
        event.targetType,
        (event.sender as Friend).id as string,
        messages,
      );
      return;
    }
    const text = messagesToFeishuText(messages);
    if (!text) return;
    const client = this.getClient();
    try {
      // root_id field is not yet exposed in SDK types, using type assertion to bypass constraint to support "reply to specific message"
      await (client.im.v1.message.create as any)({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          msg_type: "text",
          content: JSON.stringify({ text }),
          root_id: messageId ?? undefined,
        },
      });
      if (DEBUG) console.log(`[FeishuAdapter] Replied chat_id=${chatId}`);
    } catch (err) {
      console.error("[FeishuAdapter] Reply failed:", err);
      throw err;
    }
  }

  /**
   * Use Feishu "Get conversation list of user or bot" API to get conversation names (group + private)
   * Reference: https://open.feishu.cn/document/server-docs/im-v1/chat/list
   */
  async listChatsForInsights(): Promise<
    Array<{
      chatId: string;
      chatName?: string | null;
      chatType: "p2p" | "group" | "unknown";
    }>
  > {
    const chats: Array<{
      chatId: string;
      chatName?: string | null;
      chatType: "p2p" | "group" | "unknown";
    }> = [];

    let pageToken: string | undefined;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const resp = await this.feishuGet<{
          data?: { items?: any[]; has_more?: boolean; page_token?: string };
        }>("/im/v1/chats", {
          page_size: 50,
          page_token: pageToken,
        });

        const items: any[] = Array.isArray(resp?.data?.items)
          ? (resp.data?.items as any[])
          : [];

        if (items.length === 0) {
          break;
        }

        for (const c of items) {
          const chatId: string | undefined = c.chat_id ?? c.id;
          if (!chatId) continue;
          const name: string | undefined =
            c.name ?? c.chat_name ?? c.display_name ?? chatId;
          const mode = (c.chat_mode ?? c.chat_type ?? "unknown") as string;
          const chatType: "p2p" | "group" | "unknown" =
            mode === "p2p" ? "p2p" : mode === "group" ? "group" : "unknown";

          chats.push({
            chatId,
            chatName: name,
            chatType,
          });
        }

        if (!resp?.data?.has_more) {
          break;
        }
        const nextToken = resp?.data?.page_token;
        if (!nextToken || typeof nextToken !== "string") {
          break;
        }
        pageToken = nextToken;
      } catch (err) {
        console.error(
          "[FeishuAdapter] Failed to get conversation list (/im/v1/chats), will fall back to contact table:",
          err,
        );
        break;
      }
    }

    if (DEBUG)
      console.log(
        `[FeishuAdapter] Retrieved ${chats.length} conversations via /im/v1/chats`,
      );

    return chats;
  }

  async getChatNameById(chatId: string): Promise<string | null> {
    if (!chatId) return null;
    try {
      const resp = await this.feishuGet<{
        data?: { name?: string; chat_name?: string; display_name?: string };
      }>(`/im/v1/chats/${encodeURIComponent(chatId)}`);
      const name =
        resp?.data?.name ?? resp?.data?.chat_name ?? resp?.data?.display_name;
      return typeof name === "string" && name.trim().length > 0 ? name : null;
    } catch (err) {
      if (DEBUG) {
        console.warn(
          `[FeishuAdapter] Failed to get conversation details chatId=${chatId}`,
          err,
        );
      }
      return null;
    }
  }

  /**
   * Batch fetch historical messages by conversation for scheduled Insight generation
   * @param options.chats List of conversations to fetch
   * @param options.since Start Unix timestamp (seconds), only keep messages after this
   * @param options.maxMessagesPerChat Maximum number of messages to fetch per conversation
   */
  async getMessagesByChats(options: {
    chats: Array<{
      chatId: string;
      chatName?: string | null;
      chatType?: "p2p" | "group" | "unknown";
    }>;
    since: number;
    maxMessagesPerChat?: number;
  }): Promise<ExtractedMessageInfo[]> {
    const { chats, since, maxMessagesPerChat = 200 } = options;
    const client = this.getClient();
    const allMessages: ExtractedMessageInfo[] = [];

    for (const chat of chats) {
      const chatId = chat.chatId;
      if (!chatId) continue;

      let pageToken: string | undefined;
      let fetchedCount = 0;

      // Fetch historical messages for specified conversation page by page
      // Use reverse order by creation time, start from newest message and work backwards
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const resp: any = await (client as any).im.v1.message.list({
            params: {
              container_id_type: "chat",
              container_id: chatId,
              page_size: 50,
              // ByCreateTimeDesc: Reverse order by creation time (newest first)
              sort_type: "ByCreateTimeDesc",
              page_token: pageToken,
            },
          });

          const data = resp?.data;
          const items: any[] = Array.isArray(data?.items) ? data.items : [];

          if (items.length === 0) {
            break;
          }

          let reachedOlderThanSince = false;

          for (const item of items) {
            // create_time might be millisecond timestamp string or second-level timestamp, handle both cases
            const createTimeRaw = item.create_time ?? item.create_time_ms;
            let createTimeMs = Number(createTimeRaw ?? 0);
            if (!Number.isFinite(createTimeMs) || createTimeMs <= 0) {
              continue;
            }
            // If value is relatively small (e.g., around 10 digits), it's more likely a second-level timestamp, need to convert to milliseconds
            if (createTimeMs < 1e11) {
              createTimeMs = createTimeMs * 1000;
            }
            const tsSec = Math.floor(createTimeMs / 1000);
            if (tsSec < since) {
              // Current item and subsequent items are earlier than since, mark and break current page loop
              reachedOlderThanSince = true;
              break;
            }

            const contentStr: string =
              typeof item.content === "string"
                ? item.content
                : typeof item.body?.content === "string"
                  ? item.body.content
                  : "";
            const text = extractTextFromContent(contentStr);
            if (!text) continue;

            const senderInfo: any =
              item.sender ??
              item.sender_id ??
              item.sender_id?.open_id ??
              item.sender_id?.user_id ??
              {};
            const senderId: string =
              senderInfo.open_id ??
              senderInfo.user_id ??
              senderInfo.id ??
              "unknown";

            const chatType: "private" | "group" | "channel" | "unknown" =
              chat.chatType === "group"
                ? "group"
                : chat.chatType === "p2p"
                  ? "private"
                  : item.chat_type === "group"
                    ? "group"
                    : "private";

            allMessages.push({
              id: item.message_id ?? `${chatId}_${createTimeMs}`,
              chatType,
              chatName: chat.chatName ?? chatId,
              sender: senderId,
              text,
              timestamp: tsSec,
            });

            fetchedCount++;
            if (fetchedCount >= maxMessagesPerChat) {
              break;
            }
          }

          if (fetchedCount >= maxMessagesPerChat) {
            break;
          }

          // Already encountered message earlier than since, subsequent pagination will only be older, end directly
          if (reachedOlderThanSince) {
            break;
          }

          if (!data?.has_more) {
            break;
          }
          const nextToken = data.page_token;
          if (!nextToken || typeof nextToken !== "string") {
            break;
          }
          pageToken = nextToken;
        } catch (err) {
          console.error(
            `[FeishuAdapter] Failed to fetch historical messages for conversation ${chatId}:`,
            err,
          );
          break;
        }
      }

      if (DEBUG)
        console.log(
          `[FeishuAdapter] Collected ${fetchedCount} messages for summary from conversation ${chatId}`,
        );
    }

    if (DEBUG)
      console.log(
        `[FeishuAdapter] [Bot ${this.botId}] Collected ${allMessages.length} Feishu messages for scheduled Insight`,
      );

    return allMessages;
  }

  /** Empty implementation when no long-connection resources need to be released */
  async kill(): Promise<void> {
    this.client = null;
  }
}

/**
 * Build Friend from Feishu event (private chat sender)
 */
export function feishuEventToFriend(openId: string, name?: string): Friend {
  return {
    id: openId,
    name: name ?? openId,
    nickname: name,
  };
}

/**
 * Build Group + GroupMember from Feishu event (group chat sender)
 */
export function feishuEventToGroupMember(
  openId: string,
  chatId: string,
  chatName?: string,
  memberName?: string,
): GroupMember {
  const group: Group = {
    id: chatId,
    name: chatName ?? chatId,
    permission: Permission.Member,
  };
  return {
    id: openId,
    memberName: memberName ?? openId,
    permission: Permission.Member,
    group,
    // Fields below are not used in current scenario, fill with reasonable defaults
    specialTitle: "",
    joinTimestamp: new Date(0),
    lastSpeakTimestamp: new Date(0),
    muteTimeRemaining: 0,
  };
}
