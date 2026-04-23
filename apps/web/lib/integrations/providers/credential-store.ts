/**
 * CredentialStore implementation for apps/web
 *
 * Provides implementations of CredentialStore interface from @alloomi/integrations/core
 * using the database queries from apps/web.
 */

import type { PlatformId } from "@alloomi/integrations/core";
import type { IntegrationId } from "@/lib/integrations/client";
import {
  getIntegrationAccountsByUserId,
  getIntegrationAccountByPlatform,
  getIntegrationAccountById,
  updateIntegrationAccount,
  upsertIntegrationAccount,
} from "@/lib/db/queries";

/**
 * Implementation of CredentialStore that uses apps/web database queries
 */
export class WebCredentialStore {
  /**
   * Get all integration accounts for a user
   */
  async getAccountsByUserId(userId: string) {
    return getIntegrationAccountsByUserId({ userId });
  }

  /**
   * Get integration account by platform for a user
   */
  async getAccountByPlatform(userId: string, platform: PlatformId) {
    return getIntegrationAccountByPlatform({
      userId,
      platform: platform as IntegrationId,
    });
  }

  /**
   * Get integration account by ID
   */
  async getAccountById(userId: string, platformAccountId: string) {
    return getIntegrationAccountById({ userId, platformAccountId });
  }

  /**
   * Update integration account credentials/metadata/status
   */
  async updateAccount(params: {
    userId: string;
    platformAccountId: string;
    status?: string;
    credentials?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    await updateIntegrationAccount(params);
  }

  /**
   * Create a new integration account
   */
  async createAccount(params: {
    userId: string;
    platform: PlatformId;
    platformAccountId?: string | null;
    status?: string;
    credentials?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }) {
    // Generate a platform-specific externalId if not provided
    const externalId =
      params.platformAccountId ??
      `${params.platform}-${params.userId}-${Date.now()}`;
    const displayName = `${params.platform} Account`;

    return upsertIntegrationAccount({
      userId: params.userId,
      platform: params.platform as IntegrationId,
      externalId,
      displayName,
      credentials: params.credentials ?? {},
      metadata: params.metadata ?? null,
      status: params.status ?? "active",
    });
  }
}

/**
 * Singleton instance of WebCredentialStore
 */
export const credentialStore = new WebCredentialStore();
