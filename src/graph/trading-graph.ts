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
import { graphLogger, logAnalysisStart, logAnalysisStep, logAnalysisResult, logAnalysisError } from "../utils/logger";

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
    const start = Date.now();
    graphLogger.nodeStart("Market Analyst", s.ticker);
    const r = await runMarketAnalyst(llm, s.dataSnapshot!);
    graphLogger.nodeDone("Market Analyst", Date.now() - start);
    return { marketReport: r.summary || JSON.stringify(r) };
  }

  async function sentimentAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Sentiment Analyst", s.ticker);
    const r = await runSocialAnalyst(llm, s.dataSnapshot!);
    graphLogger.nodeDone("Sentiment Analyst", Date.now() - start);
    return { sentimentReport: r.summary || JSON.stringify(r) };
  }

  async function newsAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("News Analyst", s.ticker);
    const r = await runNewsAnalyst(llm, s.dataSnapshot!);
    graphLogger.nodeDone("News Analyst", Date.now() - start);
    return { newsReport: r.summary || JSON.stringify(r) };
  }

  async function fundamentalsAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Fundamentals Analyst", s.ticker);
    const r = await runFundamentalsAnalyst(llm, s.dataSnapshot!);
    graphLogger.nodeDone("Fundamentals Analyst", Date.now() - start);
    return { fundamentalsReport: r.summary || JSON.stringify(r) };
  }

  async function bullResearcher(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Bull Researcher", `round ${s.debateCount + 1}`);
    const r = await runBullResearcher(llm,
      { summary: s.marketReport || "" }, { summary: s.newsReport || "" },
      { summary: s.sentimentReport || "" }, { summary: s.fundamentalsReport || "" },
      s.ticker, s.debateHistory ? s.debateHistory.split("\n") : []
    );
    graphLogger.nodeDone("Bull Researcher", Date.now() - start);
    return {
      debateHistory: (s.debateHistory || "") + "\nBull: " + r.argument,
      debateCount: s.debateCount + 1,
    };
  }

  async function bearResearcher(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Bear Researcher", `round ${s.debateCount + 1}`);
    const r = await runBearResearcher(llm,
      { summary: s.marketReport || "" }, { summary: s.newsReport || "" },
      { summary: s.sentimentReport || "" }, { summary: s.fundamentalsReport || "" },
      s.ticker, s.debateHistory ? s.debateHistory.split("\n") : []
    );
    graphLogger.nodeDone("Bear Researcher", Date.now() - start);
    return {
      debateHistory: (s.debateHistory || "") + "\nBear: " + r.argument,
      debateCount: s.debateCount + 1,
    };
  }

  async function researchManager(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Research Manager");
    const r = await runResearchManager(deepLlm,
      { summary: s.debateHistory } as any,
      { summary: s.debateHistory } as any,
      s.debateHistory ? s.debateHistory.split("\n") : [],
      s.dataSnapshot!
    );
    const plan = `Rating: ${r.decision} | Confidence: ${r.confidence} | ${r.reasoning}`;
    graphLogger.nodeDone("Research Manager", Date.now() - start);
    return { investmentPlan: plan };
  }

  async function trader(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Trader");
    const r = await runTrader(llm, {
      action: "hold", ticker: s.ticker, confidence: 0.5,
      targetPrice: 0, stopLoss: 0, positionSize: "", timeframe: "", reasoning: s.investmentPlan
    } as any, s.dataSnapshot!);
    const plan = `${r.action} ${r.ticker} | Target: ${r.targetPrice} | SL: ${r.stopLoss}`;
    graphLogger.nodeDone("Trader", Date.now() - start);
    return { traderPlan: plan };
  }

  async function aggressiveAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Aggressive Risk");
    const r = await runAggressiveAnalyst(llm, { action: "hold", ticker: s.ticker } as any, s.dataSnapshot!, { history: s.riskHistory, count: s.riskCount } as any);
    graphLogger.nodeDone("Aggressive Risk", Date.now() - start);
    return { riskHistory: (s.riskHistory || "") + "\nAggressive: " + r, riskCount: s.riskCount + 1 };
  }

  async function conservativeAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Conservative Risk");
    const r = await runConservativeAnalyst(llm, { action: "hold", ticker: s.ticker } as any, s.dataSnapshot!, { history: s.riskHistory, count: s.riskCount } as any);
    graphLogger.nodeDone("Conservative Risk", Date.now() - start);
    return { riskHistory: (s.riskHistory || "") + "\nConservative: " + r, riskCount: s.riskCount + 1 };
  }

  async function neutralAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Neutral Risk");
    const r = await runNeutralAnalyst(llm, { action: "hold", ticker: s.ticker } as any, s.dataSnapshot!, { history: s.riskHistory, count: s.riskCount } as any);
    graphLogger.nodeDone("Neutral Risk", Date.now() - start);
    return { riskHistory: (s.riskHistory || "") + "\nNeutral: " + r, riskCount: s.riskCount + 1 };
  }

  async function portfolioManager(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Portfolio Manager");
    const r = await runPortfolioManager(deepLlm, { action: "hold", ticker: s.ticker } as any, { history: s.riskHistory } as any, s.dataSnapshot!);
    const decision = `${r.finalDecision} | ${r.action} | ${r.reasoning}`;
    await memory.saveEpisodicMemory(["trading", "experiences"], `${s.ticker}-${s.date}`, {
      ticker: s.ticker, date: s.date, event: "Analysis", outcome: decision, lesson: ""
    });
    graphLogger.nodeDone("Portfolio Manager", Date.now() - start);
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
  logAnalysisStart(ticker);

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

  logAnalysisStep(1, 7, "Load Past Experience");
  logAnalysisStep(2, 7, "4 Analysts (Market, Sentiment, News, Fundamentals)");
  logAnalysisStep(3, 7, "Bull/Bear Debate");
  logAnalysisStep(4, 7, "Research Manager");
  logAnalysisStep(5, 7, "Trader");
  logAnalysisStep(6, 7, "Risk Team (Aggressive, Conservative, Neutral)");
  logAnalysisStep(7, 7, "Portfolio Manager");

  console.log("\n");

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
