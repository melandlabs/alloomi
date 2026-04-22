import { createHash } from "node:crypto";

/** Minimal RssSubscription type derived from schema */
export type RssSubscription = {
  id: string;
  userId: string;
  sourceUrl: string;
  title: string | null;
  category: string | null;
  sourceType: string;
  status: string;
};

/** Minimal InsertRssItem type derived from schema */
export type InsertRssItem = {
  subscriptionId: string;
  guidHash: string;
  title: string | null;
  summary: string | null;
  content: string | null;
  link: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
  status: string;
  metadata: Record<string, unknown>;
};

const DEFAULT_MAX_ITEMS = 25;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RssItem = Record<string, any>;

type BuildOptions = {
  subscription: RssSubscription;
  items: RssItem[];
  feedTitle?: string | null;
  limit?: number;
};

export function buildRssItemInserts({
  subscription,
  items,
  feedTitle,
  limit = DEFAULT_MAX_ITEMS,
}: BuildOptions): InsertRssItem[] {
  const now = new Date();
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_MAX_ITEMS;
  const trimmedItems = items.slice(0, safeLimit);

  return trimmedItems.map((item, index) => {
    const digestSource =
      item.guid ??
      (item as { id?: string }).id ??
      item.link ??
      item.title ??
      `${subscription.sourceUrl}:${index}`;
    const guidHash = createHash("sha256")
      .update(`${subscription.id}:${digestSource}`)
      .digest("hex");

    const publishedAt = parseDate(item.isoDate ?? item.pubDate ?? null);
    const author =
      (item as { creator?: string }).creator ??
      (item as { author?: string }).author ??
      null;

    const metadata: Record<string, unknown> = {
      feedTitle: feedTitle ?? subscription.title ?? null,
      sourceUrl: subscription.sourceUrl,
      subscriptionId: subscription.id,
      subscriptionTitle: subscription.title,
      subscriptionCategory: subscription.category,
    };

    if (author) {
      metadata.author = author;
    }
    if (item.categories && item.categories.length > 0) {
      metadata.categories = item.categories;
    }
    if (item.guid) {
      metadata.guid = item.guid;
    }

    const encodedContent =
      (item as { "content:encoded"?: string })["content:encoded"] ??
      item.content ??
      null;

    return {
      subscriptionId: subscription.id,
      guidHash,
      title: item.title ?? null,
      summary:
        item.contentSnippet ?? (item as { summary?: string }).summary ?? null,
      content: encodedContent,
      link: (item.link as string | null) ?? null,
      publishedAt: publishedAt ?? null,
      fetchedAt: now,
      status: "pending",
      metadata,
    } satisfies InsertRssItem;
  });
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
