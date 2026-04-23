/**
 * Local cloud AI call client
 *
 * Provides unified interface to call cloud LLM API
 * - Handles authentication
 * - Automatically handles streaming responses
 * - Error handling and retries
 */

import {
  getCloudApiClient,
  getStoredAuthToken,
} from "@/lib/auth/remote-client";
import { isTauriMode } from "@/lib/env/constants";

export interface CloudAIRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  system?: string;
  stream?: boolean;
}

export interface CloudAIResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    inputCredits: number;
    outputCredits: number;
    totalCredits: number;
  };
}

/**
 * Check if cloud AI can be used
 */
export function canUseCloudAI(): boolean {
  if (typeof window === "undefined") {
    return false; // SSR mode does not use cloud AI
  }

  if (!isTauriMode()) {
    return false; // Web mode directly uses local model
  }

  const client = getCloudApiClient();
  if (!client) {
    return false; // No cloud API client
  }

  const token = getStoredAuthToken();
  if (!token) {
    return false; // No auth token
  }

  return true;
}

/**
 * Check cloud AI service availability
 */
export async function checkCloudAIAvailability(): Promise<{
  available: boolean;
  status?: string;
  message?: string;
}> {
  try {
    const client = getCloudApiClient();
    if (!client) {
      return {
        available: false,
        message: "Cloud API client not available",
      };
    }

    const token = getStoredAuthToken();
    if (!token) {
      return {
        available: false,
        message: "No authentication token",
      };
    }

    client.setAuthToken(token);

    const status = await client.checkCloudAIStatus();
    return {
      available: true,
      status: status.status,
      message: status.message,
    };
  } catch (error) {
    console.error("[CloudAI] Availability check failed:", error);
    return {
      available: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Call cloud LLM (streaming response)
 */
export async function callCloudAIStream(
  request: CloudAIRequest,
): Promise<ReadableStream> {
  if (!canUseCloudAI()) {
    throw new Error(
      "Cloud AI is not available. Please check your authentication.",
    );
  }

  const client = getCloudApiClient();
  if (!client) {
    throw new Error("Cloud API client not available");
  }

  const token = getStoredAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  client.setAuthToken(token);

  try {
    const response = await client.chatWithAI({
      ...request,
      stream: true,
    });

    if (!response.body) {
      throw new Error("Response body is empty");
    }

    return response.body;
  } catch (error) {
    console.error("[CloudAI] Stream call failed:", error);
    throw error;
  }
}

/**
 * Call cloud LLM (non-streaming response)
 */
export async function callCloudAI(
  request: CloudAIRequest,
): Promise<CloudAIResponse> {
  if (!canUseCloudAI()) {
    throw new Error(
      "Cloud AI is not available. Please check your authentication.",
    );
  }

  const client = getCloudApiClient();
  if (!client) {
    throw new Error("Cloud API client not available");
  }

  const token = getStoredAuthToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  client.setAuthToken(token);

  try {
    const response = await client.chatWithAI({
      ...request,
      stream: false,
    });

    const data = (await response.json()) as CloudAIResponse;
    return data;
  } catch (error) {
    console.error("[CloudAI] Call failed:", error);
    throw error;
  }
}

/**
 * Generic cloud AI call (automatically determines streaming/non-streaming)
 */
export async function callCloudAIGeneric(
  request: CloudAIRequest,
): Promise<
  | { stream: true; body: ReadableStream }
  | { stream: false; data: CloudAIResponse }
> {
  if (request.stream !== false) {
    const body = await callCloudAIStream(request);
    return { stream: true, body };
  }
  const data = await callCloudAI(request);
  return { stream: false, data };
}
