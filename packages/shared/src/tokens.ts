/**
 * Token estimation utilities.
 * Provides CJK-aware token counting for text content.
 */

/**
 * Estimate token count for a given text.
 * Uses a simple heuristic: CJK characters are counted directly,
 * while other characters are estimated at ~5 characters per token.
 */
export const estimateTokens = (text: string): number => {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  const wordCount = Math.ceil(otherChars / 5);
  return chineseChars + wordCount;
};
