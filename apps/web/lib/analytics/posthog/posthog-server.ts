// Dynamic import to reduce memory footprint
import type { PostHog } from "posthog-node";

const serverApiKey =
  process.env.POSTHOG_SERVER_API_KEY ||
  process.env.POSTHOG_API_KEY ||
  process.env.NEXT_PUBLIC_POSTHOG_KEY ||
  "";
const serverHost =
  process.env.POSTHOG_SERVER_HOST ||
  process.env.POSTHOG_HOST ||
  process.env.NEXT_PUBLIC_POSTHOG_HOST ||
  "https://app.posthog.com";

let client: PostHog | null = null;

async function getClient() {
  if (!serverApiKey) {
    return null;
  }

  if (!client) {
    const { PostHog } = await import("posthog-node");
    client = new PostHog(serverApiKey, {
      host: serverHost,
      flushAt: 1,
      flushInterval: 1000,
    });
  }

  return client;
}

export async function captureServerEvent({
  distinctId,
  event,
  properties,
}: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}) {
  const posthog = await getClient();
  if (!posthog) {
    return false;
  }

  try {
    await posthog.capture({
      distinctId,
      event,
      properties,
    });
    return true;
  } catch (error) {
    console.error("[PostHog] Failed to capture server event", error);
    return false;
  }
}

export async function shutdownPosthog() {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
