/**
 * Structured output data extracted from agent responses
 */
export interface ExecutionStructuredData {
  summary?: string;
  reasoningChain?: string[];
  suggestedActions?: Array<{ type: string; description: string }>;
  [key: string]: unknown;
}

/**
 * Result from parsing structured output
 */
export interface ParsedStructuredOutput {
  data: ExecutionStructuredData;
  cleanText: string;
}

/**
 * Parse structured output from text content.
 * Looks for <structured-output>...</structured-output> blocks and extracts JSON data.
 * Returns the clean text (without the structured output block) and parsed data.
 */
export function parseStructuredOutput(text: string): ParsedStructuredOutput {
  const structuredOutputRegex =
    /<structured-output>([\s\S]*?)<\/structured-output>/gi;
  const matches = [...text.matchAll(structuredOutputRegex)];

  let cleanText = text;
  const data: ExecutionStructuredData = {};

  if (matches.length > 0) {
    // Use the last occurrence
    const lastMatch = matches[matches.length - 1];
    const jsonStr = lastMatch[1].trim();

    try {
      const parsed = JSON.parse(jsonStr);
      Object.assign(data, parsed);
    } catch {
      // If JSON parsing fails, ignore
    }

    // Remove the structured output block from clean text
    cleanText = text.replace(structuredOutputRegex, "").trim();
  }

  return { data, cleanText };
}
