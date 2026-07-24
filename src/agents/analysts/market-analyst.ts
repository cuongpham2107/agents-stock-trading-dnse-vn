import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { DataSnapshot, MarketAnalystOutput } from "../../types/index.ts";

function getInstrumentContext(snapshot: DataSnapshot): string {
  return `
THÔNG TIN CHỨNG KHOÁN:
- Mã: ${snapshot.ticker}
- Giá hiện tại: ${snapshot.closePrice}
- Ngày: ${snapshot.date}
  `;
}

const MARKET_ANALYST_SYSTEM_PROMPT = `Bạn là Market Analyst chuyên phân tích kỹ thuật chứng khoán Việt Nam.

NHIỆM VỤ: Phân tích dữ liệu thị trường và đưa ra báo cáo chi tiết.

**Chỉ số kỹ thuật quan trọng:**
- Moving Averages: SMA 50, SMA 200, EMA 10
- MACD: MACD line, Signal, Histogram
- Momentum: RSI (70/30 thresholds)
- Volatility: Bollinger Bands, ATR
- Volume: VWMA

**Quy tắc:**
1. LUÔN dùng tools để lấy dữ liệu real-time
2. Phân tích OHLC history, giá đóng cửa, bid/ask
3. Xác định xu hướng giá, mức hỗ trợ/kháng cự
4. Đánh giá khối lượng giao dịch
5. Chọn 8 chỉ số phù hợp nhất cho điều kiện thị trường hiện tại

**Trước khi viết báo cáo cuối cùng:**
- Gọi get_verified_market_snapshot để có dữ liệu chính xác nhất
- Nếu có sự khác biệt giữa các nguồn, ghi chú rõ

**Output:** Viết báo cáo chi tiết, thêm bảng Markdown tóm tắt ở cuối.

{instrumentContext}`;

const MARKET_ANALYST_USER_PROMPT = `Phân tích kỹ thuật cho mã {ticker} với dữ liệu sau:

OHLC History (30 ngày): {ohlcHistory}
Latest Trades: {latestTrades}
Latest Quotes: {latestQuotes}
SecDef: {secDef}

Hãy phân tích và đưa ra báo cáo chi tiết với bảng Markdown tóm tắt ở cuối.`;

export async function runMarketAnalyst(
  llm: ChatOpenAI,
  snapshot: DataSnapshot
): Promise<MarketAnalystOutput> {
  const systemPrompt = ChatPromptTemplate.fromTemplate(MARKET_ANALYST_SYSTEM_PROMPT);
  const userPrompt = ChatPromptTemplate.fromTemplate(MARKET_ANALYST_USER_PROMPT);

  const messages = await systemPrompt.formatMessages({
    instrumentContext: getInstrumentContext(snapshot),
  });

  const userMessages = await userPrompt.formatMessages({
    ticker: snapshot.ticker,
    ohlcHistory: JSON.stringify(snapshot.ohlcHistory.slice(0, 30)),
    latestTrades: JSON.stringify(snapshot.latestTrades),
    latestQuotes: JSON.stringify(snapshot.latestQuotes),
    secDef: JSON.stringify(snapshot.secDef),
  });

  const result = await llm.invoke([...messages, ...userMessages]);

  try {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const output = JSON.parse(content);
    return output as MarketAnalystOutput;
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      technicalAnalysis: content,
      priceTrend: "neutral",
      supportResistance: "Không xác định",
      volumeAnalysis: "Không xác định",
      summary: content,
    };
  }
}
