import { getAuthToken } from "@/lib/auth/token-manager";

export type CreateRssSubscriptionPayload = {
  sourceUrl?: string;
  title?: string;
  category?: string;
  catalogSlug?: string;
};

export type UpdateRssSubscriptionPayload = {
  status?: "active" | "paused" | "disabled";
  title?: string;
  category?: string;
};

export type ImportRssOpmlResponse = {
  imported: number;
  processed: number;
  totalFound: number;
  skipped: { title?: string | null; url?: string | null; reason: string }[];
};

export async function createRssSubscriptionClient(
  payload: CreateRssSubscriptionPayload,
) {
  const headers: HeadersInit = { "Content-Type": "application/json" };

  // Add Bearer token (Tauri mode)
  if (typeof window !== "undefined") {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch("/api/integrations/rss", {
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
        : `Failed to create RSS subscription (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as { subscription: unknown };
}

export async function updateRssSubscriptionClient(
  subscriptionId: string,
  payload: UpdateRssSubscriptionPayload,
) {
  const headers: HeadersInit = { "Content-Type": "application/json" };

  // Add Bearer token (Tauri mode)
  if (typeof window !== "undefined") {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(
    `/api/integrations/rss/${encodeURIComponent(subscriptionId)}`,
    {
      method: "PATCH",
      headers,
      credentials: "include",
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody?.error === "string"
        ? errorBody.error
        : `Failed to update RSS subscription (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as { subscription: unknown };
}

export async function deleteRssSubscriptionClient(subscriptionId: string) {
  const headers: HeadersInit = {};

  // Add Bearer token (Tauri mode)
  if (typeof window !== "undefined") {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(
    `/api/integrations/rss/${encodeURIComponent(subscriptionId)}`,
    {
      method: "DELETE",
      headers,
      credentials: "include",
    },
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody?.error === "string"
        ? errorBody.error
        : `Failed to delete RSS subscription (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as { success: boolean };
}

export async function importRssOpmlClient(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const headers: HeadersInit = {};
  // Add Bearer token (Tauri mode)
  if (typeof window !== "undefined") {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch("/api/integrations/rss/import", {
    method: "POST",
    headers,
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody?.error === "string"
        ? errorBody.error
        : `Failed to import OPML (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as ImportRssOpmlResponse;
}
