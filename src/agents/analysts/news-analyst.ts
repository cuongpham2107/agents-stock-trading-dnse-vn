import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { DataSnapshot, NewsAnalystOutput } from "../../types/index.ts";

// Các trang tài chính Việt Nam
export const VIETNAMESE_FINANCIAL_SITES = [
  "cafef.vn",
  "cafeland.vn",
  "vnexpress.net/kinh-doanh/chung-khoan",
  "tinhte.vn",
  "vietstock.vn",
  "voso.vn",
  "tinnhanhchungkhoan.vn",
  "stockbiz.vn",
  "investing.com/vi",
];

function getInstrumentContext(snapshot: DataSnapshot): string {
  return `
THÔNG TIN CHỨNG KHOÁN:
- Mã: ${snapshot.ticker}
- Giá hiện tại: ${snapshot.closePrice}
- Ngày: ${snapshot.date}
  `;
}

const NEWS_ANALYST_SYSTEM_PROMPT = `Bạn là News Researcher phân tích tin tức và xu hướng thị trường chứng khoán Việt Nam.

NHIỆM VỤ: Phân tích tin tức từ dữ liệu đã có và đưa ra báo cáo toàn diện.

**Phân tích từ dữ liệu snapshot:**
- Tin tức thị trường đã có
- Sentiment từ mạng xã hội
- Thông tin cơ bản về mã chứng khoán

**Chỉ số vĩ mô quan trọng cần theo dõi:**
- Lãi suất (SBV, Fed)
- Tỷ giá USD/VND
- CPI Việt Nam
- Dòng tiền NĐTNN
- Chính sách tiền tệ

**Output:** Viết báo cáo chi tiết với bảng Markdown tóm tắt ở cuối.

{instrumentContext}`;

const NEWS_ANALYST_USER_PROMPT = `Phân tích tin tức cho mã {ticker} trong ngày {date}.

Tin tức đã có từ snapshot:
{marketNews}

Dữ liệu thị trường:
- Giá đóng cửa: {closePrice}
- Bid/Ask: Xem dữ liệu trong snapshot

Hãy tổng hợp và đưa ra báo cáo chi tiết với bảng Markdown tóm tắt ở cuối.`;

export async function runNewsAnalyst(
  llm: ChatOpenAI,
  snapshot: DataSnapshot
): Promise<NewsAnalystOutput> {
  const TIMEOUT_MS = 60000; // 60 seconds timeout

  const systemPrompt = ChatPromptTemplate.fromTemplate(NEWS_ANALYST_SYSTEM_PROMPT);
  const userPrompt = ChatPromptTemplate.fromTemplate(NEWS_ANALYST_USER_PROMPT);

  const messages = await systemPrompt.formatMessages({
    instrumentContext: getInstrumentContext(snapshot),
  });

  const userMessages = await userPrompt.formatMessages({
    ticker: snapshot.ticker,
    date: snapshot.date,
    marketNews: snapshot.marketNews || "Chưa có tin tức",
    closePrice: snapshot.closePrice || "N/A",
  });

  try {
    // Add timeout to prevent hanging
    const result = await Promise.race([
      llm.invoke([...messages, ...userMessages]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("News Analyst timeout")), TIMEOUT_MS)
      ),
    ]);

    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

    try {
      const output = JSON.parse(content);
      return output as NewsAnalystOutput;
    } catch {
      return {
        newsSummary: content,
        sentimentScore: 0,
        keyEvents: [],
        impactAssessment: "Không xác định",
        summary: content,
      };
    }
  } catch (error) {
    console.error("[News Analyst] Lỗi:", error);
    return {
      newsSummary: "Không thể phân tích tin tức do lỗi",
      sentimentScore: 0,
      keyEvents: [],
      impactAssessment: "Lỗi khi truy xuất tin tức",
      summary: "Không thể phân tích tin tức",
    };
  }
}
