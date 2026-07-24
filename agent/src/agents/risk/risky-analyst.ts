import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { TraderOutput, DataSnapshot, RiskyAnalystOutput } from "../../types/index.js";

const RISKY_ANALYST_PROMPT = `Bạn là Risky Analyst - chuyên đánh giá rủi ro từ góc nhìn MẠO HIỂM.

NHIỆM VỤ: Đánh giá rủi ro cho quyết định giao dịch {action} mã {ticker}.

QUYẾT ĐỊNH GIAO DỊCH:
{traderDecision}

DỮ LIỆU THỊ TRƯỜNG:
- Giá hiện tại: {closePrice}
- Ngày: {date}

GÓC NHÌN MẠO HIỂM:
1. Các rủi ro CÓ THỂ xảy ra (nhưng có thể chấp nhận được)
2. Cơ hội lợi nhuận nếu mọi thứ diễn ra tốt đẹp
3. Khuyến nghị cho người sẵn sàng chấp nhận rủi ro

OUTPUT FORMAT (JSON):
{
  "perspective": "risky",
  "assessment": "Đánh giá rủi ro",
  "risks": ["Rủi ro 1", "Rủi ro 2"],
  "opportunities": ["Cơ hội 1", "Cơ hội 2"],
  "recommendation": "Khuyến nghị"
}`;

export async function runRiskyAnalyst(
  llm: ChatOpenAI,
  traderDecision: TraderOutput,
  snapshot: DataSnapshot
): Promise<RiskyAnalystOutput> {
  const prompt = ChatPromptTemplate.fromTemplate(RISKY_ANALYST_PROMPT);

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
    return output as RiskyAnalystOutput;
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      perspective: "risky",
      assessment: content,
      risks: [],
      opportunities: [],
      recommendation: content,
    };
  }
}
