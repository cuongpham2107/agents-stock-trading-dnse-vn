import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { BullResearcherOutput, BearResearcherOutput, DataSnapshot, ResearchManagerOutput } from "../../types/index.ts";

function getInstrumentContext(snapshot: DataSnapshot): string {
  return `
THÔNG TIN CHỨNG KHOÁN:
- Mã: ${snapshot.ticker}
- Giá hiện tại: ${snapshot.closePrice}
- Ngày: ${snapshot.date}
  `;
}

const RESEARCH_MANAGER_PROMPT = `Bạn là Research Manager và debate facilitator - trọng tài giữa Bull và Bear Researcher.

NHIỆM VỤ: Đánh giá tranh luận và đưa ra investment plan rõ ràng cho Trader.

{instrumentContext}

---

**Thang điểm đánh giá** (chọn ĐÚNG MỘT):
- **Buy**: Sự tin tưởng mạnh mẽ vào luận điểm bull; khuyến nghị mua hoặc tăng vị thế
- **Overweight**: Góc nhìn tích cực; khuyến nghị dần dần tăng exposure
- **Hold**: Góc nhìn cân bằng; khuyến nghị giữ nguyên vị thế
- **Underweight**: Góc nhìn thận trọng; khuyến nghị giảm exposure
- **Sell**: Sự tin tưởng mạnh mẽ vào luận điểm bear; khuyến nghị bán hoặc tránh mua

---

**Lịch sử tranh luận Bull/Bear:**
{history}

**Luận điểm Bull:**
{bullReport}

**Luận điểm Bear:**
{bearReport}

---

Hãy đưa ra quyết định rõ ràng dựa trên bằng chứng từ cả hai phía.

OUTPUT FORMAT (JSON):
{
  "decision": "bullish|bearish|neutral",
  "rating": "Buy|Overweight|Hold|Underweight|Sell",
  "confidence": 0.7,
  "reasoning": "Lý do chi tiết dựa trên bằng chứng",
  "bullSummary": "Tóm tắt luận điểm bull",
  "bearSummary": "Tóm tắt luận điểm bear",
  "keyFactors": ["Yếu tố quyết định 1", "Yếu tố quyết định 2"],
  "actionPlan": "Kế hoạch hành động cụ thể"
}`;

export async function runResearchManager(
  llm: ChatOpenAI,
  bullReport: BullResearcherOutput,
  bearReport: BearResearcherOutput,
  debateHistory: string[],
  snapshot?: DataSnapshot
): Promise<ResearchManagerOutput> {
  const instrumentContext = snapshot ? getInstrumentContext(snapshot) : "";
  const prompt = ChatPromptTemplate.fromTemplate(RESEARCH_MANAGER_PROMPT);

  const chain = prompt.pipe(llm);

  const result = await chain.invoke({
    instrumentContext,
    bullReport: JSON.stringify(bullReport, null, 2),
    bearReport: JSON.stringify(bearReport, null, 2),
    history: debateHistory.length > 0 ? debateHistory.join("\n---\n") : "Chưa có debate",
  });

  try {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const output = JSON.parse(content);
    return {
      decision: output.decision || "neutral",
      confidence: output.confidence || 0.5,
      reasoning: output.reasoning || content,
      bullSummary: output.bullSummary || bullReport.summary,
      bearSummary: output.bearSummary || bearReport.summary,
      keyFactors: output.keyFactors || [],
    };
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      decision: "neutral",
      confidence: 0.5,
      reasoning: content,
      bullSummary: bullReport.summary,
      bearSummary: bearReport.summary,
      keyFactors: [],
    };
  }
}
