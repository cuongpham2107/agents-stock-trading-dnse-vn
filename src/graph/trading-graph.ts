import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import type { DataSnapshot, RiskDebateState } from "../types/index";
import { runMarketAnalyst } from "../agents/analysts/market-analyst";
import { runNewsAnalyst } from "../agents/analysts/news-analyst";
import { runSocialAnalyst } from "../agents/analysts/social-analyst";
import { runFundamentalsAnalyst } from "../agents/analysts/fundamentals-analyst";
import { runBullResearcher } from "../agents/researchers/bull-researcher";
import { runBearResearcher } from "../agents/researchers/bear-researcher";
import { runResearchManager } from "../agents/managers/research-manager";
import { runTrader } from "../agents/trader/trader";
import { runAggressiveAnalyst, runConservativeAnalyst, runNeutralAnalyst } from "../agents/risk/risk-debate";
import { runPortfolioManager } from "../agents/managers/portfolio-manager";
import { LongTermMemoryManager } from "../memory/long-term";

// ==================== STATE ====================

const State = Annotation.Root({
  ticker: Annotation<string>,
  date: Annotation<string>,
  dataSnapshot: Annotation<DataSnapshot | null>,
  marketReport: Annotation<string>,
  sentimentReport: Annotation<string>,
  newsReport: Annotation<string>,
  fundamentalsReport: Annotation<string>,
  debateHistory: Annotation<string>,
  debateCount: Annotation<number>,
  investmentPlan: Annotation<string>,
  traderPlan: Annotation<string>,
  riskHistory: Annotation<string>,
  riskCount: Annotation<number>,
  finalDecision: Annotation<string>,
  pastExperience: Annotation<string>,
  messages: Annotation<unknown[]>,
});

type State = typeof State.State;

// ==================== NODES ====================

function createNodes(llm: ChatOpenAI, deepLlm: ChatOpenAI) {
  const memory = new LongTermMemoryManager();

  async function loadExperience(s: State) {
    const exps = memory.searchMemories(["trading", "experiences"], s.ticker);
    const past = exps.length > 0
      ? `Kinh nghiệm: ${exps.map((e: any) => `${e.date}: ${e.lesson}`).join("; ")}`
      : "";
    return { pastExperience: past };
  }

  async function marketAnalyst(s: State) {
    console.log("▶ Market Analyst...");
    const r = await runMarketAnalyst(llm, s.dataSnapshot!);
    console.log("✔ Market Analyst done");
    return { marketReport: r.summary || JSON.stringify(r) };
  }

  async function sentimentAnalyst(s: State) {
    console.log("▶ Sentiment Analyst...");
    const r = await runSocialAnalyst(llm, s.dataSnapshot!);
    console.log("✔ Sentiment Analyst done");
    return { sentimentReport: r.summary || JSON.stringify(r) };
  }

  async function newsAnalyst(s: State) {
    console.log("▶ News Analyst...");
    const r = await runNewsAnalyst(llm, s.dataSnapshot!);
    console.log("✔ News Analyst done");
    return { newsReport: r.summary || JSON.stringify(r) };
  }

  async function fundamentalsAnalyst(s: State) {
    console.log("▶ Fundamentals Analyst...");
    const r = await runFundamentalsAnalyst(llm, s.dataSnapshot!);
    console.log("✔ Fundamentals Analyst done");
    return { fundamentalsReport: r.summary || JSON.stringify(r) };
  }

  async function bullResearcher(s: State) {
    console.log("▶ Bull Researcher (round " + (s.debateCount + 1) + ")...");
    const r = await runBullResearcher(llm,
      { summary: s.marketReport || "" }, { summary: s.newsReport || "" },
      { summary: s.sentimentReport || "" }, { summary: s.fundamentalsReport || "" },
      s.ticker, s.debateHistory ? s.debateHistory.split("\n") : []
    );
    console.log("✔ Bull Researcher done");
    return {
      debateHistory: (s.debateHistory || "") + "\nBull: " + r.argument,
      debateCount: s.debateCount + 1,
    };
  }

  async function bearResearcher(s: State) {
    console.log("▶ Bear Researcher (round " + (s.debateCount + 1) + ")...");
    const r = await runBearResearcher(llm,
      { summary: s.marketReport || "" }, { summary: s.newsReport || "" },
      { summary: s.sentimentReport || "" }, { summary: s.fundamentalsReport || "" },
      s.ticker, s.debateHistory ? s.debateHistory.split("\n") : []
    );
    console.log("✔ Bear Researcher done");
    return {
      debateHistory: (s.debateHistory || "") + "\nBear: " + r.argument,
      debateCount: s.debateCount + 1,
    };
  }

  async function researchManager(s: State) {
    console.log("▶ Research Manager...");
    const r = await runResearchManager(deepLlm,
      { summary: s.debateHistory } as any,
      { summary: s.debateHistory } as any,
      s.debateHistory ? s.debateHistory.split("\n") : [],
      s.dataSnapshot!
    );
    const plan = `Rating: ${r.decision} | Confidence: ${r.confidence} | ${r.reasoning}`;
    console.log("✔ Research Manager done");
    return { investmentPlan: plan };
  }

  async function trader(s: State) {
    console.log("▶ Trader...");
    const r = await runTrader(llm, {
      action: "hold", ticker: s.ticker, confidence: 0.5,
      targetPrice: 0, stopLoss: 0, positionSize: "", timeframe: "", reasoning: s.investmentPlan
    } as any, s.dataSnapshot!);
    const plan = `${r.action} ${r.ticker} | Target: ${r.targetPrice} | SL: ${r.stopLoss}`;
    console.log("✔ Trader done");
    return { traderPlan: plan };
  }

  async function aggressiveAnalyst(s: State) {
    console.log("▶ Aggressive Risk Analyst...");
    const r = await runAggressiveAnalyst(llm, { action: "hold", ticker: s.ticker } as any, s.dataSnapshot!, { history: s.riskHistory, count: s.riskCount } as any);
    console.log("✔ Aggressive done");
    return { riskHistory: (s.riskHistory || "") + "\nAggressive: " + r, riskCount: s.riskCount + 1 };
  }

  async function conservativeAnalyst(s: State) {
    console.log("▶ Conservative Risk Analyst...");
    const r = await runConservativeAnalyst(llm, { action: "hold", ticker: s.ticker } as any, s.dataSnapshot!, { history: s.riskHistory, count: s.riskCount } as any);
    console.log("✔ Conservative done");
    return { riskHistory: (s.riskHistory || "") + "\nConservative: " + r, riskCount: s.riskCount + 1 };
  }

  async function neutralAnalyst(s: State) {
    console.log("▶ Neutral Risk Analyst...");
    const r = await runNeutralAnalyst(llm, { action: "hold", ticker: s.ticker } as any, s.dataSnapshot!, { history: s.riskHistory, count: s.riskCount } as any);
    console.log("✔ Neutral done");
    return { riskHistory: (s.riskHistory || "") + "\nNeutral: " + r, riskCount: s.riskCount + 1 };
  }

  async function portfolioManager(s: State) {
    console.log("▶ Portfolio Manager...");
    const r = await runPortfolioManager(deepLlm, { action: "hold", ticker: s.ticker } as any, { history: s.riskHistory } as any, s.dataSnapshot!);
    const decision = `${r.finalDecision} | ${r.action} | ${r.reasoning}`;
    await memory.saveEpisodicMemory(["trading", "experiences"], `${s.ticker}-${s.date}`, {
      ticker: s.ticker, date: s.date, event: "Analysis", outcome: decision, lesson: ""
    });
    console.log("✔ Portfolio Manager done");
    return { finalDecision: decision };
  }

  async function saveExperience(s: State) {
    return { pastExperience: s.pastExperience };
  }

  return {
    loadExperience, marketAnalyst, sentimentAnalyst, newsAnalyst, fundamentalsAnalyst,
    bullResearcher, bearResearcher, researchManager, trader,
    aggressiveAnalyst, conservativeAnalyst, neutralAnalyst,
    portfolioManager, saveExperience,
  };
}

// ==================== BUILD GRAPH ====================

export function buildTradingGraph(llm: ChatOpenAI, deepLlm: ChatOpenAI) {
  const n = createNodes(llm, deepLlm);
  const R = 1; // Số round debate
  return new StateGraph(State)
    // Nodes
    .addNode("load", n.loadExperience)
    .addNode("market", n.marketAnalyst)
    .addNode("sentiment", n.sentimentAnalyst)
    .addNode("news", n.newsAnalyst)
    .addNode("fundamentals", n.fundamentalsAnalyst)
    .addNode("bull", n.bullResearcher)
    .addNode("bear", n.bearResearcher)
    .addNode("manager", n.researchManager)
    .addNode("trader", n.trader)
    .addNode("aggressive", n.aggressiveAnalyst)
    .addNode("conservative", n.conservativeAnalyst)
    .addNode("neutral", n.neutralAnalyst)
    .addNode("portfolio", n.portfolioManager)
    .addNode("save", n.saveExperience)
    // Flow: 4 analysts chạy SONG SONG (fan-out từ "load")
    .addEdge(START, "load")
    .addEdge("load", "market")
    .addEdge("load", "sentiment")
    .addEdge("load", "news")
    .addEdge("load", "fundamentals")
    // Fan-in: "bull" chỉ chạy khi cả 4 analyst xong
    .addEdge("market", "bull")
    .addEdge("sentiment", "bull")
    .addEdge("news", "bull")
    .addEdge("fundamentals", "bull")
    // Debate loop: bull → bear → (repeat R times) → manager
    .addEdge("bull", "bear")
    .addEdge("bear", R > 1 ? "bull" : "manager")
    // Manager → Trader → Risk
    .addEdge("manager", "trader")
    .addEdge("trader", "aggressive")
    .addEdge("aggressive", "conservative")
    .addEdge("conservative", "neutral")
    .addEdge("neutral", "portfolio")
    // End
    .addEdge("portfolio", "save")
    .addEdge("save", END)
    .compile();
}
// ==================== ANALYZE ====================

export async function analyze(llm: ChatOpenAI, ticker: string, date: string): Promise<string> {
  // Tạo deepLlm với cùng config với llm
  const deepLlm = new ChatOpenAI({
    model: process.env.DEEP_MODEL || "nvidia/deepseek-ai/deepseek-v4-pro",
    apiKey: process.env.LLM_API_KEY,
    temperature: 0.3,
    configuration: {
      baseURL: process.env.LLM_BASE_URL || "http://localhost:20128/v1",
    },
  });
  const graph = buildTradingGraph(llm, deepLlm);

  const result = await graph.invoke({
    ticker, date,
    dataSnapshot: { ticker, date, closePrice: 0, ohlcHistory: [], latestTrades: [], latestQuotes: {},
      foreignTrading: {}, secDef: {}, instruments: {}, marketNews: "", socialSentiment: "",
      marketReport: "", sentimentReport: "", newsReport: "", fundamentalsReport: "" },
    marketReport: "", sentimentReport: "", newsReport: "", fundamentalsReport: "",
    debateHistory: "", debateCount: 0,
    investmentPlan: "", traderPlan: "",
    riskHistory: "", riskCount: 0,
    finalDecision: "", pastExperience: "", messages: [],
  });

  return result.finalDecision || "Không có kết quả";
}
