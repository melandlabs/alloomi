/**
 * Send Reply tool - Send a reply to a chat conversation
 */

import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { Session } from "next-auth";
import { getBotsByUserId } from "@/lib/db/queries";
import {
  sendMessage,
  type SendMessageParams,
} from "@/lib/bots/message-service";

/**
 * Create the sendReply tool
 */
export function createSendReplyTool(session: Session) {
  return tool(
    "sendReply",
    [
      "Send a reply to a chat conversation. The 'draft' parameter is the message content to send.",
      "When draftOnly is true (default), the tool pauses and asks for user confirmation before sending. The message is shown in a confirmation panel — it is NOT saved to Gmail draft or any email folder.",
      "When draftOnly is false, the tool directly sends the message to the platform.",
      "IMPORTANT: Only set draftOnly to false when the user explicitly confirms they want to send immediately.",
      "",
      "BEFORE SENDING - USE QUERY TOOLS:",
      "- **ALWAYS** use the queryIntegrations tool to check what accounts the user has connected before calling sendReply.",
      "- **ALWAYS** use the queryContacts tool to find valid recipients before calling sendReply.",
      "",
      "BOT SELECTION (CRITICAL):",
      "- If botId is NOT provided: The tool will automatically query the user's connected accounts and select the appropriate bot.",
      "- DO NOT make up, guess, or generate a botId value. If you don't have a specific botId from the user or context, ALWAYS omit this parameter.",
      "",
      "FILE ATTACHMENTS:",
      "- The 'files' parameter accepts an ARRAY of file objects.",
      "- Each file must have: path (absolute file path), optional filename, optional mimeType.",
      '- Example files format: [{"path": "/path/to/file.pdf", "filename": "report.pdf"}]',
      "- All files must exist on the local filesystem.",
      "",
      "**⚠️ CRITICAL - WHEN TO USE sendReply:**",
      "- ✅ USE sendReply: When sending messages to OTHER people (contacts, groups, channels)",
      "- ❌ DO NOT USE sendReply: When sending files back to the CURRENT user in a Telegram/WhatsApp/Feishu bot conversation",
      "",
      "**Telegram/WhatsApp/Feishu Bot Conversations - STOP! DO NOT USE sendReply:**",
      "- If you are running inside a Telegram, WhatsApp or Feishu bot conversation:",
      "- DO NOT attempt to send files back to the user using sendReply - this will fail due to account restrictions",
      "- Instead: Inform the user that the file has been generated and provide the local file path",
      "- The user can access the file through their file system or device",
      "- Only use sendReply to send messages to OTHER contacts (not the current conversation user)",
      '- Example: Say "File generated at: /path/to/file.pdf" instead of trying to use sendReply',
    ].join("\n"),
    {
      draft: z
        .string()
        .describe("The content of the reply message to be sent."),
      recipients: z
        .array(z.string())
        .optional()
        .describe(
          "List of recipient names or IDs (optional if using current conversation).",
        ),
      botId: z
        .string()
        .optional()
        .describe(
          "The bot ID to use for sending (optional, will auto-query if not provided). IMPORTANT: Only provide a specific botId if you have it from context. Never make up or guess this value.",
        ),
      draftOnly: z
        .boolean()
        .default(true)
        .describe(
          "If true, only generate a draft without sending. If false, actually send the message. Default is true.",
        ),
      subject: z
        .string()
        .optional()
        .describe(
          "Email subject line (for email platforms only). If not provided, the first line of the message will be used as the subject.",
        ),
      cc: z
        .array(z.string())
        .optional()
        .describe("CC recipients (for email platforms)."),
      bcc: z
        .array(z.string())
        .optional()
        .describe("BCC recipients (for email platforms)."),
      files: z
        .array(
          z.object({
            path: z.string().describe("Absolute file path to the attachment."),
            filename: z
              .string()
              .optional()
              .describe(
                "Custom filename (optional, defaults to basename of path).",
              ),
            mimeType: z
              .string()
              .optional()
              .describe(
                "MIME type of the file (optional, auto-detected if not provided).",
              ),
          }),
        )
        .optional()
        .describe(
          "List of file attachments to send with the message. Each attachment must have an absolute path. Supports common file types like documents, images, videos, etc.",
        ),
    },
    async (args) => {
      try {
        const { draft, recipients, botId, draftOnly, subject, cc, bcc, files } =
          args;

        // Check for files parameter with telegram/whatsapp/feishu/dingtalk bots
        // In bot conversations, files should not be sent back via sendReply
        if (files && files.length > 0 && !draftOnly) {
          const sessionWithPlatform = session as typeof session & {
            platform?: string;
          };
          // If session includes current conversation platform, prefer using that platform's bot for "prohibit file sending" check
          let targetBotId = botId;
          if (!botId) {
            const botsResult = await getBotsByUserId({
              id: session.user.id,
              limit: null,
              startingAfter: null,
              endingBefore: null,
              onlyEnable: true,
            });
            const chatBots = botsResult.bots.filter(
              (b) =>
                b.adapter === "telegram" ||
                b.adapter === "whatsapp" ||
                b.adapter === "feishu" ||
                b.adapter === "dingtalk",
            );
            if (sessionWithPlatform.platform && chatBots.length > 0) {
              const currentBot = chatBots.find(
                (b) => b.adapter === sessionWithPlatform.platform,
              );
              if (currentBot) targetBotId = currentBot.id;
              else targetBotId = chatBots[0].id;
            } else if (chatBots.length > 0) {
              targetBotId = chatBots[0].id;
            }
          }

          // Check if target bot is telegram/whatsapp/feishu/dingtalk (none support sending files via sendReply)
          if (targetBotId) {
            const botsResult = await getBotsByUserId({
              id: session.user.id,
              limit: null,
              startingAfter: null,
              endingBefore: null,
              onlyEnable: true,
            });
            const targetBot = botsResult.bots.find((b) => b.id === targetBotId);

            if (
              targetBot &&
              (targetBot.adapter === "telegram" ||
                targetBot.adapter === "whatsapp" ||
                targetBot.adapter === "feishu" ||
                targetBot.adapter === "dingtalk")
            ) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `⚠️ Cannot send files via sendReply in ${targetBot.adapter} bot conversations.\n\nThe files have been generated locally. Please inform the user of the file location instead of trying to send them back through sendReply.\n\nFiles:\n${files.map((f) => `- ${f.path}`).join("\n")}\n\nCorrect approach: Say something like "✅ File generated at: ${files[0].path}" instead of using sendReply.`,
                  },
                ],
                isError: true,
              };
            }
          }
        }

        // Draft mode
        if (draftOnly) {
          const botsResult = await getBotsByUserId({
            id: session.user.id,
            limit: null,
            startingAfter: null,
            endingBefore: null,
            onlyEnable: true,
          });

          const availableBots = botsResult.bots.filter(
            (b) => b.adapter !== "manual",
          );

          return {
            content: [
              {
                type: "text" as const,
                text: "Message prepared. Awaiting your confirmation to send.",
              },
            ],
            data: {
              success: true,
              draftOnly: true,
              draft,
              recipients: recipients ?? [],
              availableAccounts: availableBots.map((b) => ({
                botId: b.id,
                platform: b.adapter,
                accountName:
                  b.platformAccount?.displayName ||
                  b.platformAccount?.externalId ||
                  "Unknown",
                botName: b.name || "Unnamed",
              })),
            },
          };
        }

        // Get available bots
        const botsResult = await getBotsByUserId({
          id: session.user.id,
          limit: null,
          startingAfter: null,
          endingBefore: null,
          onlyEnable: true,
        });

        const availableBots = botsResult.bots.filter(
          (b) => b.adapter !== "manual",
        );

        if (availableBots.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No active account found. To send messages, you need to connect and enable at least one account.",
              },
            ],
            isError: true,
          };
        }

        // Validate botId
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        let targetBotId = botId;

        if (botId) {
          if (!uuidRegex.test(botId)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "The provided botId is not valid.",
                },
              ],
              isError: true,
            };
          }

          const botExists = availableBots.some((b) => b.id === botId);
          if (!botExists) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "The selected account is not available. Please select from your available accounts.",
                },
              ],
              isError: true,
            };
          }

          targetBotId = botId;
        } else if (availableBots.length === 1) {
          targetBotId = availableBots[0].id;
        } else {
          // If session includes current conversation platform, prefer using that platform's bot, avoid going to other channel logic
          const sessionWithPlatform = session as typeof session & {
            platform?: string;
          };
          if (sessionWithPlatform.platform) {
            const currentPlatformBot = availableBots.find(
              (b) => b.adapter === sessionWithPlatform.platform,
            );
            if (currentPlatformBot) {
              targetBotId = currentPlatformBot.id;
            }
          }
          if (!targetBotId) {
            const botList = availableBots
              .map((bot, index) => {
                const platform = bot.adapter;
                const accountName =
                  bot.platformAccount?.displayName ||
                  bot.platformAccount?.externalId ||
                  `Account ${index + 1}`;
                const botName = bot.name || "Unnamed Bot";

                return `${index + 1}. **${platform}** - ${accountName} (Bot: ${botName})\n   Bot ID: \`${bot.id}\``;
              })
              .join("\n\n");

            return {
              content: [
                {
                  type: "text" as const,
                  text: `You have multiple connected accounts. Please choose which one to use for sending this message:\n\n${botList}`,
                },
              ],
              isError: true,
            };
          }
        }

        // Check recipients
        if (!recipients || recipients.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Cannot send message: recipients are required when draftOnly is false.",
              },
            ],
            isError: true,
          };
        }

        // Process files if provided
        let processedAttachments = undefined;
        if (files && files.length > 0) {
          const { statSync, existsSync } = await import("node:fs");
          const { basename } = await import("node:path");
          const { extname } = await import("node:path");

          processedAttachments = [];

          for (const file of files) {
            const { path: filePath, filename, mimeType } = file;

            // Validate file exists
            if (!existsSync(filePath)) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Attachment not found: ${filePath}`,
                  },
                ],
                isError: true,
              };
            }

            // Get file stats
            const stats = statSync(filePath);
            const finalFilename = filename || basename(filePath);
            const ext = extname(finalFilename).toLowerCase();

            // Determine MIME type
            let finalMimeType = mimeType;
            if (!finalMimeType) {
              const mimeTypes: Record<string, string> = {
                ".pdf": "application/pdf",
                ".doc": "application/msword",
                ".docx":
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".ppt": "application/vnd.ms-powerpoint",
                ".pptx":
                  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                ".xls": "application/vnd.ms-excel",
                ".xlsx":
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".mp4": "video/mp4",
                ".mp3": "audio/mpeg",
                ".zip": "application/zip",
                ".txt": "text/plain",
                ".md": "text/markdown",
                ".json": "application/json",
                ".csv": "text/csv",
              };
              finalMimeType = mimeTypes[ext] || "application/octet-stream";
            }

            // Create attachment object with file path (not file:// URL)
            processedAttachments.push({
              name: finalFilename,
              url: `file://${filePath}`, // Fallback URL
              contentType: finalMimeType,
              sizeBytes: stats.size,
              source: "local",
              blobPath: filePath, // Use blobPath to store actual file path
            });
          }
        }

        // Send message
        const params: SendMessageParams = {
          botId: targetBotId,
          recipients,
          message: draft,
          subject,
          cc,
          bcc,
          attachments: processedAttachments,
          withAppSuffix: true,
        };

        const result = await sendMessage(params, session.user.id);

        if (result.success) {
          return {
            content: [
              {
                type: "text" as const,
                text: result.message ?? "Message sent successfully!",
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: result.error ?? "Failed to send message",
            },
          ],
          isError: true,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error sending message: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
