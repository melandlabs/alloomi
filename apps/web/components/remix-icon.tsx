"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Mapping from Material icon names to Remix Icon class names (only line/fill suffix differs).
 * See https://remixicon.com
 */
const MATERIAL_TO_REMIX: Record<string, { line: string; fill: string }> = {
  track_changes: { line: "ri-dashboard-line", fill: "ri-dashboard-fill" },
  timer: { line: "ri-timer-line", fill: "ri-timer-fill" },
  folder_open: { line: "ri-file-2-line", fill: "ri-file-2-fill" },
  search: { line: "ri-search-line", fill: "ri-search-fill" },
  inbox: { line: "ri-inbox-line", fill: "ri-inbox-fill" },
  tune: { line: "ri-settings-3-line", fill: "ri-settings-3-fill" },
  support_agent: {
    line: "ri-customer-service-2-line",
    fill: "ri-customer-service-2-fill",
  },
  chat: { line: "ri-chat-smile-line", fill: "ri-chat-smile-fill" },
  /** Group "Chat" conversation */
  chat_1: { line: "ri-chat-1-line", fill: "ri-chat-1-fill" },
  /** Character tab */
  theater_mask: {
    line: "ri-character-recognition-line",
    fill: "ri-character-recognition-fill",
  },
  /** Group "Event" event */
  focus: { line: "ri-focus-line", fill: "ri-focus-fill" },
  fact_check: {
    line: "ri-checkbox-multiple-line",
    fill: "ri-checkbox-multiple-fill",
  },
  folder_special: {
    line: "ri-folder-star-line",
    fill: "ri-folder-star-fill",
  },
  contacts: { line: "ri-contacts-line", fill: "ri-contacts-fill" },
  /** Personalization "My Following" tab */
  heart_add_2: {
    line: "ri-heart-add-2-line",
    fill: "ri-heart-add-2-fill",
  },
  inbox_text: { line: "ri-mail-line", fill: "ri-mail-fill" },
  file_present: { line: "ri-file-line", fill: "ri-file-fill" },
  category: { line: "ri-apps-line", fill: "ri-apps-fill" },
  apps: { line: "ri-apps-line", fill: "ri-apps-fill" },
  auto_awesome_motion: {
    line: "ri-magic-line",
    fill: "ri-magic-fill",
  },
  /** Personalization */
  brain_ai_3: {
    line: "ri-brain-ai-3-line",
    fill: "ri-brain-ai-3-fill",
  },
  /** Today/Focus */
  lightbulb_ai: {
    line: "ri-lightbulb-ai-line",
    fill: "ri-lightbulb-ai-fill",
  },
  /** Skills */
  apps_2_ai: {
    line: "ri-apps-2-ai-line",
    fill: "ri-apps-2-ai-fill",
  },
  /** Events / Tracking events (left sidebar) */
  radar: { line: "ri-radar-line", fill: "ri-radar-fill" },
  /** Library Stuff Tab: folder */
  folders_line: { line: "ri-folders-line", fill: "ri-folders-fill" },
  /** Library Chat Vault Tab */
  folder_4_line: { line: "ri-folder-4-line", fill: "ri-folder-4-fill" },
  /** Library original stack icon kept for compatibility */
  stack_overflow: {
    line: "ri-stack-overflow-line",
    fill: "ri-stack-overflow-fill",
  },
  /** Source info / Message panel etc. general */
  close: { line: "ri-close-line", fill: "ri-close-fill" },
  checkbox_circle: {
    line: "ri-checkbox-circle-line",
    fill: "ri-checkbox-circle-fill",
  },
  // Square checkbox (for batch selection)
  checkbox: {
    line: "ri-checkbox-line",
    fill: "ri-checkbox-fill",
  },
  checkbox_square: {
    line: "ri-checkbox-blank-line",
    fill: "ri-checkbox-blank-fill",
  },
  /** Checkbox partial selection state (indeterminate) */
  checkbox_indeterminate: {
    line: "ri-checkbox-indeterminate-line",
    fill: "ri-checkbox-indeterminate-fill",
  },
  arrow_down_s: {
    line: "ri-arrow-down-s-line",
    fill: "ri-arrow-down-s-fill",
  },
  arrow_down: {
    line: "ri-arrow-down-line",
    fill: "ri-arrow-down-fill",
  },
  arrow_right_s: {
    line: "ri-arrow-right-s-line",
    fill: "ri-arrow-right-s-fill",
  },
  /** Alias for arrow_right_s (used in calendar page) */
  "arrow-right-s-line": {
    line: "ri-arrow-right-s-line",
    fill: "ri-arrow-right-s-fill",
  },
  filter: { line: "ri-filter-line", fill: "ri-filter-fill" },
  /** Link and unbind (use Remix -m series for compatibility with design class names) */
  link: { line: "ri-link-m", fill: "ri-link-m" },
  link_unlink: {
    line: "ri-link-unlink-m",
    fill: "ri-link-unlink-m",
  },
  expand_all: {
    line: "ri-arrow-down-double-line",
    fill: "ri-arrow-down-double-fill",
  },
  collapse_all: {
    line: "ri-arrow-up-double-line",
    fill: "ri-arrow-up-double-fill",
  },
  /** Library list/grid/loading/file */
  list: { line: "ri-list-unordered", fill: "ri-list-unordered" },
  layout_grid: { line: "ri-grid-line", fill: "ri-grid-fill" },
  loader_2: { line: "ri-loader-4-line", fill: "ri-loader-4-line" },
  file_text: { line: "ri-file-text-line", fill: "ri-file-text-fill" },
  layers: { line: "ri-stack-line", fill: "ri-stack-fill" },
  /** Preview / View */
  eye: { line: "ri-eye-line", fill: "ri-eye-fill" },
  /** Filter/type options: slideshow, website, document, image, audio, spreadsheet, other */
  slideshow: { line: "ri-slideshow-2-line", fill: "ri-slideshow-2-fill" },
  code: { line: "ri-code-s-line", fill: "ri-code-s-fill" },
  image: { line: "ri-image-line", fill: "ri-image-fill" },
  music_2: { line: "ri-music-2-line", fill: "ri-music-2-fill" },
  table: { line: "ri-table-2-line", fill: "ri-table-2-fill" },
  /** Spreadsheet filter etc., use ri-table-2 */
  table_2: { line: "ri-table-2", fill: "ri-table-2" },
  more_2: { line: "ri-more-line", fill: "ri-more-fill" },
  /** File/download/upload/delete/help etc. (semantically corresponding to Lucide) */
  download: { line: "ri-download-line", fill: "ri-download-fill" },
  delete_bin: { line: "ri-delete-bin-line", fill: "ri-delete-bin-fill" },
  arrow_right_up: {
    line: "ri-arrow-right-up-line",
    fill: "ri-arrow-right-up-fill",
  },
  upload_cloud: { line: "ri-upload-cloud-line", fill: "ri-upload-cloud-fill" },
  question: { line: "ri-question-line", fill: "ri-question-fill" },
  /** Arrow/add/check/time/star (settings and subscription pages) */
  arrow_right: { line: "ri-arrow-right-line", fill: "ri-arrow-right-fill" },
  add: { line: "ri-add-line", fill: "ri-add-fill" },
  check: { line: "ri-check-line", fill: "ri-check-fill" },
  star: { line: "ri-star-line", fill: "ri-star-fill" },
  /** User/personal settings (semantically consistent with Lucide User) */
  user: { line: "ri-user-line", fill: "ri-user-fill" },
  /** About me / profile soul (settings sub-nav) */
  profile: { line: "ri-profile-line", fill: "ri-profile-fill" },
  /** Sidebar collapse/fold (semantically consistent with Lucide PanelLeftClose) */
  sidebar_fold: { line: "ri-sidebar-fold-line", fill: "ri-sidebar-fold-fill" },
  /** Sidebar expand (semantically consistent with Lucide PanelLeft) */
  panel_left: {
    line: "ri-sidebar-unfold-line",
    fill: "ri-sidebar-unfold-fill",
  },
  /** Agent/bot entry (semantically consistent with Lucide Bot) */
  robot_2: { line: "ri-robot-2-line", fill: "ri-robot-2-fill" },
  /** Main sidebar Agents entry */
  robot_3: { line: "ri-robot-3-line", fill: "ri-robot-3-fill" },
  /** Sidebar Board / Kanban entry (kanban) */
  kanban_view: { line: "ri-kanban-view", fill: "ri-kanban-view" },
  /** Sidebar marketplace entry */
  store_3: { line: "ri-store-3-line", fill: "ri-store-3-fill" },
  /** Coupon/gift (semantically consistent with Lucide Gift) */
  gift: { line: "ri-gift-line", fill: "ri-gift-fill" },
  /** New conversation (AI chat) */
  chat_ai: { line: "ri-chat-ai-line", fill: "ri-chat-ai-fill" },
  /** Information/tip (semantically consistent with Lucide Info) */
  info: { line: "ri-information-line", fill: "ri-information-fill" },
  /** Create skill (Skill Creator) */
  bard: { line: "ri-bard-line", fill: "ri-bard-fill" },
  /** Contact us/feedback: send, email, copy, attachment, warning, external link */
  send_plane: { line: "ri-send-plane-line", fill: "ri-send-plane-fill" },
  file_copy: { line: "ri-file-copy-line", fill: "ri-file-copy-fill" },
  attachment: { line: "ri-attachment-line", fill: "ri-attachment-fill" },
  error_warning: {
    line: "ri-error-warning-line",
    fill: "ri-error-warning-fill",
  },
  /** Insight detail sidebar: activity, info, notes, files */
  dashboard: { line: "ri-dashboard-line", fill: "ri-dashboard-fill" },
  timeline_view: { line: "ri-timeline-view", fill: "ri-timeline-view" },
  discuss: { line: "ri-discuss-line", fill: "ri-discuss-fill" },
  sticky_note: { line: "ri-sticky-note-line", fill: "ri-sticky-note-fill" },
  /** Insight detail drawer: close, back, refresh, pin, loading, Digest/Sources/Attached */
  arrow_left_s: {
    line: "ri-arrow-left-s-line",
    fill: "ri-arrow-left-s-fill",
  },
  /** Alias for arrow_left_s (used in calendar page) */
  "arrow-left-s-line": {
    line: "ri-arrow-left-s-line",
    fill: "ri-arrow-left-s-fill",
  },
  refresh: { line: "ri-refresh-line", fill: "ri-refresh-fill" },
  pushpin: { line: "ri-pushpin-line", fill: "ri-pushpin-fill" },
  unpin: { line: "ri-unpin-line", fill: "ri-unpin-fill" },
  /** Insight detail: AI interpretation / Update history (GitBranch) */
  git_branch: { line: "ri-git-branch-line", fill: "ri-git-branch-fill" },
  /** Insight detail: warning / workflow etc. (AlertTriangle, Workflow) */
  alert_triangle: {
    line: "ri-error-warning-line",
    fill: "ri-error-warning-fill",
  },
  workflow: { line: "ri-flow-chart-line", fill: "ri-flow-chart-fill" },
  /** AI interpretation / Magic (WandSparkles) */
  wand_sparkles: { line: "ri-magic-line", fill: "ri-magic-fill" },
  bell_off: {
    line: "ri-notification-off-line",
    fill: "ri-notification-off-fill",
  },
  /** Fullscreen (insight detail enters fullscreen page) */
  fullscreen: { line: "ri-fullscreen-line", fill: "ri-fullscreen-fill" },
  /** Source info tab: message, translate, edit, etc. */
  message: { line: "ri-chat-3-line", fill: "ri-chat-3-fill" },
  translate: { line: "ri-translate-2-line", fill: "ri-translate-2-fill" },
  edit: { line: "ri-edit-line", fill: "ri-edit-fill" },
  scan: { line: "ri-scan-line", fill: "ri-scan-fill" },
  /** Lucide replacement: reply, feedback, #, email, send, chevron, loading, logout, etc. */
  reply: { line: "ri-reply-line", fill: "ri-reply-fill" },
  /** About / feedback entry (Remix feedback icon) */
  feedback: { line: "ri-feedback-line", fill: "ri-feedback-fill" },
  hashtag: { line: "ri-hashtag", fill: "ri-hashtag" },
  mail: { line: "ri-mail-line", fill: "ri-mail-fill" },
  chevron_down: { line: "ri-arrow-down-s-line", fill: "ri-arrow-down-s-fill" },
  chevron_up: { line: "ri-arrow-up-s-line", fill: "ri-arrow-up-s-fill" },
  chevron_left: { line: "ri-arrow-left-s-line", fill: "ri-arrow-left-s-fill" },
  chevron_right: {
    line: "ri-arrow-right-s-line",
    fill: "ri-arrow-right-s-fill",
  },
  logout: { line: "ri-logout-box-r-line", fill: "ri-logout-box-r-fill" },
  /** Remove from squad / exit circle (character danger zone) */
  logout_circle_r: {
    line: "ri-logout-circle-r-line",
    fill: "ri-logout-circle-r-fill",
  },
  door_open: { line: "ri-door-open-line", fill: "ri-door-open-fill" },
  grip_vertical: { line: "ri-draggable", fill: "ri-draggable" },
  bell: { line: "ri-notification-3-line", fill: "ri-notification-3-fill" },
  clock: { line: "ri-time-line", fill: "ri-time-fill" },
  shield: { line: "ri-shield-line", fill: "ri-shield-fill" },
  shield_check: { line: "ri-shield-check-line", fill: "ri-shield-check-fill" },
  magic: { line: "ri-magic-line", fill: "ri-magic-fill" },
  sparkles: { line: "ri-magic-line", fill: "ri-magic-fill" },
  circle_check: {
    line: "ri-checkbox-circle-line",
    fill: "ri-checkbox-circle-fill",
  },
  circle_close: { line: "ri-close-circle-line", fill: "ri-close-circle-fill" },
  checkbox_blank: {
    line: "ri-checkbox-blank-circle-line",
    fill: "ri-checkbox-blank-circle-fill",
  },
  maximize: { line: "ri-fullscreen-line", fill: "ri-fullscreen-fill" },
  maximize_2: { line: "ri-fullscreen-line", fill: "ri-fullscreen-fill" },
  target: { line: "ri-focus-3-line", fill: "ri-focus-3-fill" },
  quote: { line: "ri-double-quotes-l", fill: "ri-double-quotes-l" },
  calendar: { line: "ri-calendar-line", fill: "ri-calendar-fill" },
  /** Onboarding explore icon */
  compass_3: { line: "ri-compass-3-line", fill: "ri-compass-3-fill" },
  folder_2: { line: "ri-folder-2-line", fill: "ri-folder-2-fill" },
  sparkling_2: { line: "ri-sparkling-2-line", fill: "ri-sparkling-2-fill" },
  user_settings: {
    line: "ri-user-settings-line",
    fill: "ri-user-settings-fill",
  },
  /** General settings tab */
  equalizer_2: {
    line: "ri-equalizer-2-line",
    fill: "ri-equalizer-2-fill",
  },
  /** Urgent/important/monitoring (brief-panel etc.) */
  siren: { line: "ri-alarm-warning-line", fill: "ri-alarm-warning-fill" },
  zap: { line: "ri-thunderstorms-line", fill: "ri-thunderstorms-fill" },
  /** Group priority High/Medium/Low (signal-cellular 1/2/3) */
  signal_cellular_3: {
    line: "ri-signal-cellular-3-line",
    fill: "ri-signal-cellular-3-fill",
  },
  signal_cellular_2: {
    line: "ri-signal-cellular-2-line",
    fill: "ri-signal-cellular-2-fill",
  },
  signal_cellular_1: {
    line: "ri-signal-cellular-1-line",
    fill: "ri-signal-cellular-1-fill",
  },
  /** Platform/brand and general (add-platform-dialog etc.) */
  cloud: { line: "ri-cloud-line", fill: "ri-cloud-fill" },
  orbit: { line: "ri-planet-line", fill: "ri-planet-fill" },
  blocks: { line: "ri-blocks-line", fill: "ri-blocks-fill" },
  github: { line: "ri-github-line", fill: "ri-github-fill" },
  ticket: { line: "ri-coupon-line", fill: "ri-coupon-fill" },
  apple: { line: "ri-apple-line", fill: "ri-apple-fill" },
  qq: { line: "ri-qq-line", fill: "ri-qq-fill" },
  linkedin: { line: "ri-linkedin-box-line", fill: "ri-linkedin-box-fill" },
  twitter: { line: "ri-twitter-x-line", fill: "ri-twitter-x-fill" },
  "twitter-x": { line: "ri-twitter-x-line", fill: "ri-twitter-x-fill" },
  instagram: { line: "ri-instagram-line", fill: "ri-instagram-fill" },
  slack: { line: "ri-slack-line", fill: "ri-slack-fill" },
  telegram: { line: "ri-telegram-line", fill: "ri-telegram-fill" },
  discord: { line: "ri-discord-line", fill: "ri-discord-fill" },
  whatsapp: { line: "ri-whatsapp-line", fill: "ri-whatsapp-fill" },
  /** More UI */
  menu: { line: "ri-menu-line", fill: "ri-menu-fill" },
  chevrons_up_down: {
    line: "ri-arrow-up-down-line",
    fill: "ri-arrow-up-down-fill",
  },
  zoom_in: { line: "ri-zoom-in-line", fill: "ri-zoom-in-fill" },
  zoom_out: { line: "ri-zoom-out-line", fill: "ri-zoom-out-fill" },
  arrow_left: { line: "ri-arrow-left-line", fill: "ri-arrow-left-fill" },
  credit_card: { line: "ri-bank-card-line", fill: "ri-bank-card-fill" },
  bookmark: { line: "ri-bookmark-line", fill: "ri-bookmark-fill" },
  at_sign: { line: "ri-at-line", fill: "ri-at-fill" },
  minimize_2: { line: "ri-subtract-line", fill: "ri-subtract-fill" },
  file_archive: { line: "ri-file-zip-line", fill: "ri-file-zip-fill" },
  video: { line: "ri-video-line", fill: "ri-video-fill" },
  upload: { line: "ri-upload-2-line", fill: "ri-upload-2-fill" },
  history: { line: "ri-history-line", fill: "ri-history-fill" },
  share_2: { line: "ri-share-line", fill: "ri-share-fill" },
  /** Connectors / linked accounts (platform integrations) */
  connector: { line: "ri-connector-line", fill: "ri-connector-fill" },
  mouse_pointer: { line: "ri-cursor-line", fill: "ri-cursor-fill" },
  chart_gantt: { line: "ri-bar-chart-box-line", fill: "ri-bar-chart-box-fill" },
  terminal: { line: "ri-terminal-box-line", fill: "ri-terminal-box-fill" },
  globe: { line: "ri-global-line", fill: "ri-global-fill" },
  /** Lucide replacement */
  lock: { line: "ri-lock-line", fill: "ri-lock-fill" },
  monitor: { line: "ri-monitor-line", fill: "ri-monitor-fill" },
  external_link: {
    line: "ri-external-link-line",
    fill: "ri-external-link-fill",
  },
  network: { line: "ri-node-tree-line", fill: "ri-node-tree-fill" },
  eye_off: { line: "ri-eye-off-line", fill: "ri-eye-off-fill" },
  rss: { line: "ri-rss-line", fill: "ri-rss-fill" },
  arrow_up: { line: "ri-arrow-up-line", fill: "ri-arrow-up-fill" },
  arrow_up_s: { line: "ri-arrow-up-s-line", fill: "ri-arrow-up-s-fill" },
  folder: { line: "ri-folder-line", fill: "ri-folder-fill" },
  settings: { line: "ri-settings-3-line", fill: "ri-settings-3-fill" },
  settings_line: { line: "ri-settings-line", fill: "ri-settings-fill" },
  user_round: { line: "ri-user-line", fill: "ri-user-fill" },
  clipboard_list: { line: "ri-clipboard-line", fill: "ri-clipboard-fill" },
  file_spreadsheet: {
    line: "ri-file-excel-2-line",
    fill: "ri-file-excel-2-fill",
  },
  presentation: { line: "ri-slideshow-2-line", fill: "ri-slideshow-2-fill" },
  /** Lucide replacement (continued) */
  rotate_ccw: { line: "ri-arrow-go-back-line", fill: "ri-arrow-go-back-fill" },
  rotate_cw: { line: "ri-refresh-line", fill: "ri-refresh-fill" },
  shuffle: { line: "ri-shuffle-line", fill: "ri-shuffle-fill" },
  tags: { line: "ri-price-tag-3-line", fill: "ri-price-tag-3-fill" },
  id_card: { line: "ri-id-card-line", fill: "ri-id-card-fill" },
  file_input: { line: "ri-file-upload-line", fill: "ri-file-upload-fill" },
  server: { line: "ri-server-line", fill: "ri-server-fill" },
  smartphone: { line: "ri-smartphone-line", fill: "ri-smartphone-fill" },
  save: { line: "ri-save-line", fill: "ri-save-fill" },
  list_checks: { line: "ri-list-check", fill: "ri-list-check-fill" },
  file_image: { line: "ri-image-line", fill: "ri-image-fill" },
  file_json: { line: "ri-code-s-line", fill: "ri-code-s-fill" },
  file_type: { line: "ri-file-text-line", fill: "ri-file-text-fill" },
  type: { line: "ri-font-size-line", fill: "ri-font-size-fill" },
  send: { line: "ri-send-plane-line", fill: "ri-send-plane-fill" },
  badge_help: { line: "ri-question-line", fill: "ri-question-fill" },
  loader_icon: { line: "ri-loader-4-line", fill: "ri-loader-4-line" },
  copy: { line: "ri-file-copy-line", fill: "ri-file-copy-fill" },
  /** Like/dislike (below AI response) */
  thumb_up: { line: "ri-thumb-up-line", fill: "ri-thumb-up-fill" },
  thumb_down: { line: "ri-thumb-down-line", fill: "ri-thumb-down-fill" },
  message_circle: { line: "ri-chat-3-line", fill: "ri-chat-3-fill" },
  qr_code: { line: "ri-qr-code-line", fill: "ri-qr-code-fill" },
  mic: { line: "ri-mic-line", fill: "ri-mic-fill" },
  file: { line: "ri-file-line", fill: "ri-file-fill" },
  /** Lucide replacement (continued): BookOpen, Brain, HardDrive, Bold, Italic, ListOrdered */
  book_open: { line: "ri-book-open-line", fill: "ri-book-open-fill" },
  /** Onboarding guide / Manual */
  booklet: { line: "ri-booklet-line", fill: "ri-booklet-fill" },
  brain: { line: "ri-brain-line", fill: "ri-brain-fill" },
  hard_drive: { line: "ri-hard-drive-2-line", fill: "ri-hard-drive-2-fill" },
  hard_drive_3_line: {
    line: "ri-hard-drive-3-line",
    fill: "ri-hard-drive-3-fill",
  },
  bold: { line: "ri-bold", fill: "ri-bold" },
  italic: { line: "ri-italic", fill: "ri-italic" },
  list_ordered: { line: "ri-list-ordered", fill: "ri-list-ordered" },
  /** CheckCheck / Double check */
  check_double: { line: "ri-check-double-line", fill: "ri-check-double-fill" },
  /** MoreVertical / MoreHorizontal */
  more_vertical: { line: "ri-more-line", fill: "ri-more-fill" },
  /** Slash (Lucide) */
  slash: { line: "ri-slash", fill: "ri-slash" },
};

export interface RemixIconProps {
  /** Icon name (keeps original Material name for compatibility with existing configuration) */
  name: string;
  /** Whether selected / filled style */
  filled?: boolean;
  /** Custom className */
  className?: string;
  /** Icon size class name, defaults to size-5 */
  size?: string;
}

/** Tailwind size class name corresponding font-size, to align font icon with container */
const SIZE_TO_TEXT: Record<string, string> = {
  "size-3": "text-sm",
  "size-3.5": "text-[0.875rem]",
  "size-4": "text-base", // 1rem
  "size-5": "text-[1.25rem]", // 1.25rem
  "size-6": "text-[1.5rem]", // 1.5rem
  "size-8": "text-2xl", // 1.5rem
  "size-12": "text-3xl", // 1.875rem
  "size-16": "text-4xl", // 2.25rem
};

/**
 * Derives className for icons from Tailwind size class (container size + font size).
 * Remix Icons are font icons, requiring fixed container and centering to avoid
 * misalignment with text baseline (legacy from Material era).
 * Supports arbitrary sizes like size-[12px], size-[14px], applied to both container and font size.
 */
function getSizeClass(size: string): { box: string; text: string } {
  const arbitraryMatch = size.match(/^size-\[(.+)\]$/);
  if (arbitraryMatch) {
    const value = arbitraryMatch[1];
    return { box: size, text: `text-[${value}]` };
  }
  const key = size.startsWith("size-") && SIZE_TO_TEXT[size] ? size : "size-5";
  return {
    box: key,
    text: SIZE_TO_TEXT[key] ?? "text-[1.25rem]",
  };
}

/**
 * Unified Remix Icon component.
 * Maps icon names to Remix class names, supporting line/fill variants.
 * Uses fixed size + inline-flex centering to resolve vertical alignment
 * issues between font icons and text.
 *
 * @param props - Component props
 * @returns Remix icon element
 */
export function RemixIcon({
  name,
  filled = false,
  className,
  size = "size-5",
}: RemixIconProps) {
  // Memoize icon class computation to avoid repeated lookups
  const remixClass = useMemo(() => {
    const mapping = MATERIAL_TO_REMIX[name];
    return mapping
      ? filled
        ? mapping.fill
        : mapping.line
      : `ri-${name.replace(/_/g, "-")}-line`;
  }, [name, filled]);

  const { box, text } = getSizeClass(size);

  return (
    <i
      className={cn(
        remixClass,
        box,
        text,
        "inline-flex items-center justify-center shrink-0 leading-none",
        className,
      )}
    />
  );
}
