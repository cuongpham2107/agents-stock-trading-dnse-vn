import type { Context } from "grammy";

// ==================== TELEGRAM COMMAND TYPES ====================

export type TelegramCommand =
  | "analyze"
  | "quick"
  | "portfolio"
  | "buy"
  | "sell"
  | "close"
  | "check"
  | "review"
  | "watchlist"
  | "add"
  | "remove"
  | "help";

export interface ParsedCommand {
  command: TelegramCommand;
  args: string[];
  rawText: string;
}

export interface TelegramContext extends Context {
  parsedCommand?: ParsedCommand;
}

// ==================== MONITOR RESULT ====================

export type MonitorSignal = "ALERT" | "WATCH" | "OK";

export interface MonitorResult {
  ticker: string;
  signal: MonitorSignal;
  reason: string;
  currentPrice: number;
  priceChange?: number;   // % so với hôm qua
}

// ==================== PORTFOLIO REVIEW RESULT ====================

export type PositionRecommendation = "HOLD" | "BUY_MORE" | "PARTIAL_SELL" | "FULL_SELL";

export interface PositionReviewResult {
  ticker: string;
  positionId: string;
  currentPrice: number;
  avgCost: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  recommendation: PositionRecommendation;
  reasoning: string;
  /** So với review hôm qua */
  changed: boolean;
  priceMovedPct?: number;
}
