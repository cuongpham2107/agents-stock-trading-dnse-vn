import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { TraderOutput, DataSnapshot, SafeAnalystOutput } from "../../types/index.ts";

const SAFE_ANALYST_PROMPT = `Bạn là Safe Analyst - chuyên đánh giá rủi ro từ góc nhìn AN TOÀN.

NHIỆM VỤ: Đánh giá rủi ro cho quyết định giao dịch {action} mã {ticker}.

QUYẾT ĐỊNH GIAO DỊCH:
{traderDecision}

DỮ LIỆU THỊ TRƯỜNG:
- Giá hiện tại: {closePrice}
- Ngày: {date}

GÓC NHÌN AN TOÀN:
1. Các rủi ro CẦN PHẢI xem xét kỹ
2. Biện pháp giảm thiểu rủi ro
3. Khuyến nghị cho người thận trọng

OUTPUT FORMAT (JSON):
{{
  "perspective": "safe",
  "assessment": "Đánh giá rủi ro",
  "risks": ["Rủi ro 1", "Rủi ro 2"],
  "mitigation": ["Biện pháp 1", "Biện pháp 2"],
  "recommendation": "Khuyến nghị"
}}`;

export async function runSafeAnalyst(
  llm: ChatOpenAI,
  traderDecision: TraderOutput,
  snapshot: DataSnapshot
): Promise<SafeAnalystOutput> {
  const prompt = ChatPromptTemplate.fromTemplate(SAFE_ANALYST_PROMPT);

  const chain = prompt.pipe(llm);

  const result = await chain.invoke({
    action: traderDecision.action,
    ticker: snapshot.ticker,
    traderDecision: JSON.stringify(traderDecision),
    closePrice: snapshot.closePrice,
    date: snapshot.date,
  });

  try {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const output = JSON.parse(content);
    return output as SafeAnalystOutput;
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      perspective: "safe",
      assessment: content,
      risks: [],
      mitigation: [],
      recommendation: content,
    };
  }
}
