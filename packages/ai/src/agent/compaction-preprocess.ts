/**
 * Lightweight token estimate kept local to the package so this preprocessing
 * module can stay portable. The web app has a richer tokens.ts, but the
 * preprocessing algorithm itself only needs a cheap relative size heuristic.
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  const wordCount = Math.ceil(otherChars / 5);
  return chineseChars + wordCount;
}

export interface CompactionPreprocessMessage {
  role: "user" | "assistant" | "system";
  type: "message" | "tool_use" | "tool_result";
  content: string;
}

export interface CompactionMessageGroup {
  role: "user" | "assistant" | "system";
  type: "message" | "tool_use" | "tool_result";
  messages: CompactionPreprocessMessage[];
  content: string;
  tokens: number;
}

export interface CompactionPreprocessOptions {
  maxMergedMessages?: number;
  maxCharsPerMessage?: number;
  maxCodeBlockLines?: number;
  keepCodeBlockHeadLines?: number;
  keepCodeBlockTailLines?: number;
}

const DEFAULT_OPTIONS: Required<CompactionPreprocessOptions> = {
  maxMergedMessages: 8,
  maxCharsPerMessage: 12_000,
  maxCodeBlockLines: 120,
  keepCodeBlockHeadLines: 40,
  keepCodeBlockTailLines: 20,
};

const IMAGE_DATA_URL_RE =
  /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/g;
const FILE_DATA_URL_RE =
  /data:(application|text)\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/g;
const IMAGE_MARKDOWN_RE = /!\[[^\]]*?\]\(([^)]+)\)/g;
const CODE_BLOCK_RE = /```([\w+-]*)\n([\s\S]*?)```/g;

/**
 * Normalize caller-provided bounds so the preprocessing pipeline behaves
 * consistently across apps that consume the shared package.
 */
function normalizeOptions(
  options?: CompactionPreprocessOptions,
): Required<CompactionPreprocessOptions> {
  return {
    maxMergedMessages: Math.max(
      1,
      options?.maxMergedMessages ?? DEFAULT_OPTIONS.maxMergedMessages,
    ),
    maxCharsPerMessage: Math.max(
      500,
      options?.maxCharsPerMessage ?? DEFAULT_OPTIONS.maxCharsPerMessage,
    ),
    maxCodeBlockLines: Math.max(
      20,
      options?.maxCodeBlockLines ?? DEFAULT_OPTIONS.maxCodeBlockLines,
    ),
    keepCodeBlockHeadLines: Math.max(
      5,
      options?.keepCodeBlockHeadLines ?? DEFAULT_OPTIONS.keepCodeBlockHeadLines,
    ),
    keepCodeBlockTailLines: Math.max(
      5,
      options?.keepCodeBlockTailLines ?? DEFAULT_OPTIONS.keepCodeBlockTailLines,
    ),
  };
}

/**
 * Remove inline media payloads before compaction. These blobs are expensive in
 * token space but rarely contribute meaningful summary context.
 */
function replaceMediaMarkers(content: string): string {
  return content
    .replace(IMAGE_DATA_URL_RE, "[image omitted for compaction]")
    .replace(FILE_DATA_URL_RE, "[document omitted for compaction]")
    .replace(IMAGE_MARKDOWN_RE, (match, url: string) => {
      if (typeof url === "string" && url.startsWith("data:image/")) {
        return "[image omitted for compaction]";
      }
      return match;
    });
}

/**
 * Preserve the beginning and end of large code blocks, where filenames,
 * signatures, errors, and final edits are usually most informative.
 */
function truncateCodeBlock(
  code: string,
  options: Required<CompactionPreprocessOptions>,
): string {
  const lines = code.split("\n");
  if (lines.length <= options.maxCodeBlockLines) {
    return code;
  }

  const head = lines.slice(0, options.keepCodeBlockHeadLines);
  const tail = lines.slice(-options.keepCodeBlockTailLines);
  const omitted = Math.max(
    0,
    lines.length -
      options.keepCodeBlockHeadLines -
      options.keepCodeBlockTailLines,
  );

  return [
    ...head,
    `... [${omitted} lines omitted for compaction] ...`,
    ...tail,
  ].join("\n");
}

/**
 * Apply long-code truncation only inside fenced blocks so prose outside the
 * block remains untouched.
 */
function truncateCodeBlocks(
  content: string,
  options: Required<CompactionPreprocessOptions>,
): string {
  return content.replace(
    CODE_BLOCK_RE,
    (_match, lang: string, code: string) => {
      return `\`\`\`${lang}\n${truncateCodeBlock(code, options)}\n\`\`\``;
    },
  );
}

/**
 * If a message is still too large after code truncation, keep the head and
 * tail so the summarizer still sees setup plus outcome.
 */
function truncateLongMessage(
  content: string,
  options: Required<CompactionPreprocessOptions>,
): string {
  if (content.length <= options.maxCharsPerMessage) {
    return content;
  }

  const headChars = Math.floor(options.maxCharsPerMessage * 0.7);
  const tailChars = Math.floor(options.maxCharsPerMessage * 0.2);
  const omitted = Math.max(0, content.length - headChars - tailChars);

  return [
    content.slice(0, headChars).trimEnd(),
    `\n\n... [${omitted} chars omitted for compaction] ...\n\n`,
    content.slice(content.length - tailChars).trimStart(),
  ].join("");
}

/**
 * Sanitize a single message: trim empty content, strip media payloads,
 * shorten oversized code blocks, then cap total message length.
 */
export function sanitizeCompactionMessage(
  message: CompactionPreprocessMessage,
  options?: CompactionPreprocessOptions,
): CompactionPreprocessMessage | null {
  const normalized = normalizeOptions(options);
  const trimmed = message.content.trim();
  if (!trimmed) {
    return null;
  }

  const withoutMedia = replaceMediaMarkers(trimmed);
  const withShorterCode = truncateCodeBlocks(withoutMedia, normalized);
  const shortened = truncateLongMessage(withShorterCode, normalized);

  return {
    role: message.role,
    type: message.type,
    content: shortened,
  };
}

/**
 * Sanitize a batch of messages and drop entries that become empty.
 * Some callers stop here, while others continue into grouping/flattening.
 */
export function sanitizeCompactionMessages(
  messages: CompactionPreprocessMessage[],
  options?: CompactionPreprocessOptions,
): CompactionPreprocessMessage[] {
  return messages
    .map((message) => sanitizeCompactionMessage(message, options))
    .filter(
      (message): message is CompactionPreprocessMessage => message !== null,
    );
}

/**
 * Merge one compatible run into a synthetic block so the summarizer sees fewer
 * fragments and more coherent chunks of context.
 */
function mergeGroup(
  messages: CompactionPreprocessMessage[],
): CompactionMessageGroup {
  const content =
    messages.length === 1
      ? messages[0].content
      : messages
          .map(
            (message, index) =>
              `[${message.type.toUpperCase()} ${index + 1}/${messages.length}]\n${message.content}`,
          )
          .join("\n\n");

  return {
    role: messages[0].role,
    type: messages[0].type,
    messages,
    content,
    tokens: estimateTokens(content),
  };
}

/**
 * Group adjacent messages by type. Plain chat messages also keep role as a
 * hard boundary, while tool segments can merge across repeated assistant runs.
 */
export function groupCompactionMessages(
  messages: CompactionPreprocessMessage[],
  options?: CompactionPreprocessOptions,
): CompactionMessageGroup[] {
  const normalized = normalizeOptions(options);
  const sanitized = sanitizeCompactionMessages(messages, normalized);
  const groups: CompactionMessageGroup[] = [];
  let current: CompactionPreprocessMessage[] = [];

  const flush = () => {
    if (current.length === 0) return;
    groups.push(mergeGroup(current));
    current = [];
  };

  for (const message of sanitized) {
    const previous = current[current.length - 1];
    const isPlainMessage = message.type === "message";
    const canMerge =
      previous &&
      previous.type === message.type &&
      (isPlainMessage ? previous.role === message.role : true) &&
      current.length < normalized.maxMergedMessages;

    if (canMerge) {
      current.push(message);
      continue;
    }

    flush();
    current.push(message);
  }

  flush();
  return groups;
}

/**
 * Convert merged groups back into the flat shape used by current compaction
 * callers and transport layers.
 */
export function flattenCompactionGroups(
  groups: CompactionMessageGroup[],
): CompactionPreprocessMessage[] {
  return groups.map((group) => ({
    role: group.role,
    type: group.type,
    content: group.content,
  }));
}

/**
 * Drop oldest groups until enough estimated tokens are freed. This is a small
 * utility for future retry paths when a compaction prompt still ends up large.
 */
export function truncateOldestCompactionGroups(
  groups: CompactionMessageGroup[],
  tokenGap: number,
): CompactionMessageGroup[] {
  if (tokenGap <= 0 || groups.length <= 1) {
    return groups;
  }

  let freed = 0;
  let dropCount = 0;

  while (dropCount < groups.length - 1 && freed < tokenGap) {
    freed += groups[dropCount].tokens;
    dropCount += 1;
  }

  return groups.slice(dropCount);
}

/**
 * Full preprocessing pass for callers that want both sanitized source messages
 * and grouped/flattened compaction blocks.
 */
export function preprocessCompactionMessages(
  messages: CompactionPreprocessMessage[],
  options?: CompactionPreprocessOptions,
): {
  sanitized: CompactionPreprocessMessage[];
  groups: CompactionMessageGroup[];
  flattened: CompactionPreprocessMessage[];
} {
  const sanitized = sanitizeCompactionMessages(messages, options);
  const groups = groupCompactionMessages(sanitized, options);

  return {
    sanitized,
    groups,
    flattened: flattenCompactionGroups(groups),
  };
}
