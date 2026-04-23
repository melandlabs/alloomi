import { simpleParser } from "mailparser";

export interface ParsedEmailResult {
  html?: string;
  text?: string;
  error?: string;
}

/**
 * Parse raw MIME email content using mailparser.
 * Prefers HTML content, falls back to textAsHtml, then plain text.
 */
export async function parseRawEmail(
  rawContent: string,
): Promise<ParsedEmailResult> {
  if (!rawContent) {
    return { error: "Empty content" };
  }

  try {
    const parsed = await simpleParser(rawContent);

    let html: string | undefined = undefined;

    if (parsed.html && typeof parsed.html === "string") {
      html = parsed.html;
    }

    if (!html && parsed.textAsHtml && typeof parsed.textAsHtml === "string") {
      html = parsed.textAsHtml;
    }

    if (!html && parsed.text) {
      html = `<div style="white-space: pre-wrap; font-family: monospace;">${parsed.text}</div>`;
    }

    if (!html) {
      return {
        error: "No readable content found in email",
        text: parsed.text,
      };
    }

    return {
      html,
      text: parsed.text,
    };
  } catch (error) {
    console.error("[Email Parser] Failed to parse raw email:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to parse email content",
    };
  }
}
