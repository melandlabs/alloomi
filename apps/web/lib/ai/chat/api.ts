import type { Chat } from "@/lib/db/schema";

// Extended chat type with additional statistics
export type ChatWithExtendedInfo = Chat & {
  latestMessageTime: Date | null;
  latestMessageContent: string | null;
  messageCount: number;
};

// Chat History API response type
export type ChatHistoryResponse = {
  chats: ChatWithExtendedInfo[];
  hasMore: boolean;
};
