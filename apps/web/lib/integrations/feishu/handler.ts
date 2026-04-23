/**
 * Feishu Bot Inbound Message Handler (Bot Mode, based on OpenClaw)
 *
 * Unlike Telegram/iMessage self mode: this is "user → bot → Alloomi replies on behalf".
 * - One-in-one-out: each im.message.receive_v1 contains only one user message, generates one reply from that content, no session history.
 * - Input: the current text from user to bot; Output: sent back to that chat as the bot.
 * - Tauri: uses modelConfig to request /api/ai; Non-Tauri: direct LLM.
 */
import { sendReplyByBotId } from "@/lib/bots/send-reply";
import {
  type IntegrationAccountWithBot,
  getUserTypeForService,
  getUserById,
  getUserInsightSettings,
} from "@/lib/db/queries";
import { DEFAULT_AI_MODEL, AI_PROXY_BASE_URL } from "@/lib/env/constants";
import { getCloudAuthToken } from "@/lib/auth/token-manager";
import { handleAgentRuntime } from "@/lib/ai/runtime/shared";

/** Matches Insight settings language, used for Feishu-side visible text */
function userPrefersChinese(language: string | null | undefined): boolean {
  const n = (language ?? "").trim().toLowerCase();
  return n.startsWith("zh");
}

function pickUserLocale<T extends { zh: string; en: string }>(
  bundle: T,
  zh: boolean,
): string {
  return zh ? bundle.zh : bundle.en;
}

/** Feishu bot prompts sent to end users (CN/EN) */
const FEISHU_USER_COPY = {
  timeoutFallback: {
    zh: "处理超时，请缩短问题或稍后再试。（若经常在桌面端出现，请确认已登录云端并完成飞书连接时的鉴权。）",
    en: "The reply took too long. Try a shorter question or try again later. In the desktop app, ensure you are signed in to the cloud and Feishu has finished connecting.",
  },
  insufficient: {
    zh: "当前信息不足，无法可靠回答。",
    en: "Not enough context to answer reliably.",
  },
  authFailure: {
    zh: "云端令牌无效或已过期，请在 Alloomi 内重新登录后再向机器人发消息。（重启后请稍等界面加载完成再发。）",
    en: "Your cloud session token is invalid or expired. Please sign in to Alloomi again, then message the bot. After a restart, wait until the app has loaded.",
  },
  internalPlaceholder: {
    zh: "模型服务暂时异常，请稍后再试。若刚重启应用，请确认已登录并等待几秒后再发消息。",
    en: "The assistant service is temporarily unavailable. If you just restarted the app, wait a few seconds, make sure you are signed in, then try again.",
  },
  processingError: {
    zh: "处理消息时出错了，请稍后重试。",
    en: "Something went wrong while processing your message. Please try again later.",
  },
} as const;

/**
 * Process single user message received by Feishu bot: use account owner's insight context + this message content to generate reply, sent as bot
 * Bot mode: only uses this params.text, no session history attached
 * @param options.authToken Cloud token for bot to call AI in Tauri mode
 */
export async function handleFeishuInboundMessage(
  account: IntegrationAccountWithBot,
  params: {
    chatId: string;
    messageId: string;
    senderId: string;
    senderName?: string;
    text: string;
    chatType: "p2p" | "group";
  },
  options?: { authToken?: string },
): Promise<void> {
  const { userId } = account;
  const bot = account.bot;
  if (!bot || bot.adapter !== "feishu") {
    console.warn("[Feishu] Account not linked to a Feishu bot, skipping");
    return;
  }

  const { chatId, text, messageId } = params;
  if (!text?.trim()) {
    return;
  }

  const LOG_FEISHU = process.env.DEBUG_FEISHU === "true";
  const logMsg = (label: string, ...args: unknown[]) => {
    if (LOG_FEISHU) console.log("[Feishu]", label, ...args);
  };

  /** For catch block: write early based on Insight language preference */
  let zhUiForUserCopy = false;

  try {
    const insightSettings = await getUserInsightSettings(userId);
    zhUiForUserCopy = userPrefersChinese(insightSettings?.language);
    const userType = await getUserTypeForService(userId);
    const user = await getUserById(userId);

    // Bot mode: only this user message as "current question", no session history
    const prompt = [
      "You are the Alloomi assistant. Help the user based on the following cross-platform message summaries.",
      "When information is insufficient, say so instead of making up content.",
      "",
      "=== User's question (this single message to the bot) ===",
      text,
      "",
      "Answer concisely.",
    ].join("\n");

    console.log(
      "[Feishu] Bot initiating model generation message_id=%s user message length=%d content=%s",
      messageId,
      text.length,
      text.slice(0, 200),
    );

    // Prefer cached token on inbound; after cold start init sets CloudAuthToken, merge here to avoid WS connected before conn refreshes after restart
    const token =
      options?.authToken?.trim() || getCloudAuthToken()?.trim() || undefined;
    if (!token) {
      console.warn(
        "[Feishu] No cloud auth token (connection + in-memory unset). Open the desktop app, sign in, wait for the Feishu listener to initialize, or re-save Feishu in Connectors.",
      );
    }
    // If Agent produces no text for long time, for-await hangs causing no reply on Feishu side; hard timeout and abort subprocess
    const abortController = new AbortController();
    const agentTimeoutMs = Number.parseInt(
      process.env.FEISHU_AGENT_TIMEOUT_MS || "",
      10,
    );
    const FEISHU_AGENT_MAX_MS = Number.isFinite(agentTimeoutMs)
      ? Math.max(30_000, agentTimeoutMs)
      : 180_000;
    let hardTimeout = false;
    const deadline = setTimeout(() => {
      hardTimeout = true;
      abortController.abort();
      console.warn(
        `[Feishu] Agent exceeded ${FEISHU_AGENT_MAX_MS}ms without finishing; aborted and will send timeout hint message_id=%s`,
        messageId,
      );
    }, FEISHU_AGENT_MAX_MS);

    const replyParts: string[] = [];
    try {
      await handleAgentRuntime(
        prompt,
        {
          userId,
          conversation: [],
          stream: false,
          silentTools: true, // Don't push tool_use stream to user
          language: insightSettings?.language ?? null,
          abortController,
          ...(token && {
            modelConfig: {
              apiKey: token,
              baseUrl: AI_PROXY_BASE_URL,
              model: DEFAULT_AI_MODEL,
            },
          }),
        },
        async (chunk) => {
          replyParts.push(chunk);
        },
        "feishu", // platform only used for Agent logging
      );
    } finally {
      clearTimeout(deadline);
    }

    const answer = replyParts.join("").trim();

    const looksLikeAuthOrProxyFailure = (s: string) =>
      s.includes("无效的令牌") ||
      s.includes("new_api_error") ||
      /Failed to authenticate/i.test(s) ||
      (/\b401\b/.test(s) &&
        /token|authenticate|鉴权|Unauthorized|API Error/i.test(s));

    const looksLikeInternalPlaceholder = (s: string) =>
      s.includes("__INTERNAL_ERROR__") ||
      s.includes("__API_KEY_ERROR__") ||
      s.includes("__TIMEOUT_ERROR__");

    let toSend = hardTimeout
      ? answer.trim() ||
        pickUserLocale(FEISHU_USER_COPY.timeoutFallback, zhUiForUserCopy)
      : answer ||
        pickUserLocale(FEISHU_USER_COPY.insufficient, zhUiForUserCopy);

    if (looksLikeAuthOrProxyFailure(answer)) {
      toSend = pickUserLocale(FEISHU_USER_COPY.authFailure, zhUiForUserCopy);
    } else if (looksLikeInternalPlaceholder(answer)) {
      toSend = pickUserLocale(
        FEISHU_USER_COPY.internalPlaceholder,
        zhUiForUserCopy,
      );
    }
    logMsg("sending full reply content", toSend.slice(0, 500));

    await sendReplyByBotId({
      id: bot.id,
      userId,
      recipients: [chatId],
      message: toSend,
      withAppSuffix: true,
    });
  } catch (error) {
    console.error("[Feishu] Failed to process inbound message:", error);
    try {
      await sendReplyByBotId({
        id: bot.id,
        userId,
        recipients: [chatId],
        message: pickUserLocale(
          FEISHU_USER_COPY.processingError,
          zhUiForUserCopy,
        ),
        withAppSuffix: false,
      });
    } catch (e) {
      console.error("[Feishu] Failed to send error message:", e);
    }
  }
}
