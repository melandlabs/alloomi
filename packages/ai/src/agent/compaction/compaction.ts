/**
 * Compaction trigger thresholds as ratio of token budget used.
 * Budget is the platform's TOKEN_BUDGET (e.g., 80,000 for platform stores).
 */
export const COMPACTION_SOFT_RATIO = 0.75;
export const COMPACTION_HARD_RATIO = 0.9;
export const COMPACTION_EMERGENCY_RATIO = 0.95;

/**
 * Model used for summarization - claude-haiku is fast and cheap.
 * Must match a model in model-pricing.ts.
 */
export const COMPACTION_MODEL = "anthropic/claude-haiku-4.5";

/**
 * Compaction levels corresponding to token budget ratios.
 */
export type CompactionLevel = "soft" | "hard" | "emergency";

/**
 * Result of a compaction operation.
 */
export interface CompactionResult {
  /** The generated summary content */
  summary: string;
  /** How many messages were summarized */
  messageCount: number;
  /** The compaction level that was triggered */
  level: CompactionLevel;
  /** Token count of the original messages */
  originalTokens: number;
  /** Token count of the generated summary */
  summaryTokens: number;
}

/**
 * Platform types that support compaction.
 */
export type CompactionPlatform =
  | "telegram"
  | "whatsapp"
  | "imessage"
  | "gmail"
  | "weixin"
  // scheduler marks compaction work triggered by scheduled jobs rather than
  // an inbound platform conversation.
  | "scheduler";

/**
 * Build the system prompt for compaction summarization.
 */
export function buildCompactionPrompt(level: CompactionLevel): string {
  // The summarizer sees already-compacted history in some call paths, so the
  // prompt explicitly tells it how to treat truncation markers and merged blocks.
  const levelInstruction =
    level === "emergency"
      ? "EMERGENCY: The conversation has reached critical token limits. Be extremely concise while preserving ALL critical information."
      : level === "hard"
        ? "HARD: The conversation is near token limits. Preserve the most important context concisely."
        : "SOFT: The conversation is growing large. Provide a concise summary of the key context.";

  return `You are a conversation archivist. Your task is to compress a conversation segment into a structured summary that preserves the context needed to continue later.

${levelInstruction}

The input may already be preprocessed:
- Consecutive messages of the same kind may be merged into a single block
- Long code blocks or long message bodies may be shortened with omission markers
- Media payloads may be replaced with short placeholders

Treat these as compression artifacts from the preprocessing stage. Preserve their meaning when useful, but do not repeat them mechanically.

Preserve the following information when present:
- User goals, requests, intentions, or constraints
- Key decisions made or conclusions reached
- Important files, URLs, identifiers, commands, or references
- User preferences or requirements that should continue to apply
- Current task status, unfinished work, or pending next steps
- Important outcomes of tool usage, searches, or external actions
- Errors, blockers, caveats, or uncertainty that would matter later

Do not preserve everything verbatim. Prefer concise factual carry-forward context over repetition.

FORMAT your response as:
[COMPACTED: ${level.toUpperCase()} -- N messages summarized]

## Summary

### Goals & Context
- ...

### Important Events & Decisions
- ...

### Files, References & Identifiers
- ...

### Open Work & Current Status
- ...

Optional:

### Risks or Notes
- ...

Keep the summary under 1500 tokens.
Preserve factual accuracy.
Do not hallucinate missing details.
If specific details were truncated in the source, summarize only what is still supported by the visible context.`;
}
