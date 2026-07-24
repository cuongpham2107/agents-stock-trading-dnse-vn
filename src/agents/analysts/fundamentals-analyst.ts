import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { DataSnapshot, FundamentalsAnalystOutput } from "../../types/index.ts";

function getInstrumentContext(snapshot: DataSnapshot): string {
  return `
THÔNG TIN CHỨNG KHOÁN:
- Mã: ${snapshot.ticker}
- Giá hiện tại: ${snapshot.closePrice}
- Ngày: ${snapshot.date}
  `;
}

const FUNDAMENTALS_SYSTEM_PROMPT = `Bạn là Fundamental Analyst phân tích thông tin cơ bản của công ty.

NHIỆM VỤ: Phân tích thông tin tài chính và đưa ra báo cáo toàn diện.

**Công cụ có sẵn:**
- get_fundamentals: Phân tích tổng quan công ty
- get_balance_sheet: Báo cáo tài sản
- get_cashflow: Báo cáo dòng tiền
- get_income_statement: Báo cáo thu nhập

**Yêu cầu:**
1. Phân tích sâu về tài chính công ty
2. Đưa ra insights cụ thể, có thể hành động được
3. Bảng Markdown tóm tắt ở cuối báo cáo

{instrumentContext}`;

const FUNDAMENTALS_USER_PROMPT = `Phân tích cơ bản cho mã {ticker} với dữ liệu sau:

Foreign Trading: {foreignTrading}
Latest Trades: {latestTrades}
Instruments: {instruments}
SecDef: {secDef}

Hãy phân tích và đưa ra báo cáo chi tiết với bảng Markdown tóm tắt ở cuối.`;

export async function runFundamentalsAnalyst(
  llm: ChatOpenAI,
  snapshot: DataSnapshot
): Promise<FundamentalsAnalystOutput> {
  const systemPrompt = ChatPromptTemplate.fromTemplate(FUNDAMENTALS_SYSTEM_PROMPT);
  const userPrompt = ChatPromptTemplate.fromTemplate(FUNDAMENTALS_USER_PROMPT);

  const messages = await systemPrompt.formatMessages({
    instrumentContext: getInstrumentContext(snapshot),
  });

  const userMessages = await userPrompt.formatMessages({
    ticker: snapshot.ticker,
    foreignTrading: JSON.stringify(snapshot.foreignTrading),
    latestTrades: JSON.stringify(snapshot.latestTrades),
    instruments: JSON.stringify(snapshot.instruments),
    secDef: JSON.stringify(snapshot.secDef),
  });

  const result = await llm.invoke([...messages, ...userMessages]);

  try {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    const output = JSON.parse(content);
    return output as FundamentalsAnalystOutput;
  } catch {
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return {
      foreignActivity: content,
      tradingVolume: "Không xác định",
      priceRange: "Không xác định",
      marketCap: "Không xác định",
      summary: content,
    };
  }
}
