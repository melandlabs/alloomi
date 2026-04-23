"use client";

/**
 * Events Panel authorization related states and handler functions
 * Centrally manages platform addition, various channel authorization form toggles and submission logic, to streamline the main panel
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { GoogleAuthSubmission } from "@/components/google-auth";
import type { OutlookAuthSubmission } from "@/components/outlook-auth";
import type { MessengerAuthSubmission } from "@/components/messenger-auth-form";
import type { WhatsAppUserInfo } from "@/components/whatsapp-auth";
import { createIntegrationAccount } from "@/lib/integrations/client";
import { useIntegrations } from "@/hooks/use-integrations";
import type { IntegrationId } from "@/hooks/use-integrations";

/** Authorization Hook returns: modal states, setters, and various channel submission callbacks */
export function useEventsPanelAuth() {
  const router = useRouter();
  const { mutate } = useIntegrations();

  const [showTelegramTokenForm, setShowTelegramTokenForm] = useState(false);
  const [isAddPlatformDialogOpen, setIsAddPlatformDialogOpen] = useState(false);
  const [linkingPlatform, setLinkingPlatform] = useState<IntegrationId | null>(
    null,
  );
  const [isGoogleAuthFormOpen, setIsGoogleAuthFormOpen] = useState(false);
  const [isWhatsAppAuthFormOpen, setIsWhatsAppAuthFormOpen] = useState(false);
  const [isOutlookAuthFormOpen, setIsOutlookAuthFormOpen] = useState(false);
  const [isMessengerAuthFormOpen, setIsMessengerAuthFormOpen] = useState(false);
  const [isIMessageAuthFormOpen, setIsIMessageAuthFormOpen] = useState(false);
  const [isTabsDialogOpen, setIsTabsDialogOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const showTelegramTokenFormHandler = useCallback(() => {
    setShowTelegramTokenForm(true);
  }, []);

  const handleGoogleSubmit = useCallback(
    async ({ email, appPassword, name }: GoogleAuthSubmission) => {
      const account = await createIntegrationAccount({
        platform: "gmail",
        externalId: email,
        displayName: name ?? email,
        credentials: { email, appPassword },
        metadata: { email, name: name ?? email },
        bot: {
          name: `Gmail · ${name ?? email}`,
          description: "Automatically created through Gmail authorization",
          adapter: "gmail",
          enable: true,
        },
      });
      router.refresh();
      await mutate();
      setIsGoogleAuthFormOpen(false);
    },
    [router, mutate],
  );

  const handleOutlookSubmit = useCallback(
    async ({ email, appPassword, name }: OutlookAuthSubmission) => {
      try {
        const account = await createIntegrationAccount({
          platform: "outlook",
          externalId: email,
          displayName: name ?? email,
          credentials: { email, appPassword },
          metadata: { email, name: name ?? email },
          bot: {
            name: `Outlook · ${name ?? email}`,
            description: "Automatically created through Outlook authorization",
            adapter: "outlook",
            enable: true,
            adapterConfig: {
              IMAP_HOST: "outlook.office365.com",
              IMAP_PORT: 993,
              SMTP_HOST: "smtp.office365.com",
              SMTP_PORT: 587,
            },
          },
        });
        router.refresh();
        await mutate();
      } finally {
        setIsOutlookAuthFormOpen(false);
      }
    },
    [router, mutate],
  );

  const handleWhatsAppSuccess = useCallback(
    async (sessionKey: string, user: WhatsAppUserInfo) => {
      await createIntegrationAccount({
        platform: "whatsapp",
        externalId: user.wid ?? sessionKey,
        displayName:
          user.pushName ?? user.formattedNumber ?? user.wid ?? "WhatsApp",
        credentials: { sessionKey },
        metadata: {
          wid: user.wid,
          pushName: user.pushName ?? null,
          formattedNumber: user.formattedNumber ?? null,
        },
        bot: {
          name: `WhatsApp · ${user.pushName ?? user.formattedNumber ?? user.wid ?? sessionKey}`,
          description: "Automatically created through WhatsApp authorization",
          adapter: "whatsapp",
          enable: true,
        },
      });
      router.refresh();
      await mutate();
      setIsWhatsAppAuthFormOpen(false);
    },
    [router, mutate],
  );

  const handleMessengerSubmit = useCallback(
    async ({
      pageId,
      pageAccessToken,
      pageName,
      appId,
      appSecret,
      verifyToken,
    }: MessengerAuthSubmission) => {
      const account = await createIntegrationAccount({
        platform: "facebook_messenger",
        externalId: pageId,
        displayName: pageName ?? `Messenger · ${pageId}`,
        credentials: {
          pageId,
          pageAccessToken,
          pageName,
          appId,
          appSecret,
          verifyToken,
        },
        metadata: {
          pageId,
          pageName: pageName ?? null,
          appId: appId ?? null,
          appSecret: appSecret ?? null,
          verifyToken: verifyToken ?? null,
        },
        bot: {
          name: `Messenger · ${pageName ?? pageId}`,
          description:
            "Automatically created through Facebook Messenger authorization",
          adapter: "facebook_messenger",
          adapterConfig: { pageId },
          enable: true,
        },
      });
      router.refresh();
      await mutate();
      setIsMessengerAuthFormOpen(false);
    },
    [router, mutate],
  );

  return {
    showTelegramTokenForm,
    setShowTelegramTokenForm,
    showTelegramTokenFormHandler,
    isAddPlatformDialogOpen,
    setIsAddPlatformDialogOpen,
    linkingPlatform,
    setLinkingPlatform,
    isGoogleAuthFormOpen,
    setIsGoogleAuthFormOpen,
    isWhatsAppAuthFormOpen,
    setIsWhatsAppAuthFormOpen,
    isOutlookAuthFormOpen,
    setIsOutlookAuthFormOpen,
    isMessengerAuthFormOpen,
    setIsMessengerAuthFormOpen,
    isIMessageAuthFormOpen,
    setIsIMessageAuthFormOpen,
    isTabsDialogOpen,
    setIsTabsDialogOpen,
    isMoreMenuOpen,
    setIsMoreMenuOpen,
    handleGoogleSubmit,
    handleOutlookSubmit,
    handleWhatsAppSuccess,
    handleMessengerSubmit,
    // Form components and props for Dialogs and other child components can be extended here as needed
  };
}
