"use client";

import {
  capturePosthogEvent,
  getPosthogClient,
  initPosthog,
  isPosthogEnabled,
} from "./posthog";

const SUMMARY_REFRESH_EVENT = "summary_refresh";
const TOUR_SUMMARY_START_EVENT = "tour_summary_start";
const TOUR_SUMMARY_FINISH_EVENT = "tour_summary_finish";
const TOUR_SUMMARY_SKIP_EVENT = "tour_summary_skip";

export const PosthogEvents = {
  // ========================================
  // Authentication & Account
  // ========================================
  authLoginSuccess: "auth_login_success",
  authLoginFailure: "auth_login_failure",
  authLogout: "auth_logout",
  authLoginPageView: "auth_login_page_view",
  accountAuthorizeStart: "account_authorization_start",
  accountAuthorizeSuccess: "account_authorization_success",
  accountAuthorizeFailure: "account_authorization_failure",
  accountDisconnect: "account_disconnect",

  // ========================================
  // Authorization Modal Lifecycle
  // ========================================
  accountAuthModalOpened: "account_auth_modal_opened",
  accountAuthModalClosed: "account_auth_modal_closed",
  accountAuthModalCancelled: "account_auth_modal_cancelled",

  // ========================================
  // Authorization Flow Steps
  // ========================================
  accountAuthStepViewed: "account_auth_step_viewed",
  accountAuthStepCompleted: "account_auth_step_completed",
  accountAuthStepSkipped: "account_auth_step_skipped",
  accountAuthStepDuration: "account_auth_step_duration",

  // ========================================
  // QR Code Login Events
  // ========================================
  accountAuthQrGenerated: "account_auth_qr_generated",
  accountAuthQrScanned: "account_auth_qr_scanned",
  accountAuthQrExpired: "account_auth_qr_expired",
  accountAuthQrRefreshed: "account_auth_qr_refreshed",

  // ========================================
  // User Interaction Events
  // ========================================
  accountAuthMethodSwitched: "account_auth_method_switched",
  accountAuthHelpClicked: "account_auth_help_clicked",
  accountAuthRegenerateClicked: "account_auth_regenerate_clicked",

  // ========================================
  // User Experience Metrics
  // ========================================
  accountAuthTimeToComplete: "account_auth_time_to_complete",

  // ========================================
  // Onboarding
  // ========================================
  onboardingStarted: "onboarding_started",
  onboardingStepViewed: "onboarding_step_viewed",
  onboardingStepCompleted: "onboarding_step_completed",
  onboardingCompleted: "onboarding_completed",
  onboardingSkipped: "onboarding_skipped",
  onboardingFailed: "onboarding_failed",

  // ========================================
  // User Activation Milestones
  // ========================================
  userFirstChatCreated: "user_first_chat_created",
  userFirstMessageSent: "user_first_message_sent",
  userFirstPlatformIntegrated: "user_first_platform_integrated",
  userFirstInsightGenerated: "user_first_insight_generated",
  userFirstFileUploaded: "user_first_file_uploaded",
  userActivated: "user_activated", // Triggers when user completes first key action

  // ========================================
  // Chat & Messages
  // ========================================
  agentPromptSubmitted: "agent_prompt_submitted",
  messageReplySent: "message_reply_sent",
  messageReplyFailed: "message_reply_failed",
  chatCreated: "chat_created",
  chatDeleted: "chat_deleted",
  chatShared: "chat_shared",

  // ========================================
  // Insights & Summaries
  // ========================================
  insightRefresh: SUMMARY_REFRESH_EVENT,
  summaryRefresh: SUMMARY_REFRESH_EVENT,
  insightGenerated: "insight_generated",
  insightViewed: "insight_viewed",
  insightShared: "insight_shared",
  insightFeedbackGiven: "insight_feedback_given",

  // ========================================
  // Platform Integrations
  // ========================================
  integrationStarted: "integration_started",
  integrationCompleted: "integration_completed",
  integrationFailed: "integration_failed",
  integrationRemoved: "integration_removed",

  // ========================================
  // Files & Assets
  // ========================================
  fileUploaded: "file_uploaded",
  fileViewed: "file_viewed",
  fileDeleted: "file_deleted",
  fileShared: "file_shared",

  // ========================================
  // People & Relationships
  // ========================================
  peopleViewed: "people_viewed",
  personAdded: "person_added",
  personMerged: "person_merged",
  relationshipCreated: "relationship_created",

  // ========================================
  // Tasks & Todos
  // ========================================
  taskCreated: "task_created",
  taskCompleted: "task_completed",
  taskDeleted: "task_deleted",

  // ========================================
  // Tours & Guides
  // ========================================
  tourGuestStart: "tour_guest_start",
  tourGuestFinish: "tour_guest_finish",
  tourGuestSkip: "tour_guest_skip",
  tourInsightStart: TOUR_SUMMARY_START_EVENT,
  tourInsightFinish: TOUR_SUMMARY_FINISH_EVENT,
  tourInsightSkip: TOUR_SUMMARY_SKIP_EVENT,
  tourSummaryStart: TOUR_SUMMARY_START_EVENT,
  tourSummaryFinish: TOUR_SUMMARY_FINISH_EVENT,
  tourSummarySkip: TOUR_SUMMARY_SKIP_EVENT,

  // ========================================
  // Monetization
  // ========================================
  upgradeCheckoutStart: "upgrade_checkout_start",
  upgradeCheckoutCompleted: "upgrade_checkout_completed",
  upgradeCheckoutFailed: "upgrade_checkout_failed",
  affiliateApply: "affiliate_apply",
  couponClaimed: "coupon_claimed",

  // ========================================
  // Landing Page Events
  // ========================================
  // Funnel Step 1: Landing Page View
  landingPageViewed: "landing_page_viewed",

  // Funnel Step 2: CTA Click
  landingCtaClicked: "landing_cta_clicked",

  // Funnel Step 3: Modal Opened
  landingModalOpened: "landing_modal_opened",

  // Funnel Step 4: Discord Join
  landingDiscordJoinClicked: "landing_discord_join_clicked",
  landingDiscordJoined: "landing_discord_joined",

  // Funnel Step 5: Registration Form Viewed
  landingRegistrationFormViewed: "landing_registration_form_viewed",

  // Funnel Step 6: Registration Submitted
  landingRegistrationSubmitted: "landing_registration_submitted",
  landingRegistrationSuccess: "landing_registration_success",
  landingRegistrationFailed: "landing_registration_failed",
  landingFormValidationFailed: "landing_form_validation_failed",

  // Other Events
  landingModalClosed: "landing_modal_closed",
  landingSectionViewed: "landing_section_viewed",
  landingScrollDepth: "landing_scroll_depth",
  landingElementClicked: "landing_element_clicked",

  // ========================================
  // Session & Retention
  // ========================================
  sessionStarted: "session_started",
  sessionEnded: "session_ended",
  pageView: "page_view",
  featureUsed: "feature_used",

  // ========================================
  // Page Engagement & Time Tracking
  // ========================================
  pageTimeHeartbeat: "page_time_heartbeat",
  pageLeave: "page_leave",
} as const;

type PosthogEventName = (typeof PosthogEvents)[keyof typeof PosthogEvents];

type EventProperties = Record<string, unknown>;

export function trackEvent(
  event: PosthogEventName,
  properties?: EventProperties,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!isPosthogEnabled()) {
    return;
  }

  initPosthog();
  capturePosthogEvent(event, properties);
}

export function getPosthog() {
  return getPosthogClient();
}
