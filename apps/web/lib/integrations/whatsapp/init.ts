import {
  startWhatsAppSelfMessageListener,
  stopWhatsAppSelfMessageListener,
} from "./self-message-listener";
import { getIntegrationAccountsByUserId } from "@/lib/db/queries";

/**
 * Initialize WhatsApp Self Message Listener for a user
 * This should be called after user logs in and has connected WhatsApp accounts
 */
export async function initWhatsAppSelfMessageListener(
  userId: string,
  authToken?: string, // Cloud auth token for API configuration
): Promise<void> {
  try {
    // Check if user has connected WhatsApp accounts
    const allAccounts = await getIntegrationAccountsByUserId({
      userId,
    });

    const accounts = allAccounts.filter((acc) => acc.platform === "whatsapp");

    if (!accounts || accounts.length === 0) {
      console.log(
        `[WhatsApp Init] No WhatsApp accounts found for user ${userId}, skipping Self Message Listener`,
      );
      return;
    }

    console.log(
      `[WhatsApp Init] Found ${accounts.length} WhatsApp account(s), starting Self Message Listener...`,
    );

    // Start Self Message Listener
    await startWhatsAppSelfMessageListener(userId, authToken);
  } catch (error) {
    console.error(
      `[WhatsApp Init] Failed to start Self Message Listener for user ${userId}:`,
      error,
    );
  }
}

/**
 * Stop WhatsApp Self Message Listener for a user
 * Exported for use in cleanup operations
 */
export { stopWhatsAppSelfMessageListener };
