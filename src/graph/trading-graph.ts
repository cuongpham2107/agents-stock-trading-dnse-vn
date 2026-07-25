import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import type { DataSnapshot, TraderOutput, RiskDebateState } from "../types/index";
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
import { graphLogger, logAnalysisStart, logAnalysisStep, logNodeResult } from "../utils/logger";
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
    } catch (err) {
      // FIX #5: log lỗi thay vì nuốt im lặng
      console.warn(`[buildDataSnapshot] API failed for ${path}: ${err}`);
      return {};
    }
  };

  const toDate = new Date(date);
  const fromDate = new Date(date);
  fromDate.setDate(fromDate.getDate() - 90);
  const fromTs = Math.floor(fromDate.getTime() / 1000);
  const toTs = Math.floor(toDate.getTime() / 1000);
  // FIX #5: xoá dead code fromDateStr

  const [closePriceRaw, ohlcRaw, latestTradesRaw, latestQuotesRaw, foreignRaw, secDefRaw, instrumentsRaw] =
    await Promise.all([
      safeGet(`/price/${ticker}/close`, `${API_BASE_URL}/price/${ticker}/close`),
      safeGet("/price/ohlc", `${API_BASE_URL}/price/ohlc?symbol=${ticker}&type=STOCK&resolution=1D&from=${fromTs}&to=${toTs}`),
      safeGet(`/price/${ticker}/trades/latest`, `${API_BASE_URL}/price/${ticker}/trades/latest?boardId=G1`),
      safeGet(`/price/${ticker}/quotes/latest`, `${API_BASE_URL}/price/${ticker}/quotes/latest`),
      safeGet(`/price/${ticker}/foreign-trading`, `${API_BASE_URL}/price/${ticker}/foreign-trading?from=${fromTs}&to=${toTs}`),
      safeGet(`/price/${ticker}/secdef`, `${API_BASE_URL}/price/${ticker}/secdef`),
      safeGet("/instruments", `${API_BASE_URL}/instruments?symbol=${ticker}&limit=1`),
    ]);

  // Parse giá đóng cửa — API trả về {prices: [{closePrice, boardId, ...}]}
  const closePriceData = closePriceRaw as Record<string, unknown>;
  const pricesArr = Array.isArray(closePriceData?.prices)
    ? (closePriceData.prices as Array<Record<string, unknown>>)
    : [];
  const mainPrice =
    pricesArr.find((p) => p.boardId === "G1" && (p.closePrice as number) > 0) ||
    pricesArr.find((p) => (p.closePrice as number) > 0);
  const closePrice = (mainPrice?.closePrice as number) || 0;

  // Parse OHLC — API trả về {t:[], o:[], h:[], l:[], c:[], v:[]}
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
  } else if (Array.isArray((ohlcData as any)?.data)) {
    ohlcHistory = (ohlcData as any).data as unknown[];
  }

  // Parse latest trades
  const latestTradesData = latestTradesRaw as Record<string, unknown>;
  const latestTrades: unknown[] = Array.isArray(latestTradesData?.data)
    ? (latestTradesData.data as unknown[])
    : Array.isArray(latestTradesRaw)
    ? (latestTradesRaw as unknown[])
    : [];

  return {
    ticker, date, closePrice, ohlcHistory, latestTrades,
    latestQuotes: latestQuotesRaw,
    foreignTrading: foreignRaw,
    secDef: secDefRaw,
    instruments: instrumentsRaw,
    marketNews: "", socialSentiment: "",
    marketReport: "", sentimentReport: "", newsReport: "", fundamentalsReport: "",
  };
}

// ==================== STATE ====================

const MAX_DEBATE_ROUNDS = 2;

const State = Annotation.Root({
  ticker: Annotation<string>,
  date: Annotation<string>,
  dataSnapshot: Annotation<DataSnapshot | null>,
  // Analyst reports
  marketReport: Annotation<string>,
  sentimentReport: Annotation<string>,
  newsReport: Annotation<string>,
  fundamentalsReport: Annotation<string>,
  // FIX #2: tách bull/bear report riêng để truyền đúng vào researchManager
  bullReport: Annotation<string>,
  bearReport: Annotation<string>,
  debateHistory: Annotation<string>,
  debateCount: Annotation<number>,
  // Plans
  investmentPlan: Annotation<string>,
  traderPlan: Annotation<string>,
  // FIX #1: lưu structured traderOutput để risk team dùng
  traderOutput: Annotation<TraderOutput | null>,
  // Risk team — FIX #3: mỗi analyst lưu riêng để song song hoá
  aggressiveReport: Annotation<string>,
  conservativeReport: Annotation<string>,
  neutralReport: Annotation<string>,
  // Final
  finalDecision: Annotation<string>,
  pastExperience: Annotation<string>,
});

type State = typeof State.State;

// ==================== NODES ====================

function createNodes(llm: ChatOpenAI, deepLlm: ChatOpenAI) {
  const memory = new LongTermMemoryManager();

  // ---------- fetch ----------
  async function fetchData(s: State) {
    if (s.dataSnapshot && (s.dataSnapshot.closePrice > 0 || s.dataSnapshot.ohlcHistory.length > 0)) {
      return {};
    }
    const ticker = s.ticker || "";
    const date = s.date || new Date().toISOString().split("T")[0]!;
    if (!ticker) {
      return {
        ticker, date,
        dataSnapshot: {
          ticker, date, closePrice: 0, ohlcHistory: [], latestTrades: [],
          latestQuotes: {}, foreignTrading: {}, secDef: {}, instruments: {},
          marketNews: "", socialSentiment: "",
          marketReport: "", sentimentReport: "", newsReport: "", fundamentalsReport: "",
        },
      };
    }
    graphLogger.nodeStart("Fetch Data", ticker);
    const dataSnapshot = await buildDataSnapshot(ticker, date);
    graphLogger.nodeDone("Fetch Data", 0);
    return { ticker, date, dataSnapshot };
  }

  // ---------- load ----------
  async function loadExperience(s: State) {
    if (!s.ticker) return { pastExperience: "" };
    try {
      const exps = memory.searchMemories(["trading", "experiences"], s.ticker);
      const past = exps.length > 0
        ? `Kinh nghiệm: ${exps.map((e: any) => `${e.date}: ${e.lesson}`).join("; ")}`
        : "";
      return { pastExperience: past };
    } catch (err) {
      console.warn(`[loadExperience] ${err}`);
      return { pastExperience: "" };
    }
  }

  // ---------- 4 analysts (song song) ----------
  async function marketAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Market Analyst", s.ticker);
    try {
      const r = await runMarketAnalyst(llm, s.dataSnapshot!);
      const summary = r.summary || JSON.stringify(r);
      logNodeResult("Market Analyst", summary);
      graphLogger.nodeDone("Market Analyst", Date.now() - start);
      return { marketReport: summary };
    } catch (err) {
      console.error(`[marketAnalyst] ${err}`);
      return { marketReport: `Lỗi phân tích: ${err}` };
    }
  }

  async function sentimentAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Sentiment Analyst", s.ticker);
    try {
      const r = await runSocialAnalyst(llm, s.dataSnapshot!);
      const summary = r.summary || JSON.stringify(r);
      logNodeResult("Sentiment Analyst", summary);
      graphLogger.nodeDone("Sentiment Analyst", Date.now() - start);
      return { sentimentReport: summary };
    } catch (err) {
      console.error(`[sentimentAnalyst] ${err}`);
      return { sentimentReport: `Lỗi phân tích: ${err}` };
    }
  }

  async function newsAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("News Analyst", s.ticker);
    try {
      const r = await runNewsAnalyst(llm, s.dataSnapshot!);
      const summary = r.summary || JSON.stringify(r);
      logNodeResult("News Analyst", summary);
      graphLogger.nodeDone("News Analyst", Date.now() - start);
      return { newsReport: summary };
    } catch (err) {
      console.error(`[newsAnalyst] ${err}`);
      return { newsReport: `Lỗi phân tích: ${err}` };
    }
  }

  async function fundamentalsAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Fundamentals Analyst", s.ticker);
    try {
      const r = await runFundamentalsAnalyst(llm, s.dataSnapshot!);
      const summary = r.summary || JSON.stringify(r);
      logNodeResult("Fundamentals Analyst", summary);
      graphLogger.nodeDone("Fundamentals Analyst", Date.now() - start);
      return { fundamentalsReport: summary };
    } catch (err) {
      console.error(`[fundamentalsAnalyst] ${err}`);
      return { fundamentalsReport: `Lỗi phân tích: ${err}` };
    }
  }

  // ---------- debate ----------
  async function bullResearcher(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Bull Researcher", `round ${s.debateCount + 1}`);
    try {
      const r = await runBullResearcher(
        llm,
        { summary: s.marketReport || "" }, { summary: s.newsReport || "" },
        { summary: s.sentimentReport || "" }, { summary: s.fundamentalsReport || "" },
        s.ticker, s.debateHistory ? s.debateHistory.split("\n") : []
      );
      logNodeResult("Bull Researcher", r.argument);
      graphLogger.nodeDone("Bull Researcher", Date.now() - start);
      return {
        bullReport: r.argument,
        debateHistory: (s.debateHistory || "") + "\nBull: " + r.argument,
        debateCount: (s.debateCount || 0) + 1,
      };
    } catch (err) {
      console.error(`[bullResearcher] ${err}`);
      return { bullReport: `Lỗi: ${err}`, debateCount: (s.debateCount || 0) + 1 };
    }
  }

  async function bearResearcher(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Bear Researcher", `round ${s.debateCount + 1}`);
    try {
      const r = await runBearResearcher(
        llm,
        { summary: s.marketReport || "" }, { summary: s.newsReport || "" },
        { summary: s.sentimentReport || "" }, { summary: s.fundamentalsReport || "" },
        s.ticker, s.debateHistory ? s.debateHistory.split("\n") : []
      );
      logNodeResult("Bear Researcher", r.argument);
      graphLogger.nodeDone("Bear Researcher", Date.now() - start);
      return {
        bearReport: r.argument,
        debateHistory: (s.debateHistory || "") + "\nBear: " + r.argument,
        debateCount: (s.debateCount || 0) + 1,
      };
    } catch (err) {
      console.error(`[bearResearcher] ${err}`);
      return { bearReport: `Lỗi: ${err}`, debateCount: (s.debateCount || 0) + 1 };
    }
  }

  // FIX #4: conditional edge function cho debate loop
  function shouldContinueDebate(s: State): "bull" | "manager" {
    // debateCount tăng mỗi lần bull hoặc bear chạy → 1 round = 2 increments
    const rounds = Math.floor((s.debateCount || 0) / 2);
    return rounds < MAX_DEBATE_ROUNDS ? "bull" : "manager";
  }

  // ---------- manager ----------
  async function researchManager(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Research Manager");
    try {
      // FIX #2: truyền bullReport và bearReport riêng biệt
      const r = await runResearchManager(
        deepLlm,
        { summary: s.bullReport || s.debateHistory || "" } as any,
        { summary: s.bearReport || s.debateHistory || "" } as any,
        s.debateHistory ? s.debateHistory.split("\n") : [],
        s.dataSnapshot!
      );
      const plan = `Rating: ${r.decision} | Confidence: ${r.confidence} | ${r.reasoning}`;
      logNodeResult("Research Manager", plan);
      graphLogger.nodeDone("Research Manager", Date.now() - start);
      return { investmentPlan: plan };
    } catch (err) {
      console.error(`[researchManager] ${err}`);
      return { investmentPlan: `Lỗi: ${err}` };
    }
  }

  // ---------- trader ----------
  async function trader(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Trader");
    try {
      // Truyền investmentPlan thật vào reasoning
      const r = await runTrader(llm, {
        action: "hold", ticker: s.ticker, confidence: 0.5,
        targetPrice: 0, stopLoss: 0, positionSize: "", timeframe: "",
        reasoning: s.investmentPlan || "",
      } as any, s.dataSnapshot!);
      const plan = `${r.action} ${r.ticker} | Target: ${r.targetPrice} | SL: ${r.stopLoss} | Confidence: ${r.confidence}`;
      logNodeResult("Trader", plan);
      graphLogger.nodeDone("Trader", Date.now() - start);
      // FIX #1: lưu cả structured output để risk team dùng
      return { traderPlan: plan, traderOutput: r };
    } catch (err) {
      console.error(`[trader] ${err}`);
      const fallback: TraderOutput = {
        action: "hold", ticker: s.ticker, confidence: 0,
        targetPrice: 0, stopLoss: 0, positionSize: "N/A",
        timeframe: "N/A", reasoning: `Lỗi: ${err}`,
      };
      return { traderPlan: `Lỗi: ${err}`, traderOutput: fallback };
    }
  }

  // ---------- risk team (song song) — FIX #1 + #3 ----------

  function getTraderOutput(s: State): TraderOutput {
    // FIX #1: dùng traderOutput thật thay vì hardcode "hold"
    return s.traderOutput || {
      action: "hold", ticker: s.ticker, confidence: 0.5,
      targetPrice: 0, stopLoss: 0, positionSize: "", timeframe: "",
      reasoning: s.investmentPlan || "",
    };
  }

  const emptyRiskState: RiskDebateState = {
    history: "", aggressiveHistory: "", conservativeHistory: "", neutralHistory: "",
    latestSpeaker: null, currentAggressiveResponse: "",
    currentConservativeResponse: "", currentNeutralResponse: "", count: 0,
  };

  async function aggressiveAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Aggressive Risk");
    try {
      const r = await runAggressiveAnalyst(llm, getTraderOutput(s), s.dataSnapshot!, emptyRiskState);
      logNodeResult("Aggressive Risk", r);
      graphLogger.nodeDone("Aggressive Risk", Date.now() - start);
      return { aggressiveReport: r };
    } catch (err) {
      console.error(`[aggressiveAnalyst] ${err}`);
      return { aggressiveReport: `Lỗi: ${err}` };
    }
  }

  async function conservativeAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Conservative Risk");
    try {
      const r = await runConservativeAnalyst(llm, getTraderOutput(s), s.dataSnapshot!, emptyRiskState);
      logNodeResult("Conservative Risk", r);
      graphLogger.nodeDone("Conservative Risk", Date.now() - start);
      return { conservativeReport: r };
    } catch (err) {
      console.error(`[conservativeAnalyst] ${err}`);
      return { conservativeReport: `Lỗi: ${err}` };
    }
  }

  async function neutralAnalyst(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Neutral Risk");
    try {
      const r = await runNeutralAnalyst(llm, getTraderOutput(s), s.dataSnapshot!, emptyRiskState);
      logNodeResult("Neutral Risk", r);
      graphLogger.nodeDone("Neutral Risk", Date.now() - start);
      return { neutralReport: r };
    } catch (err) {
      console.error(`[neutralAnalyst] ${err}`);
      return { neutralReport: `Lỗi: ${err}` };
    }
  }

  // ---------- portfolio ----------
  async function portfolioManager(s: State) {
    const start = Date.now();
    graphLogger.nodeStart("Portfolio Manager");
    try {
      // FIX #1: dùng traderOutput thật; FIX #3: dùng reports riêng từ 3 analyst song song
      const riskState: RiskDebateState = {
        ...emptyRiskState,
        history: [s.aggressiveReport, s.conservativeReport, s.neutralReport]
          .filter(Boolean).join("\n\n"),
        aggressiveHistory: s.aggressiveReport || "",
        conservativeHistory: s.conservativeReport || "",
        neutralHistory: s.neutralReport || "",
        currentAggressiveResponse: s.aggressiveReport || "",
        currentConservativeResponse: s.conservativeReport || "",
        currentNeutralResponse: s.neutralReport || "",
      };
      const r = await runPortfolioManager(
        deepLlm,
        getTraderOutput(s),
        riskState,
        s.dataSnapshot!,
        s.investmentPlan,
        s.pastExperience
      );
      const decision = `${r.finalDecision} | ${r.action} | ${r.reasoning}`;
      logNodeResult("Portfolio Manager", decision);
      await memory.saveEpisodicMemory(["trading", "experiences"], `${s.ticker}-${s.date}`, {
        ticker: s.ticker, date: s.date, event: "Analysis", outcome: decision, lesson: "",
      });
      graphLogger.nodeDone("Portfolio Manager", Date.now() - start);
      return { finalDecision: decision };
    } catch (err) {
      console.error(`[portfolioManager] ${err}`);
      return { finalDecision: `Lỗi Portfolio Manager: ${err}` };
    }
  }

  async function saveExperience(s: State) {
    return { pastExperience: s.pastExperience };
  }

  return {
    fetchData, loadExperience,
    marketAnalyst, sentimentAnalyst, newsAnalyst, fundamentalsAnalyst,
    bullResearcher, bearResearcher, shouldContinueDebate, researchManager,
    trader, aggressiveAnalyst, conservativeAnalyst, neutralAnalyst,
    portfolioManager, saveExperience,
  };
}

// ==================== BUILD GRAPH ====================

export function buildTradingGraph(llm: ChatOpenAI, deepLlm: ChatOpenAI) {
  const n = createNodes(llm, deepLlm);

  return new StateGraph(State)
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
    // FIX #3: risk team song song
    .addNode("aggressive", n.aggressiveAnalyst)
    .addNode("conservative", n.conservativeAnalyst)
    .addNode("neutral", n.neutralAnalyst)
    .addNode("portfolio", n.portfolioManager)
    .addNode("save", n.saveExperience)
    // fetch → load → 4 analysts song song
    .addEdge(START, "fetch")
    .addEdge("fetch", "load")
    .addEdge("load", "market")
    .addEdge("load", "sentiment")
    .addEdge("load", "news")
    .addEdge("load", "fundamentals")
    // fan-in 4 analysts → bull
    .addEdge("market", "bull")
    .addEdge("sentiment", "bull")
    .addEdge("news", "bull")
    .addEdge("fundamentals", "bull")
    // bull → bear → FIX #4: conditional loop
    .addEdge("bull", "bear")
    .addConditionalEdges("bear", n.shouldContinueDebate, { bull: "bull", manager: "manager" })
    // manager → trader → risk team (3 song song) → portfolio
    .addEdge("manager", "trader")
    .addEdge("trader", "aggressive")
    .addEdge("trader", "conservative")
    .addEdge("trader", "neutral")
    // fan-in 3 risk analysts → portfolio
    .addEdge("aggressive", "portfolio")
    .addEdge("conservative", "portfolio")
    .addEdge("neutral", "portfolio")
    .addEdge("portfolio", "save")
    .addEdge("save", END)
    .compile();
}

// ==================== ANALYZE ====================

export async function analyze(llm: ChatOpenAI, ticker: string, date: string): Promise<string> {
  logAnalysisStart(ticker);

  const deepLlm = new ChatOpenAI({
    model: process.env.DEEP_MODEL || "nvidia/deepseek-ai/deepseek-v4-pro",
    apiKey: process.env.LLM_API_KEY,
    temperature: 0.3,
    configuration: { baseURL: process.env.LLM_BASE_URL || "http://localhost:20128/v1" },
  });

  const graph = buildTradingGraph(llm, deepLlm);

  logAnalysisStep(1, 7, "Load Past Experience");
  logAnalysisStep(2, 7, "4 Analysts (Market, Sentiment, News, Fundamentals)");
  logAnalysisStep(3, 7, `Bull/Bear Debate (${MAX_DEBATE_ROUNDS} rounds)`);
  logAnalysisStep(4, 7, "Research Manager");
  logAnalysisStep(5, 7, "Trader");
  logAnalysisStep(6, 7, "Risk Team (Aggressive, Conservative, Neutral) — song song");
  logAnalysisStep(7, 7, "Portfolio Manager");
  console.log("\n");

  const result = await graph.invoke({
    ticker, date,
    dataSnapshot: await buildDataSnapshot(ticker, date),
    marketReport: "", sentimentReport: "", newsReport: "", fundamentalsReport: "",
    bullReport: "", bearReport: "",
    debateHistory: "", debateCount: 0,
    investmentPlan: "", traderPlan: "", traderOutput: null,
    aggressiveReport: "", conservativeReport: "", neutralReport: "",
    finalDecision: "", pastExperience: "",
  });

  return result.finalDecision || "Không có kết quả";
}
