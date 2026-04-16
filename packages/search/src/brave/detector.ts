/**
 * Search Intent Detector
 *
 * Detects whether a user query requires real-time information from the web.
 */

const REALTIME_KEYWORDS = [
  // Time-related
  "today",
  "yesterday",
  "tomorrow",
  "now",
  "latest",
  "recent",
  "current",
  "this week",
  "this month",

  // News/Events
  "news",
  "breaking",
  "announcement",
  "what happened",
  "what's happening",

  // Real-time data
  "price",
  "stock",
  "weather",
  "currency",
  "rate",
  "market",

  // Dynamic information
  "ranking",
  "rank",
  "top",
  "best",

  // Live/Real-time
  "live",
  "real-time",
  "happening now",

  // Updates/Version
  "update",
  "new version",
  "release",

  // Current status
  "status",
  "how is",
  "how's",
];

/**
 * Check if the user query requires real-time information
 *
 * @param query - The user's message content
 * @returns true if the query likely needs real-time information
 */
export function needsRealTimeInfo(query: string): boolean {
  if (!query || typeof query !== "string") {
    return false;
  }

  const lowerQuery = query.toLowerCase();

  // Check for time-related keywords
  for (const keyword of REALTIME_KEYWORDS) {
    if (lowerQuery.includes(keyword.toLowerCase()) || query.includes(keyword)) {
      return true;
    }
  }

  // Check for question patterns that typically need real-time info
  const questionPatterns = [
    /what'?s\s+(the\s+)?(latest|current|new)\s+/i,
    /how\s+((is|are)\s+)?(the\s+)?(stock|price|weather)/i,
    /any\s+(news|updates?|breaking)/i,
  ];

  for (const pattern of questionPatterns) {
    if (pattern.test(query)) {
      return true;
    }
  }

  return false;
}
