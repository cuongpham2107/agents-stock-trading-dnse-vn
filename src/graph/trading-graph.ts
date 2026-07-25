import { StateGraph, Annotation, START, END, Send } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import type {
  DataSnapshot,
  RiskDebateState,
} from "../types/index";
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
import { AnalysisStore } from "./stores";
import { LongTermMemoryManager } from "../memory/long-term";

// ==================== STATE ANNOTATION ====================

export const TradingStateAnnotation = Annotation.Root({
  ticker: Annotation<string>,
  date: Annotation<string>,
  dataSnapshot: Annotation<DataSnapshot | null>,

  // Analyst reports
  marketReport: Annotation<string>,
  sentimentReport: Annotation<string>,
  newsReport: Annotation<string>,
  fundamentalsReport: Annotation<string>,

  // Investment debate state
  investmentDebateState: Annotation<{
    history: string;
    bullHistory: string;
    bearHistory: string;
    currentResponse: string;
    judgeDecision: string;
    count: number;
  }>,
  investmentPlan: Annotation<string>,

  // Trader output
  traderInvestmentPlan: Annotation<string>,

  // Risk debate state
  riskDebateState: Annotation<RiskDebateState>,

  // Final output
  finalTradeDecision: Annotation<string>,

  // Memory
  pastExperience: Annotation<string>,

  // Error handling
  error: Annotation<string | null>,
  retryCount: Annotation<number>,

  // Metadata
  messages: Annotation<unknown[]>,
});

export type TradingState = typeof TradingStateAnnotation.State;

// ==================== GRAPH NODES ====================

function createGraphNodes(llm: ChatOpenAI, deepLlm: ChatOpenAI) {
  const analysisStore = new AnalysisStore();
  const memoryManager = new LongTermMemoryManager();

  // Node: Load Past Experience
  async function loadPastExperience(state: TradingState) {
    console.log("[Memory] Đang tải kinh nghiệm quá khứ...");

    const ticker = state.ticker;
    const experiences = memoryManager.searchMemories(
      ["trading", "experiences"],
      ticker
    );

    let pastExperience = "";
    if (experiences.length > 0) {
      pastExperience = `Kinh nghiệm quá khứ với ${ticker}:\n`;
      for (const exp of experiences.slice(0, 5)) {
        const e = exp as any;
        pastExperience += `- ${e.date}: ${e.event} → ${e.outcome} (${e.lesson})\n`;
      }
    }

    console.log(`[Memory] Tìm thấy ${experiences.length} kinh nghiệm quá khứ`);
    return { pastExperience };
  }

  // Node: Save Current Experience
  async function saveCurrentExperience(state: TradingState) {
    console.log("[Memory] Đang lưu kinh nghiệm hiện tại...");

    const ticker = state.ticker;
    const date = state.date;
    const finalDecision = state.finalTradeDecision;

    if (finalDecision) {
      await memoryManager.saveEpisodicMemory(
        ["trading", "experiences"],
        `${ticker}-${date}`,
        {
          ticker,
          date,
          event: "Phân tích và quyết định giao dịch",
          outcome: finalDecision,
          lesson: "", // Để trống, sẽ được cập nhật sau khi có kết quả thực tế
        }
      );
      console.log(`[Memory] Đã lưu kinh nghiệm cho ${ticker} ngày ${date}`);
    }

    return { pastExperience: state.pastExperience };
  }

  // Node: Parallel Analysts (dùng Send API)

  // Node: Parallel Analysts (dùng Send API)
  async function runAnalystsParallel(state: TradingState) {
    console.log("[Graph] Chạy 4 Analysts song song...");

    const snapshot = state.dataSnapshot!;
    const ticker = state.ticker;

    // Fan-out to parallel analysts using Send
    return [
      new Send("Market Analyst", { ticker, snapshot }),
      new Send("Sentiment Analyst", { ticker, snapshot }),
      new Send("News Analyst", { ticker, snapshot }),
      new Send("Fundamentals Analyst", { ticker, snapshot }),
    ];
  }

  // Node: Market Analyst
  async function marketAnalyst(state: TradingState) {
    console.log("[Graph] Đang chạy Market Analyst...");
    const result = await runMarketAnalyst(llm, state.dataSnapshot!);
    return {
      marketReport: result.summary || JSON.stringify(result),
    };
  }

  // Node: Sentiment Analyst
  async function sentimentAnalyst(state: TradingState) {
    console.log("[Graph] Đang chạy Sentiment Analyst...");
    const result = await runSocialAnalyst(llm, state.dataSnapshot!);
    return {
      sentimentReport: result.summary || JSON.stringify(result),
    };
  }

  // Node: News Analyst
  async function newsAnalyst(state: TradingState) {
    console.log("[Graph] Đang chạy News Analyst...");
    const result = await runNewsAnalyst(llm, state.dataSnapshot!);
    return {
      newsReport: result.summary || JSON.stringify(result),
    };
  }

  // Node: Fundamentals Analyst
  async function fundamentalsAnalyst(state: TradingState) {
    console.log("[Graph] Đang chạy Fundamentals Analyst...");
    const result = await runFundamentalsAnalyst(llm, state.dataSnapshot!);
    return {
      fundamentalsReport: result.summary || JSON.stringify(result),
    };
  }

  // Node: Aggregate Analyst Reports
  async function aggregateAnalystReports(state: TradingState) {
    console.log("[Graph] Tổng hợp báo cáo analysts...");
    return {
      messages: [
        { role: "assistant", content: `Đã tổng hợp 4 báo cáo phân tích cho ${state.ticker}` },
      ],
    };
  }

  // Node: Bull Researcher
  async function bullResearcher(state: TradingState) {
    console.log("[Graph] Đang chạy Bull Researcher...");
    console.log("[Graph] State keys:", Object.keys(state));
    console.log("[Graph] investmentDebateState:", state.investmentDebateState);
    const debateState = state.investmentDebateState;

    // Tạo report objects với summary
    const marketReport = { summary: state.marketReport || "" };
    const newsReport = { summary: state.newsReport || "" };
    const sentimentReport = { summary: state.sentimentReport || "" };
    const fundamentalsReport = { summary: state.fundamentalsReport || "" };

    const bullReport = await runBullResearcher(
      llm,
      marketReport,
      newsReport,
      sentimentReport,
      fundamentalsReport,
      state.ticker,
      debateState.history ? debateState.history.split("\n") : []
    );

    const argument = `Bull Researcher: ${bullReport.argument}`;

    return {
      investmentDebateState: {
        ...debateState,
        history: debateState.history + "\n" + argument,
        bullHistory: debateState.bullHistory + "\n" + argument,
        count: debateState.count + 1,
      },
    };
  }

  // Node: Bear Researcher
  async function bearResearcher(state: TradingState) {
    console.log("[Graph] Đang chạy Bear Researcher...");
    const debateState = state.investmentDebateState;

    // Tạo report objects với summary
    const marketReport = { summary: state.marketReport || "" };
    const newsReport = { summary: state.newsReport || "" };
    const sentimentReport = { summary: state.sentimentReport || "" };
    const fundamentalsReport = { summary: state.fundamentalsReport || "" };

    const bearReport = await runBearResearcher(
      llm,
      marketReport,
      newsReport,
      sentimentReport,
      fundamentalsReport,
      state.ticker,
      debateState.history ? debateState.history.split("\n") : []
    );

    const argument = `Bear Researcher: ${bearReport.argument}`;

    return {
      investmentDebateState: {
        ...debateState,
        history: debateState.history + "\n" + argument,
        bearHistory: debateState.bearHistory + "\n" + argument,
        count: debateState.count + 1,
      },
    };
  }

  // Node: Research Manager
  async function researchManager(state: TradingState) {
    console.log("[Graph] Đang chạy Research Manager...");
    const snapshot = state.dataSnapshot!;
    const debateState = state.investmentDebateState;

    const bullReport = { argument: debateState.bullHistory, summary: debateState.bullHistory };
    const bearReport = { argument: debateState.bearHistory, summary: debateState.bearHistory };

    const decision = await runResearchManager(
      deepLlm,
      bullReport as any,
      bearReport as any,
      debateState.history ? debateState.history.split("\n") : [],
      snapshot
    );

    const investmentPlan = `Investment Plan: ${decision.reasoning}\nRating: ${decision.decision}\nConfidence: ${decision.confidence}`;

    return {
      investmentDebateState: {
        ...debateState,
        judgeDecision: investmentPlan,
        currentResponse: investmentPlan,
      },
      investmentPlan,
    };
  }

  // Node: Trader
  async function trader(state: TradingState) {
    console.log("[Graph] Đang chạy Trader...");
    const snapshot = state.dataSnapshot!;

    const researchDecision = {
      decision: "neutral" as const,
      confidence: 0.5,
      reasoning: state.investmentPlan,
      bullSummary: "",
      bearSummary: "",
      keyFactors: [],
    };

    const decision = await runTrader(llm, researchDecision, snapshot);

    const traderPlan = `Trader Proposal: ${decision.action.toUpperCase()} ${decision.ticker}\nTarget: ${decision.targetPrice}\nStop Loss: ${decision.stopLoss}\nReasoning: ${decision.reasoning}`;

    return {
      traderInvestmentPlan: traderPlan,
    };
  }

  // Node: Risk Team (Parallel with Send)
  async function runRiskTeamParallel(state: TradingState) {
    console.log("[Graph] Chạy Risk Team song song...");
    const snapshot = state.dataSnapshot!;
    const riskState = state.riskDebateState;
    const traderDecision = JSON.parse(state.traderInvestmentPlan || "{}");

    return [
      new Send("Aggressive Analyst", { snapshot, riskState, traderDecision }),
      new Send("Conservative Analyst", { snapshot, riskState, traderDecision }),
      new Send("Neutral Analyst", { snapshot, riskState, traderDecision }),
    ];
  }

  // Node: Aggressive Analyst
  async function aggressiveAnalyst(state: TradingState) {
    console.log("[Graph] Đang chạy Aggressive Risk Analyst...");
    const snapshot = state.dataSnapshot!;
    const riskState = state.riskDebateState;
    const traderDecision = JSON.parse(state.traderInvestmentPlan || "{}");
    const response = await runAggressiveAnalyst(llm, traderDecision, snapshot, riskState);
    return {
      riskDebateState: {
        ...riskState,
        history: riskState.history + "\n" + response,
        aggressiveHistory: riskState.aggressiveHistory + "\n" + response,
        latestSpeaker: "Aggressive" as const,
        currentAggressiveResponse: response,
        count: riskState.count + 1,
      },
    };
  }

  // Node: Conservative Analyst
  async function conservativeAnalyst(state: TradingState) {
    console.log("[Graph] Đang chạy Conservative Risk Analyst...");
    const snapshot = state.dataSnapshot!;
    const riskState = state.riskDebateState;
    const traderDecision = JSON.parse(state.traderInvestmentPlan || "{}");
    const response = await runConservativeAnalyst(llm, traderDecision, snapshot, riskState);
    return {
      riskDebateState: {
        ...riskState,
        history: riskState.history + "\n" + response,
        conservativeHistory: riskState.conservativeHistory + "\n" + response,
        latestSpeaker: "Conservative" as const,
        currentConservativeResponse: response,
        count: riskState.count + 1,
      },
    };
  }

  // Node: Neutral Analyst
  async function neutralAnalyst(state: TradingState) {
    console.log("[Graph] Đang chạy Neutral Risk Analyst...");
    const snapshot = state.dataSnapshot!;
    const riskState = state.riskDebateState;
    const traderDecision = JSON.parse(state.traderInvestmentPlan || "{}");
    const response = await runNeutralAnalyst(llm, traderDecision, snapshot, riskState);
    return {
      riskDebateState: {
        ...riskState,
        history: riskState.history + "\n" + response,
        neutralHistory: riskState.neutralHistory + "\n" + response,
        latestSpeaker: "Neutral" as const,
        currentNeutralResponse: response,
        count: riskState.count + 1,
      },
    };
  }

  // Node: Aggregate Risk Reports
  async function aggregateRiskReports(state: TradingState) {
    console.log("[Graph] Tổng hợp báo cáo risk...");
    return {
      messages: [
        { role: "assistant", content: `Đã tổng hợp báo cáo risk cho ${state.ticker}` },
      ],
    };
  }

  // Node: Portfolio Manager
  async function portfolioManager(state: TradingState) {
    console.log("[Graph] Đang chạy Portfolio Manager...");
    const snapshot = state.dataSnapshot!;
    const riskState = state.riskDebateState;
    const traderDecision = JSON.parse(state.traderInvestmentPlan || "{}");

    const decision = await runPortfolioManager(deepLlm, traderDecision, riskState, snapshot);

    const finalDecision = `FINAL TRADE DECISION: ${decision.finalDecision.toUpperCase()} ${decision.ticker}\nAction: ${decision.action.toUpperCase()}\nReasoning: ${decision.reasoning}`;

    // Lưu kết quả vào store
    analysisStore.save({
      ticker: state.ticker,
      date: state.date,
      result: finalDecision,
      timestamp: Date.now(),
    });

    return {
      finalTradeDecision: finalDecision,
      riskDebateState: {
        ...riskState,
        judgeDecision: finalDecision,
      },
    };
  }

  // Node: Error Handler
  async function errorHandler(state: TradingState) {
    console.log(`[Graph] Xử lý lỗi: ${state.error}`);
    return {
      error: null,
      retryCount: state.retryCount + 1,
    };
  }

  return {
    runAnalystsParallel,
    marketAnalyst,
    sentimentAnalyst,
    newsAnalyst,
    fundamentalsAnalyst,
    aggregateAnalystReports,
    bullResearcher,
    bearResearcher,
    researchManager,
    trader,
    runRiskTeamParallel,
    aggressiveAnalyst,
    conservativeAnalyst,
    neutralAnalyst,
    aggregateRiskReports,
    portfolioManager,
    errorHandler,
    loadPastExperience,
    saveCurrentExperience,
  };
}

// ==================== CONDITIONAL EDGES ====================

function shouldContinueDebate(state: TradingState): string {
  const maxRounds = 2;
  const count = state.investmentDebateState?.count ?? 0;

  console.log(`[Debate] Round ${count}, max: ${maxRounds * 2}, count % 2 = ${count % 2}`);

  let destination: string;
  if (count >= maxRounds * 2) {
    destination = "Research Manager";
  } else {
    destination = count % 2 === 0 ? "Bear Researcher" : "Bull Researcher";
  }

  console.log(`[Debate] Destination: "${destination}"`);
  return destination;
}

function shouldRetry(state: TradingState): string {
  const maxRetries = 3;
  if (state.error && state.retryCount < maxRetries) {
    return "Error Handler";
  }
  return "continue";
}

// ==================== BUILD GRAPH ====================

export function buildTradingGraph(llm: ChatOpenAI, deepLlm: ChatOpenAI) {
  const nodes = createGraphNodes(llm, deepLlm);

  const workflow = new StateGraph(TradingStateAnnotation)
    // Memory
    .addNode("Load Past Experience", nodes.loadPastExperience)
    .addNode("Save Experience", nodes.saveCurrentExperience)

    // Analysts (Sequential)
    .addNode("Market Analyst", nodes.marketAnalyst)
    .addNode("Sentiment Analyst", nodes.sentimentAnalyst)
    .addNode("News Analyst", nodes.newsAnalyst)
    .addNode("Fundamentals Analyst", nodes.fundamentalsAnalyst)
    .addNode("Aggregate Reports", nodes.aggregateAnalystReports)

    // Debate
    .addNode("Bull Researcher", nodes.bullResearcher)
    .addNode("Bear Researcher", nodes.bearResearcher)
    .addNode("Research Manager", nodes.researchManager)

    // Trader
    .addNode("Trader", nodes.trader)

    // Risk Team (Sequential)
    .addNode("Aggressive Analyst", nodes.aggressiveAnalyst)
    .addNode("Conservative Analyst", nodes.conservativeAnalyst)
    .addNode("Neutral Analyst", nodes.neutralAnalyst)
    .addNode("Aggregate Risk Reports", nodes.aggregateRiskReports)

    // Portfolio Manager
    .addNode("Portfolio Manager", nodes.portfolioManager)

    // ===== EDGES =====

    // Start → Load Past Experience
    .addEdge(START, "Load Past Experience")

    // Load Past Experience → Analysts (Sequential)
    .addEdge("Load Past Experience", "Market Analyst")
    .addEdge("Market Analyst", "Sentiment Analyst")
    .addEdge("Sentiment Analyst", "News Analyst")
    .addEdge("News Analyst", "Fundamentals Analyst")
    .addEdge("Fundamentals Analyst", "Aggregate Reports")

    // Aggregate → Bull Researcher
    .addEdge("Aggregate Reports", "Bull Researcher")

    // Debate Loop
    .addConditionalEdges("Bull Researcher", shouldContinueDebate, {
      "Bear Researcher": "Bear Researcher",
      "Research Manager": "Research Manager",
    })
    .addConditionalEdges("Bear Researcher", shouldContinueDebate, {
      "Bull Researcher": "Bull Researcher",
      "Research Manager": "Research Manager",
    })

    // Research Manager → Trader
    .addEdge("Research Manager", "Trader")

    // Trader → Risk Team (Sequential)
    .addEdge("Trader", "Aggressive Analyst")
    .addEdge("Aggressive Analyst", "Conservative Analyst")
    .addEdge("Conservative Analyst", "Neutral Analyst")
    .addEdge("Neutral Analyst", "Aggregate Risk Reports")

    // Aggregate Risk → Portfolio Manager
    .addEdge("Aggregate Risk Reports", "Portfolio Manager")

    // Portfolio Manager → Save Experience
    .addEdge("Portfolio Manager", "Save Experience")

    // Save Experience → End
    .addEdge("Save Experience", END);

  return workflow.compile();
}

// ==================== MAIN ANALYZE FUNCTION ====================

export async function analyze(
  llm: ChatOpenAI,
  ticker: string,
  date: string
): Promise<string> {
  const deepLlm = new ChatOpenAI({ temperature: 0.3 });

  const graph = buildTradingGraph(llm, deepLlm);

  const initialRiskState: RiskDebateState = {
    history: "",
    aggressiveHistory: "",
    conservativeHistory: "",
    neutralHistory: "",
    latestSpeaker: null,
    currentAggressiveResponse: "",
    currentConservativeResponse: "",
    currentNeutralResponse: "",
    count: 0,
  };

  const initialState: Partial<TradingState> = {
    ticker,
    date,
    dataSnapshot: {
      ticker,
      date,
      closePrice: 0,
      ohlcHistory: [],
      latestTrades: [],
      latestQuotes: {},
      foreignTrading: {},
      secDef: {},
      instruments: {},
      marketNews: "",
      socialSentiment: "",
      marketReport: "",
      sentimentReport: "",
      newsReport: "",
      fundamentalsReport: "",
    },
    marketReport: "",
    sentimentReport: "",
    newsReport: "",
    fundamentalsReport: "",
    investmentDebateState: {
      history: "",
      bullHistory: "",
      bearHistory: "",
      currentResponse: "",
      judgeDecision: "",
      count: 0,
    },
    investmentPlan: "",
    traderInvestmentPlan: "",
    riskDebateState: initialRiskState,
    finalTradeDecision: "",
    pastExperience: "",
    error: null,
    retryCount: 0,
    messages: [],
  };

  const result = await graph.invoke(initialState);

  return result.finalTradeDecision || "Không có kết quả";
}

// ==================== STREAMING ANALYZE ====================

export async function* analyzeStreaming(
  llm: ChatOpenAI,
  ticker: string,
  date: string
) {
  const deepLlm = new ChatOpenAI({ temperature: 0.3 });
  const graph = buildTradingGraph(llm, deepLlm);

  const initialRiskState: RiskDebateState = {
    history: "",
    aggressiveHistory: "",
    conservativeHistory: "",
    neutralHistory: "",
    latestSpeaker: null,
    currentAggressiveResponse: "",
    currentConservativeResponse: "",
    currentNeutralResponse: "",
    count: 0,
  };

  const initialState: Partial<TradingState> = {
    ticker,
    date,
    dataSnapshot: {
      ticker,
      date,
      closePrice: 0,
      ohlcHistory: [],
      latestTrades: [],
      latestQuotes: {},
      foreignTrading: {},
      secDef: {},
      instruments: {},
      marketNews: "",
      socialSentiment: "",
      marketReport: "",
      sentimentReport: "",
      newsReport: "",
      fundamentalsReport: "",
    },
    marketReport: "",
    sentimentReport: "",
    newsReport: "",
    fundamentalsReport: "",
    investmentDebateState: {
      history: "",
      bullHistory: "",
      bearHistory: "",
      currentResponse: "",
      judgeDecision: "",
      count: 0,
    },
    investmentPlan: "",
    traderInvestmentPlan: "",
    riskDebateState: initialRiskState,
    finalTradeDecision: "",
    pastExperience: "",
    error: null,
    retryCount: 0,
    messages: [],
  };

  // Stream updates
  const streamIterable = await graph.stream(initialState, { streamMode: "updates" });
  for await (const chunk of streamIterable) {
    yield chunk;
  }
}
