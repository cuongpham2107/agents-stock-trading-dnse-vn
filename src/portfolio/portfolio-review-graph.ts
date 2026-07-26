import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { buildDataSnapshot } from "../graph/trading-graph";
import { createAnalystsSubgraph } from "../graph/subgraphs/analysts";
import prisma from "../db/prisma";
import type { PositionRecommendation, PositionReviewResult } from "../telegram/types";
import type { DataSnapshot } from "../types/index";

// ==================== REVIEW STATE ====================

const ReviewStateAnnotation = Annotation.Root({
  positionId: Annotation<string>,
  ticker: Annotation<string>,
  quantity: Annotation<number>,
  avgCost: Annotation<number>,
  date: Annotation<string>,
  dataSnapshot: Annotation<DataSnapshot | null>,
  marketReport: Annotation<string>,
  sentimentReport: Annotation<string>,
  newsReport: Annotation<string>,
  fundamentalsReport: Annotation<string>,
  currentPrice: Annotation<number>,
  pnl: Annotation<number>,
  pnlPct: Annotation<number>,
  recommendation: Annotation<PositionRecommendation | "">,
  reasoning: Annotation<string>,
  messages: Annotation<unknown[]>,
});

type ReviewState = typeof ReviewStateAnnotation.State;

// ==================== POSITION EVALUATOR PROMPT ====================

const EVALUATOR_PROMPT = `Bạn là Position Evaluator — chuyên gia đánh giá vị thế paper trading.

Context vị thế:
- Mã: {ticker}
- Đang giả định giữ: {quantity} cổ
- Giá vốn: {avgCost} VND
- Giá hôm nay: {currentPrice} VND
- P&L hiện tại: {pnl} VND ({pnlPct}%)

Phân tích từ các analyst:
Market: {marketReport}
News: {newsReport}

Dựa vào toàn bộ thông tin trên, đưa ra khuyến nghị:
- HOLD: Giữ nguyên, xu hướng chưa thay đổi
- BUY_MORE: Nên mua thêm, tín hiệu tốt
- PARTIAL_SELL: Chốt lời/cắt lỗ một phần
- FULL_SELL: Đóng toàn bộ vị thế

Trả về JSON:
{{"recommendation": "HOLD"|"BUY_MORE"|"PARTIAL_SELL"|"FULL_SELL", "reasoning": "lý do 2-3 câu"}}`;

// ==================== BUILD REVIEW GRAPH ====================

export function buildPortfolioReviewGraph(llm: ChatOpenAI) {
  const analystsSubgraph = createAnalystsSubgraph(llm);

  // Node: Fetch giá thị trường hôm nay
  async function fetchCurrentPrice(s: ReviewState): Promise<Partial<ReviewState>> {
    const date = s.date || (new Date().toISOString().split("T")[0] ?? "");
    try {
      const dataSnapshot = await buildDataSnapshot(s.ticker, date);
      const currentPrice = dataSnapshot.closePrice || s.avgCost;
      const pnl = (currentPrice - s.avgCost) * s.quantity;
      const pnlPct = ((currentPrice - s.avgCost) / s.avgCost) * 100;
      return { date, dataSnapshot, currentPrice, pnl, pnlPct };
    } catch (err) {
      console.warn(`[review] fetchCurrentPrice error for ${s.ticker}: ${err}`);
      const currentPrice = s.avgCost;
      return {
        date,
        dataSnapshot: null,
        currentPrice,
        pnl: 0,
        pnlPct: 0,
      };
    }
  }

  // Node: Đánh giá vị thế
  async function positionEvaluator(s: ReviewState): Promise<Partial<ReviewState>> {
    try {
      const prompt = ChatPromptTemplate.fromTemplate(EVALUATOR_PROMPT);
      const messages = await prompt.formatMessages({
        ticker: s.ticker,
        quantity: s.quantity,
        avgCost: s.avgCost.toLocaleString("vi-VN"),
        currentPrice: s.currentPrice.toLocaleString("vi-VN"),
        pnl: s.pnl.toLocaleString("vi-VN"),
        pnlPct: s.pnlPct.toFixed(2),
        marketReport: s.marketReport?.slice(0, 800) || "Không có dữ liệu",
        newsReport: s.newsReport?.slice(0, 800) || "Không có dữ liệu",
      });

      const result = await llm.invoke(messages);
      const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          recommendation: (parsed.recommendation as PositionRecommendation) || "HOLD",
          reasoning: parsed.reasoning || "",
        };
      }

      // Fallback
      const upper = content.toUpperCase();
      let rec: PositionRecommendation = "HOLD";
      if (upper.includes("FULL_SELL") || upper.includes("FULL SELL")) rec = "FULL_SELL";
      else if (upper.includes("PARTIAL_SELL") || upper.includes("PARTIAL SELL")) rec = "PARTIAL_SELL";
      else if (upper.includes("BUY_MORE") || upper.includes("BUY MORE")) rec = "BUY_MORE";
      return { recommendation: rec, reasoning: content.slice(0, 300) };
    } catch (err) {
      console.error(`[review] positionEvaluator error for ${s.ticker}: ${err}`);
      return { recommendation: "HOLD", reasoning: "Không thể đánh giá do lỗi" };
    }
  }

  // Node: Lưu DailyReview vào DB
  async function saveDailyReview(s: ReviewState): Promise<Partial<ReviewState>> {
    const today = s.date || (new Date().toISOString().split("T")[0] ?? "");
    try {
      await prisma.dailyReview.upsert({
        where: { positionId_date: { positionId: s.positionId, date: today } },
        create: {
          positionId: s.positionId,
          ticker: s.ticker,
          date: today,
          currentPrice: s.currentPrice,
          pnl: s.pnl,
          pnlPct: s.pnlPct,
          recommendation: s.recommendation || "HOLD",
          reasoning: s.reasoning,
        },
        update: {
          currentPrice: s.currentPrice,
          pnl: s.pnl,
          pnlPct: s.pnlPct,
          recommendation: s.recommendation || "HOLD",
          reasoning: s.reasoning,
        },
      });
    } catch (err) {
      console.error(`[review] saveDailyReview error: ${err}`);
    }
    return {};
  }

  return new StateGraph(ReviewStateAnnotation)
    .addNode("fetch", fetchCurrentPrice)
    .addNode("analysts", analystsSubgraph)
    .addNode("evaluator", positionEvaluator)
    .addNode("save", saveDailyReview)
    .addEdge(START, "fetch")
    .addEdge("fetch", "analysts")
    .addEdge("analysts", "evaluator")
    .addEdge("evaluator", "save")
    .addEdge("save", END)
    .compile();
}

// ==================== RUN REVIEW FOR ONE POSITION ====================

export async function runPositionReview(
  llm: ChatOpenAI,
  positionId: string
): Promise<PositionReviewResult | null> {
  const position = await prisma.paperPosition.findUnique({
    where: { id: positionId },
    include: { reviews: { orderBy: { date: "desc" }, take: 1 } },
  });

  if (!position || position.status === "closed") return null;

  // Không review ngày mở vị thế
  const today = new Date().toISOString().split("T")[0] ?? "";
  if (position.openDate === today) {
    console.log(`[review] Bỏ qua ${position.ticker} — mở hôm nay`);
    return null;
  }

  const graph = buildPortfolioReviewGraph(llm);

  const result = await graph.invoke({
    positionId: position.id,
    ticker: position.ticker,
    quantity: position.quantity,
    avgCost: position.avgCost,
    date: today,
    dataSnapshot: null,
    marketReport: "",
    sentimentReport: "",
    newsReport: "",
    fundamentalsReport: "",
    currentPrice: 0,
    pnl: 0,
    pnlPct: 0,
    recommendation: "",
    reasoning: "",
    messages: [],
  });

  // So sánh với review hôm qua
  const lastReview = position.reviews[0];
  const lastRec = lastReview?.recommendation;
  const currentRec = result.recommendation || "HOLD";

  // Kiểm tra P&L thay đổi > 3% so với hôm qua
  const lastPnlPct = lastReview?.pnlPct ?? 0;
  const pnlMovement = Math.abs((result.pnlPct ?? 0) - lastPnlPct);
  const changed = currentRec !== lastRec || pnlMovement >= 3;

  return {
    ticker: position.ticker,
    positionId: position.id,
    currentPrice: result.currentPrice ?? 0,
    avgCost: position.avgCost,
    quantity: position.quantity,
    pnl: result.pnl ?? 0,
    pnlPct: result.pnlPct ?? 0,
    recommendation: currentRec as PositionRecommendation,
    reasoning: result.reasoning || "",
    changed,
    priceMovedPct: pnlMovement,
  };
}

// ==================== RUN REVIEW FOR ALL OPEN POSITIONS ====================

export async function runAllOpenPositionReviews(
  llm: ChatOpenAI
): Promise<PositionReviewResult[]> {
  const openPositions = await prisma.paperPosition.findMany({
    where: { status: "open" },
  });

  if (openPositions.length === 0) return [];

  const today = new Date().toISOString().split("T")[0] ?? "";

  // Lọc: không review ngày mở
  const toReview = openPositions.filter((p) => p.openDate !== today);

  // Chạy tối đa 3 cùng lúc để tránh rate limit
  const results: PositionReviewResult[] = [];
  for (let i = 0; i < toReview.length; i += 3) {
    const batch = toReview.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map((p) =>
        runPositionReview(llm, p.id).catch((err) => {
          console.error(`[review] lỗi ${p.ticker}: ${err}`);
          return null;
        })
      )
    );
    results.push(...batchResults.filter((r): r is PositionReviewResult => r !== null));
  }

  return results;
}
