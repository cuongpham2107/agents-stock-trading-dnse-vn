import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { RiskStateAnnotation, type RiskState } from "../state";
import {
  runAggressiveAnalyst,
  runConservativeAnalyst,
  runNeutralAnalyst,
} from "../../agents/risk/risk-debate";
import { runPortfolioManager } from "../../agents/managers/portfolio-manager";
import type { DataSnapshot, TraderOutput, RiskDebateState } from "../../types";

// ==================== RISK SUBGRAPH ====================

/** Guard: đảm bảo riskDebateState luôn khởi tạo đủ field */
function resolveRiskState(raw: unknown) {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    history: typeof d.history === "string" ? d.history : "",
    aggressiveHistory: typeof d.aggressiveHistory === "string" ? d.aggressiveHistory : "",
    conservativeHistory: typeof d.conservativeHistory === "string" ? d.conservativeHistory : "",
    neutralHistory: typeof d.neutralHistory === "string" ? d.neutralHistory : "",
    latestSpeaker: (d.latestSpeaker === "Aggressive" || d.latestSpeaker === "Conservative" || d.latestSpeaker === "Neutral" ? d.latestSpeaker : null) as "Aggressive" | "Conservative" | "Neutral" | null,
    currentAggressiveResponse: typeof d.currentAggressiveResponse === "string" ? d.currentAggressiveResponse : "",
    currentConservativeResponse: typeof d.currentConservativeResponse === "string" ? d.currentConservativeResponse : "",
    currentNeutralResponse: typeof d.currentNeutralResponse === "string" ? d.currentNeutralResponse : "",
    count: typeof d.count === "number" ? d.count : 0,
  };
}

export function createRiskSubgraph(llm: ChatOpenAI, deepLlm: ChatOpenAI, maxRounds: number = 2) {
  // Node: Aggressive Analyst
  async function aggressiveAnalyst(state: RiskState): Promise<Partial<RiskState>> {
    console.log("[Risk] Đang chạy Aggressive Risk Analyst...");

    const snapshot = state.dataSnapshot!;
    const riskState = resolveRiskState(state.riskDebateState);
    const traderDecision = JSON.parse(state.traderInvestmentPlan || "{}") as TraderOutput;

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

  // Node: Conservative Analyst
  async function conservativeAnalyst(state: RiskState): Promise<Partial<RiskState>> {
    console.log("[Risk] Đang chạy Conservative Risk Analyst...");

    const snapshot = state.dataSnapshot!;
    const riskState = resolveRiskState(state.riskDebateState);
    const traderDecision = JSON.parse(state.traderInvestmentPlan || "{}") as TraderOutput;

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

  // Node: Neutral Analyst
  async function neutralAnalyst(state: RiskState): Promise<Partial<RiskState>> {
    console.log("[Risk] Đang chạy Neutral Risk Analyst...");

    const snapshot = state.dataSnapshot!;
    const riskState = resolveRiskState(state.riskDebateState);
    const traderDecision = JSON.parse(state.traderInvestmentPlan || "{}") as TraderOutput;

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
  async function portfolioManager(state: RiskState): Promise<Partial<RiskState>> {
    console.log("[Risk] Đang chạy Portfolio Manager...");

    const snapshot = state.dataSnapshot!;
    const riskState = resolveRiskState(state.riskDebateState);
    const traderDecision = JSON.parse(state.traderInvestmentPlan || "{}") as TraderOutput;

    const decision = await runPortfolioManager(
      deepLlm,
      traderDecision,
      riskState,
      snapshot
    );

    const finalDecision = `FINAL TRADE DECISION: ${decision.finalDecision.toUpperCase()} ${decision.ticker}\nAction: ${decision.action.toUpperCase()}\nReasoning: ${decision.reasoning}`;

    return {
      finalTradeDecision: finalDecision,
      riskDebateState: {
        ...riskState,
        currentAggressiveResponse: riskState.currentAggressiveResponse,
        currentConservativeResponse: riskState.currentConservativeResponse,
        currentNeutralResponse: riskState.currentNeutralResponse,
      },
      messages: [{ role: "assistant", content: finalDecision }],
    };
  }

  // Conditional edge: Continue risk analysis or end
  function shouldContinueRiskAnalysis(state: RiskState): string {
    const riskState = resolveRiskState(state.riskDebateState);
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

  // Build subgraph
  const workflow = new StateGraph(RiskStateAnnotation)
    .addNode("Aggressive Analyst", aggressiveAnalyst)
    .addNode("Conservative Analyst", conservativeAnalyst)
    .addNode("Neutral Analyst", neutralAnalyst)
    .addNode("Portfolio Manager", portfolioManager)

    .addEdge(START, "Aggressive Analyst")
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
    .addEdge("Portfolio Manager", END);

  return workflow.compile();
}
