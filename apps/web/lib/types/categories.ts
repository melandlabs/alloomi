import type { DBUserCategory } from "@/lib/db/schema";

/**
 * User category data structure
 */
export type UserCategory = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Preset category template structure
 */
export type CategoryTemplate = {
  name: string;
  description: string;
};

/**
 * Request body for creating a category
 */
export type CategoryCreatePayload = {
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  templateName?: string; // Template name if creating from a template
};

/**
 * Request body for updating a category
 */
export type CategoryUpdatePayload = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

/**
 * Request body for batch updating category sort order
 */
export type CategorySortOrderPayload = {
  categories: Array<{ id: string; sortOrder: number }>;
};

/**
 * Default category templates for new users
 */
export const DEFAULT_CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    name: "News",
    description:
      "Industry news, political news, company updates. Stay on top of what matters.",
  },
  {
    name: "Meetings",
    description:
      "Formal meetings, workshops, internal and online meetings. Never miss an important meeting.",
  },
  {
    name: "Funding",
    description:
      "Funding rounds, investments, fundraising updates. Track key progress on financing.",
  },
  {
    name: "R&D",
    description:
      "R&D milestones, technical breakthroughs, product updates, prototype testing. Track R&D and product progress.",
  },
  {
    name: "Partnerships",
    description:
      "Strategic partnerships, joint ventures, agreements, alliances. Key updates on external collaboration.",
  },
  {
    name: "User Growth",
    description:
      "User acquisition, engagement, retention, market penetration. Capture important changes in user growth.",
  },
  {
    name: "Branding",
    description: "Brand campaigns, marketing content, social media presence.",
  },
];

/**
 * Get all default category templates
 */
export function getDefaultCategoryTemplates(): CategoryTemplate[] {
  return DEFAULT_CATEGORY_TEMPLATES;
}

/**
 * Get a default category template by name
 */
export function getDefaultCategoryTemplateByName(
  name: string,
): CategoryTemplate | undefined {
  return DEFAULT_CATEGORY_TEMPLATES.find(
    (t) => t.name.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * Convert database model to API response format
 */
export function dbCategoryToApiCategory(
  dbCategory: DBUserCategory,
): UserCategory {
  return {
    id: dbCategory.id,
    userId: dbCategory.userId,
    name: dbCategory.name,
    description: dbCategory.description,
    isActive: dbCategory.isActive,
    sortOrder: dbCategory.sortOrder,
    createdAt: dbCategory.createdAt,
    updatedAt: dbCategory.updatedAt,
  };
}
