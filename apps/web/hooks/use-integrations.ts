"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { getAuthToken } from "@/lib/auth/token-manager";

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

export type IntegrationAccountClient = {
  id: string;
  platform: IntegrationId;
  externalId: string;
  displayName: string;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  hasValidContextToken?: boolean; // For WeChat, indicates if bot has valid context token for notifications
  bot: {
    id: string;
    name: string;
    description: string;
    adapter: string;
    enable: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};

const jsonFetcher = async (url: string) => {
  const headers: HeadersInit = {};

  // Add Bearer token in Tauri mode
  if (typeof window !== "undefined") {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return (await response.json()) as { accounts: IntegrationAccountClient[] };
};

export function useIntegrations() {
  const { data, error, isLoading, mutate } = useSWR<{
    accounts: IntegrationAccountClient[];
  }>("/api/integrations", jsonFetcher, {
    fallbackData: { accounts: [] },
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const accounts = data?.accounts ?? [];

  const groupedByIntegration = useMemo(() => {
    return accounts.reduce<Record<IntegrationId, IntegrationAccountClient[]>>(
      (acc, account) => {
        const bucket = acc[account.platform];
        if (bucket) {
          bucket.push(account);
        } else {
          acc[account.platform] = [account];
        }
        return acc;
      },
      {
        telegram: [],
        whatsapp: [],
        slack: [],
        discord: [],
        gmail: [],
        outlook: [],
        linkedin: [],
        instagram: [],
        twitter: [],
        google_calendar: [],
        outlook_calendar: [],
        teams: [],
        facebook_messenger: [],
        google_drive: [],
        google_docs: [],
        hubspot: [],
        notion: [],
        github: [],
        asana: [],
        jira: [],
        linear: [],
        imessage: [],
        feishu: [],
        dingtalk: [],
        qqbot: [],
        weixin: [],
      },
    );
  }, [accounts]);

  return {
    accounts,
    groupedByIntegration,
    isLoading,
    error,
    mutate,
  };
}
