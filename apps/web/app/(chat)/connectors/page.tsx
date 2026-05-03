"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PersonalizationLinkedAccounts } from "@/components/personalization/personalization-linked-accounts";
import { normalizeIntegrationPlatform } from "@/lib/integrations/connector-target";
import type { IntegrationId } from "@/hooks/use-integrations";
import "../../../i18n";

/**
 * Standalone Connectors page: manage linked platforms and RSS (moved out of Personalization dialog).
 * URL `?addPlatform=true` opens the add-platform flow via PlatformIntegrations.
 * URL `?platform=xxx` pre-selects a specific platform for connection.
 */
export default function ConnectorsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAddConnectorDialogOpen, setIsAddConnectorDialogOpen] =
    useState(false);
  const [pendingLinkingPlatform, setPendingLinkingPlatform] =
    useState<IntegrationId | null>(null);
  const addPanelTab = useMemo<"apps" | "rss">(() => {
    return searchParams.get("addPanelTab") === "rss" ? "rss" : "apps";
  }, [searchParams]);

  /**
   * Auto-open add-connector dialog for deep links.
   */
  useEffect(() => {
    if (searchParams.get("addPlatform") !== "true") return;
    setPendingLinkingPlatform(
      normalizeIntegrationPlatform(searchParams.get("platform")),
    );
    setIsAddConnectorDialogOpen(true);
    router.replace("/connectors", { scroll: false });
  }, [router, searchParams]);

  const handleAddConnectorDialogOpenChange = (open: boolean) => {
    setIsAddConnectorDialogOpen(open);
    if (!open) setPendingLinkingPlatform(null);
  };

  return (
    <div className="flex h-full min-h-0 min-h-[60vh] flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <PersonalizationLinkedAccounts
          open={true}
          isAddConnectorDialogOpen={isAddConnectorDialogOpen}
          onAddConnectorDialogOpenChange={handleAddConnectorDialogOpenChange}
          initialAddPanelTab={addPanelTab}
          linkingPlatform={pendingLinkingPlatform}
        />
      </div>
    </div>
  );
}
