import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { BearResearcherOutput } from "../../types/index.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportInput = { summary?: string; [key: string]: any };

const BEAR_RESEARCHER_PROMPT = `Bạn là Bear Researcher - chuyên đưa ra luận điểm BÁN BEARISH cho mã chứng khoán {ticker}.

NHIỆM VỤ: Sử dụng dữ liệu từ 4 analysts để đưa ra luận điểm bearish thuyết phục.

DỮ LIỆU ĐẦU VÀO:
- Market Analysis: {marketReport}
- News Analysis: {newsReport}
- Social Analysis: {socialReport}
- Fundamentals Analysis: {fundamentalsReport}

LUẬN ĐIỂM BEARISH CẦN CÓ:
1. Tại sao giá có thể GIẢM?
2. Các yếu tố tiêu cực từ phân tích kỹ thuật
3. Tin tức bất lợi
4. Dòng tiền rút ra
5. Sentiment mạng xã hội tiêu cực

NẾU CÓ DEBATE HISTORY (từ các round trước):
{debateHistory}

Hãy đưa ra luận điểm bearish mạnh mẽ, dựa trên dữ liệu thực tế.

OUTPUT: Trả về JSON với các field: argument, evidence (array), confidence (number), counterArguments (array), summary.`;

export async function runBearResearcher(
  llm: ChatOpenAI,
  marketReport: ReportInput,
  newsReport: ReportInput,
  socialReport: ReportInput,
  fundamentalsReport: ReportInput,
  ticker: string,
  debateHistory: string[] = []
): Promise<BearResearcherOutput> {
  const prompt = ChatPromptTemplate.fromTemplate(BEAR_RESEARCHER_PROMPT);

  const chain = prompt.pipe(llm);

  const result = await chain.invoke({
    ticker,
    marketReport: JSON.stringify(marketReport),
    newsReport: JSON.stringify(newsReport),
    socialReport: JSON.stringify(socialReport),
    fundamentalsReport: JSON.stringify(fundamentalsReport),
    debateHistory: debateHistory.length > 0 ? debateHistory.join("\n---\n") : "Chưa có debate history",
  });

  try {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const output = JSON.parse(content);
    return output as BearResearcherOutput;
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      argument: content,
      evidence: [],
      confidence: 0.5,
      counterArguments: [],
      summary: content,
    };
  }
}
