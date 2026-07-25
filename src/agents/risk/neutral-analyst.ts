import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { TraderOutput, DataSnapshot, NeutralAnalystOutput } from "../../types/index.ts";

const NEUTRAL_ANALYST_PROMPT = `Bạn là Neutral Analyst - chuyên đánh giá rủi ro từ góc nhìn TRUNG LẬP.

NHIỆM VỤ: Đánh giá rủi ro cho quyết định giao dịch {action} mã {ticker}.

QUYẾT ĐỊNH GIAO DỊCH:
{traderDecision}

DỮ LIỆU THỊ TRƯỜNG:
- Giá hiện tại: {closePrice}
- Ngày: {date}

GÓC NHÌN TRUNG LẬP:
1. Cân nhắc cả hai phía (bull và bear)
2. Các chỉ số quan trọng cần theo dõi
3. Khuyến nghị cân bằng

OUTPUT FORMAT (JSON):
{{
  "perspective": "neutral",
  "assessment": "Đánh giá rủi ro",
  "balancedView": "Góc nhìn cân bằng",
  "keyMetrics": ["Chỉ số 1", "Chỉ số 2"],
  "recommendation": "Khuyến nghị"
}}`;

export async function runNeutralAnalyst(
  llm: ChatOpenAI,
  traderDecision: TraderOutput,
  snapshot: DataSnapshot
): Promise<NeutralAnalystOutput> {
  const prompt = ChatPromptTemplate.fromTemplate(NEUTRAL_ANALYST_PROMPT);

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
    return output as NeutralAnalystOutput;
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      perspective: "neutral",
      assessment: content,
      balancedView: content,
      keyMetrics: [],
      recommendation: content,
    };
  }
}
