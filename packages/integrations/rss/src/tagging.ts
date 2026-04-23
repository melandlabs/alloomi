import type { RssSubscription, InsertRssItem } from "./normalize";

/**
 * RSS article category types
 */
export type RssCategory =
  | "News" // Default news
  | "R&D" // Research and development technology
  | "Product" // Product updates
  | "Marketing" // Marketing
  | "Funding" // Funding and investment
  | "Partnerships" // Partnerships
  | "User Growth" // User growth
  | "HR & Recruiting" // HR and recruiting
  | "Meetings" // Meetings and events
  | "Branding" // Branding
  | "Security"; // Security announcements

/**
 * Importance levels
 */
export type RssImportance = "high" | "medium" | "low";

/**
 * Urgency levels
 */
export type RssUrgency = "immediate" | "24h" | "not_urgent";

/**
 * Tag extraction result
 */
export interface RssTags {
  categories: RssCategory[];
  importance: RssImportance;
  urgency: RssUrgency;
  keywords: string[];
}

/**
 * Subscription-level tag configuration
 */
export interface RssTagConfig {
  // Default categories (can configure multiple)
  defaultCategories?: RssCategory[];
  // Default importance
  defaultImportance?: RssImportance;
  // Default urgency
  defaultUrgency?: RssUrgency;
  // Keyword rules (keyword -> category mapping)
  keywordRules?: KeywordRule[];
}

/**
 * Keyword rules
 */
export interface KeywordRule {
  // Keyword list (triggers on any match)
  keywords: string[];
  // Mapped category
  category: RssCategory;
  // Mapped importance (optional)
  importance?: RssImportance;
  // Mapped urgency (optional)
  urgency?: RssUrgency;
}

/**
 * Predefined RSS source type rules
 */
const SOURCE_TYPE_RULES: Record<
  string,
  {
    defaultCategories: RssCategory[];
    defaultImportance: RssImportance;
    defaultUrgency: RssUrgency;
  }
> = {
  "tech-blog": {
    defaultCategories: ["R&D", "Product"],
    defaultImportance: "medium",
    defaultUrgency: "not_urgent",
  },
  "news-feed": {
    defaultCategories: ["News"],
    defaultImportance: "medium",
    defaultUrgency: "not_urgent",
  },
  "company-blog": {
    defaultCategories: ["Product", "Branding"],
    defaultImportance: "medium",
    defaultUrgency: "not_urgent",
  },
  "security-advisory": {
    defaultCategories: ["Security"],
    defaultImportance: "high",
    defaultUrgency: "24h",
  },
  "job-board": {
    defaultCategories: ["HR & Recruiting"],
    defaultImportance: "low",
    defaultUrgency: "not_urgent",
  },
};

/**
 * Common keyword rule library
 */
const COMMON_KEYWORD_RULES: KeywordRule[] = [
  // Technology R&D category
  {
    keywords: ["launch", "release", "update", "feature", "beta", "version"],
    category: "Product",
    importance: "medium",
  },
  {
    keywords: ["API", "SDK", "framework", "library", "open source", "github"],
    category: "R&D",
    importance: "medium",
  },
  {
    keywords: ["vulnerability", "security", "patch", "CVE", "exploit"],
    category: "Security",
    importance: "high",
    urgency: "24h",
  },

  // Funding and investment
  {
    keywords: [
      "funding",
      "raise",
      "investment",
      "investor",
      "Series A",
      "Series B",
      "VC",
    ],
    category: "Funding",
    importance: "medium",
  },

  // Partnerships and acquisitions
  {
    keywords: [
      "partnership",
      "acquisition",
      "acquire",
      "merger",
      "deal",
      "strategic",
    ],
    category: "Partnerships",
    importance: "medium",
  },

  // User growth
  {
    keywords: ["user growth", "milestone", "million users", "MAU", "DAU"],
    category: "User Growth",
    importance: "medium",
  },

  // HR and recruiting
  {
    keywords: [
      "hiring",
      "recruit",
      "job opening",
      "position",
      "role",
      "join our team",
    ],
    category: "HR & Recruiting",
    importance: "low",
  },

  // Meetings and events
  {
    keywords: [
      "conference",
      "summit",
      "webinar",
      "workshop",
      "meetup",
      "event",
    ],
    category: "Meetings",
    importance: "low",
  },

  // Marketing and promotion
  {
    keywords: ["campaign", "marketing", "promotion", "advertisement"],
    category: "Marketing",
    importance: "low",
  },

  // Branding and press
  {
    keywords: ["award", "recognition", "press release", "announcement"],
    category: "Branding",
    importance: "medium",
  },
];

/**
 * Extract tag configuration from subscription metadata
 */
export function getTagConfig(
  subscription: RssSubscription,
): RssTagConfig | null {
  const metadata = subscription as unknown as {
    tagConfig?: RssTagConfig;
  };

  return metadata.tagConfig || null;
}

/**
 * Extract tags based on RSS metadata
 */
function extractFromMetadata(item: InsertRssItem): {
  categories: Set<RssCategory>;
  importance: RssImportance;
  urgency: RssUrgency;
} {
  const categories = new Set<RssCategory>();
  const importance: RssImportance = "medium";
  const urgency: RssUrgency = "not_urgent";

  const metadata = item.metadata as Record<string, unknown> | null;
  if (!metadata) {
    return { categories, importance, urgency };
  }

  // Extract from RSS source categories field
  const rssCategories = metadata.categories as string[] | undefined;
  if (rssCategories && rssCategories.length > 0) {
    // Map RSS categories to system categories
    for (const rssCat of rssCategories) {
      const category = mapRssCategoryToSystem(rssCat);
      if (category) {
        categories.add(category);
      }
    }
  }

  // Extract from subscriptionCategory
  const subscriptionCategory = metadata.subscriptionCategory as
    | string
    | undefined;
  if (subscriptionCategory) {
    const category = mapRssCategoryToSystem(subscriptionCategory);
    if (category) {
      categories.add(category);
    }
  }

  // Extract from feedTitle (some sources identify type via title)
  const feedTitle = metadata.feedTitle as string | undefined;
  if (feedTitle) {
    const inferredCategory = inferCategoryFromFeedTitle(feedTitle);
    if (inferredCategory) {
      categories.add(inferredCategory);
    }
  }

  return { categories, importance, urgency };
}

/**
 * Map RSS source category to system category
 */
function mapRssCategoryToSystem(rssCategory: string): RssCategory | null {
  const normalized = rssCategory.toLowerCase();

  // Technology R&D
  if (
    normalized.includes("tech") ||
    normalized.includes("developer") ||
    normalized.includes("engineering")
  ) {
    return "R&D";
  }

  // Product
  if (normalized.includes("product") || normalized.includes("release")) {
    return "Product";
  }

  // Security
  if (normalized.includes("security") || normalized.includes("vulnerability")) {
    return "Security";
  }

  // Funding
  if (normalized.includes("funding") || normalized.includes("investment")) {
    return "Funding";
  }

  // Recruiting
  if (
    normalized.includes("jobs") ||
    normalized.includes("careers") ||
    normalized.includes("hiring")
  ) {
    return "HR & Recruiting";
  }

  // News
  if (normalized.includes("news")) {
    return "News";
  }

  return null;
}

/**
 * Infer category from feedTitle
 */
function inferCategoryFromFeedTitle(feedTitle: string): RssCategory | null {
  const normalized = feedTitle.toLowerCase();

  // Security advisory
  if (
    normalized.includes("security") ||
    normalized.includes("advisory") ||
    normalized.includes("cve")
  ) {
    return "Security";
  }

  // Tech blog
  if (
    normalized.includes("blog") &&
    (normalized.includes("engineering") ||
      normalized.includes("developer") ||
      normalized.includes("tech"))
  ) {
    return "R&D";
  }

  // Recruiting
  if (
    normalized.includes("jobs") ||
    normalized.includes("careers") ||
    normalized.includes("recruiting")
  ) {
    return "HR & Recruiting";
  }

  return null;
}

/**
 * Extract tags based on keyword matching
 */
function extractFromKeywords(
  item: InsertRssItem,
  rules: KeywordRule[],
): {
  categories: Set<RssCategory>;
  importance: RssImportance;
  urgency: RssUrgency;
  keywords: string[];
} {
  const categories = new Set<RssCategory>();
  let importance: RssImportance = "medium";
  let urgency: RssUrgency = "not_urgent";
  const matchedKeywords: string[] = [];

  // Search text: title + summary
  const searchText = [item.title || "", item.summary || "", item.content || ""]
    .join(" ")
    .toLowerCase();

  // Matching rules
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        categories.add(rule.category);
        matchedKeywords.push(keyword);

        // If rule specifies importance/urgency, use rule value (only set on first match)
        if (rule.importance && importance === "medium") {
          importance = rule.importance;
        }
        if (rule.urgency && urgency === "not_urgent") {
          urgency = rule.urgency;
        }

        break; // Rule matched successfully, check next rule
      }
    }
  }

  return { categories, importance, urgency, keywords: matchedKeywords };
}

/**
 * Extract keywords (extract important words from title and summary)
 */
function extractTopKeywords(item: InsertRssItem): string[] {
  const keywords: string[] = [];
  const text = [item.title, item.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Simple word extraction: identify capitalized words, technical terms, etc.
  // Using simple rules here; more sophisticated NLP could be used
  const words = text.split(/\s+/);
  const wordFreq = new Map<string, number>();

  for (const word of words) {
    // Filter out common stop words
    if (
      word.length < 3 ||
      /^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|this|that|with|have|from|they|will|more|when|into|your|some|than|them|what|which|their|about|would|after|other|like|there|could|just|should|such|before|where|been|during|being|while|through|each|because|these|those|without|under|until|above|against|between|into|upon|within|across|among|behind|beyond|plus|except|but|nor|off|per|via|due|onto|past|since|toward|towards|very|just|also|even|now|then|here|there|when|where|why|how|all|each|every|both|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|can|will|just|don|should|now|的|了|和|是|在|我|有|就|不|人|都|一|一个|上|也|很|到|说|要|去|你|会|着|没有|看|好|自己|这)$/i.test(
        word,
      )
    ) {
      continue;
    }

    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  // Take the top 5 words by frequency
  const sorted = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  keywords.push(...sorted.map((e) => e[0]));

  return keywords;
}

/**
 * Main function: extract tags for RSS articles
 */
export function extractRssTags(
  item: InsertRssItem,
  subscription: RssSubscription,
): RssTags {
  // 1. Get subscription-level configuration
  const tagConfig = getTagConfig(subscription);

  // 2. Get default configuration from sourceType
  const sourceTypeRules = SOURCE_TYPE_RULES[subscription.sourceType] || {
    defaultCategories: ["News"],
    defaultImportance: "medium",
    defaultUrgency: "not_urgent",
  };

  // 3. Extract from metadata
  const metadataTags = extractFromMetadata(item);

  // 4. Extract from keywords (prefer subscription config, otherwise use common rules)
  const keywordRules = tagConfig?.keywordRules || COMMON_KEYWORD_RULES;
  const keywordTags = extractFromKeywords(item, keywordRules);

  // 5. Extract keywords
  const topKeywords = extractTopKeywords(item);

  // 6. Merge categories (priority: keywords > metadata > subscription config > sourceType default)
  const categories = new Set<RssCategory>();

  // Categories from keyword matching
  keywordTags.categories.forEach((cat) => categories.add(cat));

  // Categories from metadata extraction
  metadataTags.categories.forEach((cat) => categories.add(cat));

  // Default categories from subscription config
  tagConfig?.defaultCategories?.forEach((cat) => categories.add(cat));

  // sourceType default categories (if no category yet)
  if (categories.size === 0) {
    sourceTypeRules.defaultCategories.forEach((cat) => categories.add(cat));
  }

  // 7. Determine importance (priority: keywords > subscription config > sourceType default)
  const importance =
    keywordTags.importance !== "medium"
      ? keywordTags.importance
      : tagConfig?.defaultImportance || sourceTypeRules.defaultImportance;

  // 8. Determine urgency (priority: keywords > subscription config > sourceType default)
  const urgency =
    keywordTags.urgency !== "not_urgent"
      ? keywordTags.urgency
      : tagConfig?.defaultUrgency || sourceTypeRules.defaultUrgency;

  // 9. Special rule: if both importance and urgency are low, add News label by default
  // This ensures articles without explicit importance or urgency are classified as News
  if (importance === "low" && urgency === "not_urgent") {
    categories.add("News");
  }

  // 10. Fallback rule: if no category is added, forcibly add News
  // This ensures every article has at least one category
  if (categories.size === 0) {
    categories.add("News");
  }

  return {
    categories: Array.from(categories),
    importance,
    urgency,
    keywords: topKeywords,
  };
}

/**
 * Update subscription tag configuration
 * This function returns the metadata fields that need to be updated
 */
export function buildTagConfigMetadata(
  config: RssTagConfig,
): Record<string, unknown> {
  return {
    tagConfig: config,
  };
}
