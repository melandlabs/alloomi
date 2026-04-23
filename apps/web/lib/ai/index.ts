/**
 * @alloomi/ai - AI Layer barrel export
 * Re-exports from @alloomi/agent/ai package and local app-specific modules.
 */

// Package exports (tokens, pricing, compaction, providers, router)
export {
  estimateTokens,
  getInputCredits,
  getOutputCredits,
  getTotalCredits,
  INPUT_TOKENS_PER_CREDIT,
  OUTPUT_TOKENS_PER_CREDIT,
} from "@alloomi/ai/agent/ai";
export type { ModelType } from "@alloomi/ai/agent/ai";
export {
  MODEL_PRICING,
  getModelPricing,
  getModelMultiplier,
  CREDIT_VALUE_USD,
  calculateImageCredits,
  getImageModelPricing,
  IMAGE_MODEL_PRICING,
  getCanonicalImageModel,
  calculateInputCredits,
  calculateOutputCredits,
  calculateTotalCredits,
} from "@alloomi/ai/agent/ai";
export {
  COMPACTION_SOFT_RATIO,
  COMPACTION_HARD_RATIO,
  COMPACTION_EMERGENCY_RATIO,
  COMPACTION_MODEL,
  buildCompactionPrompt,
} from "@alloomi/ai/agent/ai";
export type {
  CompactionLevel,
  CompactionPlatform,
  CompactionResult,
} from "@alloomi/ai/agent/ai";
export {
  triggerCompaction,
  triggerCompactionAsync,
} from "@alloomi/ai/agent/ai";
export type {
  CompactionOptions,
  CompactionResponse,
} from "@alloomi/ai/agent/ai";
export {
  prepareConversationWindows,
  estimateConversationTokens,
  getConversationBucket,
  DEFAULT_CONVERSATION_WINDOW_CONFIG,
} from "@alloomi/ai/agent/ai";
export type {
  ConversationWindowMessage,
  ConversationWindowConfig,
  ConversationWindowBucket,
  ConversationWindowResult,
  TokenizedConversationWindowMessage,
  ConversationWindowBucketStats,
  ConversationWindowRole,
} from "@alloomi/ai/agent/ai";
export {
  getModel,
  getVLMModel,
  createDynamicModel,
  getModelProvider,
  setAIUserContext,
  clearAIUserContext,
  getAIUserContext,
} from "@alloomi/ai/agent/ai";
export type { AIUserContext, UserType } from "@alloomi/ai/agent/ai";
export {
  routeModelCall,
  getRecommendedMode,
  // Note: checkCloudAIAvailability from package is excluded to avoid conflict
  // with cloud-client version below; use checkCloudAIAvailability from ./cloud-client
} from "@alloomi/ai/agent/ai";
export type { ModelCallOptions, ModelCallResult } from "@alloomi/ai/agent/ai";

// Local app-specific cloud client (depends on @/lib/api/remote-client)
export {
  canUseCloudAI,
  checkCloudAIAvailability,
  callCloudAIStream,
  callCloudAI,
  callCloudAIGeneric,
  type CloudAIRequest,
  type CloudAIResponse,
} from "./cloud-client";

// Local app-specific router (extends package router with cloud fallback)
export {
  routeModelCall as routeModelCallLocal,
  routeModelCallCloud,
} from "./router";
export type { CloudAIRequest as RouterCloudAIRequest } from "./router";

// Local app-specific request context (app-specific helpers only)
export {
  extractCloudAuthToken,
  setAIUserContextFromRequest,
} from "./request-context";

// Backward-compatible singletons for web app (non-native mode)
// These delegate to the new function-based API
import { isTauriMode } from "@/lib/env/constants";
import {
  getModelProvider,
  getModel as getModelBase,
  getVLMModel,
} from "@alloomi/ai/agent/ai";

// NOTE: These are lazy getters to avoid requiring LLM_MODEL at module load time.
// They are only evaluated when actually used (e.g., in executeJob, not in API routes).
let _modelProvider: ReturnType<typeof getModelProvider> | undefined;
let _model: ReturnType<typeof getModelBase> | undefined;
let _vlmModel: ReturnType<typeof getVLMModel> | undefined;

export const modelProvider = () => {
  if (!_modelProvider) _modelProvider = getModelProvider(isTauriMode());
  return _modelProvider;
};
export const model = () => {
  if (!_model) _model = getModelBase(isTauriMode());
  return _model;
};
export const vlmModel = () => {
  if (!_vlmModel) _vlmModel = getVLMModel(isTauriMode());
  return _vlmModel;
};
