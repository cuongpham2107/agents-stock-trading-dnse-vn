// ==================== LLM RETRY HANDLER ====================

import { ChatOpenAI } from "@langchain/openai";

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * Invoke LLM với retry logic
 */
export async function invokeWithRetry<T>(
  llm: ChatOpenAI,
  messages: { role: string; content: string }[],
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const result = await llm.invoke(messages);
      return result as T;
    } catch (error) {
      lastError = error as Error;
      const isRateLimit = lastError.message.includes("429") ||
                          lastError.message.includes("rate") ||
                          lastError.message.includes("quota") ||
                          lastError.message.includes("503");

      if (!isRateLimit || attempt === cfg.maxRetries) {
        throw lastError;
      }

      const delay = Math.min(
        cfg.initialDelay * Math.pow(cfg.backoffMultiplier, attempt),
        cfg.maxDelay
      );

      console.log(`[Retry] Lỗi rate limit, thử lại sau ${delay}ms (attempt ${attempt + 1}/${cfg.maxRetries})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/**
 * Invoke LLM với streaming và retry
 */
export async function* streamWithRetry<T>(
  llm: ChatOpenAI,
  messages: { role: string; content: string }[],
  config: Partial<RetryConfig> = {}
) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const stream = await llm.stream(messages);
      for await (const chunk of stream) {
        yield chunk;
      }
      return;
    } catch (error) {
      const err = error as Error;
      const isRateLimit = err.message.includes("429") ||
                          err.message.includes("rate") ||
                          err.message.includes("quota") ||
                          err.message.includes("503");

      if (!isRateLimit || attempt === cfg.maxRetries) {
        throw err;
      }

      const delay = Math.min(
        cfg.initialDelay * Math.pow(cfg.backoffMultiplier, attempt),
        cfg.maxDelay
      );

      console.log(`[Retry] Lỗi rate limit, thử lại sau ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
