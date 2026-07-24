import { z } from "zod";

// ==================== SHARED TYPES ====================

export interface DataSnapshot {
  ticker: string;
  date: string;
  closePrice: number;
  ohlcHistory: unknown[];
  latestTrades: unknown[];
  latestQuotes: unknown;
  foreignTrading: unknown;
  secDef: unknown;
  instruments: unknown;
  marketNews: string;
  socialSentiment: string;
  marketReport: string;
  sentimentReport: string;
  newsReport: string;
  fundamentalsReport: string;
}

// ==================== ANALYST OUTPUTS ====================

export const MarketAnalystOutputSchema = z.object({
  technicalAnalysis: z.string().describe("Phân tích kỹ thuật từ OHLC, giá, volume"),
  priceTrend: z.enum(["bullish", "bearish", "neutral"]).describe("Xu hướng giá"),
  supportResistance: z.string().describe("Mức hỗ trợ/kháng cự"),
  volumeAnalysis: z.string().describe("Phân tích khối lượng"),
  summary: z.string().describe("Tóm tắt phân tích thị trường"),
});
export type MarketAnalystOutput = z.infer<typeof MarketAnalystOutputSchema>;

export const NewsAnalystOutputSchema = z.object({
  newsSummary: z.string().describe("Tóm tắt tin tức quan trọng"),
  sentimentScore: z.number().min(-1).max(1).describe("Điểm sentiment (-1到1)"),
  keyEvents: z.array(z.string()).describe("Sự kiện quan trọng"),
  impactAssessment: z.string().describe("Đánh giá tác động"),
  summary: z.string().describe("Tóm tắt phân tích tin tức"),
});
export type NewsAnalystOutput = z.infer<typeof NewsAnalystOutputSchema>;

export const SocialAnalystOutputSchema = z.object({
  socialSentiment: z.string().describe("Sentiment từ mạng xã hội"),
  trendingTopics: z.array(z.string()).describe("Chủ đề trending"),
  retailSentiment: z.enum(["bullish", "bearish", "neutral"]).describe("Sentiment nhà đầu tư nhỏ lẻ"),
  summary: z.string().describe("Tóm tắt phân tích mạng xã hội"),
});
export type SocialAnalystOutput = z.infer<typeof SocialAnalystOutputSchema>;

export const FundamentalsAnalystOutputSchema = z.object({
  foreignActivity: z.string().describe("Hoạt động NĐT nước ngoài"),
  tradingVolume: z.string().describe("Khối lượng giao dịch"),
  priceRange: z.string().describe("Phạm vi giá (cao/thấp/mở cửa)"),
  marketCap: z.string().describe("Vốn hóa thị trường"),
  summary: z.string().describe("Tóm tắt phân tích cơ bản"),
});
export type FundamentalsAnalystOutput = z.infer<typeof FundamentalsAnalystOutputSchema>;

// ==================== RESEARCHER OUTPUTS ====================

export const BullResearcherOutputSchema = z.object({
  argument: z.string().describe("Luận điểm bullish"),
  evidence: z.array(z.string()).describe("Bằng chứng"),
  confidence: z.number().min(0).max(1).describe("Mức độ tự tin"),
  counterArguments: z.array(z.string()).describe("Phản biện từ phía bear"),
  summary: z.string().describe("Tóm tắt luận điểm bull"),
});
export type BullResearcherOutput = z.infer<typeof BullResearcherOutputSchema>;

export const BearResearcherOutputSchema = z.object({
  argument: z.string().describe("Luận điểm bearish"),
  evidence: z.array(z.string()).describe("Bằng chứng"),
  confidence: z.number().min(0).max(1).describe("Mức độ tự tin"),
  counterArguments: z.array(z.string()).describe("Phản biện từ phía bull"),
  summary: z.string().describe("Tóm tắt luận điểm bear"),
});
export type BearResearcherOutput = z.infer<typeof BearResearcherOutputSchema>;

// ==================== MANAGER OUTPUTS ====================

export const ResearchManagerOutputSchema = z.object({
  decision: z.enum(["bullish", "bearish", "neutral"]).describe("Quyết định cuối cùng"),
  confidence: z.number().min(0).max(1).describe("Mức độ tự tin"),
  reasoning: z.string().describe("Lý do"),
  bullSummary: z.string().describe("Tóm tắt luận điểm bull"),
  bearSummary: z.string().describe("Tóm tắt luận điểm bear"),
  keyFactors: z.array(z.string()).describe("Yếu tố quyết định"),
});
export type ResearchManagerOutput = z.infer<typeof ResearchManagerOutputSchema>;

// ==================== TRADER OUTPUT ====================

export const TraderOutputSchema = z.object({
  action: z.enum(["buy", "sell", "hold", "wait"]).describe("Hành động giao dịch"),
  ticker: z.string().describe("Mã chứng khoán"),
  confidence: z.number().min(0).max(1).describe("Mức độ tự tin"),
  targetPrice: z.number().describe("Giá mục tiêu"),
  stopLoss: z.number().describe("Giá cắt lỗ"),
  positionSize: z.string().describe("Quy mô vị thế (VD: 2-5% portfolio)"),
  timeframe: z.string().describe("Thời gian nắm giữ dự kiến"),
  reasoning: z.string().describe("Lý do chi tiết"),
});
export type TraderOutput = z.infer<typeof TraderOutputSchema>;

// ==================== RISK TEAM STATE ====================

export interface RiskDebateState {
  history: string;
  aggressiveHistory: string;
  conservativeHistory: string;
  neutralHistory: string;
  latestSpeaker: "Aggressive" | "Conservative" | "Neutral" | null;
  currentAggressiveResponse: string;
  currentConservativeResponse: string;
  currentNeutralResponse: string;
  count: number;
}

export interface RiskyAnalystOutput {
  perspective: "risky";
  assessment: string;
  risks: string[];
  opportunities: string[];
  recommendation: string;
}

export interface SafeAnalystOutput {
  perspective: "safe";
  assessment: string;
  risks: string[];
  mitigation: string[];
  recommendation: string;
}

export interface NeutralAnalystOutput {
  perspective: "neutral";
  assessment: string;
  balancedView: string;
  keyMetrics: string[];
  recommendation: string;
}

// ==================== PORTFOLIO MANAGER OUTPUT ====================

export const PortfolioManagerOutputSchema = z.object({
  finalDecision: z.enum(["approve", "reject", "modify"]).describe("Quyết định cuối cùng"),
  ticker: z.string().describe("Mã chứng khoán"),
  action: z.enum(["buy", "sell", "hold", "wait"]).describe("Hành động giao dịch"),
  adjustedTargetPrice: z.number().optional().describe("Giá mục tiêu điều chỉnh"),
  adjustedStopLoss: z.number().optional().describe("Giá cắt lỗ điều chỉnh"),
  adjustedPositionSize: z.string().optional().describe("Quy mô vị thế điều chỉnh"),
  reasoning: z.string().describe("Lý do quyết định"),
  riskAdjustments: z.array(z.string()).describe("Điều chỉnh rủi ro"),
});
export type PortfolioManagerOutput = z.infer<typeof PortfolioManagerOutputSchema>;

// ==================== GRAPH STATE ====================

export interface TradingState {
  ticker: string;
  date: string;
  dataSnapshot: DataSnapshot | null;

  // Analyst outputs
  marketAnalystReport: MarketAnalystOutput | null;
  newsAnalystReport: NewsAnalystOutput | null;
  socialAnalystReport: SocialAnalystOutput | null;
  fundamentalsAnalystReport: FundamentalsAnalystOutput | null;

  // Researcher outputs
  bullReport: BullResearcherOutput | null;
  bearReport: BearResearcherOutput | null;

  // Debate history
  debateHistory: string[];
  currentRound: number;
  maxRounds: number;

  // Manager output
  researchManagerDecision: ResearchManagerOutput | null;

  // Trader output
  traderDecision: TraderOutput | null;

  // Risk debate state
  riskDebateState: RiskDebateState;
  maxRiskRounds: number;

  // Final output
  portfolioManagerDecision: PortfolioManagerOutput | null;

  // Metadata
  error: string | null;
  messages: unknown[];
}
