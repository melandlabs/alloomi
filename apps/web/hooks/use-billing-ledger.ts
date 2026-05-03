"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";

import { getAuthToken } from "@/lib/auth/token-manager";

export type BillingLedgerEntry = {
  id: string;
  createdAt: string;
  source: "purchase" | "usage" | "refund" | "reward" | "subscription";
  description: string;
  delta?: number;
  balanceAfter?: number;
  amount?: number;
  currency?: string;
  planName?: string;
  billingCycle?: string;
  status?: string;
};

export type BillingLedgerResponse = {
  items: BillingLedgerEntry[];
  total: number;
  limit: number;
  offset: number;
};

type BillingLedgerFetcherError = Error & { status?: number };

async function fetchBillingLedger(url: string): Promise<BillingLedgerResponse> {
  let cloudAuthToken: string | undefined;
  try {
    cloudAuthToken = getAuthToken() || undefined;
  } catch (error) {
    console.error("[useBillingLedger] Failed to read cloud_auth_token:", error);
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
      responseMessage ?? `Failed to fetch billing ledger (${response.status})`,
    ) as BillingLedgerFetcherError;
    error.status = response.status;
    throw error;
  }

  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as BillingLedgerResponse).items) ||
    typeof (data as BillingLedgerResponse).total !== "number" ||
    typeof (data as BillingLedgerResponse).limit !== "number" ||
    typeof (data as BillingLedgerResponse).offset !== "number"
  ) {
    throw new Error("Billing ledger response payload malformed");
  }

  return data as BillingLedgerResponse;
}

export function useBillingLedger(options?: {
  limit?: number;
  source?: string;
}) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);

  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.source) params.set("source", options.source);

  const queryString = params.toString();
  const url = queryString
    ? `/api/billing/ledger?${queryString}`
    : "/api/billing/ledger";

  const swr = useSWR<BillingLedgerResponse>(
    isAuthenticated ? url : null,
    fetchBillingLedger,
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
