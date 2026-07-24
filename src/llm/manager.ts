import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { LLMProvider, LLMConfig, ModelPreset } from "./types";
import { createLLM, getDefaultConfig, createConfigFromPreset } from "./factory";
import { PROVIDER_CONFIGS, getAllModels, getModelsByTier } from "./types";

// ==================== LLM MANAGER ====================

export type AnyChatModel = ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI;

export interface LLMManagerConfig {
  quickModel?: string;
  deepModel?: string;
  quickApiKey?: string;
  deepApiKey?: string;
}

export class LLMManager {
  private quickLLM: AnyChatModel;
  private deepLLM: AnyChatModel;
  private currentConfig: LLMManagerConfig;

  constructor(config?: LLMManagerConfig) {
    this.currentConfig = config || {};

    // Tạo quick LLM
    const quickConfig = this.currentConfig.quickModel
      ? createConfigFromPreset(this.currentConfig.quickModel, this.currentConfig.quickApiKey)
      : getDefaultConfig();

    // Tạo deep LLM
    const deepConfig = this.currentConfig.deepModel
      ? createConfigFromPreset(this.currentConfig.deepModel, this.currentConfig.deepApiKey)
      : {
          ...getDefaultConfig(),
          temperature: 0.3,
        };

    this.quickLLM = createLLM(quickConfig, { temperature: 0.7 });
    this.deepLLM = createLLM(deepConfig, { temperature: 0.3 });
  }

  /**
   * Lấy quick LLM (cho analyst, researcher)
   */
  getQuickLLM(): AnyChatModel {
    return this.quickLLM;
  }

  /**
   * Lấy deep LLM (cho research manager, portfolio manager)
   */
  getDeepLLM(): AnyChatModel {
    return this.deepLLM;
  }

  /**
   * Switch quick model
   */
  switchQuickModel(presetName: string, apiKey?: string): void {
    const config = createConfigFromPreset(presetName, apiKey);
    this.quickLLM = createLLM(config, { temperature: 0.7 });
    console.log(`[LLM Manager] Đã chuyển quick model: ${presetName}`);
  }

  /**
   * Switch deep model
   */
  switchDeepModel(presetName: string, apiKey?: string): void {
    const config = createConfigFromPreset(presetName, apiKey);
    this.deepLLM = createLLM(config, { temperature: 0.3 });
    console.log(`[LLM Manager] Đã chuyển deep model: ${presetName}`);
  }

  /**
   * Switch cả hai model
   */
  switchModels(quickPreset: string, deepPreset: string, apiKey?: string): void {
    this.switchQuickModel(quickPreset, apiKey);
    this.switchDeepModel(deepPreset, apiKey);
  }

  /**
   * Hiển thị models đang dùng
   */
  getCurrentModels(): { quick: string; deep: string } {
    return {
      quick: (this.quickLLM as ChatOpenAI).model || "unknown",
      deep: (this.deepLLM as ChatOpenAI).model || "unknown",
    };
  }

  /**
   * List tất cả models có thể switch
   */
  static listAvailableModels(): ModelPreset[] {
    return getAllModels();
  }

  /**
   * List models theo tier
   */
  static listModelsByTier(tier: "quick" | "deep"): ModelPreset[] {
    return getModelsByTier(tier);
  }

  /**
   * List providers
   */
  static listProviders(): string[] {
    return Object.keys(PROVIDER_CONFIGS);
  }
}

// ==================== SINGLETON INSTANCE ====================

let globalLLMManager: LLMManager | null = null;

export function getLLMManager(config?: LLMManagerConfig): LLMManager {
  if (!globalLLMManager) {
    globalLLMManager = new LLMManager(config);
  }
  return globalLLMManager;
}

export function resetLLMManager(): void {
  globalLLMManager = null;
}
