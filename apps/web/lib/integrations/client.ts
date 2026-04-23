"use client";

export type IntegrationId =
  | "telegram"
  | "whatsapp"
  | "slack"
  | "discord"
  | "gmail"
  | "outlook"
  | "linkedin"
  | "instagram"
  | "twitter"
  | "google_calendar"
  | "outlook_calendar"
  | "teams"
  | "facebook_messenger"
  | "google_drive"
  | "google_docs"
  | "hubspot"
  | "notion"
  | "github"
  | "asana"
  | "jira"
  | "linear"
  | "imessage"
  | "feishu"
  | "dingtalk"
  | "qqbot"
  | "weixin";

export type CreateIntegrationAccountPayload = {
  platform: IntegrationId;
  externalId: string;
  displayName: string;
  status?: "active" | "paused" | "disabled";
  credentials: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  bot?: {
    id?: string | null;
    name: string;
    description: string;
    adapter: string;
    adapterConfig?: Record<string, unknown>;
    enable?: boolean;
  } | null;
};

export type CreatedIntegrationAccount = {
  id: string;
  platform: IntegrationId;
  externalId: string;
  displayName: string;
  status: string;
  metadata: Record<string, unknown> | null;
  botId: string | null;
};

export async function createIntegrationAccount(
  payload: CreateIntegrationAccountPayload,
): Promise<CreatedIntegrationAccount> {
  // Need to add Bearer token in Tauri mode
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Check if cloud authentication is needed (Tauri mode)
  if (typeof window !== "undefined") {
    // Use functions from token-manager consistently
    const { getAuthToken } = await import("@/lib/auth/token-manager");
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch("/api/integrations", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody?.error === "string"
        ? errorBody.error
        : `Failed to create integration account (${response.status})`;
    throw new Error(message);
  }

  const data = (await response.json()) as {
    account: CreatedIntegrationAccount;
  };

  // Trigger account authorization success event for refresh
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("integration:accountAuthorized", {
        detail: { account: data.account, platform: payload.platform },
      }),
    );
  }

  return data.account;
}

export async function deleteIntegrationAccountRemote(accountId: string) {
  // Need to add Bearer token in Tauri mode
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Check if cloud authentication is needed (Tauri mode)
  let hasToken = false;
  if (typeof window !== "undefined") {
    // Use functions from token-manager consistently
    const { getAuthToken } = await import("@/lib/auth/token-manager");
    const token = getAuthToken();
    console.log(
      `[deleteIntegrationAccountRemote] Token from token-manager: ${token ? `${token.substring(0, 30)}...` : "null"}`,
    );
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      hasToken = true;
      console.log(
        "[deleteIntegrationAccountRemote] Using Bearer token for cloud auth",
      );
    }
  }

  const response = await fetch(`/api/integrations/${accountId}`, {
    method: "DELETE",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody?.error === "string"
        ? errorBody.error
        : `Failed to delete integration account (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as {
    success: boolean;
    deletedAccountId: string | null;
    deletedBotIds: string[];
  };
}

export async function updateIntegrationAccountCredentials(
  accountId: string,
  credentials: Record<string, unknown>,
  metadata?: Record<string, unknown> | null,
): Promise<CreatedIntegrationAccount> {
  // Need to add Bearer token in Tauri mode
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Check if cloud authentication is needed (Tauri mode)
  if (typeof window !== "undefined") {
    // Use functions from token-manager consistently
    const { getAuthToken } = await import("@/lib/auth/token-manager");
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      console.log(
        "[updateIntegrationAccountCredentials] Using Bearer token for cloud auth",
      );
    }
  }

  const response = await fetch(`/api/integrations/${accountId}`, {
    method: "PATCH",
    headers,
    credentials: "include",
    body: JSON.stringify({
      credentials,
      metadata,
      status: "active",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody?.error === "string"
        ? errorBody.error
        : `Failed to update integration account (${response.status})`;
    throw new Error(message);
  }

  const data = (await response.json()) as {
    account: CreatedIntegrationAccount;
  };
  return data.account;
}
