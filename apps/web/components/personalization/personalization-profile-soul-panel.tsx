"use client";

import { useTranslation } from "react-i18next";
import { PersonalizationSwrBoundary } from "./personalization-swr-boundary";
import { PersonalizationRoleSettings } from "./personalization-role-settings";

/**
 * "About me" page: merged identity/description and interests (people + topics).
 * Linked from settings sub-nav; replaces the two removed personalization dialog tabs.
 * Uses compact variants (no duplicate intro, no inner padding/mid divider) so the scroll region controls spacing.
 */
export function PersonalizationProfileSoulPanel() {
  const { t } = useTranslation();

  return (
    <PersonalizationSwrBoundary>
      <div className="flex flex-col gap-8">
        <div className="space-y-6">
          <p className="px-0 pb-0 text-base font-semibold text-foreground-secondary">
            {t("settings.profileTitle", "Profile")}
          </p>
          <PersonalizationRoleSettings open hideIntro />
        </div>
      </div>
    </PersonalizationSwrBoundary>
  );
}
