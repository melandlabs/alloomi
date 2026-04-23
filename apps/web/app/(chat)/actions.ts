"use server";

import type { UIMessage } from "ai";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
} from "@/lib/db/queries";
import { auth } from "@/app/(auth)/auth";
import { getCloudUrl } from "@/lib/auth/cloud-proxy";
import {
  parseRawEmail,
  type ParsedEmailResult,
} from "@/lib/integrations/email/parser";

const COOKIE_CONFIRMATION_MAX_AGE = 60 * 24 * 60 * 60; // 60 days

export async function setCookiePreference(value: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const cookieStore = await cookies();
  cookieStore.set("user-cookie:confirm", value, {
    path: "/",
    maxAge: COOKIE_CONFIRMATION_MAX_AGE,
    sameSite: "lax",
    secure: true,
  });
}

/**
 * Cached title generation function using React.cache()
 * This prevents duplicate AI calls for the same message within a request
 */
const generateTitleCached = cache(async (token: string, message: UIMessage) => {
  // Extract message text
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msg = message as any;
  const userContent =
    typeof msg.content === "string"
      ? msg.content
      : typeof msg.content === "object" && msg.content !== null
        ? JSON.stringify(msg.content)
        : "";

  const cloudUrl = getCloudUrl();
  const url = `${cloudUrl}/api/ai/v1/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "moonshotai/kimi-k2.5",
      max_tokens: 80,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You will generate a short title based on the first message a user begins a conversation with. Ensure it is not more than 80 characters long. The title should be a summary of the user's message. Do not use quotes or colons. Return only the title text, no extra explanation.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate title: ${response.status} ${error}`);
  }

  const data = await response.json();
  const title = data.choices?.[0]?.message?.content?.trim();
  if (!title) {
    throw new Error("Invalid AI response: no title in choices");
  }
  return title;
});

export async function generateTitleFromUserMessage({
  token,
  message,
}: {
  token: string;
  message: UIMessage;
}) {
  return generateTitleCached(token, message);
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function parseEmailAction(
  rawContent: string,
): Promise<ParsedEmailResult> {
  return parseRawEmail(rawContent);
}
