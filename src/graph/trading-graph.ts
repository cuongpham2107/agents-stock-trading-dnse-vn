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
import { graphLogger, logAnalysisStart, logAnalysisStep, logAnalysisResult, logAnalysisError, logNodeResult } from "../utils/logger";
import { DnseServer, API_BASE_URL } from "../tools/dnse/server";

// ==================== BUILD DATA SNAPSHOT ====================

async function buildDataSnapshot(ticker: string, date: string): Promise<DataSnapshot> {
  const server = new DnseServer(
    process.env.DNSE_API_KEY || "",
    process.env.DNSE_API_SECRET || ""
  );

  const safeGet = async (path: string, url: string): Promise<unknown> => {
    try {
      const raw = await server.getJson(path, url);
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  // Tính toán khoảng thời gian 90 ngày trước
  const toDate = new Date(date);
  const fromDate = new Date(date);
  fromDate.setDate(fromDate.getDate() - 90);
  const fromTs = Math.floor(fromDate.getTime() / 1000);
  const toTs = Math.floor(toDate.getTime() / 1000);
  const fromDateStr = fromDate.toISOString().split("T")[0];

  // Fetch song song tất cả dữ liệu cần thiết
  const [closePriceRaw, ohlcRaw, latestTradesRaw, latestQuotesRaw, foreignRaw, secDefRaw, instrumentsRaw] =
    await Promise.all([
      safeGet(`/price/${ticker}/close`, `${API_BASE_URL}/price/${ticker}/close`),
      safeGet(
        "/price/ohlc",
        `${API_BASE_URL}/price/ohlc?symbol=${ticker}&type=STOCK&resolution=1D&from=${fromTs}&to=${toTs}`
      ),
      safeGet(
        `/price/${ticker}/trades/latest`,
        `${API_BASE_URL}/price/${ticker}/trades/latest?boardId=G1`
      ),
      safeGet(
        `/price/${ticker}/quotes/latest`,
        `${API_BASE_URL}/price/${ticker}/quotes/latest`
      ),
      safeGet(
        `/price/${ticker}/foreign-trading`,
        `${API_BASE_URL}/price/${ticker}/foreign-trading?from=${fromTs}&to=${toTs}`
      ),
      safeGet(`/price/${ticker}/secdef`, `${API_BASE_URL}/price/${ticker}/secdef`),
      safeGet("/instruments", `${API_BASE_URL}/instruments?symbol=${ticker}&limit=1`),
    ]);

  // Parse giá đóng cửa — API trả về {prices: [{closePrice, boardId, ...}]}
  const closePriceData = closePriceRaw as Record<string, unknown>;
  const pricesArr = Array.isArray(closePriceData?.prices) ? (closePriceData.prices as Array<Record<string, unknown>>) : [];
  // Ưu tiên boardId G1 (lô chẵn), fallback sang phần tử đầu tiên có giá > 0
  const mainPrice = pricesArr.find((p) => p.boardId === "G1" && (p.closePrice as number) > 0)
    || pricesArr.find((p) => (p.closePrice as number) > 0);
  const closePrice = (mainPrice?.closePrice as number) || 0;

  // Parse OHLC history — API trả về {t:[], o:[], h:[], l:[], c:[], v:[]}
  const ohlcData = ohlcRaw as Record<string, unknown>;
  let ohlcHistory: unknown[] = [];
  if (Array.isArray(ohlcData?.t) && (ohlcData.t as unknown[]).length > 0) {
    const t = ohlcData.t as number[];
    const o = ohlcData.o as number[];
    const h = ohlcData.h as number[];
    const l = ohlcData.l as number[];
    const c = ohlcData.c as number[];
    const v = ohlcData.v as number[];
    ohlcHistory = t.map((ts, i) => ({ t: ts, o: o[i], h: h[i], l: l[i], c: c[i], v: v[i] }));
  } else if (Array.isArray(ohlcData?.data)) {
    ohlcHistory = ohlcData.data as unknown[];
  }

  // Parse latest trades
  const latestTradesData = latestTradesRaw as Record<string, unknown>;
  const latestTrades: unknown[] = Array.isArray(latestTradesData?.data)
    ? (latestTradesData.data as unknown[])
    : Array.isArray(latestTradesRaw)
    ? (latestTradesRaw as unknown[])
    : [];

  return {
    ticker,
    date,
    closePrice,
    ohlcHistory,
    latestTrades,
    latestQuotes: latestQuotesRaw,
    foreignTrading: foreignRaw,
    secDef: secDefRaw,
    instruments: instrumentsRaw,
    marketNews: "",
    socialSentiment: "",
    marketReport: "",
    sentimentReport: "",
    newsReport: "",
    fundamentalsReport: "",
  };
}



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

  async function fetchData(s: State) {
    // Nếu dataSnapshot đã có dữ liệu thực (closePrice > 0 hoặc ohlcHistory có data) thì skip
    if (s.dataSnapshot && (s.dataSnapshot.closePrice > 0 || s.dataSnapshot.ohlcHistory.length > 0)) {
      return {};
    }

    const ticker = s.ticker || "";
    const date = s.date || new Date().toISOString().split("T")[0]!;

    if (!ticker) {
      return {
        ticker,
        date,
        dataSnapshot: {
          ticker, date, closePrice: 0, ohlcHistory: [], latestTrades: [],
          latestQuotes: {}, foreignTrading: {}, secDef: {}, instruments: {},
          marketNews: "", socialSentiment: "", marketReport: "",
          sentimentReport: "", newsReport: "", fundamentalsReport: "",
        },
      };
    }

    graphLogger.nodeStart("Fetch Data", ticker);
    const dataSnapshot = await buildDataSnapshot(ticker, date);
    graphLogger.nodeDone("Fetch Data", 0);

    return { ticker, date, dataSnapshot };
  }

  async function loadExperience(s: State) {
    if (!s.ticker) {
      return { pastExperience: "" };
    }
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
    const summary = r.summary || JSON.stringify(r);
    logNodeResult("Market Analyst", summary);
    graphLogger.nodeDone("Market Analyst", Date.now() - start);
    return { marketReport: summary };
  }

  async function sentimentAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Sentiment Analyst", s.ticker);
    const r = await runSocialAnalyst(llm, s.dataSnapshot!);
    const summary = r.summary || JSON.stringify(r);
    logNodeResult("Sentiment Analyst", summary);
    graphLogger.nodeDone("Sentiment Analyst", Date.now() - start);
    return { sentimentReport: summary };
  }

  async function newsAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("News Analyst", s.ticker);
    const r = await runNewsAnalyst(llm, s.dataSnapshot!);
    const summary = r.summary || JSON.stringify(r);
    logNodeResult("News Analyst", summary);
    graphLogger.nodeDone("News Analyst", Date.now() - start);
    return { newsReport: summary };
  }

  async function fundamentalsAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Fundamentals Analyst", s.ticker);
    const r = await runFundamentalsAnalyst(llm, s.dataSnapshot!);
    const summary = r.summary || JSON.stringify(r);
    logNodeResult("Fundamentals Analyst", summary);
    graphLogger.nodeDone("Fundamentals Analyst", Date.now() - start);
    return { fundamentalsReport: summary };
  }

  async function bullResearcher(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Bull Researcher", `round ${s.debateCount + 1}`);
    const r = await runBullResearcher(llm,
      { summary: s.marketReport || "" }, { summary: s.newsReport || "" },
      { summary: s.sentimentReport || "" }, { summary: s.fundamentalsReport || "" },
      s.ticker, s.debateHistory ? s.debateHistory.split("\n") : []
    );
    logNodeResult("Bull Researcher", r.argument);
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
    logNodeResult("Bear Researcher", r.argument);
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
    logNodeResult("Research Manager", plan);
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
    logNodeResult("Trader", plan);
    graphLogger.nodeDone("Trader", Date.now() - start);
    return { traderPlan: plan };
  }

  async function aggressiveAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Aggressive Risk");
    const r = await runAggressiveAnalyst(llm, { action: "hold", ticker: s.ticker } as any, s.dataSnapshot!, { history: s.riskHistory, count: s.riskCount } as any);
    logNodeResult("Aggressive Risk", r);
    graphLogger.nodeDone("Aggressive Risk", Date.now() - start);
    return { riskHistory: (s.riskHistory || "") + "\nAggressive: " + r, riskCount: s.riskCount + 1 };
  }

  async function conservativeAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Conservative Risk");
    const r = await runConservativeAnalyst(llm, { action: "hold", ticker: s.ticker } as any, s.dataSnapshot!, { history: s.riskHistory, count: s.riskCount } as any);
    logNodeResult("Conservative Risk", r);
    graphLogger.nodeDone("Conservative Risk", Date.now() - start);
    return { riskHistory: (s.riskHistory || "") + "\nConservative: " + r, riskCount: s.riskCount + 1 };
  }

  async function neutralAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Neutral Risk");
    const r = await runNeutralAnalyst(llm, { action: "hold", ticker: s.ticker } as any, s.dataSnapshot!, { history: s.riskHistory, count: s.riskCount } as any);
    logNodeResult("Neutral Risk", r);
    graphLogger.nodeDone("Neutral Risk", Date.now() - start);
    return { riskHistory: (s.riskHistory || "") + "\nNeutral: " + r, riskCount: s.riskCount + 1 };
  }

  async function portfolioManager(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Portfolio Manager");
    const r = await runPortfolioManager(deepLlm, { action: "hold", ticker: s.ticker } as any, { history: s.riskHistory } as any, s.dataSnapshot!);
    const decision = `${r.finalDecision} | ${r.action} | ${r.reasoning}`;
    logNodeResult("Portfolio Manager", decision);
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
    fetchData, loadExperience, marketAnalyst, sentimentAnalyst, newsAnalyst, fundamentalsAnalyst,
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
    .addNode("fetch", n.fetchData)
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
    // Flow: fetch → load → 4 analysts chạy SONG SONG (fan-out)
    .addEdge(START, "fetch")
    .addEdge("fetch", "load")
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
    dataSnapshot: await buildDataSnapshot(ticker, date),
    marketReport: "", sentimentReport: "", newsReport: "", fundamentalsReport: "",
    debateHistory: "", debateCount: 0,
    investmentPlan: "", traderPlan: "",
    riskHistory: "", riskCount: 0,
    finalDecision: "", pastExperience: "", messages: [],
  });

  return result.finalDecision || "Không có kết quả";
}
