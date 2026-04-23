/**
 * Format Agent error codes into user-friendly messages.
 *
 * This module is intentionally kept free of server-only imports so it can
 * be safely consumed by client components (e.g. chat-context.tsx).
 */

/** Convert Agent internal error codes to user-readable messages (without exposing local log paths to IM) */
export function formatAgentStreamErrorForUser(
  platform:
    | "telegram"
    | "whatsapp"
    | "imessage"
    | "gmail"
    | "feishu"
    | "dingtalk"
    | "qqbot"
    | "weixin"
    | "chat"
    | "scheduler",
  raw: string,
): string {
  const zh = ["feishu", "dingtalk", "qqbot", "weixin"].includes(platform);

  if (raw === "__API_KEY_ERROR__" || raw.startsWith("__API_KEY_ERROR__")) {
    return zh
      ? "云端鉴权失败，请在应用内重新登录后再试。"
      : "Authentication failed. Please sign in again in the app.";
  }
  if (raw.startsWith("__INTERNAL_ERROR__")) {
    return zh
      ? "模型服务暂时异常，请稍后再试。"
      : "The assistant hit an internal error. Please try again later.";
  }
  if (raw.startsWith("__TIMEOUT_ERROR__")) {
    return zh
      ? "请求超时，请稍后再试。"
      : "Request timed out. Please try again.";
  }
  if (raw.startsWith("__PROCESS_CRASH__")) {
    return zh
      ? "模型进程异常退出，请缩短任务后重试。"
      : "The assistant process exited unexpectedly. Please try a smaller task.";
  }
  if (raw.startsWith("__CUSTOM_API_ERROR__")) {
    return zh
      ? "当前 API 配置可能不兼容，请检查 baseUrl 与模型。"
      : "API configuration may be incompatible. Check base URL and model.";
  }

  const authHint =
    raw.includes("无效的令牌") ||
    raw.includes("new_api_error") ||
    /Failed to authenticate/i.test(raw);
  if (authHint) {
    return zh
      ? "令牌无效或已过期，请重新登录后再试。"
      : "Your session token is invalid or expired. Please sign in again.";
  }

  return zh ? `出错了：${raw}` : `Error: ${raw}`;
}
