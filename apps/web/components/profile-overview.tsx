"use client";

import { useState, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

// bundle-dynamic-imports: Dynamically import dialog components to reduce initial JS bundle size
const PlansDialogLazy = lazy(() =>
  import("@/components/plans-dialog").then((mod) => ({
    default: mod.PlansDialog,
  })),
);

const CreditsTopUpDialogLazy = lazy(() =>
  import("@/components/credits-topup-dialog").then((mod) => ({
    default: mod.CreditsTopUpDialog,
  })),
);

const UsageDialogLazy = lazy(() =>
  import("@/components/usage-dialog").then((mod) => ({
    default: mod.UsageContentCard,
  })),
);

/**
 * Profile settings overview page content
 * Only displays subscription info card (user nickname, email, tier inside card);
 * Account edit and logout are on the right side of the header
 */
export function ProfileOverview() {
  const { t } = useTranslation();
  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const [showPlansDialog, setShowPlansDialog] = useState(false);

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <div className="[&>div]:h-full"></div>
      </div>
      <Suspense fallback={null}>
        <UsageDialogLazy />
      </Suspense>

      <Suspense fallback={null}>
        <CreditsTopUpDialogLazy
          open={showTopUpDialog}
          onOpenChange={setShowTopUpDialog}
        />
      </Suspense>
      <Suspense fallback={null}>
        <PlansDialogLazy
          open={showPlansDialog}
          onOpenChange={setShowPlansDialog}
        />
      </Suspense>
    </div>
  );
}
