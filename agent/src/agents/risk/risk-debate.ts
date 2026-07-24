import { ChatOpenAI } from "@langchain/openai";
import type { TraderOutput, DataSnapshot, RiskDebateState } from "../../types/index.js";

// ==================== AGGRESSIVE RISK ANALYST ====================

function getInstrumentContext(snapshot: DataSnapshot): string {
  return `
THÔNG TIN CHỨNG KHOÁN:
- Mã: ${snapshot.ticker}
- Giá hiện tại: ${snapshot.closePrice}
- Ngày: ${snapshot.date}
- Dữ liệu OHLC: ${JSON.stringify(snapshot.ohlcHistory.slice(0, 10))}
- Bid/Ask: ${JSON.stringify(snapshot.latestQuotes)}
- Dòng tiền NĐTNN: ${JSON.stringify(snapshot.foreignTrading)}
  `;
}

export async function runAggressiveAnalyst(
  llm: ChatOpenAI,
  traderDecision: TraderOutput,
  snapshot: DataSnapshot,
  riskState: RiskDebateState
): Promise<string> {
  const instrumentContext = getInstrumentContext(snapshot);

  const prompt = `Bạn là Aggressive Risk Analyst - chuyên đánh giá rủi ro từ góc nhìn MẠO HIỂM.

NHIỆM VỤ: Ủng hộ quyết định giao dịch của Trader, nhấn mạnh tiềm năng lợi nhuận cao.

QUYẾT ĐỊNH TỪ TRADER:
${JSON.stringify(traderDecision, null, 2)}

DỮ LIỆU THỊ TRƯỜNG:
${instrumentContext}
Market Research Report: ${snapshot.marketReport}
Social Media Sentiment Report: ${snapshot.sentimentReport}
Latest World Affairs Report: ${snapshot.newsReport}
Company Fundamentals Report: ${snapshot.fundamentalsReport}

LỊCH SỬ TRANEH LUẬN:
${riskState.history || "Chưa có debate"}

PHẢN BIỆN TỪ CONSERVATIVE:
${riskState.currentConservativeResponse || "Chưa có"}

PHẢN BIỆN TỪ NEUTRAL:
${riskState.currentNeutralResponse || "Chưa có"}

HÃY:
1. Đưa ra luận điểm BULLISH mạnh mẽ cho quyết định giao dịch này
2. Phản biện trực tiếp các ý kiến từ Conservative và Neutral
3. Nhấn mạnh tiềm năng tăng trưởng, cơ hội lợi nhuận
4. Chỉ ra nơi sự thận trọng có thể bỏ lỡ cơ hội quan trọng

Trả lời bằng văn bản tự nhiên, không cần format JSON.`;

  const result = await llm.invoke(prompt);
  const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

  return `Aggressive Analyst: ${content}`;
}

// ==================== CONSERVATIVE RISK ANALYST ====================

export async function runConservativeAnalyst(
  llm: ChatOpenAI,
  traderDecision: TraderOutput,
  snapshot: DataSnapshot,
  riskState: RiskDebateState
): Promise<string> {
  const instrumentContext = getInstrumentContext(snapshot);

  const prompt = `Bạn là Conservative Risk Analyst - chuyên đánh giá rủi ro từ góc nhìn THẬN TRỌNG.

NHIỆM VỤ: Bảo vệ tài sản, giảm thiểu biến động, đảm bảo tăng trưởng ổn định.

QUYẾT ĐỊNH TỪ TRADER:
${JSON.stringify(traderDecision, null, 2)}

DỮ LIỆU THỊ TRƯỜNG:
${instrumentContext}
Market Research Report: ${snapshot.marketReport}
Social Media Sentiment Report: ${snapshot.sentimentReport}
Latest World Affairs Report: ${snapshot.newsReport}
Company Fundamentals Report: ${snapshot.fundamentalsReport}

LỊCH SỬ TRANEH LUẬN:
${riskState.history || "Chưa có debate"}

PHẢN BIỆN TỪ AGGRESSIVE:
${riskState.currentAggressiveResponse || "Chưa có"}

PHẢN BIỆN TỪ NEUTRAL:
${riskState.currentNeutralResponse || "Chưa có"}

HÃY:
1. Chỉ ra các rủi ro tiềm ẩn từ quyết định giao dịch
2. Phản biện trực tiếp các ý kiến từ Aggressive và Neutral
3. Nhấn mạnh tầm quan trọng của việc bảo vệ vốn
4. Предложить các biện pháp giảm thiểu rủi ro

Trả lời bằng văn bản tự nhiên, không cần format JSON.`;

  const result = await llm.invoke(prompt);
  const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

  return `Conservative Analyst: ${content}`;
}

// ==================== NEUTRAL RISK ANALYST ====================

export async function runNeutralAnalyst(
  llm: ChatOpenAI,
  traderDecision: TraderOutput,
  snapshot: DataSnapshot,
  riskState: RiskDebateState
): Promise<string> {
  const instrumentContext = getInstrumentContext(snapshot);

  const prompt = `Bạn là Neutral Risk Analyst - chuyên đánh giá rủi ro từ góc nhìn CÂN BẰNG.

NHIỆM VỤ: Cung cấp góc nhìn cân bằng, xem xét cả hai phía lợi ích và rủi ro.

QUYẾT ĐỊNH TỪ TRADER:
${JSON.stringify(traderDecision, null, 2)}

DỮ LIỆU THỊ TRƯỜNG:
${instrumentContext}
Market Research Report: ${snapshot.marketReport}
Social Media Sentiment Report: ${snapshot.sentimentReport}
Latest World Affairs Report: ${snapshot.newsReport}
Company Fundamentals Report: ${snapshot.fundamentalsReport}

LỊCH SỬ TRANEH LUẬN:
${riskState.history || "Chưa có debate"}

PHẢN BIỆN TỪ AGGRESSIVE:
${riskState.currentAggressiveResponse || "Chưa có"}

PHẢN BIỆN TỪ CONSERVATIVE:
${riskState.currentConservativeResponse || "Chưa có"}

HÃY:
1. Phân tích cả hai phía (Aggressive và Conservative)
2. Chỉ ra điểm mạnh và yếu của mỗi quan điểm
3. Предложить chiến lược cân bằng giữa tăng trưởng và bảo vệ
4. Đưa ra khuyến nghị trung lập nhưng thực tế

Trả lời bằng văn bản tự nhiên, không cần format JSON.`;

  const result = await llm.invoke(prompt);
  const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

  return `Neutral Analyst: ${content}`;
}

// ==================== RISK DEBATE LOOP ====================

export async function runRiskDebate(
  llm: ChatOpenAI,
  traderDecision: TraderOutput,
  snapshot: DataSnapshot,
  maxRounds: number = 2
): Promise<RiskDebateState> {
  let riskState: RiskDebateState = {
    history: "",
    aggressiveHistory: "",
    conservativeHistory: "",
    neutralHistory: "",
    latestSpeaker: null,
    currentAggressiveResponse: "",
    currentConservativeResponse: "",
    currentNeutralResponse: "",
    count: 0,
  };

  for (let round = 0; round < maxRounds; round++) {
    console.log(`[Risk Debate] Round ${round + 1}/${maxRounds}`);

    // 1. Aggressive speaks first
    const aggressiveResponse = await runAggressiveAnalyst(llm, traderDecision, snapshot, riskState);
    riskState = updateRiskState(riskState, "Aggressive", aggressiveResponse);
    console.log(`[Risk Debate] Aggressive: ${aggressiveResponse.substring(0, 100)}...`);

    // 2. Conservative responds
    const conservativeResponse = await runConservativeAnalyst(llm, traderDecision, snapshot, riskState);
    riskState = updateRiskState(riskState, "Conservative", conservativeResponse);
    console.log(`[Risk Debate] Conservative: ${conservativeResponse.substring(0, 100)}...`);

    // 3. Neutral responds
    const neutralResponse = await runNeutralAnalyst(llm, traderDecision, snapshot, riskState);
    riskState = updateRiskState(riskState, "Neutral", neutralResponse);
    console.log(`[Risk Debate] Neutral: ${neutralResponse.substring(0, 100)}...`);
  }

  return riskState;
}

function updateRiskState(
  state: RiskDebateState,
  speaker: "Aggressive" | "Conservative" | "Neutral",
  response: string
): RiskDebateState {
  const newState = { ...state };

  newState.history += `\n${response}`;
  newState.count += 1;
  newState.latestSpeaker = speaker;

  switch (speaker) {
    case "Aggressive":
      newState.aggressiveHistory += `\n${response}`;
      newState.currentAggressiveResponse = response;
      break;
    case "Conservative":
      newState.conservativeHistory += `\n${response}`;
      newState.currentConservativeResponse = response;
      break;
    case "Neutral":
      newState.neutralHistory += `\n${response}`;
      newState.currentNeutralResponse = response;
      break;
  }

  return newState;
}
