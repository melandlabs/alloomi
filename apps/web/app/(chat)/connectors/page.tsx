"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PersonalizationLinkedAccounts } from "@/components/personalization/personalization-linked-accounts";
import { useTranslation } from "react-i18next";
import "../../../i18n";

/**
 * Standalone Connectors page: manage linked platforms and RSS (moved out of Personalization dialog).
 * URL `?addPlatform=true` opens the add-platform flow via PlatformIntegrations.
 */
export default function ConnectorsPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [isAddConnectorDialogOpen, setIsAddConnectorDialogOpen] =
    useState(false);
  const addPanelTab = useMemo<"apps" | "rss">(() => {
    return searchParams.get("addPanelTab") === "rss" ? "rss" : "apps";
  }, [searchParams]);

  /**
   * Auto-open add-connector dialog for deep links.
   */
  useEffect(() => {
    if (searchParams.get("addPlatform") === "true") {
      setIsAddConnectorDialogOpen(true);
    }
  }, [searchParams]);

  return (
    <div className="flex h-full min-h-0 min-h-[60vh] flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <PersonalizationLinkedAccounts
          open={true}
          isAddConnectorDialogOpen={isAddConnectorDialogOpen}
          onAddConnectorDialogOpenChange={setIsAddConnectorDialogOpen}
          initialAddPanelTab={addPanelTab}
        />
      </div>
    </div>
  );
}
