/**
 * iMessage Agent Runtime Handler
 *
 * Forwards iMessage messages to the Agent Runtime for execution
 * Reuses the shared agent runtime implementation
 */

import { handleAgentRuntime as sharedHandleAgentRuntime } from "@/lib/ai/runtime/shared";

export interface HandleAgentRuntimeOptions {
  conversation?: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  images?: Array<{ data: string; mimeType: string }>;
  fileAttachments?: Array<{ name: string; data: string; mimeType: string }>;
  userId?: string;
  workDir?: string;
  stream?: boolean;
  aiSoulPrompt?: string | null;
  language?: string | null;
  modelConfig?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  accountId?: string; // Account ID for per-day file persistence (used by compaction)
}

/**
 * Calls the Agent Runtime to process iMessage messages
 */
export async function handleAgentRuntime(
  prompt: string,
  options: HandleAgentRuntimeOptions,
  callback: (message: string) => Promise<void>,
): Promise<void> {
  return sharedHandleAgentRuntime(prompt, options, callback, "imessage");
}
