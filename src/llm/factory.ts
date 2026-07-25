import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type {
  LLMProvider,
  LLMConfig,
  ModelPreset,
} from "./types";

// ==================== LLM FACTORY ====================

export interface LLMFactoryOptions {
  temperature?: number;
  maxTokens?: number;
  thinkingLevel?: string;
}

/**
 * Tạo LLM instance từ config
 */
export function createLLM(
  config: LLMConfig,
  options?: LLMFactoryOptions
): ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI {
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens;

  switch (config.provider) {
    case "openai":
    case "nvidia":
    case "ollama":
    case "deepseek":
    case "openrouter":
      return createOpenAICompatible(config, temperature, maxTokens);

    case "anthropic":
      return createAnthropic(config, temperature, maxTokens);

    case "google":
      return createGoogle(config, temperature, maxTokens);

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

/**
 * Tạo OpenAI-compatible LLM (OpenAI, NVIDIA, Ollama, DeepSeek)
 */
function createOpenAICompatible(
  config: LLMConfig,
  temperature: number,
  maxTokens?: number
): ChatOpenAI {
  return new ChatOpenAI({
    model: config.model,
    apiKey: config.apiKey,
    temperature,
    maxTokens,
    configuration: {
      baseURL: config.baseUrl,
    },
  });
}

/**
 * Tạo Anthropic LLM
 */
function createAnthropic(
  config: LLMConfig,
  temperature: number,
  maxTokens?: number
): ChatAnthropic {
  return new ChatAnthropic({
    model: config.model,
    apiKey: config.apiKey,
    temperature,
    maxTokens,
    anthropicApiUrl: config.baseUrl,
  });
}

/**
 * Tạo Google Gemini LLM
 */
function createGoogle(
  config: LLMConfig,
  temperature: number,
  maxTokens?: number
): ChatGoogleGenerativeAI {
  const fields = {
    model: config.model,
    temperature,
    apiKey: config.apiKey,
  };

  return new ChatGoogleGenerativeAI(fields);
}

// ==================== PRESET CONFIGS ====================

/**
 * Config mặc định từ environment
 */
export function getDefaultConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || "nvidia") as LLMProvider;

  return {
    provider,
    model: process.env.LLM_MODEL || "nvidia/llama-3.1-nemotron-70b-instruct",
    apiKey: process.env.LLM_API_KEY || process.env.NVIDIA_API_KEY,
    baseUrl: process.env.LLM_BASE_URL || process.env.NVIDIA_BASE_URL,
    temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.7"),
    maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS) : undefined,
  };
}

/**
 * Tạo config từ preset name
 */
export function createConfigFromPreset(
  presetName: string,
  apiKey?: string
): LLMConfig {
  const preset = getModelByName(presetName);
  if (!preset) {
    throw new Error(`Model preset not found: ${presetName}`);
  }

  const providerConfig = getProviderConfig(preset.provider);

  return {
    provider: preset.provider,
    model: preset.model,
    apiKey: apiKey || process.env.LLM_API_KEY,
    baseUrl: preset.baseUrl || providerConfig.defaultBaseUrl,
    temperature: 0.7,
  };
}

/**
 * Lấy provider config
 */
function getProviderConfig(provider: LLMProvider) {
  const configs: Record<LLMProvider, { defaultBaseUrl: string }> = {
    openai: { defaultBaseUrl: "https://api.openai.com/v1" },
    anthropic: { defaultBaseUrl: "https://api.anthropic.com" },
    google: { defaultBaseUrl: "https://generativelanguage.googleapis.com/v1" },
    nvidia: { defaultBaseUrl: "https://integrate.api.nvidia.com/v1" },
    ollama: { defaultBaseUrl: "http://localhost:11434/v1" },
    deepseek: { defaultBaseUrl: "https://api.deepseek.com/v1" },
    openrouter: { defaultBaseUrl: "https://openrouter.ai/api/v1" },
  };

  return configs[provider];
}

/**
 * Lấy model name từ preset
 */
function getModelByName(name: string): ModelPreset | undefined {
  const allModels: ModelPreset[] = [
    // OpenAI
    { name: "GPT-4o", provider: "openai", model: "gpt-4o", tier: "deep", description: "" },
    { name: "GPT-4o-mini", provider: "openai", model: "gpt-4o-mini", tier: "quick", description: "" },
    // Anthropic
    { name: "Claude Sonnet 4", provider: "anthropic", model: "claude-sonnet-4-20250514", tier: "deep", description: "" },
    { name: "Claude 3.5 Haiku", provider: "anthropic", model: "claude-3-5-haiku-20241022", tier: "quick", description: "" },
    // Google
    { name: "Gemini 2.5 Pro", provider: "google", model: "gemini-2.5-pro", tier: "deep", description: "" },
    { name: "Gemini 2.0 Flash", provider: "google", model: "gemini-2.0-flash", tier: "quick", description: "" },
    // NVIDIA
    { name: "Nemotron 70B", provider: "nvidia", model: "nvidia/llama-3.1-nemotron-70b-instruct", tier: "deep", description: "" },
    { name: "Llama 3.1 70B", provider: "nvidia", model: "meta/llama-3.1-70b-instruct", tier: "quick", description: "" },
    // DeepSeek
    { name: "DeepSeek V3", provider: "deepseek", model: "deepseek-chat", tier: "deep", description: "" },
    // OpenRouter
    { name: "GPT-4o (OpenRouter)", provider: "openrouter", model: "openai/gpt-4o", tier: "deep", description: "" },
    { name: "Claude Sonnet 4 (OpenRouter)", provider: "openrouter", model: "anthropic/claude-sonnet-4", tier: "deep", description: "" },
    { name: "Gemini 2.5 Pro (OpenRouter)", provider: "openrouter", model: "google/gemini-2.5-pro", tier: "deep", description: "" },
    { name: "Llama 3.1 70B (OpenRouter)", provider: "openrouter", model: "meta-llama/llama-3.1-70b-instruct", tier: "quick", description: "" },
  ];

  return allModels.find((m) => m.name.toLowerCase() === name.toLowerCase());
}
