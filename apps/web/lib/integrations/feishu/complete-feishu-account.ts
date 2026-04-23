/**
 * Server-side: write Feishu integration account and ensure corresponding Bot exists (aligned with POST /api/integrations behavior)
 */

import {
  createBot,
  getIntegrationAccountsByUserId,
  updateBot,
  upsertIntegrationAccount,
} from "@/lib/db/queries";

export async function upsertFeishuBotIntegration(params: {
  userId: string;
  appId: string;
  appSecret: string;
  displayName: string;
  botName: string;
  botDescription: string;
  /** Use lark for Feishu international (Lark) tenant, consistent with device code polling domain */
  apiDomain?: "feishu" | "lark";
  metadata?: Record<string, unknown> | null;
}) {
  const account = await upsertIntegrationAccount({
    userId: params.userId,
    platform: "feishu",
    externalId: params.appId,
    displayName: params.displayName,
    credentials: {
      appId: params.appId,
      appSecret: params.appSecret,
      ...(params.apiDomain ? { domain: params.apiDomain } : {}),
    },
    metadata: params.metadata ?? null,
    status: "active",
  });

  const existingAccounts = await getIntegrationAccountsByUserId({
    userId: params.userId,
  });
  const associatedBot = existingAccounts.find(
    (item) => item.id === account.id,
  )?.bot;

  let botId: string | null = null;
  if (associatedBot) {
    await updateBot(associatedBot.id, {
      name: params.botName,
      description: params.botDescription,
      adapter: "feishu",
      adapterConfig: {},
      enable: true,
    });
    botId = associatedBot.id;
  } else {
    botId = await createBot({
      name: params.botName,
      description: params.botDescription,
      adapter: "feishu",
      adapterConfig: {},
      enable: true,
      userId: params.userId,
      platformAccountId: account.id,
    });
  }

  return { account, botId };
}
