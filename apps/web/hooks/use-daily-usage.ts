"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";

import { getAuthToken } from "@/lib/auth/token-manager";

export type DailyUsageEntry = {
  date: string;
  consumed: number;
  recharged: number;
};

export type DailyUsage = {
  dailyUsage: DailyUsageEntry[];
  totalConsumed: number;
  totalRecharged: number;
  netChange: number;
};

type DailyUsageFetcherError = Error & { status?: number };

async function fetchDailyUsage(url: string): Promise<DailyUsage> {
  let cloudAuthToken: string | undefined;
  try {
    cloudAuthToken = getAuthToken() || undefined;
  } catch (error) {
    console.error("[useDailyUsage] Failed to read cloud_auth_token:", error);
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (cloudAuthToken) {
    headers.Authorization = `Bearer ${cloudAuthToken}`;
  }

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // keep data as null
  }

  if (!response.ok) {
    let responseMessage: string | null = null;

    if (data && typeof data === "object") {
      const payload = data as { cause?: unknown; message?: unknown };
      if (typeof payload.cause === "string") {
        responseMessage = payload.cause;
      } else if (typeof payload.message === "string") {
        responseMessage = payload.message;
      }
    }

    const error = new Error(
      responseMessage ?? `Failed to fetch daily usage (${response.status})`,
    ) as DailyUsageFetcherError;
    error.status = response.status;
    throw error;
  }

  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as DailyUsage).dailyUsage) ||
    typeof (data as DailyUsage).totalConsumed !== "number" ||
    typeof (data as DailyUsage).totalRecharged !== "number" ||
    typeof (data as DailyUsage).netChange !== "number"
  ) {
    throw new Error("Daily usage response payload malformed");
  }

  return data as DailyUsage;
}

export function useDailyUsage(days = 7) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);

  const swr = useSWR<DailyUsage>(
    isAuthenticated ? `/api/quota/daily-usage?days=${days}` : null,
    fetchDailyUsage,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  );

  return {
    data: swr.data ?? null,
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
    mutate: swr.mutate,
    isAuthenticated,
  };
}
