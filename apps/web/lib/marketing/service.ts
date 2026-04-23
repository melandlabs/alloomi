import { siteMetadata } from "@/lib/marketing/seo";
import { getApplicationBaseUrl } from "@/lib/env";
import { captureServerEvent } from "@/lib/analytics/posthog/posthog-server";
import { sendViaSendGrid } from "@/lib/integrations/email/sendgrid";
import {
  ensureUserEmailPreferences,
  getUserById,
  hasMarketingEmailBeenSent,
  recordMarketingEmailLog,
  updateUserEmailPreferences,
} from "@/lib/db/queries";
import {
  MARKETING_EMAIL_TEMPLATES,
  getMarketingTemplateById,
  resolveDefaultLinks,
} from "./templates";
import { renderMarketingEmail } from "./render";
import { isEmailTemplateEnabled } from "./feature-flags";
import type {
  MarketingEmailTemplateDefinition,
  MarketingLinkMap,
  MarketingUserSnapshot,
  TemplateBuildContext,
} from "./types";

function deriveFirstName(email: string) {
  const prefix = email.split("@")[0] ?? "";
  if (!prefix) {
    return null;
  }

  const sanitized = prefix
    .split(/[.\-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return sanitized || null;
}

function resolveSupportChannels(unsubscribeToken: string) {
  const appUrl = getApplicationBaseUrl();
  const defaultLinks = resolveDefaultLinks();
  const supportEmail =
    process.env.MARKETING_SUPPORT_EMAIL || siteMetadata.contactEmail;
  const supportUrl = process.env.MARKETING_SUPPORT_URL || defaultLinks.support;
  const feedbackUrl =
    process.env.MARKETING_FEEDBACK_URL || defaultLinks.feedback;
  const unsubscribeUrl = `${appUrl.replace(/\/$/, "")}/marketing/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

  return {
    supportEmail,
    supportUrl,
    feedbackUrl,
    unsubscribeUrl,
  };
}

export type SendLifecycleEmailOptions = {
  templateId: string;
  userId: string;
  email?: string;
  dedupeKeyOverride?: string;
  forceSend?: boolean;
  linkOverrides?: Partial<MarketingLinkMap>;
  snapshot?: MarketingUserSnapshot;
};

export async function sendLifecycleEmail(
  options: SendLifecycleEmailOptions,
): Promise<{
  delivered: boolean;
  reason?: string;
  template?: MarketingEmailTemplateDefinition;
}> {
  const template = getMarketingTemplateById(options.templateId);

  if (!template) {
    throw new Error(`Unknown marketing email template: ${options.templateId}`);
  }

  const userRecord = await getUserById(options.userId);
  if (!userRecord?.email && !options.email) {
    throw new Error(
      `User ${options.userId} does not have an email configured for marketing.`,
    );
  }

  const recipientEmail = options.email ?? userRecord?.email ?? "";
  const preferences = await ensureUserEmailPreferences(options.userId);
  const support = resolveSupportChannels(preferences.unsubscribeToken);
  const links = resolveDefaultLinks(options.linkOverrides);
  links.support = support.supportUrl;
  links.feedback = support.feedbackUrl;

  const firstName =
    userRecord?.email?.includes("@") && !userRecord.email.startsWith("guest")
      ? deriveFirstName(userRecord.email)
      : null;

  const context: TemplateBuildContext = {
    user: {
      id: options.userId,
      email: recipientEmail,
      firstName,
      displayName: firstName,
    },
    support,
    links,
    snapshot: options.snapshot,
  };

  const dedupeKey =
    options.dedupeKeyOverride ??
    (typeof template.dedupeKey === "function"
      ? template.dedupeKey(context)
      : (template.dedupeKey ?? template.id));

  if (!isEmailTemplateEnabled(template.id) && !options.forceSend) {
    await recordMarketingEmailLog({
      userId: options.userId,
      email: recipientEmail,
      stage: template.stage,
      template: template.id,
      dedupeKey,
      status: "skipped",
      metadata: { reason: "feature_flag_disabled" },
    });

    return { delivered: false, reason: "feature_flag_disabled", template };
  }

  if (preferences.marketingOptIn === false && !options.forceSend) {
    await recordMarketingEmailLog({
      userId: options.userId,
      email: recipientEmail,
      stage: template.stage,
      template: template.id,
      dedupeKey,
      status: "skipped",
      metadata: { reason: "opt_out" },
    });

    return { delivered: false, reason: "user_opted_out", template };
  }

  if (!options.forceSend) {
    const alreadySent = await hasMarketingEmailBeenSent({
      userId: options.userId,
      dedupeKey,
    });

    if (alreadySent) {
      return { delivered: false, reason: "dedupe", template };
    }
  }

  const rendered = renderMarketingEmail(template, context);

  const sendResult = await sendViaSendGrid({
    to: recipientEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    categories: ["marketing", template.stage, template.id],
    customArgs: {
      templateId: template.id,
      stage: template.stage,
      userId: options.userId,
    },
  });

  const status = sendResult.delivered ? "sent" : "failed";

  await recordMarketingEmailLog({
    userId: options.userId,
    email: recipientEmail,
    stage: template.stage,
    template: template.id,
    dedupeKey,
    status,
    error: sendResult.error,
    metadata: {
      responseId: sendResult.responseId,
      forceSend: options.forceSend ?? false,
    },
  });

  if (sendResult.delivered) {
    await updateUserEmailPreferences(options.userId, {
      lastEmailSentAt: new Date(),
    });
  }

  await captureServerEvent({
    distinctId: options.userId,
    event: "marketing_email_sent",
    properties: {
      templateId: template.id,
      stage: template.stage,
      delivered: sendResult.delivered,
      dedupeKey,
      error: sendResult.error ?? null,
    },
  });

  return {
    delivered: sendResult.delivered,
    reason: sendResult.error,
    template,
  };
}

export function listMarketingTemplates() {
  return MARKETING_EMAIL_TEMPLATES;
}
