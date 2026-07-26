import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { DataSnapshot, SocialAnalystOutput } from "../../types/index.ts";

function getInstrumentContext(snapshot: DataSnapshot): string {
  return `
THÔNG TIN CHỨNG KHOÁN:
- Mã: ${snapshot.ticker}
- Giá hiện tại: ${snapshot.closePrice}
- Ngày: ${snapshot.date}
  `;
}

const SENTIMENT_SYSTEM_PROMPT = `Bạn là Financial Market Sentiment Analyst chuyên phân tích sentiment thị trường chứng khoán Việt Nam.

NHIỆM VỤ: Phân tích sentiment từ nhiều nguồn và đưa ra báo cáo toàn diện.

**QUAN TRỌNG: Phân tích sentiment từ các nguồn Việt Nam:**

### 1. CafeF (cafef.vn) - Phân tích chuyên sâu
- Bài viết phân tích từ chuyên gia
- Bình luận của nhà đầu tư
- Tone: Chuyên nghiệp, phân tích kỹ

### 2. VnExpress Kinh doanh (vnexpress.net/kinh-doanh/chung-khoan)
- Tin nhanh thị trường
- Dòng tiền NĐTNN
- Tone: Nhanh, cập nhật liên tục

### 3. StockBiz (stockbiz.vn) - Cộng đồng nhà đầu tư
- Thảo luận forum
- Phân tích kỹ thuật từ cộng đồng
- Tone: Retail-focused, sôi nổi

### 4. Tin Nhanh Chứng Khoán (tinnhanhchungkhoan.vn)
- Tin real-time
- Cảnh báo thị trường
- Tone: Nhanh, khẩn trương

### 5. Diễn đàn chứng khoán
- Ý kiến nhà đầu tư cá nhân
- Fear/Greed sentiment
- Tone: Emotional, đa chiều

**Cách phân tích:**
1. Đọc tone của từng nguồn (CafeF = chuyên nghiệp, StockBiz = retail, VnExpress = tổng hợp)
2. Tìm sự khác biệt giữa các nguồn (divergence)
3. Xác định narrative themes xuyên suốt các nguồn
4. Đánh giá retail sentiment từ forum/comments
5. Thành thật về giới hạn dữ liệu

**Output fields:**
- overall_band: Bullish/Mildly Bullish/Neutral/Mixed/Mildly Bearish/Bearish
- overall_score: 0-10 (5 = neutral)
- confidence: low/medium/high
- narrative: Phân tích chi tiết từng nguồn Việt Nam

{instrumentContext}`;

const SENTIMENT_USER_PROMPT = `Phân tích sentiment cho mã {ticker} trong khoảng {startDate} đến {endDate}.

**Bước 1: Phân tích CafeF**
Tìm bài viết phân tích mới nhất về {ticker} từ cafef.vn:
- Phân tích từ chuyên gia
- Bình luận nhà đầu tư
- Tone bài viết

**Bước 2: Phân tích VnExpress**
Tìm tin tức thị trường từ vnexpress.net:
- Tin nhanh về mã
- Dòng tiền NĐTNN
- Chính sách vĩ mô

**Bước 3: Phân tích Cộng đồng**
Tìm thảo luận từ stockbiz.vn, diễn đàn:
- Ý kiến nhà đầu tư cá nhân
- Fear/Greed sentiment
- Trending topics

**Dữ liệu sentiment từ snapshot:**
{socialSentiment}

Hãy tổng hợp và đưa ra báo cáo chi tiết với bảng Markdown tóm tắt ở cuối.`;

function getSevenDaysBack(date: string): string {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) {
    // fallback về 7 ngày trước từ hôm nay
    const fallback = new Date();
    fallback.setDate(fallback.getDate() - 7);
    return fallback.toISOString().split("T")[0] ?? "";
  }
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0] || date;
}

export async function runSocialAnalyst(
  llm: ChatOpenAI,
  snapshot: DataSnapshot
): Promise<SocialAnalystOutput> {
  const startDate = getSevenDaysBack(snapshot.date);
  const endDate = snapshot.date;

  const systemPrompt = ChatPromptTemplate.fromTemplate(SENTIMENT_SYSTEM_PROMPT);
  const userPrompt = ChatPromptTemplate.fromTemplate(SENTIMENT_USER_PROMPT);

  const messages = await systemPrompt.formatMessages({
    instrumentContext: getInstrumentContext(snapshot),
  });

  const userMessages = await userPrompt.formatMessages({
    ticker: snapshot.ticker,
    startDate,
    endDate,
    socialSentiment: snapshot.socialSentiment || "Chưa có dữ liệu",
  });

  const result = await llm.invoke([...messages, ...userMessages]);

  try {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const output = JSON.parse(content);
    return output as SocialAnalystOutput;
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      socialSentiment: content,
      trendingTopics: [],
      retailSentiment: "neutral",
      summary: content,
    };
  }
}
