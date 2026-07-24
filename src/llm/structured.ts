import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// ==================== STRUCTURED OUTPUT SCHEMAS ====================

export const AnalysisResultSchema = z.object({
  ticker: z.string().describe("Mã chứng khoán"),
  date: z.string().describe("Ngày phân tích"),
  recommendation: z.enum(["BUY", "SELL", "HOLD", "WAIT"]).describe("Khuyến nghị"),
  confidence: z.number().min(0).max(1).describe("Độ tin cậy (0-1)"),
  targetPrice: z.number().optional().describe("Giá mục tiêu"),
  stopLoss: z.number().optional().describe("Giá cắt lỗ"),
  reasoning: z.string().describe("Lý do phân tích"),
  risks: z.array(z.string()).describe("Các rủi ro"),
});

export const MarketSentimentSchema = z.object({
  overall: z.enum(["bullish", "bearish", "neutral"]).describe("Sentiment tổng quan"),
  score: z.number().min(-1).max(1).describe("Điểm sentiment (-1 đến 1)"),
  factors: z.array(z.string()).describe("Các yếu tố ảnh hưởng"),
  summary: z.string().describe("Tóm tắt"),
});

export const TradeDecisionSchema = z.object({
  action: z.enum(["BUY", "SELL", "HOLD", "WAIT"]).describe("Hành động"),
  ticker: z.string().describe("Mã chứng khoán"),
  quantity: z.number().optional().describe("Khối lượng"),
  targetPrice: z.number().optional().describe("Giá mục tiêu"),
  stopLoss: z.number().optional().describe("Giá cắt lỗ"),
  timeframe: z.string().describe("Thời gian nắm giữ"),
  reasoning: z.string().describe("Lý do"),
});

// ==================== STRUCTURED OUTPUT HELPER ====================

export async function getStructuredOutput<T>(
  llm: ChatOpenAI,
  schema: z.ZodSchema<T>,
  messages: { role: string; content: string }[]
): Promise<T> {
  const modelWithStructure = llm.withStructuredOutput(schema);
  const result = await modelWithStructure.invoke(messages as any);
  return result as T;
}

/**
 * Parse JSON response to structured output
 */
export function parseStructuredOutput<T>(
  schema: z.ZodSchema<T>,
  jsonStr: string
): T {
  const parsed = JSON.parse(jsonStr);
  return schema.parse(parsed);
}

/**
 * Validate structured output
 */
export function validateStructuredOutput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
