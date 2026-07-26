import type { ChatOpenAI } from "@langchain/openai";
import type { Bot } from "grammy";
import type { TelegramContext } from "../telegram/types";
import { sendMarkdown } from "../telegram/bot";
import { formatWatchlistScan, formatDailyReviews } from "../telegram/formatter";
import { getWatchlist } from "../portfolio/watchlist";
import { runMonitorBatch } from "../graph/monitor-graph";
import { runAllOpenPositionReviews } from "../portfolio/portfolio-review-graph";

// ==================== DAILY SCAN JOBS ====================

/**
 * 08:00 & 11:30 — quét watchlist, gửi kết quả về Telegram
 * @param alertOnly nếu true, chỉ gửi nếu có ALERT (dùng cho lúc 11:30)
 */
export async function runWatchlistScan(
  llm: ChatOpenAI,
  bot: Bot<TelegramContext>,
  chatIds: string[],
  alertOnly = false
): Promise<void> {
  const tickers = await getWatchlist();
  if (tickers.length === 0) {
    console.log("[scheduler] Watchlist trống, bỏ qua scan");
    return;
  }

  console.log(`[scheduler] Quét ${tickers.length} mã: ${tickers.join(", ")}`);
  const results = await runMonitorBatch(llm, tickers);

  const hasAlert = results.some((r) => r.signal === "ALERT");

  // 11:30: chỉ gửi nếu có ALERT
  if (alertOnly && !hasAlert) {
    console.log("[scheduler] 11:30 — không có ALERT, bỏ qua gửi Telegram");
    return;
  }

  const message = formatWatchlistScan(results);
  for (const chatId of chatIds) {
    try {
      await sendMarkdown(bot, chatId, message);
    } catch (err) {
      console.error(`[scheduler] Lỗi gửi Telegram ${chatId}: ${err}`);
    }
  }
}

/**
 * 15:30 — review toàn bộ vị thế mở, chỉ gửi Telegram khi có thay đổi
 */
export async function runPortfolioReview(
  llm: ChatOpenAI,
  bot: Bot<TelegramContext>,
  chatIds: string[]
): Promise<void> {
  console.log("[scheduler] 15:30 — bắt đầu portfolio review");

  const reviews = await runAllOpenPositionReviews(llm);

  if (reviews.length === 0) {
    console.log("[scheduler] Không có vị thế nào cần review");
    return;
  }

  // Chỉ gửi review có thay đổi (recommendation đổi hoặc giá biến động > 3%)
  const toNotify = reviews.filter((r) => r.changed);

  if (toNotify.length === 0) {
    console.log(`[scheduler] ${reviews.length} vị thế reviewed — không có thay đổi, im lặng`);
    return;
  }

  console.log(`[scheduler] Gửi Telegram: ${toNotify.length}/${reviews.length} vị thế có thay đổi`);

  const message = formatDailyReviews(toNotify);
  for (const chatId of chatIds) {
    try {
      await sendMarkdown(bot, chatId, message);
    } catch (err) {
      console.error(`[scheduler] Lỗi gửi Telegram ${chatId}: ${err}`);
    }
  }
}
