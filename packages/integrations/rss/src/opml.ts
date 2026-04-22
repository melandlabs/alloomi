import { XMLParser } from "fast-xml-parser";

export const DEFAULT_MAX_OPML_FEEDS = 200;

export type ParsedOpmlFeed = {
  sourceUrl: string;
  title: string | null;
  category: string | null;
};

export type SkippedOpmlFeed = {
  title?: string | null;
  url?: string | null;
  reason: string;
};

type RawOutline = {
  text?: string;
  title?: string;
  category?: string;
  xmlUrl?: string;
  outline?: RawOutline | RawOutline[];
  [key: string]: unknown;
};

type ParseOptions = {
  maxFeeds?: number;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
  allowBooleanAttributes: true,
});

export function parseOpmlFeeds(
  opml: string,
  options: ParseOptions = {},
): {
  feeds: ParsedOpmlFeed[];
  skipped: SkippedOpmlFeed[];
  totalFound: number;
} {
  if (!opml || !opml.trim()) {
    throw new Error("Empty OPML file.");
  }

  const parsed = parser.parse(opml);
  const outlines = getOutlineArray(parsed?.opml?.body?.outline);

  if (!outlines.length) {
    throw new Error("No outlines were found inside this OPML file.");
  }

  const candidates: ParsedOpmlFeed[] = [];
  for (const outline of outlines) {
    collectFeedsFromOutline(outline, null, candidates);
  }

  if (!candidates.length) {
    throw new Error("No RSS feeds were found inside this OPML file.");
  }

  const skipped: SkippedOpmlFeed[] = [];
  const normalized: ParsedOpmlFeed[] = [];
  const seenUrls = new Set<string>();

  for (const feed of candidates) {
    try {
      const normalizedUrl = normalizeFeedUrl(feed.sourceUrl);
      if (seenUrls.has(normalizedUrl)) {
        skipped.push({
          title: feed.title,
          url: normalizedUrl,
          reason: "Duplicate feed skipped.",
        });
        continue;
      }
      seenUrls.add(normalizedUrl);
      normalized.push({
        sourceUrl: normalizedUrl,
        title: feed.title,
        category: feed.category,
      });
    } catch (error) {
      skipped.push({
        title: feed.title,
        url: feed.sourceUrl,
        reason:
          error instanceof Error
            ? error.message
            : "Invalid feed URL encountered.",
      });
    }
  }

  const maxFeeds = options.maxFeeds ?? DEFAULT_MAX_OPML_FEEDS;
  const feeds = normalized.slice(0, maxFeeds);

  if (normalized.length > feeds.length) {
    for (const feed of normalized.slice(maxFeeds)) {
      skipped.push({
        title: feed.title,
        url: feed.sourceUrl,
        reason: `Upload limit reached. Only the first ${maxFeeds} feeds are processed per file.`,
      });
    }
  }

  return {
    feeds,
    skipped,
    totalFound: candidates.length,
  };
}

function getOutlineArray(
  outline: RawOutline | RawOutline[] | undefined,
): RawOutline[] {
  if (!outline) return [];
  return Array.isArray(outline) ? outline : [outline];
}

function collectFeedsFromOutline(
  node: RawOutline,
  parentCategory: string | null,
  accumulator: ParsedOpmlFeed[],
) {
  if (!node || typeof node !== "object") return;

  const label = coalesceLabel(node);
  const explicitCategory = node.category?.trim() || null;
  const nestedOutlines = getOutlineArray(node.outline);

  if (node.xmlUrl) {
    const sourceUrl = `${node.xmlUrl}`.trim();
    if (sourceUrl.length > 0) {
      accumulator.push({
        sourceUrl,
        title: coalesceLabel({ title: node.title, text: node.text }),
        category: parentCategory ?? explicitCategory,
      });
    }
  }

  if (nestedOutlines.length > 0) {
    const nextCategory = node.xmlUrl
      ? parentCategory
      : (explicitCategory ?? label ?? parentCategory);
    for (const child of nestedOutlines) {
      collectFeedsFromOutline(child, nextCategory ?? null, accumulator);
    }
  }
}

function coalesceLabel(node: { title?: string; text?: string } | undefined) {
  if (!node) return null;
  return node.title?.trim() || node.text?.trim() || null;
}

function normalizeFeedUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("Feed entry is missing its URL.");
  }

  const parsed = new URL(trimmed);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP/HTTPS feed URLs are supported.");
  }

  parsed.hash = "";
  return parsed.toString();
}
