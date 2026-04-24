/**
 * Extract raw message data from various platform formats
 * This module provides utility functions to extract message data
 * during insight generation for storage in IndexedDB
 */

export interface RawMessageData {
  messageId: string;
  platform: string;
  botId: string;
  channel?: string;
  person?: string;
  timestamp: number;
  content: string;
  attachments?: Array<{
    name: string;
    url: string;
    contentType?: string;
    sizeBytes?: number;
  }>;
  metadata?: Record<string, any>;
}

/**
 * Extract raw messages from Slack format
 */
export function extractSlackMessages(
  messages: unknown[],
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any, index: number) => {
      const timestamp = msg.ts || msg.timestamp || msg.time;
      const content =
        msg.text || msg.content || msg.message || msg.snippet || "";
      const channel = msg.channel || msg.chatName || msg.chatId || "unknown";
      const sender =
        msg.user || msg.userName || msg.sender || msg.from || "unknown";

      // Generate unique messageId
      let messageId: string;
      if (msg.clientMsgId || msg.msgId) {
        messageId = String(msg.clientMsgId || msg.msgId);
      } else {
        const contentHash = content
          ? btoa(content.substring(0, 100)).substring(0, 16)
          : "";
        messageId = `slack_${botId}_${timestamp}_${channel}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform: "slack",
        botId,
        channel,
        person: sender,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        content: String(content),
        attachments: extractAttachments(msg.attachments, msg.files),
        metadata: {
          slackTs: msg.ts,
          threadTs: msg.threadTs,
          replyCount: msg.replyCount,
        },
      };
    });
}

/**
 * Extract raw messages from Discord format
 */
export function extractDiscordMessages(
  messages: unknown[],
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any, index: number) => {
      const timestamp = msg.timestamp || msg.createdTimestamp;
      const content =
        msg.content || msg.message || msg.text || msg.snippet || "";
      const channel =
        msg.channelName || msg.channelId || msg.guildId || "unknown";
      const sender =
        msg.authorName || msg.authorUsername || msg.userName || "unknown";

      // Generate unique messageId
      let messageId: string;
      if (msg.id) {
        messageId = String(msg.id);
      } else {
        const contentHash = content
          ? btoa(content.substring(0, 100)).substring(0, 16)
          : "";
        messageId = `discord_${botId}_${timestamp}_${channel}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform: "discord",
        botId,
        channel,
        person: sender,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        content: String(content),
        attachments: extractAttachments(msg.attachments),
        metadata: {
          guildId: msg.guildId,
          channelId: msg.channelId,
        },
      };
    });
}

/**
 * Extract raw messages from Feishu/DingTalk: Message is in ExtractedMessageInfo format, write to IndexedDB original record
 */
export function extractUnifiedInsightMessages(
  messages: unknown[],
  platform: "feishu" | "dingtalk",
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any) => {
      const content = String(msg.text ?? msg.content ?? msg.message ?? "");
      const channel = String(msg.chatName ?? msg.chatId ?? "unknown");
      const sender = String(msg.sender ?? "unknown");
      const idRaw = msg.id;
      const tsRaw = msg.timestamp ?? msg.ts ?? 0;
      const tsNum = typeof tsRaw === "number" ? tsRaw : Number(tsRaw) || 0;

      // ExtractedMessageInfo and part pipeline use second-level timestamp; IndexedDB display layer handles seconds
      const timestampSec =
        tsNum >= 1e12 ? Math.floor(tsNum / 1000) : Math.floor(tsNum);

      let messageId: string;
      if (idRaw !== undefined && idRaw !== null && idRaw !== "") {
        messageId = String(idRaw);
      } else {
        const contentHash = content
          ? btoa(encodeURIComponent(content.substring(0, 100))).substring(0, 16)
          : "";
        messageId = `${platform}_${botId}_${timestampSec}_${channel}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform,
        botId,
        channel,
        person: sender,
        timestamp:
          timestampSec > 0 ? timestampSec : Math.floor(Date.now() / 1000),
        content,
        attachments: extractAttachments(msg.attachments),
        metadata: {
          chatType: msg.chatType,
        },
      };
    });
}

/**
 * Extract raw messages from Telegram format
 */
export function extractTelegramMessages(
  messages: unknown[],
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any, index: number) => {
      const timestamp = msg.date || msg.timestamp || msg.time;
      const content = msg.text || msg.message || msg.content || msg.snippet;
      const chatId = msg.chatName || msg.chatTitle || msg.chatId || "unknown";
      const sender =
        msg.fromName || msg.fromFirstName || msg.sender || "unknown";

      // Generate unique messageId using combination of fields
      // Use msg.id if available, otherwise create a unique composite key
      let messageId: string;
      if (msg.id) {
        messageId = String(msg.id);
      } else {
        // Create a hash from content to ensure uniqueness for same-timestamp messages
        const contentHash = content
          ? btoa(encodeURIComponent(content.substring(0, 100))).substring(0, 16)
          : "";
        messageId = `telegram_${botId}_${timestamp}_${chatId}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform: "telegram",
        botId,
        channel: chatId,
        person: sender,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        content: String(content || ""),
        attachments: extractAttachments(msg.attachments),
        metadata: {
          chatId: msg.chatId,
          fromId: msg.fromId,
        },
      };
    });
}

/**
 * Extract raw messages from WhatsApp format
 */
export function extractWhatsAppMessages(
  messages: unknown[],
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any, index: number) => {
      const timestamp = msg.timestamp || msg.time || msg.date;
      const content = msg.body || msg.text || msg.message || msg.content;
      const channel = msg.chatName || msg.from || msg.chatId || "unknown";
      const sender = msg.author || msg.sender || msg.pushName || "unknown";

      // Generate unique messageId
      let messageId: string;
      if (msg.id || msg.key?.id) {
        messageId = String(msg.id || msg.key?.id);
      } else {
        const contentHash = content
          ? btoa(content.substring(0, 100)).substring(0, 16)
          : "";
        messageId = `whatsapp_${botId}_${timestamp}_${channel}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform: "whatsapp",
        botId,
        channel,
        person: sender,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        content: String(content || ""),
        attachments: extractAttachments(msg.attachments),
        metadata: {
          fromMe: msg.fromMe,
          remoteJid: msg.key?.remoteJid,
        },
      };
    });
}

/**
 * Extract raw messages from iMessage format
 */
export function extractIMessageMessages(
  messages: unknown[],
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any, index: number) => {
      const timestamp = msg.timestamp || msg.time || msg.date;
      const content = msg.text || msg.message || msg.content || "";
      const channel = msg.chatName || msg.chat_id || msg.chatId || "unknown";
      const sender = msg.sender || msg.from || msg.isFromMe ? "Me" : "unknown";

      // Generate unique messageId
      let messageId: string;
      if (msg.id) {
        messageId = `imessage_${String(msg.id)}`;
      } else {
        const contentHash = content
          ? btoa(encodeURIComponent(content.substring(0, 100))).substring(0, 16)
          : "";
        messageId = `imessage_${botId}_${timestamp}_${channel}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform: "imessage",
        botId,
        channel,
        person: sender,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        content: String(content || ""),
        attachments: extractAttachments(msg.attachments),
        metadata: {
          chatId: msg.chatId || msg.chat_id,
          isFromMe: msg.isFromMe || msg.is_from_me,
          isGroupChat: msg.isGroupChat || msg.is_group_chat,
        },
      };
    });
}

/**
 * Extract raw messages from Email format (Gmail/Outlook)
 */
export function extractEmailMessages(
  emails: unknown[],
  platform: "gmail" | "outlook",
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(emails)) {
    return [];
  }

  return emails
    .filter((email) => email && typeof email === "object")
    .map((email: any, index: number) => {
      const timestamp =
        email.timestamp ||
        email.date ||
        email.time ||
        Math.floor(Date.now() / 1000);
      const content =
        email.text || email.snippet || email.subject || email.body || "";
      const channel =
        email.from?.email || email.sender || email.fromEmail || "unknown";
      const sender =
        email.from?.name || email.senderName || email.fromName || "unknown";

      // Generate unique messageId
      let messageId: string;
      if (email.uid || email.id) {
        messageId = String(email.uid || email.id);
      } else {
        const contentHash = content
          ? btoa(content.substring(0, 100)).substring(0, 16)
          : "";
        messageId = `${platform}_${botId}_${timestamp || 0}_${channel}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform,
        botId,
        channel,
        person: sender,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        content: String(content),
        attachments: extractAttachments(email.attachments),
        metadata: {
          subject: email.subject,
          to: email.to,
          cc: email.cc,
          bcc: email.bcc,
        },
      };
    });
}

/**
 * Extract raw messages from Teams format
 */
export function extractTeamsMessages(
  messages: unknown[],
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any, index: number) => {
      const timestamp = msg.timestamp || msg.createdDateTime || msg.time;
      const content = msg.body?.content || msg.content || msg.text || "";
      const channel =
        msg.channelName || msg.chatName || msg.channelId || "unknown";
      const sender =
        msg.from?.user?.displayName ||
        msg.senderName ||
        msg.userName ||
        "unknown";

      // Generate unique messageId
      let messageId: string;
      if (msg.id) {
        messageId = String(msg.id);
      } else {
        const contentHash = content
          ? btoa(content.substring(0, 100)).substring(0, 16)
          : "";
        messageId = `teams_${botId}_${timestamp}_${channel}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform: "teams",
        botId,
        channel,
        person: sender,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        content: String(content),
        attachments: extractAttachments(msg.attachments),
        metadata: {
          channelId: msg.channelId,
          teamId: msg.teamId,
        },
      };
    });
}

/**
 * Extract raw messages from LinkedIn format
 */
export function extractLinkedInMessages(
  messages: unknown[],
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any, index: number) => {
      const timestamp = msg.timestamp || msg.createdTime || msg.time;
      const content = msg.body || msg.text || msg.message || msg.content;
      const channel = msg.chatName || msg.from || "unknown";
      const sender = msg.senderName || msg.author || "unknown";

      // Generate unique messageId
      let messageId: string;
      if (msg.id) {
        messageId = String(msg.id);
      } else {
        const contentHash = content
          ? btoa(content.substring(0, 100)).substring(0, 16)
          : "";
        messageId = `linkedin_${botId}_${timestamp}_${channel}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform: "linkedin",
        botId,
        channel: msg.chatName || msg.conversationId,
        person: msg.senderName || msg.author || msg.from,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        content: String(content || ""),
        attachments: extractAttachments(msg.attachments),
        metadata: {
          conversationId: msg.conversationId,
        },
      };
    });
}

/**
 * Extract raw messages from Instagram format
 */
export function extractInstagramMessages(
  messages: unknown[],
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any, index: number) => {
      const timestamp = msg.timestamp || msg.createdTime || msg.time;
      const content = msg.text || msg.message || msg.content;
      const channel = msg.chatName || msg.conversationId || "unknown";
      const sender = msg.username || msg.senderName || msg.from || "unknown";

      // Generate unique messageId
      let messageId: string;
      if (msg.id) {
        messageId = String(msg.id);
      } else {
        const contentHash = content
          ? btoa(content.substring(0, 100)).substring(0, 16)
          : "";
        messageId = `instagram_${botId}_${timestamp}_${channel}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform: "instagram",
        botId,
        channel: msg.chatName || msg.conversationId,
        person: sender,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        content: String(content || ""),
        attachments: extractAttachments(msg.attachments),
        metadata: {
          conversationId: msg.conversationId,
        },
      };
    });
}

/**
 * Extract raw messages from X (Twitter) format
 */
export function extractXMessages(
  messages: unknown[],
  botId: string,
): RawMessageData[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((msg) => msg && typeof msg === "object")
    .map((msg: any, index: number) => {
      const timestamp = msg.timestamp || msg.createdTime || msg.time;
      const content = msg.text || msg.message || msg.content;
      const channel = msg.chatName || msg.conversationId || "unknown";
      const sender = msg.username || msg.senderName || msg.from || "unknown";

      // Generate unique messageId
      let messageId: string;
      if (msg.id) {
        messageId = String(msg.id);
      } else {
        const contentHash = content
          ? btoa(content.substring(0, 100)).substring(0, 16)
          : "";
        messageId = `twitter_${botId}_${timestamp}_${channel}_${sender}_${contentHash}`;
      }

      return {
        messageId,
        platform: "twitter",
        botId,
        channel: msg.chatName || msg.conversationId,
        person: sender,
        timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        content: String(content || ""),
        attachments: extractAttachments(msg.attachments, msg.media),
        metadata: {
          conversationId: msg.conversationId,
        },
      };
    });
}

/**
 * Extract raw messages from RSS feed format
 */
export function extractRSSMessages(
  items: unknown[],
  botId: string,
  feedTitle?: string,
): RawMessageData[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item === "object")
    .map((item: any, index: number) => {
      const timestamp =
        item.pubDate || item.publishedAt || item.date || item.isoDate;
      const parsedTimestamp = timestamp
        ? new Date(timestamp).getTime() / 1000
        : Date.now() / 1000;

      // Extract content from various RSS fields
      const content =
        item["content:encoded"] ||
        item.content ||
        item.summary ||
        item.description ||
        "";
      const title = item.title || item.titleText || "";

      // Combine title and content for better context
      const fullContent = title ? `${title}\n\n${content}` : content;

      // Extract author from various fields
      const author = item.creator || item.author || item["dc:creator"] || "";
      const person = typeof author === "string" ? author : author?.name || "";

      // Extract link/URL
      const link = item.link || item.guid || item.url;

      // Extract categories/tags
      const categories = item.categories || item.tags || [];
      const categoryList = Array.isArray(categories)
        ? categories
            .map((c: any) => (typeof c === "string" ? c : c?.name || c?.term))
            .filter(Boolean)
        : [];

      // Generate unique messageId
      let messageId: string;
      if (item.guid || item.id || item.link) {
        messageId = String(item.guid || item.id || item.link);
      } else {
        const contentHash = fullContent
          ? btoa(fullContent.substring(0, 100)).substring(0, 16)
          : "";
        messageId = `rss_${botId}_${parsedTimestamp}_${feedTitle || "feed"}_${person || "unknown"}_${contentHash}`;
      }

      return {
        messageId,
        platform: "rss",
        botId,
        channel: feedTitle || item.feedTitle || "RSS Feed",
        person: person || feedTitle || "Unknown",
        timestamp:
          typeof parsedTimestamp === "number"
            ? parsedTimestamp
            : Date.now() / 1000,
        content: String(fullContent).trim(),
        attachments: link
          ? [
              {
                name: title ? `${title.substring(0, 50)}...` : "Article",
                url: link,
                contentType: "text/html",
              },
            ]
          : undefined,
        metadata: {
          title: title,
          link: link,
          categories: categoryList,
          pubDate: item.pubDate,
          feedTitle: feedTitle || item.feedTitle,
        },
      };
    });
}

/**
 * Helper function to extract attachments from various formats
 */
function extractAttachments(
  attachments?: unknown[],
  files?: unknown[],
): Array<{
  name: string;
  url: string;
  contentType?: string;
  sizeBytes?: number;
}> {
  const result: Array<{
    name: string;
    url: string;
    contentType?: string;
    sizeBytes?: number;
  }> = [];

  // Process attachments array
  if (Array.isArray(attachments)) {
    for (const attachment of attachments) {
      if (!attachment || typeof attachment !== "object") continue;

      const att = attachment as any;
      if (att.url || att.link || att.permalink) {
        result.push({
          name: att.name || att.filename || att.title || "attachment",
          url: att.url || att.link || att.permalink,
          contentType: att.mimetype || att.contentType || att.type,
          sizeBytes: att.sizeBytes || att.size || att.fileSize,
        });
      }
    }
  }

  // Process files array (Slack specific)
  if (Array.isArray(files)) {
    for (const file of files) {
      if (!file || typeof file !== "object") continue;

      const f = file as any;
      if (f.url_private || f.url_private_download || f.permalink) {
        result.push({
          name: f.name || f.filename || f.title || "file",
          url: f.url_private || f.url_private_download || f.permalink,
          contentType: f.mimetype || f.filetype || f.type,
          sizeBytes: f.size || f.fileSize,
        });
      }
    }
  }

  // Process media array (X/Twitter specific)
  if (Array.isArray(files)) {
    for (const media of files) {
      if (!media || typeof media !== "object") continue;

      const m = media as any;
      if (m.media_url_https || m.media_url || m.url) {
        result.push({
          name: m.type || "media",
          url: m.media_url_https || m.media_url || m.url,
          contentType: m.type,
        });
      }
    }
  }

  return result;
}

/**
 * Universal message extractor - routes to appropriate platform extractor
 */
export function extractRawMessages(
  messages: unknown[] | string,
  platform: string,
  botId: string,
  feedTitle?: string,
): RawMessageData[] {
  // Handle JSON string input
  const messageArray =
    typeof messages === "string" ? JSON.parse(messages) : messages;

  if (!Array.isArray(messageArray) || messageArray.length === 0) {
    return [];
  }

  switch (platform.toLowerCase()) {
    case "slack":
      return extractSlackMessages(messageArray, botId);
    case "discord":
      return extractDiscordMessages(messageArray, botId);
    case "telegram":
      return extractTelegramMessages(messageArray, botId);
    case "whatsapp":
      return extractWhatsAppMessages(messageArray, botId);
    case "imessage":
      return extractIMessageMessages(messageArray, botId);
    case "gmail":
      return extractEmailMessages(messageArray, "gmail", botId);
    case "outlook":
      return extractEmailMessages(messageArray, "outlook", botId);
    case "teams":
      return extractTeamsMessages(messageArray, botId);
    case "linkedin":
      return extractLinkedInMessages(messageArray, botId);
    case "instagram":
      return extractInstagramMessages(messageArray, botId);
    case "twitter":
    case "x":
      return extractXMessages(messageArray, botId);
    case "rss":
      return extractRSSMessages(messageArray, botId, feedTitle);
    case "feishu":
      return extractUnifiedInsightMessages(messageArray, "feishu", botId);
    case "dingtalk":
      return extractUnifiedInsightMessages(messageArray, "dingtalk", botId);
    default:
      console.warn(`[Raw Messages] Unknown platform: ${platform}`);
      return [];
  }
}
