import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { AnalystsStateAnnotation, type AnalystsState } from "../state";
import { runMarketAnalyst } from "../../agents/analysts/market-analyst";
import { runNewsAnalyst } from "../../agents/analysts/news-analyst";
import { runSocialAnalyst } from "../../agents/analysts/social-analyst";
import { runFundamentalsAnalyst } from "../../agents/analysts/fundamentals-analyst";

// ==================== ANALYSTS SUBGRAPH ====================

export function createAnalystsSubgraph(llm: ChatOpenAI) {
  // Node: Market Analyst
  async function marketAnalyst(state: AnalystsState): Promise<Partial<AnalystsState>> {
    console.log("[Analysts] Đang chạy Market Analyst...");

    const snapshot = state.dataSnapshot!;
    const result = await runMarketAnalyst(llm, snapshot);

    return {
      marketReport: result.summary || JSON.stringify(result),
      messages: [{ role: "assistant", content: result.summary || JSON.stringify(result) }],
    };
  }

  // Node: Sentiment Analyst
  async function sentimentAnalyst(state: AnalystsState): Promise<Partial<AnalystsState>> {
    console.log("[Analysts] Đang chạy Sentiment Analyst...");

    const snapshot = state.dataSnapshot!;
    const result = await runSocialAnalyst(llm, snapshot);

    return {
      sentimentReport: result.summary || JSON.stringify(result),
      messages: [{ role: "assistant", content: result.summary || JSON.stringify(result) }],
    };
  }

  // Node: News Analyst
  async function newsAnalyst(state: AnalystsState): Promise<Partial<AnalystsState>> {
    console.log("[Analysts] Đang chạy News Analyst...");

    const snapshot = state.dataSnapshot!;
    const result = await runNewsAnalyst(llm, snapshot);

    return {
      newsReport: result.summary || JSON.stringify(result),
      messages: [{ role: "assistant", content: result.summary || JSON.stringify(result) }],
    };
  }

  // Node: Fundamentals Analyst
  async function fundamentalsAnalyst(state: AnalystsState): Promise<Partial<AnalystsState>> {
    console.log("[Analysts] Đang chạy Fundamentals Analyst...");

    const snapshot = state.dataSnapshot!;
    const result = await runFundamentalsAnalyst(llm, snapshot);

    return {
      fundamentalsReport: result.summary || JSON.stringify(result),
      messages: [{ role: "assistant", content: result.summary || JSON.stringify(result) }],
    };
  }

  // Node: Clear Messages
  async function clearMessages(state: AnalystsState): Promise<Partial<AnalystsState>> {
    return { messages: [] };
  }

  // Build subgraph — 4 analysts chạy SONG SONG, fan-in vào END
  const workflow = new StateGraph(AnalystsStateAnnotation)
    .addNode("Market Analyst", marketAnalyst)
    .addNode("Sentiment Analyst", sentimentAnalyst)
    .addNode("News Analyst", newsAnalyst)
    .addNode("Fundamentals Analyst", fundamentalsAnalyst)
    .addNode("Clear Messages", clearMessages)

    // fan-out từ START
    .addEdge(START, "Market Analyst")
    .addEdge(START, "Sentiment Analyst")
    .addEdge(START, "News Analyst")
    .addEdge(START, "Fundamentals Analyst")
    // fan-in → Clear Messages → END
    .addEdge("Market Analyst", "Clear Messages")
    .addEdge("Sentiment Analyst", "Clear Messages")
    .addEdge("News Analyst", "Clear Messages")
    .addEdge("Fundamentals Analyst", "Clear Messages")
    .addEdge("Clear Messages", END);

  return workflow.compile();
}
