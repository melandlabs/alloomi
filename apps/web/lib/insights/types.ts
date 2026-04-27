// Zod-inferred types - from subagents (these are app-specific parsing types)
import type {
  InsightTaskItem,
  DetailData,
  TimelineData,
  InsightSource,
  FollowUpData,
  ActionRequirementDetails,
  ExperimentIdeaData,
  RiskFlagData,
  StrategicData,
} from "@/lib/ai/subagents/insights";
import type { Insight } from "@/lib/db/schema";

export type GeneratedInsightPayload = {
  dedupeKey?: string | null;
  taskLabel: string;
  title: string;
  description: string;
  importance: string;
  urgency: string;
  platform?: string | null;
  account?: string | null;
  groups?: string[];
  people?: string[];
  time?: Date | string | number | null;
  details?: DetailData[] | null;
  timeline?: TimelineData[] | null;
  insights?: Insight["insights"];
  trendDirection?: string | null;
  trendConfidence?: number | null;
  sentiment?: string | null;
  sentimentConfidence?: number | null;
  intent?: string | null;
  trend?: string | null;
  issueStatus?: string | null;
  communityTrend?: string | null;
  duplicateFlag?: boolean | null;
  impactLevel?: string | null;
  resolutionHint?: string | null;
  topKeywords?: string[];
  topEntities?: string[];
  topVoices?: Insight["topVoices"];
  sources?: InsightSource[] | null;
  sourceConcentration?: string | null;
  buyerSignals?: string[];
  stakeholders?: Insight["stakeholders"];
  contractStatus?: string | null;
  signalType?: string | null;
  confidence?: number | null;
  scope?: string | null;
  nextActions?: Insight["nextActions"];
  followUps?: FollowUpData[] | null;
  actionRequired?: boolean | null;
  actionRequiredDetails?: ActionRequirementDetails | null;
  isUnreplied?: boolean | null;
  myTasks?: InsightTaskItem[] | null;
  waitingForMe?: InsightTaskItem[] | null;
  waitingForOthers?: InsightTaskItem[] | null;
  clarifyNeeded?: boolean | null;
  priority?: number | null;
  categories?: string[];
  learning?: string | null;
  experimentIdeas?: ExperimentIdeaData[] | null;
  executiveSummary?: string | null;
  riskFlags?: RiskFlagData[] | null;
  strategic?: StrategicData | null;
  client?: string | null;
  projectName?: string | null;
  nextMilestone?: string | null;
  dueDate?: string | null;
  paymentInfo?: string | null;
  entity?: string | null;
  why?: string | null;
  historySummary?: Insight["historySummary"];
  roleAttribution?: Insight["roleAttribution"];
  alerts?: Insight["alerts"];
  // User action related fields (for preserving favorite, archive, pin, etc. states)
  isFavorited?: boolean | null;
  favoritedAt?: Date | null;
  isArchived?: boolean | null;
  archivedAt?: Date | null;
};

export type OverlayDescriptor = {
  role: string;
  name?: string;
  priority?: number | null;
  fieldToggles?: Record<string, boolean>;
  [key: string]: unknown;
};

export type OverlayContext = {
  overlays: OverlayDescriptor[];
  systemPrompt?: string;
  roleKeys?: string[];
};
