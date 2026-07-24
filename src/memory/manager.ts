import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { DecisionLog, MemoryConfig, MemoryState } from "./types";

// ==================== MEMORY MANAGER ====================

export class MemoryManager {
  private memoryDir: string;
  private states: Map<string, MemoryState> = new Map();

  constructor(memoryDir: string = ".memory") {
    this.memoryDir = memoryDir;
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
    }
  }

  /**
   * Lấy context từ quyết định trước đó
   */
  getPastContext(ticker: string): string {
    const state = this.loadState(ticker);
    if (!state || state.decisions.length === 0) {
      return "";
    }

    const recentDecisions = state.decisions.slice(-5);
    const lessons = state.lessons.slice(-10);

    let context = `LỊCH SỬ QUYẾT ĐỊNH GẦN ĐÂY (${ticker}):\n`;
    for (const decision of recentDecisions) {
      context += `- ${decision.date}: ${decision.decision}`;
      if (decision.outcome) {
        context += ` | Return: ${decision.outcome.rawReturn ? (decision.outcome.rawReturn * 100).toFixed(2) : "N/A"}%`;
      }
      if (decision.reflection) {
        context += ` | Reflection: ${decision.reflection}`;
      }
      context += "\n";
    }

    if (lessons.length > 0) {
      context += `\nBÀI HỌC TỪ QUYẾT ĐỊNH TRƯỚC:\n`;
      for (const lesson of lessons) {
        context += `- ${lesson}\n`;
      }
    }

    return context;
  }

  /**
   * Lưu quyết định mới
   */
  storeDecision(
    ticker: string,
    tradeDate: string,
    finalDecision: string
  ): void {
    const state = this.loadState(ticker);

    const log: DecisionLog = {
      id: `${ticker}_${tradeDate}_${Date.now()}`,
      ticker,
      date: tradeDate,
      decision: finalDecision,
      timestamp: Date.now(),
    };

    state.decisions.push(log);
    state.lastUpdated = Date.now();

    this.saveState(ticker, state);
    console.log(`[Memory] Đã lưu quyết định for ${ticker} on ${tradeDate}`);
  }

  /**
   * Cập nhật kết quả và reflection
   */
  updateWithOutcome(
    ticker: string,
    tradeDate: string,
    outcome: {
      rawReturn?: number;
      alphaReturn?: number;
      holdingDays?: number;
    },
    reflection: string
  ): void {
    const state = this.loadState(ticker);

    const decision = state.decisions.find(
      (d) => d.ticker === ticker && d.date === tradeDate
    );

    if (decision) {
      decision.outcome = outcome;
      decision.reflection = reflection;

      // Thêm bài học mới
      if (reflection && !state.lessons.includes(reflection)) {
        state.lessons.push(reflection);
      }

      state.lastUpdated = Date.now();
      this.saveState(ticker, state);
      console.log(`[Memory] Đã cập nhật kết quả for ${ticker} on ${tradeDate}`);
    }
  }

  /**
   * Lấy quyết định pending (chưa có kết quả)
   */
  getPendingDecisions(): DecisionLog[] {
    const allDecisions: DecisionLog[] = [];

    for (const state of this.states.values()) {
      allDecisions.push(
        ...state.decisions.filter((d) => !d.outcome)
      );
    }

    return allDecisions;
  }

  /**
   * Lấy quyết định theo ticker
   */
  getDecisionsByTicker(ticker: string): DecisionLog[] {
    const state = this.loadState(ticker);
    return state.decisions;
  }

  // ==================== PRIVATE METHODS ====================

  private loadState(ticker: string): MemoryState {
    if (this.states.has(ticker)) {
      return this.states.get(ticker)!;
    }

    const filePath = this.getFilePath(ticker);

    if (existsSync(filePath)) {
      try {
        const data = readFileSync(filePath, "utf-8");
        const state = JSON.parse(data) as MemoryState;
        this.states.set(ticker, state);
        return state;
      } catch (error) {
        console.error(`[Memory] Lỗi khi tải state for ${ticker}:`, error);
      }
    }

    const newState: MemoryState = {
      decisions: [],
      lessons: [],
      lastUpdated: Date.now(),
    };
    this.states.set(ticker, newState);
    return newState;
  }

  private saveState(ticker: string, state: MemoryState): void {
    const filePath = this.getFilePath(ticker);
    writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  private getFilePath(ticker: string): string {
    return join(this.memoryDir, `${ticker}.json`);
  }
}
