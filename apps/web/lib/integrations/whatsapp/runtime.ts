import { handleAgentRuntime as sharedHandleAgentRuntime } from "@/lib/ai/runtime/shared";

/**
 * Options for handleAgentRuntime
 */
export interface HandleAgentRuntimeOptions {
  conversation?: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  images?: Array<{ data: string; mimeType: string }>;
  fileAttachments?: Array<{ name: string; data: string; mimeType: string }>;
  userId?: string; // Add userId for direct Agent calls
  workDir?: string; // Working directory for file operations
  stream?: boolean; // Enable streaming output (default: true)
  aiSoulPrompt?: string | null; // User-defined AI Soul prompt
  language?: string | null; // User language preference
  modelConfig?: {
    // Model configuration for custom API endpoints
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  accountId?: string; // Account ID for per-day file persistence (used by compaction)
}

/**
 * Handle agent runtime call - When user sends message to themselves (Note to Self)
 * This provides full Claude Agent Runtime capabilities like in web interface
 *
 * @param prompt - The message content
 * @param optionsOrCallback - Either options object or reply callback for backward compatibility
 * @param callback - Reply callback (if options is provided as first param)
 */
export async function handleAgentRuntime(
  prompt: string,
  optionsOrCallback?:
    | HandleAgentRuntimeOptions
    | ((message: string) => Promise<void>),
  callback?: (message: string) => Promise<void>,
): Promise<void> {
  // Handle backward compatibility with old signature
  let options: HandleAgentRuntimeOptions = {};
  let replyCallback: (message: string) => Promise<void>;

  if (typeof optionsOrCallback === "function") {
    // Old signature: handleAgentRuntime(prompt, replyCallback)
    replyCallback = optionsOrCallback;
  } else {
    // New signature: handleAgentRuntime(prompt, options, callback)
    options = optionsOrCallback || {};
    if (!callback) {
      throw new Error("callback is required when options is provided");
    }
    replyCallback = callback;
  }

  // Use shared implementation
  return sharedHandleAgentRuntime(prompt, options, replyCallback, "whatsapp");
}
