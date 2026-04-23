/**
 * Time tool - Get the REAL current time, date, year, and day of week
 */

import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

/**
 * Create the time tool
 */
export function createTimeTool() {
  return tool(
    "time",
    [
      "**⏰ WHAT IS THIS TOOL?**",
      "Get the REAL current time, date, year, and day of week.",
      "",
      "**🚨 CRITICAL: MUST USE THIS TOOL when:**",
      "",
      "- User asks: 'what time is it', 'what date is it today', 'what year is it'",
      "- User asks: 'what day of the week is it', 'is it Monday/Tuesday...'",
      "- User asks: 'how many days until XX', 'when is XX days from now'",
      "- Any time-based scheduling, planning, or calculation questions",
      "- Any question about the current year (e.g., 'what year is it?')",
      "",
      "**📋 WHY IS THIS IMPORTANT?**",
      "",
      "- AI models have training data with OLD dates (often 2025)",
      "- This tool returns the ACTUAL current time from the system",
      "- NEVER guess or assume the current year - always call this tool",
      "",
      "**📤 RESPONSE FORMAT:**",
      "",
      "The tool returns:",
      "- currentTime: The time in requested format",
      "- timestamp: Unix timestamp (milliseconds since epoch)",
      "- timezone: The server's timezone",
      "- message: Confirmation message",
      "",
      "**🎤 USAGE EXAMPLES:**",
      "",
      "- 'What date is it today?' → Call time()",
      "- 'What day of the week is it?' → Call time(format='human-readable')",
      "- 'What time is it now?' → Call time()",
      "- 'Is it 2025 or 2026?' → Call time() to verify",
      "- 'How many days until next Friday?' → Call time() first, then calculate",
    ].join("\n"),
    {
      format: z
        .enum(["iso", "human-readable", "timestamp", "custom"])
        .optional()
        .describe(
          "Format of the time to return: 'iso' (default, ISO 8601 format like '2026-02-21T12:00:00.000Z'), 'human-readable' (local date/time string), 'timestamp' (milliseconds since epoch), or 'custom' (requires customFormat parameter)",
        ),
      customFormat: z
        .string()
        .optional()
        .describe(
          "Custom format description (required if format='custom'). Note: Simple description of desired format, the tool will try to accommodate it.",
        ),
      timezone: z
        .string()
        .optional()
        .describe(
          "Timezone to use (e.g., 'Asia/Shanghai', 'America/New_York'). If not provided, defaults to the user's timezone.",
        ),
    },
    async ({ format = "iso", customFormat, timezone }) => {
      try {
        const now = new Date();
        const effectiveTimezone =
          timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        let timeString: string;

        // Validate custom format if needed
        if (format === "custom" && !customFormat) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    message: "customFormat is required when format is 'custom'",
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        // Generate time string based on format
        switch (format) {
          case "iso":
            timeString = now.toISOString();
            break;
          case "human-readable":
            timeString = now.toLocaleString("zh-CN", {
              timeZone: effectiveTimezone,
            });
            break;
          case "timestamp":
            timeString = now.getTime().toString();
            break;
          case "custom":
            timeString = `${now.toLocaleString("zh-CN", {
              timeZone: effectiveTimezone,
            })} (Custom format requested: ${customFormat})`;
            break;
          default:
            timeString = now.toISOString();
        }

        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const dayOfWeek = now.toLocaleDateString("zh-CN", {
          timeZone: effectiveTimezone,
          weekday: "long",
        });
        const hours = now.getHours();
        const minutes = now.getMinutes();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  currentTime: timeString,
                  format,
                  timestamp: now.getTime(),
                  timezone: effectiveTimezone,
                  year: year,
                  month: month,
                  date: date,
                  dayOfWeek: dayOfWeek,
                  time: `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`,
                  fullDate: `${month}/${date}/${year} ${dayOfWeek}`,
                  message: `Current time retrieved in ${format} format. IMPORTANT: The current year is ${year}.`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  message: `Failed to get current time: ${error instanceof Error ? error.message : String(error)}`,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
