import { startTelegramUserListener } from "./user-listener";
import { getIntegrationAccountsByUserId } from "@/lib/db/queries";

/**
 * Initialize Telegram User Listener (listens to Saved Messages)
 * This is a separate initialization function that needs to be called after user login
 */
export async function initTelegramUserListener(userId: string): Promise<void> {
  try {
    console.log(
      `[Telegram Init] Initializing User Listener for user ${userId}...`,
    );

    // Check if user has imported Telegram accounts
    const allAccounts = await getIntegrationAccountsByUserId({
      userId,
    });

    const accounts = allAccounts.filter((acc) => acc.platform === "telegram");

    if (!accounts || accounts.length === 0) {
      console.log(
        `[Telegram Init] No Telegram accounts found for user ${userId}, skipping User Listener`,
      );
      return;
    }

    console.log(
      `[Telegram Init] Found ${accounts.length} Telegram account(s), starting User Listener...`,
    );

    // Start User Listener
    await startTelegramUserListener(userId);

    console.log(
      `[Telegram Init] User Listener started successfully for user ${userId}`,
    );
  } catch (error) {
    console.error(
      `[Telegram Init] Failed to start User Listener for user ${userId}:`,
      error,
    );
  }
}
