import type { InsightSettings } from "../../db/schema";

export function userInsightSettingsToPrompt(s: InsightSettings) {
  const userFilterPrompt =
    s.focusPeople.length > 0
      ? `Only summarize information related to people in the list ${JSON.stringify(s.focusPeople)}. Do not summarize content from people not in this list.\n`
      : "";
  const topicFilterPrompt =
    s.focusTopics.length > 0
      ? `Additional requirements:\n${s.focusTopics.join("\n")}\n`
      : "";
  const languagePrompt =
    s.language.length > 0
      ? `Please output all Insight content in ${s.language}. `
      : "";
  return userFilterPrompt + topicFilterPrompt + languagePrompt;
}
