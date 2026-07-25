// ==================== GRAPH UTILITIES ====================

/**
 * Node wrapper với logging và error handling
 */
export function createSafeNode<TState>(
  name: string,
  fn: (state: TState) => Promise<Record<string, unknown>>
) {
  return async (state: TState): Promise<Record<string, unknown>> => {
    const start = Date.now();
    console.log(`[Graph] ▶ ${name} bắt đầu...`);

    try {
      const result = await fn(state);
      console.log(`[Graph] ✔ ${name} xong (${Date.now() - start}ms)`);
      return result;
    } catch (err) {
      console.log(`[Graph] ✘ ${name} lỗi (${Date.now() - start}ms):`, err);
      throw err;
    }
  };
}

/**
 * safely parse JSON report, trả về object rỗng nếu lỗi
 */
export function safeParseReport(report: string | undefined | null): Record<string, unknown> {
  if (!report) return {};
  try {
    return JSON.parse(report);
  } catch {
    return { summary: report };
  }
}

/**
 * Constants cho node names
 */
export const NODE_NAMES = {
  LOAD_PAST_EXPERIENCE: "Load Past Experience",
  MARKET_ANALYST: "Market Analyst",
  SENTIMENT_ANALYST: "Sentiment Analyst",
  NEWS_ANALYST: "News Analyst",
  FUNDAMENTALS_ANALYST: "Fundamentals Analyst",
  AGGREGATE_REPORTS: "Aggregate Reports",
  BULL_RESEARCHER: "Bull Researcher",
  BEAR_RESEARCHER: "Bear Researcher",
  RESEARCH_MANAGER: "Research Manager",
  TRADER: "Trader",
  AGGRESSIVE_ANALYST: "Aggressive Analyst",
  CONSERVATIVE_ANALYST: "Conservative Analyst",
  NEUTRAL_ANALYST: "Neutral Analyst",
  AGGREGATE_RISK: "Aggregate Risk Reports",
  PORTFOLIO_MANAGER: "Portfolio Manager",
  SAVE_EXPERIENCE: "Save Experience",
} as const;
