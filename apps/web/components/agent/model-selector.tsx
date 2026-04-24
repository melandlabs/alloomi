"use client";
import { useLocalStorage } from "usehooks-ts";

/**
 * Available model types
 */
export type ModelType =
  | "default"
  | "anthropic/claude-sonnet-4.6"
  | "anthropic/claude-sonnet-4.5"
  | "anthropic/claude-opus-4.6"
  | "anthropic/claude-haiku-4.5"
  | "deepseek/deepseek-v3.2"
  | "google/gemini-3-flash-preview"
  | "google/gemini-3-pro-preview"
  | "google/gemini-3.1-pro-preview"
  | "z-ai/glm-5"
  | "grok/grok-4.1-fast"
  | "moonshotai/kimi-k2.5"
  | "minimax/minimax-m2.5"
  | "openai/gpt-4o"
  | "openai/gpt-4o-mini"
  | "openai/gpt-5.2-codex"
  | "openai/gpt-5.2-mini"
  | "openai/gpt-5-nano"
  | "stepfun/step-3.5-flash";

/**
 * Export MODELS for use in other components
 */
export { MODELS };

/**
 * Model configuration
 */
interface ModelConfig {
  id: ModelType;
  name: string;
  provider: string;
  description: string;
  requiresReasoning?: boolean;
  supportsVision?: boolean;
  supportsThinking?: boolean;
  defaultThinkingLevel?: "disabled" | "low" | "adaptive";
  nativeCapabilities?: {
    search?: boolean;
  };
  contextTokens?: number;
  monthlyFreeQuota?: number;
}

/**
 * Available models configuration
 */
const MODELS = {
  default: {
    id: "default",
    name: "Default",
    provider: "System",
    description: "Use system default model",
  },
  "anthropic/claude-sonnet-4.6": {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    description: "Balanced performance and speed",
    supportsVision: true,
    supportsThinking: true,
    defaultThinkingLevel: "adaptive",
    nativeCapabilities: { search: true },
    contextTokens: 200000,
    monthlyFreeQuota: 82,
  },
  "anthropic/claude-sonnet-4.5": {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    description: "Balanced performance and speed",
    supportsVision: true,
    contextTokens: 200000,
    monthlyFreeQuota: 79.5,
  },
  "anthropic/claude-opus-4.6": {
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    description: "Highest quality, slower response",
    requiresReasoning: true,
    supportsVision: true,
    supportsThinking: true,
    defaultThinkingLevel: "adaptive",
    contextTokens: 200000,
    monthlyFreeQuota: 13,
  },
  "anthropic/claude-haiku-4.5": {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    description: "Fast and efficient",
    supportsVision: true,
    contextTokens: 200000,
    monthlyFreeQuota: 200,
  },
  "deepseek/deepseek-v3.2": {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    provider: "DeepSeek",
    description: "Cost-effective and efficient",
    supportsVision: false,
    contextTokens: 128000,
    monthlyFreeQuota: 113,
  },
  "google/gemini-3-flash-preview": {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "Google",
    description: "Fast and efficient",
    supportsVision: true,
    contextTokens: 385000,
    monthlyFreeQuota: 435,
  },
  "google/gemini-3-pro-preview": {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "Google",
    description: "Advanced capabilities",
    supportsVision: true,
    contextTokens: 72.2,
    monthlyFreeQuota: 63.6,
  },
  "google/gemini-3.1-pro-preview": {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "Google",
    description: "Latest advanced capabilities",
    supportsVision: true,
    contextTokens: 200000,
    monthlyFreeQuota: 44.2,
  },
  "z-ai/glm-5": {
    id: "z-ai/glm-5",
    name: "GLM 5",
    provider: "Z-ai",
    description: "Next generation capabilities",
    supportsVision: false,
    contextTokens: 128000,
    monthlyFreeQuota: 515,
  },
  "grok/grok-4.1-fast": {
    id: "grok/grok-4.1-fast",
    name: "Grok 4.1 Fast",
    provider: "X-AI",
    description: "Fast and efficient",
    supportsVision: true,
    contextTokens: 128000,
    monthlyFreeQuota: 200,
  },
  "moonshotai/kimi-k2.5": {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    provider: "Moonshot",
    description: "Fast and efficient",
    supportsVision: true,
    contextTokens: 128000,
    monthlyFreeQuota: 200,
  },
  "minimax/minimax-m2.5": {
    id: "minimax/minimax-m2.5",
    name: "MiniMax M2.5",
    provider: "MiniMax",
    description: "Fast and efficient",
    supportsVision: false,
    contextTokens: 200000,
    monthlyFreeQuota: 787,
  },
  "stepfun/step-3.5-flash": {
    id: "stepfun/step-3.5-flash",
    name: "Step 3.5 Flash",
    provider: "Step",
    description: "Fast and efficient",
    supportsVision: false,
    contextTokens: 200000,
    monthlyFreeQuota: 385,
  },
  "openai/gpt-4o": {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    description: "Multimodal with strong performance",
    supportsVision: true,
    contextTokens: 128000,
    monthlyFreeQuota: 72.4,
  },
  "openai/gpt-4o-mini": {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    description: "Fast and cost-effective",
    supportsVision: true,
    contextTokens: 128000,
    monthlyFreeQuota: 72.4,
  },
  "openai/gpt-5.2-codex": {
    id: "openai/gpt-5.2-codex",
    name: "GPT-5.2 Codex",
    provider: "OpenAI",
    description: "Next generation capabilities",
    supportsVision: true,
    nativeCapabilities: { search: true },
    contextTokens: 200000,
    monthlyFreeQuota: 116,
  },
  "openai/gpt-5.2-mini": {
    id: "openai/gpt-5.2-mini",
    name: "GPT-5.2 Mini",
    provider: "OpenAI",
    description: "Fast next-gen model",
    supportsVision: true,
    nativeCapabilities: { search: true },
    contextTokens: 200000,
    monthlyFreeQuota: 146,
  },
  "openai/gpt-5-nano": {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "OpenAI",
    description: "Ultra fast and efficient",
    supportsVision: true,
    contextTokens: 200000,
    monthlyFreeQuota: 290,
  },
} as Record<ModelType, ModelConfig>;

/**
 * Local storage key for model preference
 */
const MODEL_PREFERENCE_KEY = "alloomi:preferredModel";

/**
 * Model selector component props
 */
export interface ModelSelectorProps {
  /** Current selected model */
  value?: ModelType;
  /** Callback when model is changed */
  onModelChange?: (model: ModelType) => void;
  /** Custom className */
  className?: string;
  /** Compact mode for smaller screens */
  compact?: boolean;
  /** Disable selector */
  disabled?: boolean;
}

/**
 * Hook to access current selected model
 *
 * This provides a convenient way to read and update model preference
 * without needing to import ModelSelector component.
 *
 * @returns A tuple of [currentModel, setModel]
 */
export function useModelPreference(): [ModelType, (model: ModelType) => void] {
  const [model, setModel] = useLocalStorage<ModelType>(
    MODEL_PREFERENCE_KEY,
    "default",
  );
  return [model, setModel];
}

/**
 * Get model configuration for a given model ID
 *
 * @param modelId - The model ID
 * @returns The model configuration, or undefined if not found
 */
export function getModelConfig(modelId: ModelType): ModelConfig | undefined {
  return MODELS[modelId];
}
