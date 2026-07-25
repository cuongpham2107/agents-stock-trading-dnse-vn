import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { buildTradingGraph } from "./trading-graph";

// ==================== STUDIO GRAPH ====================
// File này export compiled graph cho LangGraph Studio

const LLM_BASE_URL = process.env.LLM_BASE_URL || "http://localhost:20128/v1";
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const QUICK_MODEL = process.env.QUICK_MODEL || "gemini/gemini-3-flash-preview";
const DEEP_MODEL = process.env.DEEP_MODEL || "nvidia/deepseek-ai/deepseek-v4-pro";

// Tạo LLM instances
const quickLlm = new ChatOpenAI({
  model: QUICK_MODEL,
  apiKey: LLM_API_KEY,
  temperature: 0.7,
  configuration: {
    baseURL: LLM_BASE_URL,
  },
});

const deepLlm = new ChatOpenAI({
  model: DEEP_MODEL,
  apiKey: LLM_API_KEY,
  temperature: 0.3,
  configuration: {
    baseURL: LLM_BASE_URL,
  },
});

// Export compiled graph
export const graph = buildTradingGraph(quickLlm, deepLlm);
