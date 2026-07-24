import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { ResearchManagerOutput, DataSnapshot, TraderOutput } from "../../types/index.js";

function getInstrumentContext(snapshot: DataSnapshot): string {
  return `
THÔNG TIN CHỨNG KHOÁN:
- Mã: ${snapshot.ticker}
- Giá hiện tại: ${snapshot.closePrice}
- Giá trần: ${snapshot.secDef ? JSON.stringify(snapshot.secDef) : "N/A"}
- Ngày: ${snapshot.date}
  `;
}

const TRADER_SYSTEM_PROMPT = `Bạn là Trading Agent phân tích dữ liệu thị trường để đưa ra quyết định đầu tư.

NHIỆM VỤ: Dựa trên phân tích của team analyst, đưa ra recommendation cụ thể: mua, bán, hoặc giữ.

**Quy tắc:**
1. Anchor reasoning vào báo cáo của analyst và investment plan
2. Đưa ra quyết định rõ ràng: BUY/HOLD/SELL
3. Cung cấp chi tiết: target price, stop loss, position size

{instrumentContext}`;

const TRADER_USER_PROMPT = `Dựa trên phân tích toàn diện từ team analyst, đây là investment plan cho {ticker}:

**Investment Plan từ Research Manager:**
{investmentPlan}

**Rating:** {rating}
**Decision:** {decision}
**Confidence:** {confidence}

Hãy tận dụng các insights này để đưa ra quyết định giao dịch chiến lược và có cơ sở.

OUTPUT FORMAT (JSON):
{
  "action": "buy|sell|hold",
  "rating": "Buy|Overweight|Hold|Underweight|Sell",
  "ticker": "${"{ticker}"}",
  "confidence": 0.7,
  "targetPrice": 25.0,
  "stopLoss": 22.0,
  "positionSize": "3-5% portfolio",
  "timeframe": "1-3 tháng",
  "reasoning": "Lý do chi tiết dựa trên phân tích",
  "entryPoint": "Giá vào lệnh hợp lý",
  "riskRewardRatio": "Tỷ lệ risk/reward"
}`;

export async function runTrader(
  llm: ChatOpenAI,
  researchDecision: ResearchManagerOutput,
  snapshot: DataSnapshot
): Promise<TraderOutput> {
  const instrumentContext = getInstrumentContext(snapshot);

  const systemPrompt = ChatPromptTemplate.fromTemplate(TRADER_SYSTEM_PROMPT);
  const userPrompt = ChatPromptTemplate.fromTemplate(TRADER_USER_PROMPT);

  const messages = await systemPrompt.formatMessages({
    instrumentContext,
  });

  const userMessages = await userPrompt.formatMessages({
    ticker: snapshot.ticker,
    investmentPlan: researchDecision.reasoning,
    rating: researchDecision.decision,
    decision: researchDecision.decision,
    confidence: researchDecision.confidence,
  });

  const result = await llm.invoke([...messages, ...userMessages]);

  try {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const output = JSON.parse(content);
    return {
      action: output.action || "hold",
      ticker: snapshot.ticker,
      confidence: output.confidence || 0.5,
      targetPrice: output.targetPrice || snapshot.closePrice,
      stopLoss: output.stopLoss || snapshot.closePrice * 0.95,
      positionSize: output.positionSize || "Không xác định",
      timeframe: output.timeframe || "Không xác định",
      reasoning: output.reasoning || content,
    };
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      action: "hold",
      ticker: snapshot.ticker,
      confidence: 0.5,
      targetPrice: snapshot.closePrice,
      stopLoss: snapshot.closePrice * 0.95,
      positionSize: "Không xác định",
      timeframe: "Không xác định",
      reasoning: content,
    };
  }
}
