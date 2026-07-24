import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { MarketAnalystOutput, NewsAnalystOutput, SocialAnalystOutput, FundamentalsAnalystOutput, BullResearcherOutput } from "../../types/index.ts";

const BULL_RESEARCHER_PROMPT = `Bạn là Bull Researcher - chuyên đưa ra luận điểm MUA BULLISH cho mã chứng khoán {ticker}.

NHIỆM VỤ: Sử dụng dữ liệu từ 4 analysts để đưa ra luận điểm bullish thuyết phục.

DỮ LIỆU ĐẦU VÀO:
- Market Analysis: {marketReport}
- News Analysis: {newsReport}
- Social Analysis: {socialReport}
- Fundamentals Analysis: {fundamentalsReport}

LUẬN ĐIỂM BULLISH CẦN CÓ:
1. Tại sao giá có thể TĂNG?
2. Các yếu tố tích cực từ phân tích kỹ thuật
3. Tin tức hỗ trợ
4. Dòng tiền tích cực
5. Sentiment mạng xã hội thuận lợi

NẾU CÓ DEBATE HISTORY (từ các round trước):
{debateHistory}

Hãy đưa ra luận điểm bullish mạnh mẽ, dựa trên dữ liệu thực tế.

OUTPUT FORMAT (JSON):
{
  "argument": "Luận điểm bullish chính",
  "evidence": ["Bằng chứng 1", "Bằng chứng 2"],
  "confidence": 0.75,
  "counterArguments": ["Phản biện từ bear (nếu có)"],
  "summary": "Tóm tắt luận điểm bull"
}`;

export async function runBullResearcher(
  llm: ChatOpenAI,
  marketReport: MarketAnalystOutput,
  newsReport: NewsAnalystOutput,
  socialReport: SocialAnalystOutput,
  fundamentalsReport: FundamentalsAnalystOutput,
  ticker: string,
  debateHistory: string[] = []
): Promise<BullResearcherOutput> {
  const prompt = ChatPromptTemplate.fromTemplate(BULL_RESEARCHER_PROMPT);

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
    return output as BullResearcherOutput;
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
