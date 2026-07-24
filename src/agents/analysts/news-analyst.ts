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

NHIỆM VỤ: Phân tích tin tức mới nhất từ các nguồn đáng tin cậy và đưa ra báo cáo toàn diện.

**QUAN TRỌNG: Khi tìm kiếm tin tức, ưu tiên các trang sau:**
1. **CafeF** (cafef.vn) - Tin tức tài chính chuyên sâu
2. **VnExpress Kinh doanh** (vnexpress.net/kinh-doanh/chung-khoan) - Tin nhanh thị trường
3. **Vietstock** (voso.vn) - Phân tích kỹ thuật
4. **Tin Nhanh Chứng Khoán** (tinnhanhchungkhoan.vn) - Tin tức real-time
5. **Investing.com Việt Nam** (investing.com/vi) - Dữ liệu quốc tế

**Cách tìm kiếm:**
- Dùng tavily_search với query: "ticker site:cafef.vn" hoặc "mã chứng khoán site:vnexpress.net"
- Dùng firecrawl_scrape để đọc nội dung chi tiết từ URL CafeF/VnExpress
- Tìm tin tức về: kết quả kinh doanh, IPO, M&A, tin tức vĩ mô, chính sách

**Chỉ số vĩ mô quan trọng cần theo dõi:**
- Lãi suất (SBV, Fed)
- Tỷ giá USD/VND
- CPI Việt Nam
- Dòng tiền NĐTNN
- Chính sách tiền tệ

**Output:** Viết báo cáo chi tiết với bảng Markdown tóm tắt ở cuối.

{instrumentContext}`;

const NEWS_ANALYST_USER_PROMPT = `Phân tích tin tức cho mã {ticker} trong ngày {date}.

**Bước 1: Tìm tin tức từ CafeF**
Tìm tin tức mới nhất về {ticker} từ cafef.vn:
- Kết quả kinh doanh quý gần nhất
- Thông tin từ ban lãnh đạo
- Phân tích từ các công ty chứng khoán

**Bước 2: Tìm tin tức từ VnExpress**
Tìm tin tức thị trường từ vnexpress.net/kinh-doanh/chung-khoan:
- Tin tức chung về thị trường
- Dòng tiền NĐTNN
- Chính sách vĩ mô

**Bước 3: Tổng hợp và phân tích**
Tin tức đã có từ snapshot:
{marketNews}

Hãy tổng hợp và đưa ra báo cáo chi tiết với bảng Markdown tóm tắt ở cuối.`;

export async function runNewsAnalyst(
  llm: ChatOpenAI,
  snapshot: DataSnapshot
): Promise<NewsAnalystOutput> {
  const systemPrompt = ChatPromptTemplate.fromTemplate(NEWS_ANALYST_SYSTEM_PROMPT);
  const userPrompt = ChatPromptTemplate.fromTemplate(NEWS_ANALYST_USER_PROMPT);

  const messages = await systemPrompt.formatMessages({
    instrumentContext: getInstrumentContext(snapshot),
  });

  const userMessages = await userPrompt.formatMessages({
    ticker: snapshot.ticker,
    date: snapshot.date,
    marketNews: snapshot.marketNews || "Chưa có tin tức",
  });

  const result = await llm.invoke([...messages, ...userMessages]);

  try {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const output = JSON.parse(content);
    return output as NewsAnalystOutput;
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      newsSummary: content,
      sentimentScore: 0,
      keyEvents: [],
      impactAssessment: "Không xác định",
      summary: content,
    };
  }
}
