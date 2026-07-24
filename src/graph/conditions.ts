// ==================== CONDITIONAL EDGE FUNCTIONS ====================

/**
 * Quyết định có tiếp tục debate không
 */
export function shouldContinueDebate(state: {
  investmentDebateState: {
    count: number;
  };
}): string {
  const maxRounds = 2;
  if (state.investmentDebateState.count >= maxRounds * 2) {
    return "Research Manager";
  }
  return state.investmentDebateState.count % 2 === 0 ? "Bull Researcher" : "Bear Researcher";
}

/**
 * Quyết định có tiếp tục risk analysis không
 */
export function shouldContinueRiskAnalysis(state: {
  riskDebateState: {
    count: number;
    latestSpeaker: string | null;
  };
}): string {
  const maxRounds = 2;
  if (state.riskDebateState.count >= maxRounds * 3) {
    return "Portfolio Manager";
  }

  const lastSpeaker = state.riskDebateState.latestSpeaker;
  if (lastSpeaker === "Aggressive" || lastSpeaker === null) {
    return "Conservative Analyst";
  }
  if (lastSpeaker === "Conservative") {
    return "Neutral Analyst";
  }
  return "Aggressive Analyst";
}

/**
 * Quyết định có retry không
 */
export function shouldRetry(state: {
  error: string | null;
  retryCount: number;
}): string {
  const maxRetries = 3;
  if (state.error && state.retryCount < maxRetries) {
    return "retry";
  }
  return "continue";
}

/**
 * Quyết định có interrupt không
 */
export function shouldInterrupt(nodeName: string, interruptNodes: string[]): boolean {
  return interruptNodes.includes(nodeName);
}
