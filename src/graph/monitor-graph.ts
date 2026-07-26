import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { buildDataSnapshot } from "./trading-graph";
import { createAnalystsSubgraph } from "./subgraphs/analysts";
import type { MonitorSignal, MonitorResult } from "../telegram/types";
import type { DataSnapshot } from "../types/index";

// ==================== MONITOR STATE ====================

const MonitorStateAnnotation = Annotation.Root({
  ticker: Annotation<string>,
  date: Annotation<string>,
  dataSnapshot: Annotation<DataSnapshot | null>,
  marketReport: Annotation<string>,
  sentimentReport: Annotation<string>,
  newsReport: Annotation<string>,
  fundamentalsReport: Annotation<string>,
  signal: Annotation<MonitorSignal | "">,
  reason: Annotation<string>,
  messages: Annotation<unknown[]>,
});

type MonitorState = typeof MonitorStateAnnotation.State;

// ==================== QUICK SCREENER AGENT ====================

const SCREENER_PROMPT = `Bạn là Quick Screener — agent đánh giá nhanh tín hiệu giao dịch.

Dựa vào báo cáo của các analyst, đưa ra 1 trong 3 tín hiệu:
- ALERT: Có tín hiệu mạnh cần chú ý ngay (giá biến động lớn, tin tức quan trọng, breakout)
- WATCH: Đáng theo dõi, có dấu hiệu nhưng chưa rõ ràng
- OK: Bình thường, không có gì đặc biệt

Trả về JSON:
{{"signal": "ALERT"|"WATCH"|"OK", "reason": "lý do ngắn gọn 1-2 câu"}}

Mã: {ticker}
Giá hiện tại: {closePrice}
Báo cáo Market: {marketReport}
Báo cáo News: {newsReport}`;

// ==================== BUILD MONITOR GRAPH ====================

export function buildMonitorGraph(llm: ChatOpenAI) {
  const analystsSubgraph = createAnalystsSubgraph(llm);

  // Node fetch data
  async function fetchData(s: MonitorState): Promise<Partial<MonitorState>> {
    const date = s.date || (new Date().toISOString().split("T")[0] ?? "");
    try {
      const dataSnapshot = await buildDataSnapshot(s.ticker, date);
      return { date, dataSnapshot };
    } catch (err) {
      console.warn(`[monitor] fetchData error for ${s.ticker}: ${err}`);
      return {
        date,
        dataSnapshot: {
          ticker: s.ticker, date, closePrice: 0, ohlcHistory: [], latestTrades: [],
          latestQuotes: {}, foreignTrading: {}, secDef: {}, instruments: {},
          marketNews: "", socialSentiment: "",
          marketReport: "", sentimentReport: "", newsReport: "", fundamentalsReport: "",
        },
      };
    }
  }

  // Node quick screener — 1 LLM call
  async function quickScreener(s: MonitorState): Promise<Partial<MonitorState>> {
    try {
      const prompt = ChatPromptTemplate.fromTemplate(SCREENER_PROMPT);
      const messages = await prompt.formatMessages({
        ticker: s.ticker,
        closePrice: s.dataSnapshot?.closePrice ?? 0,
        marketReport: s.marketReport?.slice(0, 800) || "Không có dữ liệu",
        newsReport: s.newsReport?.slice(0, 800) || "Không có dữ liệu",
      });

      const result = await llm.invoke(messages);
      const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

      // Parse JSON từ response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          signal: (parsed.signal as MonitorSignal) || "OK",
          reason: parsed.reason || "",
        };
      }

      // Fallback: detect từ text
      const upper = content.toUpperCase();
      const signal: MonitorSignal = upper.includes("ALERT") ? "ALERT" : upper.includes("WATCH") ? "WATCH" : "OK";
      return { signal, reason: content.slice(0, 200) };
    } catch (err) {
      console.error(`[monitor] quickScreener error for ${s.ticker}: ${err}`);
      return { signal: "OK", reason: "Không thể phân tích" };
    }
  }

  return new StateGraph(MonitorStateAnnotation)
    .addNode("fetch", fetchData)
    .addNode("analysts", analystsSubgraph)
    .addNode("screener", quickScreener)
    .addEdge(START, "fetch")
    .addEdge("fetch", "analysts")
    .addEdge("analysts", "screener")
    .addEdge("screener", END)
    .compile();
}

// ==================== RUN MONITOR ====================

export async function runMonitor(
  llm: ChatOpenAI,
  ticker: string,
  date?: string
): Promise<MonitorResult> {
  const graph = buildMonitorGraph(llm);
  const targetDate = date || (new Date().toISOString().split("T")[0] ?? "");

  const result = await graph.invoke({
    ticker: ticker.toUpperCase(),
    date: targetDate,
    dataSnapshot: null,
    marketReport: "",
    sentimentReport: "",
    newsReport: "",
    fundamentalsReport: "",
    signal: "",
    reason: "",
    messages: [],
  });

  return {
    ticker: ticker.toUpperCase(),
    signal: (result.signal as MonitorSignal) || "OK",
    reason: result.reason || "",
    currentPrice: result.dataSnapshot?.closePrice ?? 0,
  };
}

/**
 * Chạy monitor cho nhiều mã cùng lúc, tối đa `concurrency` mã song song
 * để tránh rate limit DNSE API
 */
export async function runMonitorBatch(
  llm: ChatOpenAI,
  tickers: string[],
  concurrency = 3
): Promise<MonitorResult[]> {
  const results: MonitorResult[] = [];

  for (let i = 0; i < tickers.length; i += concurrency) {
    const batch = tickers.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((ticker) => runMonitor(llm, ticker).catch((err) => {
        console.error(`[monitor] lỗi ${ticker}: ${err}`);
        return { ticker, signal: "OK" as MonitorSignal, reason: "Lỗi khi scan", currentPrice: 0 };
      }))
    );
    results.push(...batchResults);
  }

  return results;
}
