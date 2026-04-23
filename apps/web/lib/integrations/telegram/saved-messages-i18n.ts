/**
 * Telegram Saved Messages server-side multilingual copy
 * Return localized "Message received, executing…" notification based on Telegram user's langCode
 */

import zhHans from "@/i18n/locales/zh-Hans";
import enUS from "@/i18n/locales/en-US";

type LocaleDict = {
  telegram?: { savedMessages?: { receivedAndExecuting?: string } };
};

const resources: Record<string, LocaleDict> = {
  "zh-Hans": zhHans as LocaleDict,
  "en-US": enUS as LocaleDict,
};

const DEFAULT_LOCALE = "en-US";

/**
 * Map Telegram's lang_code (e.g., en, zh-hans) to project locale
 */
function normalizeLocale(langCode?: string | null): string {
  if (!langCode || typeof langCode !== "string") return DEFAULT_LOCALE;
  const code = langCode.replace("_", "-").toLowerCase();
  if (code.startsWith("zh")) return "zh-Hans";
  if (code.startsWith("en")) return "en-US";
  return DEFAULT_LOCALE;
}

/**
 * Get localized copy for "Message received, executing…" notification
 * @param telegramLangCode - Telegram User's lang_code (from getMe(), etc.)
 */
export function getReceivedAndExecutingMessage(
  telegramLangCode?: string | null,
): string {
  const locale = normalizeLocale(telegramLangCode);
  const msg =
    resources[locale]?.telegram?.savedMessages?.receivedAndExecuting ??
    resources[DEFAULT_LOCALE]?.telegram?.savedMessages?.receivedAndExecuting;
  return msg ?? "Message received, thinking…";
}
