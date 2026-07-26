import cron from "node-cron";
import type { ChatOpenAI } from "@langchain/openai";
import type { Bot } from "grammy";
import type { TelegramContext } from "../telegram/types";
import { runWatchlistScan, runPortfolioReview } from "./daily-scan";

// ==================== CRON SCHEDULER ====================

/**
 * Khởi động tất cả cron jobs
 *
 * Schedule (múi giờ Asia/Ho_Chi_Minh — GMT+7):
 *   08:00 — Quét watchlist, gửi báo cáo tổng quan trước phiên
 *   11:30 — Alert nhanh, chỉ gửi nếu có mã ALERT
 *   15:30 — Portfolio review, chỉ gửi khi có thay đổi
 */
export function startCronJobs(
  llm: ChatOpenAI,
  bot: Bot<TelegramContext>,
  chatIds: string[]
): void {
  if (chatIds.length === 0) {
    console.warn("[cron] Không có chat ID nào được cấu hình — cron sẽ chạy nhưng không gửi Telegram");
  }

  // 08:00 — Quét watchlist đầu ngày
  cron.schedule(
    "0 8 * * 1-5",    // Mon-Fri 08:00
    async () => {
      console.log("[cron] 08:00 — Bắt đầu quét watchlist");
      try {
        await runWatchlistScan(llm, bot, chatIds, false);
      } catch (err) {
        console.error("[cron] 08:00 lỗi:", err);
      }
    },
    { timezone: "Asia/Ho_Chi_Minh" }
  );

  // 11:30 — Alert nhanh giữa phiên (chỉ gửi ALERT)
  cron.schedule(
    "30 11 * * 1-5",  // Mon-Fri 11:30
    async () => {
      console.log("[cron] 11:30 — Kiểm tra alert giữa phiên");
      try {
        await runWatchlistScan(llm, bot, chatIds, true);
      } catch (err) {
        console.error("[cron] 11:30 lỗi:", err);
      }
    },
    { timezone: "Asia/Ho_Chi_Minh" }
  );

  // 15:30 — Portfolio review cuối phiên
  cron.schedule(
    "30 15 * * 1-5",  // Mon-Fri 15:30
    async () => {
      console.log("[cron] 15:30 — Bắt đầu portfolio review");
      try {
        await runPortfolioReview(llm, bot, chatIds);
      } catch (err) {
        console.error("[cron] 15:30 lỗi:", err);
      }
    },
    { timezone: "Asia/Ho_Chi_Minh" }
  );

  console.log("[cron] Đã đăng ký 3 jobs: 08:00 watchlist, 11:30 alert, 15:30 portfolio review (Mon-Fri, GMT+7)");
}
