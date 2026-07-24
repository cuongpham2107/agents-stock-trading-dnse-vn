import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { TraderOutput, RiskDebateState, DataSnapshot, PortfolioManagerOutput } from "../../types/index.ts";

function getInstrumentContext(snapshot: DataSnapshot): string {
  return `
THÔNG TIN CHỨNG KHOÁN:
- Mã: ${snapshot.ticker}
- Giá hiện tại: ${snapshot.closePrice}
- Ngày: ${snapshot.date}
  `;
}

const PORTFOLIO_MANAGER_PROMPT = `Bạn là Portfolio Manager - người duyệt CUỐI CÙNG quyết định giao dịch.

NHIỆM VỤ: Tổng hợp tranh luận risk debate và đưa ra quyết định giao dịch cuối cùng.

{instrumentContext}

---

**Thang điểm đánh giá** (chọn ĐÚNG MỘT):
- **Buy**: Sự tin tưởng mạnh mẽ, khuyến nghị mua hoặc tăng vị thế
- **Overweight**: Góc nhìn tích cực, dần dần tăng exposure
- **Hold**: Cân bằng, giữ nguyên vị thế
- **Underweight**: Thận trọng, giảm exposure
- **Sell**: Tin tưởng mạnh vào bear, bán hoặc tránh mua

**Context:**
- Investment Plan từ Research Manager: **{researchPlan}**
- Transaction Proposal từ Trader: **{traderPlan}**

{lessonsLine}
**Lịch sử tranh luận Risk Debate:**
{riskDebateHistory}

**Phát biểu Aggressive:**
{aggressiveHistory}

**Phát biểu Conservative:**
{conservativeHistory}

**Phát biểu Neutral:**
{neutralHistory}

---

Hãy đưa ra quyết định dứt khoát, dựa trên bằng chứng cụ thể từ các analyst.

OUTPUT FORMAT (JSON):
{
  "finalDecision": "approve|reject|modify",
  "rating": "Buy|Overweight|Hold|Underweight|Sell",
  "ticker": "${"{ticker}"}",
  "action": "buy|sell|hold|wait",
  "adjustedTargetPrice": 25.0,
  "adjustedStopLoss": 22.0,
  "adjustedPositionSize": "2-5% portfolio",
  "timeframe": "1-3 tháng",
  "reasoning": "Lý do quyết định chi tiết",
  "riskAdjustments": ["Điều chỉnh 1", "Điều chỉnh 2"],
  "keyTakeaways": ["Bài học quan trọng 1", "Bài học quan trọng 2"]
}`;

export async function runPortfolioManager(
  llm: ChatOpenAI,
  traderDecision: TraderOutput,
  riskDebateState: RiskDebateState,
  snapshot: DataSnapshot,
  researchPlan?: string,
  pastContext?: string
): Promise<PortfolioManagerOutput> {
  const instrumentContext = getInstrumentContext(snapshot);
  const lessonsLine = pastContext
    ? `- Lessons from prior decisions and outcomes:\n${pastContext}\n`
    : "";

  const prompt = ChatPromptTemplate.fromTemplate(PORTFOLIO_MANAGER_PROMPT);

  const chain = prompt.pipe(llm);

  const result = await chain.invoke({
    instrumentContext,
    ticker: snapshot.ticker,
    researchPlan: researchPlan || "Không có",
    traderPlan: JSON.stringify(traderDecision, null, 2),
    lessonsLine,
    riskDebateHistory: riskDebateState.history || "Chưa có debate",
    aggressiveHistory: riskDebateState.aggressiveHistory || "Chưa có",
    conservativeHistory: riskDebateState.conservativeHistory || "Chưa có",
    neutralHistory: riskDebateState.neutralHistory || "Chưa có",
  });

  try {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const output = JSON.parse(content);
    return {
      finalDecision: output.finalDecision || "approve",
      ticker: traderDecision.ticker,
      action: traderDecision.action,
      adjustedTargetPrice: output.adjustedTargetPrice,
      adjustedStopLoss: output.adjustedStopLoss,
      adjustedPositionSize: output.adjustedPositionSize,
      reasoning: output.reasoning || content,
      riskAdjustments: output.riskAdjustments || [],
    };
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      finalDecision: "approve",
      ticker: traderDecision.ticker,
      action: traderDecision.action,
      reasoning: content,
      riskAdjustments: [],
    };
  }
}
