import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import type {
  DataSnapshot,
  MarketAnalystOutput,
  NewsAnalystOutput,
  SocialAnalystOutput,
  FundamentalsAnalystOutput,
  BullResearcherOutput,
  BearResearcherOutput,
  ResearchManagerOutput,
  TraderOutput,
  RiskDebateState,
  PortfolioManagerOutput,
} from "../types/index.ts";
import { runMarketAnalyst } from "../agents/analysts/market-analyst.ts";
import { runNewsAnalyst } from "../agents/analysts/news-analyst.ts";
import { runSocialAnalyst } from "../agents/analysts/social-analyst.ts";
import { runFundamentalsAnalyst } from "../agents/analysts/fundamentals-analyst.ts";
import { runBullResearcher } from "../agents/researchers/bull-researcher.ts";
import { runBearResearcher } from "../agents/researchers/bear-researcher.ts";
import { runResearchManager } from "../agents/managers/research-manager.ts";
import { runTrader } from "../agents/trader/trader.ts";
import { runAggressiveAnalyst, runConservativeAnalyst, runNeutralAnalyst } from "../agents/risk/risk-debate.ts";
import { runPortfolioManager } from "../agents/managers/portfolio-manager.ts";

// ==================== STATE ANNOTATION ====================

const TradingStateAnnotation = Annotation.Root({
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

  // Metadata
  error: Annotation<string | null>,
  messages: Annotation<unknown[]>,
});

// ==================== GRAPH NODES ====================

function createGraphNodes(llm: ChatOpenAI, deepLlm: ChatOpenAI) {
  // Node: Market Analyst
  async function marketAnalyst(state: typeof TradingStateAnnotation.State) {
    console.log("[Graph] Đang chạy Market Analyst...");

    const snapshot = state.dataSnapshot!;
    const result = await runMarketAnalyst(llm, snapshot);

    return {
      marketReport: result.summary || JSON.stringify(result),
      messages: [{ role: "assistant", content: result.summary || JSON.stringify(result) }],
    };
  }

  // Node: Social/Sentiment Analyst
  async function socialAnalyst(state: typeof TradingStateAnnotation.State) {
    console.log("[Graph] Đang chạy Sentiment Analyst...");

    const snapshot = state.dataSnapshot!;
    const result = await runSocialAnalyst(llm, snapshot);

    return {
      sentimentReport: result.summary || JSON.stringify(result),
      messages: [{ role: "assistant", content: result.summary || JSON.stringify(result) }],
    };
  }

  // Node: News Analyst
  async function newsAnalyst(state: typeof TradingStateAnnotation.State) {
    console.log("[Graph] Đang chạy News Analyst...");

    const snapshot = state.dataSnapshot!;
    const result = await runNewsAnalyst(llm, snapshot);

    return {
      newsReport: result.summary || JSON.stringify(result),
      messages: [{ role: "assistant", content: result.summary || JSON.stringify(result) }],
    };
  }

  // Node: Fundamentals Analyst
  async function fundamentalsAnalyst(state: typeof TradingStateAnnotation.State) {
    console.log("[Graph] Đang chạy Fundamentals Analyst...");

    const snapshot = state.dataSnapshot!;
    const result = await runFundamentalsAnalyst(llm, snapshot);

    return {
      fundamentalsReport: result.summary || JSON.stringify(result),
      messages: [{ role: "assistant", content: result.summary || JSON.stringify(result) }],
    };
  }

  // Node: Clear Messages (between analysts)
  async function clearMessages(state: typeof TradingStateAnnotation.State) {
    return { messages: [] };
  }

  // Node: Bull Researcher
  async function bullResearcher(state: typeof TradingStateAnnotation.State) {
    console.log("[Graph] Đang chạy Bull Researcher...");

    const snapshot = state.dataSnapshot!;
    const debateState = state.investmentDebateState;

    const marketReport = JSON.parse(state.marketReport || "{}");
    const newsReport = JSON.parse(state.newsReport || "{}");
    const sentimentReport = JSON.parse(state.sentimentReport || "{}");
    const fundamentalsReport = JSON.parse(state.fundamentalsReport || "{}");

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
      messages: [{ role: "assistant", content: argument }],
    };
  }

  // Node: Bear Researcher
  async function bearResearcher(state: typeof TradingStateAnnotation.State) {
    console.log("[Graph] Đang chạy Bear Researcher...");

    const snapshot = state.dataSnapshot!;
    const debateState = state.investmentDebateState;

    const marketReport = JSON.parse(state.marketReport || "{}");
    const newsReport = JSON.parse(state.newsReport || "{}");
    const sentimentReport = JSON.parse(state.sentimentReport || "{}");
    const fundamentalsReport = JSON.parse(state.fundamentalsReport || "{}");

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
      messages: [{ role: "assistant", content: argument }],
    };
  }

  // Node: Research Manager
  async function researchManager(state: typeof TradingStateAnnotation.State) {
    console.log("[Graph] Đang chạy Research Manager...");

    const snapshot = state.dataSnapshot!;
    const debateState = state.investmentDebateState;

    const bullReport = { argument: debateState.bullHistory, summary: debateState.bullHistory };
    const bearReport = { argument: debateState.bearHistory, summary: debateState.bearHistory };

    const decision = await runResearchManager(
      deepLlm,
      bullReport as BullResearcherOutput,
      bearReport as BearResearcherOutput,
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
      messages: [{ role: "assistant", content: investmentPlan }],
    };
  }

  // Node: Trader
  async function trader(state: typeof TradingStateAnnotation.State) {
    console.log("[Graph] Đang chạy Trader...");

    const snapshot = state.dataSnapshot!;

    const researchDecision: ResearchManagerOutput = {
      decision: "neutral",
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
      messages: [{ role: "assistant", content: traderPlan }],
    };
  }

  // Node: Aggressive Risk Analyst
  async function aggressiveAnalyst(state: typeof TradingStateAnnotation.State) {
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
        latestSpeaker: "Aggressive",
        currentAggressiveResponse: response,
        count: riskState.count + 1,
      },
      messages: [{ role: "assistant", content: response }],
    };
  }

  // Node: Conservative Risk Analyst
  async function conservativeAnalyst(state: typeof TradingStateAnnotation.State) {
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
        latestSpeaker: "Conservative",
        currentConservativeResponse: response,
        count: riskState.count + 1,
      },
      messages: [{ role: "assistant", content: response }],
    };
  }

  // Node: Neutral Risk Analyst
  async function neutralAnalyst(state: typeof TradingStateAnnotation.State) {
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
        latestSpeaker: "Neutral",
        currentNeutralResponse: response,
        count: riskState.count + 1,
      },
      messages: [{ role: "assistant", content: response }],
    };
  }

  // Node: Portfolio Manager
  async function portfolioManager(state: typeof TradingStateAnnotation.State) {
    console.log("[Graph] Đang chạy Portfolio Manager...");

    const snapshot = state.dataSnapshot!;
    const riskState = state.riskDebateState;

    const traderDecision = {
      action: "hold" as const,
      ticker: state.ticker,
      confidence: 0.5,
      targetPrice: snapshot.closePrice,
      stopLoss: snapshot.closePrice * 0.95,
      positionSize: "Không xác định",
      timeframe: "Không xác định",
      reasoning: state.traderInvestmentPlan,
    };

    const decision = await runPortfolioManager(
      deepLlm,
      traderDecision,
      riskState,
      snapshot,
      state.investmentPlan
    );

    const finalDecision = `FINAL TRADE DECISION: ${decision.finalDecision.toUpperCase()} ${decision.ticker}\nAction: ${decision.action.toUpperCase()}\nReasoning: ${decision.reasoning}`;

    return {
      finalTradeDecision: finalDecision,
      riskDebateState: {
        ...riskState,
        judgeDecision: finalDecision,
      },
      messages: [{ role: "assistant", content: finalDecision }],
    };
  }

  return {
    marketAnalyst,
    socialAnalyst,
    newsAnalyst,
    fundamentalsAnalyst,
    clearMessages,
    bullResearcher,
    bearResearcher,
    researchManager,
    trader,
    aggressiveAnalyst,
    conservativeAnalyst,
    neutralAnalyst,
    portfolioManager,
  };
}

// ==================== CONDITIONAL LOGIC ====================

function shouldContinueDebate(state: typeof TradingStateAnnotation.State): string {
  const debateState = state.investmentDebateState;
  const maxRounds = 2;

  if (debateState.count >= maxRounds * 2) {
    return "Research Manager";
  }

  if (debateState.count % 2 === 0) {
    return "Bull Researcher";
  }
  return "Bear Researcher";
}

function shouldContinueRiskAnalysis(state: typeof TradingStateAnnotation.State): string {
  const riskState = state.riskDebateState;
  const maxRounds = 2;

  if (riskState.count >= maxRounds * 3) {
    return "Portfolio Manager";
  }

  const lastSpeaker = riskState.latestSpeaker;
  if (lastSpeaker === "Aggressive" || lastSpeaker === null) {
    return "Conservative Analyst";
  }
  if (lastSpeaker === "Conservative") {
    return "Neutral Analyst";
  }
  return "Aggressive Analyst";
}

// ==================== BUILD GRAPH ====================

export function buildTradingGraph(llm: ChatOpenAI, deepLlm: ChatOpenAI) {
  const nodes = createGraphNodes(llm, deepLlm);

  const workflow = new StateGraph(TradingStateAnnotation)
    // Add analyst nodes (sequential)
    .addNode("Market Analyst", nodes.marketAnalyst)
    .addNode("Sentiment Analyst", nodes.socialAnalyst)
    .addNode("News Analyst", nodes.newsAnalyst)
    .addNode("Fundamentals Analyst", nodes.fundamentalsAnalyst)
    .addNode("Clear Messages", nodes.clearMessages)

    // Add debate nodes
    .addNode("Bull Researcher", nodes.bullResearcher)
    .addNode("Bear Researcher", nodes.bearResearcher)
    .addNode("Research Manager", nodes.researchManager)

    // Add trader
    .addNode("Trader", nodes.trader)

    // Add risk analysis nodes
    .addNode("Aggressive Analyst", nodes.aggressiveAnalyst)
    .addNode("Conservative Analyst", nodes.conservativeAnalyst)
    .addNode("Neutral Analyst", nodes.neutralAnalyst)
    .addNode("Portfolio Manager", nodes.portfolioManager)

    // Define edges - Analysts run sequentially
    .addEdge(START, "Market Analyst")
    .addEdge("Market Analyst", "Clear Messages")
    .addEdge("Clear Messages", "Sentiment Analyst")
    .addEdge("Sentiment Analyst", "Clear Messages")
    .addEdge("Clear Messages", "News Analyst")
    .addEdge("News Analyst", "Clear Messages")
    .addEdge("Clear Messages", "Fundamentals Analyst")
    .addEdge("Fundamentals Analyst", "Clear Messages")
    .addEdge("Clear Messages", "Bull Researcher")

    // Debate loop
    .addConditionalEdges("Bull Researcher", shouldContinueDebate, {
      "Bear Researcher": "Bear Researcher",
      "Research Manager": "Research Manager",
    })
    .addConditionalEdges("Bear Researcher", shouldContinueDebate, {
      "Bull Researcher": "Bull Researcher",
      "Research Manager": "Research Manager",
    })

    // Research Manager -> Trader
    .addEdge("Research Manager", "Trader")

    // Trader -> Risk Analysis
    .addEdge("Trader", "Aggressive Analyst")

    // Risk analysis loop
    .addConditionalEdges("Aggressive Analyst", shouldContinueRiskAnalysis, {
      "Conservative Analyst": "Conservative Analyst",
      "Neutral Analyst": "Neutral Analyst",
      "Portfolio Manager": "Portfolio Manager",
    })
    .addConditionalEdges("Conservative Analyst", shouldContinueRiskAnalysis, {
      "Aggressive Analyst": "Aggressive Analyst",
      "Neutral Analyst": "Neutral Analyst",
      "Portfolio Manager": "Portfolio Manager",
    })
    .addConditionalEdges("Neutral Analyst", shouldContinueRiskAnalysis, {
      "Aggressive Analyst": "Aggressive Analyst",
      "Conservative Analyst": "Conservative Analyst",
      "Portfolio Manager": "Portfolio Manager",
    })

    // Portfolio Manager -> END
    .addEdge("Portfolio Manager", END);

  return workflow.compile();
}

// ==================== MAIN ANALYZE FUNCTION ====================

export async function analyze(
  llm: ChatOpenAI,
  ticker: string,
  date: string
): Promise<string> {
  const deepLlm = new ChatOpenAI({
    temperature: 0.3,
  });

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

  const initialState: Partial<typeof TradingStateAnnotation.State> = {
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
    error: null,
    messages: [],
  };

  const result = await graph.invoke(initialState);

  return result.finalTradeDecision || "Không có kết quả";
}
