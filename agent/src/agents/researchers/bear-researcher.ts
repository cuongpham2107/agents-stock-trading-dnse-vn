import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { MarketAnalystOutput, NewsAnalystOutput, SocialAnalystOutput, FundamentalsAnalystOutput, BearResearcherOutput } from "../../types/index.js";

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

OUTPUT FORMAT (JSON):
{
  "argument": "Luận điểm bearish chính",
  "evidence": ["Bằng chứng 1", "Bằng chứng 2"],
  "confidence": 0.75,
  "counterArguments": ["Phản biện từ bull (nếu có)"],
  "summary": "Tóm tắt luận điểm bear"
}`;

export async function runBearResearcher(
  llm: ChatOpenAI,
  marketReport: MarketAnalystOutput,
  newsReport: NewsAnalystOutput,
  socialReport: SocialAnalystOutput,
  fundamentalsReport: FundamentalsAnalystOutput,
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
