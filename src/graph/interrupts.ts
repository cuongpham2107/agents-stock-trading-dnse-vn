import { interrupt } from "@langchain/langgraph";

// ==================== INTERRUPT CONFIG ====================

export interface InterruptConfig {
  enabled: boolean;
  nodes: string[];
}

const DEFAULT_INTERRUPT_CONFIG: InterruptConfig = {
  enabled: true,
  nodes: ["Research Manager", "Portfolio Manager"],
};

// ==================== INTERRUPT FUNCTIONS ====================

/**
 * Interrupt trước khi chạy node
 */
export function interruptBeforeNode(
  nodeName: string,
  state: Record<string, unknown>,
  config: InterruptConfig = DEFAULT_INTERRUPT_CONFIG
): void {
  if (!config.enabled || !config.nodes.includes(nodeName)) {
    return;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[INTERRUPT] Dừng trước node: ${nodeName}`);
  console.log(`${"=".repeat(60)}`);

  // Interrupt và chờ user input
  const userInput = interrupt({
    message: `Bạn có muốn tiếp tục phân tích không?`,
    currentNode: nodeName,
    stateSnapshot: {
      ticker: state.ticker,
      date: state.date,
    },
  });

  if (userInput === "cancel") {
    throw new Error("User cancelled analysis");
  }

  console.log(`[INTERRUPT] Người dùng xác nhận tiếp tục`);
}

/**
 * Tạo interrupt point cho Research Manager
 */
export function researchManagerInterrupt(state: {
  investmentDebateState: {
    history: string;
    count: number;
  };
}): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[INTERRUPT] Research Manager`);
  console.log(`Số vòng tranh luận: ${state.investmentDebateState.count}`);
  console.log(`${"=".repeat(60)}`);

  const userInput = interrupt({
    message: `Đã hoàn thành ${state.investmentDebateState.count} rounds debate. Tiếp tục?`,
    debateHistory: state.investmentDebateState.history,
  });

  if (userInput === "cancel") {
    throw new Error("User cancelled after debate");
  }
}

/**
 * Tạo interrupt point cho Portfolio Manager
 */
export function portfolioManagerInterrupt(state: {
  traderInvestmentPlan: string;
  riskDebateState: {
    history: string;
    count: number;
  };
}): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[INTERRUPT] Portfolio Manager`);
  console.log(`${"=".repeat(60)}`);

  const userInput = interrupt({
    message: `Trading proposal: ${state.traderInvestmentPlan.substring(0, 200)}... Xác nhận quyết định cuối cùng?`,
    riskHistory: state.riskDebateState.history,
  });

  if (userInput === "cancel") {
    throw new Error("User cancelled final decision");
  }
}

// ==================== INTERRUPT HANDLER ====================

export class InterruptHandler {
  private config: InterruptConfig;
  private interrupts: Array<{
    node: string;
    timestamp: number;
    resolved: boolean;
  }> = [];

  constructor(config: Partial<InterruptConfig> = {}) {
    this.config = { ...DEFAULT_INTERRUPT_CONFIG, ...config };
  }

  shouldInterrupt(nodeName: string): boolean {
    return this.config.enabled && this.config.nodes.includes(nodeName);
  }

  recordInterrupt(nodeName: string): void {
    this.interrupts.push({
      node: nodeName,
      timestamp: Date.now(),
      resolved: false,
    });
  }

  resolveInterrupt(nodeName: string): void {
    const interrupt = this.interrupts.find(
      (i) => i.node === nodeName && !i.resolved
    );
    if (interrupt) {
      interrupt.resolved = true;
    }
  }

  getPendingInterrupts() {
    return this.interrupts.filter((i) => !i.resolved);
  }
}
