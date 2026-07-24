// ==================== MEMORY TYPES ====================

export interface DecisionLog {
  id: string;
  ticker: string;
  date: string;
  decision: string;
  outcome?: {
    rawReturn?: number;
    alphaReturn?: number;
    holdingDays?: number;
  };
  reflection?: string;
  timestamp: number;
}

export interface MemoryConfig {
  ticker: string;
  tradeDate: string;
  maxHistory?: number;
}

export interface MemoryState {
  decisions: DecisionLog[];
  lessons: string[];
  lastUpdated: number;
}
