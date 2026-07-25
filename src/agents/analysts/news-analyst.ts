import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { DataSnapshot, NewsAnalystOutput } from "../../types/index.ts";

function getInstrumentContext(snapshot: DataSnapshot): string {
  return `
THÔNG TIN CHỨNG KHOÁN:
- Mã: ${snapshot.ticker}
- Giá hiện tại: ${snapshot.closePrice}
- Ngày: ${snapshot.date}
  `;
}

const NEWS_ANALYST_PROMPT = `Bạn là News Analyst phân tích tin tức chứng khoán Việt Nam.

DỮ LIỆU ĐẦU VÀO:
{instrumentContext}
Tin tức thị trường: {marketNews}

Hãy phân tích và đưa ra báo cáo ngắn gọn (không dùng tool, chỉ phân tích từ dữ liệu có sẵn).

OUTPUT: Trả về JSON với fields: newsSummary (string), sentimentScore (number -1 to 1), keyEvents (array), impactAssessment (string), summary (string).`;

export async function runNewsAnalyst(
  llm: ChatOpenAI,
  snapshot: DataSnapshot
): Promise<NewsAnalystOutput> {
  const TIMEOUT_MS = 30000;

  const prompt = ChatPromptTemplate.fromTemplate(NEWS_ANALYST_PROMPT);

  try {
    const result = await Promise.race([
      prompt.pipe(llm).invoke({
        instrumentContext: getInstrumentContext(snapshot),
        marketNews: snapshot.marketNews || "Không có tin tức cụ thể",
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
      ),
    ]);

    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

    try {
      return JSON.parse(content) as NewsAnalystOutput;
    } catch {
      return { newsSummary: content, sentimentScore: 0, keyEvents: [], impactAssessment: "N/A", summary: content };
    }
  } catch {
    return { newsSummary: "Phân tích dựa trên dữ liệu có sẵn", sentimentScore: 0, keyEvents: [], impactAssessment: "N/A", summary: "Không có tin tức mới" };
  }
}
