export type NormalizedOption = {
  key: string;
  label: string;
  priorities?: string[];
};

type OptionGroup = {
  key: string;
  aliases: string[];
  labelPriority: string[];
};

const IMPORTANCE_GROUPS: OptionGroup[] = [
  {
    key: "high",
    aliases: ["high", "important"],
    labelPriority: ["High", "Important"],
  },
  {
    key: "medium",
    aliases: ["medium", "general"],
    labelPriority: ["Medium", "General"],
  },
  {
    key: "low",
    aliases: ["low", "not important"],
    labelPriority: ["Low", "Not Important"],
  },
];

const URGENCY_GROUPS: OptionGroup[] = [
  {
    key: "immediate",
    aliases: ["immediate", "urgent", "asap", "as soon as possible"],
    labelPriority: ["Immediate", "As soon as possible"],
  },
  {
    key: "within_24h",
    aliases: ["within 24 hours", "24h", "24 hours"],
    labelPriority: ["Within 24 hours"],
  },
  {
    key: "not_urgent",
    aliases: ["not urgent"],
    labelPriority: ["Not urgent"],
  },
];

const PLATFORM_LABELS: Record<string, string> = {
  slack: "Slack",
  discord: "Discord",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  gmail: "Gmail",
  outlook: "Outlook",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  twitter: "X",
  google_calendar: "Google Calendar",
  outlook_calendar: "Outlook Calendar",
  teams: "Microsoft Teams",
  facebook_messenger: "Facebook Messenger",
  google_drive: "Google Drive",
  google_docs: "Google Docs",
  notion: "Notion",
  hubspot: "HubSpot",
  rss: "RSS",
  imessage: "iMessage",
};

function sanitizeValue(input: string | null | undefined) {
  return String(input ?? "").trim();
}

function selectPreferredLabel(
  current: string,
  candidate: string,
  priorities: string[],
) {
  if (!current) return candidate;
  if (priorities.length === 0) return current;

  const normalize = (value: string) => value.toLowerCase();
  const currentIndex = priorities.findIndex(
    (item) => normalize(item) === normalize(current),
  );
  const candidateIndex = priorities.findIndex(
    (item) => normalize(item) === normalize(candidate),
  );

  if (candidateIndex === -1) return current;
  if (currentIndex === -1) return candidate;
  return candidateIndex < currentIndex ? candidate : current;
}

function normalizeWithGroups(
  value: string | null | undefined,
  groups: OptionGroup[],
  formatLabel?: (value: string) => string,
): NormalizedOption | null {
  const sanitized = sanitizeValue(value);
  if (!sanitized) return null;

  const formatted = formatLabel ? formatLabel(sanitized) : sanitized;
  const lower = sanitized.toLowerCase();
  const group = groups.find((entry) =>
    entry.aliases.some((alias) => alias.toLowerCase() === lower),
  );

  if (!group) {
    return {
      key: lower,
      label: formatted,
    };
  }

  return {
    key: group.key,
    label: formatted,
    priorities: group.labelPriority,
  };
}

function capitalizeWord(value: string) {
  if (/^[a-z]/.test(value)) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return value;
}

function humanizePlatform(value: string) {
  const replaced = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!replaced) return value;
  return replaced
    .split(" ")
    .map((word) => (word ? capitalizeWord(word) : ""))
    .join(" ");
}

export function normalizeImportanceOption(
  value: string | null | undefined,
): NormalizedOption | null {
  return normalizeWithGroups(value, IMPORTANCE_GROUPS, capitalizeWord);
}

export function normalizeUrgencyOption(
  value: string | null | undefined,
): NormalizedOption | null {
  return normalizeWithGroups(value, URGENCY_GROUPS, capitalizeWord);
}

export function normalizePlatformOption(
  value: string | null | undefined,
): NormalizedOption | null {
  const sanitized = sanitizeValue(value);
  if (!sanitized) return null;

  const slug = sanitized.toLowerCase().replace(/[\s-]+/g, "_");
  const key = slug.replace(/[^a-z0-9]/g, "");
  if (!key) return null;

  const preferred = PLATFORM_LABELS[slug];
  const humanized = humanizePlatform(sanitized);
  const label = preferred ?? humanized;
  const priorities = preferred
    ? [preferred, humanized, sanitized]
    : [humanized, sanitized];

  return {
    key,
    label,
    priorities,
  };
}

export function normalizeBasicOption(
  value: string | null | undefined,
): NormalizedOption | null {
  const sanitized = sanitizeValue(value);
  if (!sanitized) return null;
  return {
    key: sanitized.toLowerCase(),
    label: sanitized,
  };
}

export function dedupeOptions(
  values: Array<string | null | undefined>,
  normalizer: (value: string | null | undefined) => NormalizedOption | null,
) {
  const normalizedMap = new Map<
    string,
    { label: string; priorities: string[] }
  >();

  for (const value of values) {
    const normalized = normalizer(value);
    if (!normalized) continue;

    const existing = normalizedMap.get(normalized.key);
    if (!existing) {
      normalizedMap.set(normalized.key, {
        label: normalized.label,
        priorities: normalized.priorities ?? [],
      });
      continue;
    }

    const priorities =
      existing.priorities.length > 0
        ? existing.priorities
        : (normalized.priorities ?? []);

    const bestLabel =
      priorities.length > 0
        ? selectPreferredLabel(existing.label, normalized.label, priorities)
        : existing.label;

    normalizedMap.set(normalized.key, {
      label: bestLabel,
      priorities,
    });
  }

  return Array.from(normalizedMap.values())
    .map((entry) => entry.label)
    .sort((a, b) => a.localeCompare(b));
}

export function normalizePlatformKey(value: string | null | undefined) {
  return normalizePlatformOption(value)?.key ?? "";
}
