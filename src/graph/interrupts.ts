import * as readline from "readline";
import type { TradingState } from "./state";

// ==================== INTERRUPT POINTS ====================
// LangGraph interrupt hoạt động theo cơ chế:
//   1. compile({ interruptBefore: ["manager", "risk"] }) — graph dừng TRưỚC node đó
//   2. graph.stream(input, { configurable: { thread_id } }) — chạy đến interrupt
//   3. User xem state, confirm/cancel
//   4. graph.stream(null, { configurable: { thread_id } }) — resume từ checkpoint

export const INTERRUPT_NODES = ["manager", "risk"] as const;
export type InterruptNode = (typeof INTERRUPT_NODES)[number];

// ==================== DISPLAY HELPERS ====================

/**
 * Hiển thị tóm tắt state tại điểm interrupt
 */
export function displayInterruptSummary(
  node: InterruptNode,
  state: Partial<TradingState>
): void {
  const divider = "=".repeat(60);

  console.log(`\n${divider}`);

  if (node === "manager") {
    console.log(`[INTERRUPT] ⏸  Trước Research Manager`);
    console.log(divider);
    console.log(`📊 Mã: ${state.ticker} | Ngày: ${state.date}`);
    console.log(`\n📝 Kết quả debate (${state.investmentDebateState?.count ?? 0} rounds):`);

    const history = state.investmentDebateState?.history ?? "";
    // Hiển thị 4 dòng cuối của debate để không spam terminal
    const lastLines = history.split("\n").filter(Boolean).slice(-4);
    lastLines.forEach((l) => console.log(`  ${l}`));
  } else if (node === "risk") {
    console.log(`[INTERRUPT] ⏸  Trước Risk Team / Portfolio Manager`);
    console.log(divider);
    console.log(`📊 Mã: ${state.ticker} | Ngày: ${state.date}`);
    console.log(`\n💼 Kế hoạch từ Trader:`);

    try {
      const plan = JSON.parse(state.traderInvestmentPlan ?? "{}");
      console.log(`  Action: ${plan.action?.toUpperCase() ?? "N/A"}`);
      console.log(`  Target: ${plan.targetPrice ?? "N/A"} | Stop Loss: ${plan.stopLoss ?? "N/A"}`);
      console.log(`  Confidence: ${((plan.confidence ?? 0) * 100).toFixed(0)}%`);
      console.log(`  Lý do: ${(plan.reasoning ?? "").substring(0, 120)}...`);
    } catch {
      console.log(`  ${(state.traderInvestmentPlan ?? "").substring(0, 200)}`);
    }
  }

  console.log(divider);
}

// ==================== USER CONFIRMATION ====================

/**
 * Hỏi user có muốn tiếp tục không (dùng readline).
 * Returns true = tiếp tục, false = huỷ.
 */
export async function askUserConfirm(
  node: InterruptNode,
  rl: readline.Interface
): Promise<boolean> {
  const label =
    node === "manager"
      ? "Research Manager tổng hợp debate"
      : "Risk Team + Portfolio Manager ra quyết định cuối";

  return new Promise((resolve) => {
    rl.question(
      `\n▶  Tiếp tục chạy ${label}? [Enter = OK / c = Huỷ] `,
      (answer) => {
        const cancel = answer.trim().toLowerCase() === "c";
        if (cancel) {
          console.log("[INTERRUPT] Đã huỷ phân tích.\n");
        } else {
          console.log("[INTERRUPT] Tiếp tục...\n");
        }
        resolve(!cancel);
      }
    );
  });
}
