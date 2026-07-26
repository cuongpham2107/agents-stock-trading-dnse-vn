import { Annotation } from "@langchain/langgraph";
import type {
  DataSnapshot,
  RiskDebateState,
} from "../types/index";

// ==================== MAIN TRADING STATE ====================

export const TradingStateAnnotation = Annotation.Root({
  // Core info
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
  }>({
    value: (_, right) => right,
    default: () => ({
      history: "", bullHistory: "", bearHistory: "",
      currentResponse: "", judgeDecision: "", count: 0,
    }),
  }),
  investmentPlan: Annotation<string>,

  // Trader output
  traderInvestmentPlan: Annotation<string>,

  // Risk debate state
  riskDebateState: Annotation<RiskDebateState>({
    value: (_, right) => right,
    default: () => ({
      history: "",
      aggressiveHistory: "",
      conservativeHistory: "",
      neutralHistory: "",
      latestSpeaker: null,
      currentAggressiveResponse: "",
      currentConservativeResponse: "",
      currentNeutralResponse: "",
      count: 0,
    }),
  }),

  // Final output
  finalTradeDecision: Annotation<string>,

  // Error handling
  error: Annotation<string | null>,
  retryCount: Annotation<number>,

  // Metadata
  messages: Annotation<unknown[]>,
});

export type TradingState = typeof TradingStateAnnotation.State;

// ==================== ANALYSTS SUBGRAPH STATE ====================

export const AnalystsStateAnnotation = Annotation.Root({
  ticker: Annotation<string>,
  date: Annotation<string>,
  dataSnapshot: Annotation<DataSnapshot | null>,
  marketReport: Annotation<string>,
  sentimentReport: Annotation<string>,
  newsReport: Annotation<string>,
  fundamentalsReport: Annotation<string>,
  messages: Annotation<unknown[]>,
});

export type AnalystsState = typeof AnalystsStateAnnotation.State;

// ==================== DEBATE SUBGRAPH STATE ====================

export const DebateStateAnnotation = Annotation.Root({
  ticker: Annotation<string>,
  marketReport: Annotation<string>,
  sentimentReport: Annotation<string>,
  newsReport: Annotation<string>,
  fundamentalsReport: Annotation<string>,
  investmentDebateState: Annotation<{
    history: string;
    bullHistory: string;
    bearHistory: string;
    currentResponse: string;
    judgeDecision: string;
    count: number;
  }>({
    value: (_, right) => right,
    default: () => ({
      history: "", bullHistory: "", bearHistory: "",
      currentResponse: "", judgeDecision: "", count: 0,
    }),
  }),
  investmentPlan: Annotation<string>,
  messages: Annotation<unknown[]>,
});

export type DebateState = typeof DebateStateAnnotation.State;

// ==================== RISK SUBGRAPH STATE ====================

export const RiskStateAnnotation = Annotation.Root({
  ticker: Annotation<string>,
  date: Annotation<string>,
  dataSnapshot: Annotation<DataSnapshot | null>,
  traderInvestmentPlan: Annotation<string>,
  riskDebateState: Annotation<RiskDebateState>({
    value: (_, right) => right,
    default: () => ({
      history: "",
      aggressiveHistory: "",
      conservativeHistory: "",
      neutralHistory: "",
      latestSpeaker: null,
      currentAggressiveResponse: "",
      currentConservativeResponse: "",
      currentNeutralResponse: "",
      count: 0,
    }),
  }),
  finalTradeDecision: Annotation<string>,
  messages: Annotation<unknown[]>,
});

export type RiskState = typeof RiskStateAnnotation.State;
