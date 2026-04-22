/**
 * Minimal Insight interface for use in algorithms.
 * App-specific implementations (DB adapters) should extend this.
 */
export interface InsightBase {
  id: string;
  title: string;
  description: string;
  importance: string;
  urgency: string;
  platform: string | null;
  account: string | null;
  groups: string[] | null;
  people: string[] | null;
  time: Date | string | number;
  details: InsightDetail[] | null;
  timeline: InsightTimelineEvent[] | null;
  taskLabel: string;
  categories: string[] | null;
  topKeywords: string[] | null;
  isUnreplied?: boolean | null;
  myTasks: InsightTaskItem[] | null;
  waitingForMe: InsightTaskItem[] | null;
  waitingForOthers: InsightTaskItem[] | null;
  nextActions: InsightAction[] | null;
  followUps: InsightFollowUp[] | null;
  dueDate?: string | null;
  dedupeKey?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface InsightTimelineEvent {
  time?: number | string | null;
  person?: string | null;
  platform?: string | null;
  channel?: string | null;
  content?: string | null;
  attachments?: InsightAttachment[] | null;
}

export interface InsightAction {
  action?: string | null;
  reason?: string | null;
  confidence?: number | null;
}

export interface InsightFollowUp {
  action?: string | null;
  reason?: string | null;
  confidence?: number | null;
}

export interface InsightDetail {
  time?: number | string | null;
  person?: string | null;
  platform?: string | null;
  channel?: string | null;
  content?: string | null;
  attachments?: InsightAttachment[] | null;
}

export interface InsightAttachment {
  name: string;
  url: string;
  contentType?: string;
  downloadUrl?: string;
  sizeBytes?: number;
  blobPath?: string;
  source?: string;
  expired?: boolean;
  expiredAt?: string;
}

export interface InsightTaskItem {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  assignee?: string | null;
  dueDate?: string | null;
  context?: string | null;
  owner?: string | null;
  ownerType?: string | null;
  requester?: string | null;
  requesterId?: string | null;
  responder?: string | null;
  responderId?: string | null;
  deadline?: string | null;
  rawDeadline?: string | null;
  followUpAt?: string | null;
  followUpNote?: string | null;
  lastFollowUpAt?: string | null;
  acknowledgedAt?: string | null;
  priority?: string | null;
  confidence?: number | null;
  labels?: string[] | null;
  sourceDetailIds?: string[] | null;
  watchers?: string[] | null;
  [key: string]: unknown;
}
