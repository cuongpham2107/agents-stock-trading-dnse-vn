// ==================== LLM PROVIDER TYPES ====================

export type LLMProvider = "openai" | "anthropic" | "google" | "nvidia" | "ollama" | "deepseek" | "openrouter";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  thinkingLevel?: string;
}

export interface LLMClient {
  provider: LLMProvider;
  model: string;
  invoke(messages: unknown[]): Promise<unknown>;
}

// ==================== MODEL PRESETS ====================

export interface ModelPreset {
  name: string;
  provider: LLMProvider;
  model: string;
  baseUrl?: string;
  description: string;
  tier: "quick" | "deep";
  costPer1kTokens?: number;
}

// ==================== PROVIDER CONFIGS ====================

export const PROVIDER_CONFIGS: Record<LLMProvider, {
  name: string;
  defaultBaseUrl: string;
  models: ModelPreset[];
}> = {
  openai: {
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: [
      { name: "GPT-4o", provider: "openai", model: "gpt-4o", tier: "deep", description: "Mạnh nhất, suitable cho research" },
      { name: "GPT-4o-mini", provider: "openai", model: "gpt-4o-mini", tier: "quick", description: "Nhanh, chi phí thấp" },
      { name: "GPT-4-turbo", provider: "openai", model: "gpt-4-turbo", tier: "deep", description: "Cũ hơn nhưng ổn định" },
    ],
  },
  anthropic: {
    name: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    models: [
      { name: "Claude Sonnet 4", provider: "anthropic", model: "claude-sonnet-4-20250514", tier: "deep", description: "Mạnh, phù hợp research" },
      { name: "Claude 3.5 Haiku", provider: "anthropic", model: "claude-3-5-haiku-20241022", tier: "quick", description: "Nhanh, chi phí thấp" },
    ],
  },
  google: {
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1",
    models: [
      { name: "Gemini 2.5 Pro", provider: "google", model: "gemini-2.5-pro", tier: "deep", description: "Mạnh nhất Gemini" },
      { name: "Gemini 2.0 Flash", provider: "google", model: "gemini-2.0-flash", tier: "quick", description: "Nhanh, miễn phí tier" },
    ],
  },
  nvidia: {
    name: "NVIDIA NIM",
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
    models: [
      { name: "Nemotron 70B", provider: "nvidia", model: "nvidia/llama-3.1-nemotron-70b-instruct", tier: "deep", description: "Mạnh, OpenAI-compatible" },
      { name: "Llama 3.1 70B", provider: "nvidia", model: "meta/llama-3.1-70b-instruct", tier: "quick", description: "Nhanh, chi phí thấp" },
      { name: "Llama 3.1 8B", provider: "nvidia", model: "meta/llama-3.1-8b-instruct", tier: "quick", description: "Rất nhanh, chi phí rất thấp" },
    ],
  },
  ollama: {
    name: "Ollama (Local)",
    defaultBaseUrl: "http://localhost:11434/v1",
    models: [
      { name: "Llama 3.1 70B", provider: "ollama", model: "llama3.1:70b", tier: "deep", description: "Local, miễn phí" },
      { name: "Llama 3.1 8B", provider: "ollama", model: "llama3.1:8b", tier: "quick", description: "Local, nhanh" },
      { name: "Mistral 7B", provider: "ollama", model: "mistral:7b", tier: "quick", description: "Local, nhanh" },
    ],
  },
  deepseek: {
    name: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: [
      { name: "DeepSeek V3", provider: "deepseek", model: "deepseek-chat", tier: "deep", description: "Mạnh, chi phí thấp" },
      { name: "DeepSeek Coder", provider: "deepseek", model: "deepseek-coder", tier: "quick", description: "Code-focused" },
    ],
  },
  openrouter: {
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    models: [
      { name: "GPT-4o (OpenRouter)", provider: "openrouter", model: "openai/gpt-4o", tier: "deep", description: "GPT-4o qua OpenRouter" },
      { name: "Claude Sonnet 4 (OpenRouter)", provider: "openrouter", model: "anthropic/claude-sonnet-4", tier: "deep", description: "Claude qua OpenRouter" },
      { name: "Gemini 2.5 Pro (OpenRouter)", provider: "openrouter", model: "google/gemini-2.5-pro", tier: "deep", description: "Gemini qua OpenRouter" },
      { name: "Llama 3.1 70B (OpenRouter)", provider: "openrouter", model: "meta-llama/llama-3.1-70b-instruct", tier: "quick", description: "Llama qua OpenRouter" },
    ],
  },
};

// ==================== HELPER FUNCTIONS ====================

export function getAllModels(): ModelPreset[] {
  return Object.values(PROVIDER_CONFIGS).flatMap((p) => p.models);
}

export function getModelByName(name: string): ModelPreset | undefined {
  const nameLower = name.toLowerCase();
  return getAllModels().find(
    (m) =>
      m.name.toLowerCase() === nameLower ||
      m.model.toLowerCase() === nameLower
  );
}

export function getModelsByTier(tier: "quick" | "deep"): ModelPreset[] {
  return getAllModels().filter((m) => m.tier === tier);
}

export function getModelsByProvider(provider: LLMProvider): ModelPreset[] {
  return PROVIDER_CONFIGS[provider]?.models || [];
}
