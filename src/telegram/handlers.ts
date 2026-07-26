import type { Bot } from "grammy";
import type { ChatOpenAI } from "@langchain/openai";
import type { TelegramContext } from "./types";
import { sendMarkdown } from "./bot";
import {
  formatAnalysisResult,
  formatMonitorResult,
  formatPortfolio,
  formatBuyConfirmation,
  formatCloseConfirmation,
  formatDailyReviews,
  formatWatchlistScan,
  formatWatchlist,
  formatError,
  formatHelp,
  esc,
} from "./formatter";
import { PaperPortfolioTracker } from "../portfolio/tracker";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "../portfolio/watchlist";
import { analyze } from "../graph/trading-graph";
import { runMonitor, runMonitorBatch } from "../graph/monitor-graph";
import { runPositionReview, runAllOpenPositionReviews } from "../portfolio/portfolio-review-graph";
import prisma from "../db/prisma";

// ==================== SETUP ALL HANDLERS ====================

export function setupHandlers(bot: Bot<TelegramContext>, llm: ChatOpenAI) {
  const tracker = new PaperPortfolioTracker();

  // ==================== /start & /help ====================

  bot.command(["start", "help"], async (ctx) => {
    await sendMarkdown(bot, ctx.chat.id, formatHelp());
  });

  // ==================== PHÂN TÍCH ====================

  bot.command("analyze", async (ctx) => {
    const ticker = ctx.match?.trim().toUpperCase();
    if (!ticker) {
      await ctx.reply("❌ Dùng: /analyze TICKER (vd: /analyze HPG)");
      return;
    }

    await ctx.reply(`⏳ Đang phân tích ${ticker} — quy trình 7 bước, vui lòng chờ ~2 phút...`);

    try {
      const date = new Date().toISOString().split("T")[0] ?? "";
      const result = await analyze(llm, ticker, date);
      await sendMarkdown(bot, ctx.chat.id, formatAnalysisResult(ticker, result));
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi phân tích: ${err}`));
    }
  });

  bot.command("quick", async (ctx) => {
    const ticker = ctx.match?.trim().toUpperCase();
    if (!ticker) {
      await ctx.reply("❌ Dùng: /quick TICKER (vd: /quick HPG)");
      return;
    }

    await ctx.reply(`⚡ Đang scan nhanh ${ticker}...`);

    try {
      const result = await runMonitor(llm, ticker);
      const signalEmoji = result.signal === "ALERT" ? "🚨" : result.signal === "WATCH" ? "👀" : "✅";
      const text = [
        `${signalEmoji} *Quick scan: ${esc(ticker)}*`,
        "",
        `Tín hiệu: *${esc(result.signal)}*`,
        `Giá: ${esc(result.currentPrice.toLocaleString("vi-VN"))}đ`,
        `${esc(result.reason)}`,
      ].join("\n");
      await sendMarkdown(bot, ctx.chat.id, text);
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi scan: ${err}`));
    }
  });

  // ==================== PORTFOLIO ====================

  bot.command("portfolio", async (ctx) => {
    try {
      const positions = await tracker.getAllPositions();
      await sendMarkdown(bot, ctx.chat.id, formatPortfolio(positions));
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi: ${err}`));
    }
  });

  // /buy HPG 1000 26.8  [ghi chú tùy chọn]
  bot.command("buy", async (ctx) => {
    const parts = (ctx.match ?? "").trim().split(/\s+/);
    const ticker = parts[0]?.toUpperCase();
    const quantity = parseFloat(parts[1] ?? "");
    const avgCost = parseFloat(parts[2] ?? "");
    const note = parts.slice(3).join(" ") || undefined;

    if (!ticker || isNaN(quantity) || isNaN(avgCost)) {
      await ctx.reply("❌ Dùng: /buy TICKER SỐ_LƯỢNG GIÁ [ghi chú]\nVD: /buy HPG 1000 26.8");
      return;
    }

    try {
      const result = await tracker.openPosition({ ticker, quantity, avgCost, note });
      const date = new Date().toISOString().split("T")[0] ?? "";
      await sendMarkdown(
        bot,
        ctx.chat.id,
        formatBuyConfirmation(ticker, quantity, avgCost, result.positionId, date)
      );
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi: ${err}`));
    }
  });

  // /sell TICKER SỐ_LƯỢNG GIÁ_ĐÓNG
  bot.command("sell", async (ctx) => {
    const parts = (ctx.match ?? "").trim().split(/\s+/);
    const ticker = parts[0]?.toUpperCase();
    const sellQty = parseFloat(parts[1] ?? "");
    const closePrice = parseFloat(parts[2] ?? "");

    if (!ticker || isNaN(sellQty) || isNaN(closePrice)) {
      await ctx.reply("❌ Dùng: /sell TICKER SỐ_LƯỢNG GIÁ\nVD: /sell HPG 500 28.5");
      return;
    }

    try {
      const result = await tracker.sellPartialByTicker(ticker, sellQty, closePrice);
      if (!result.success) {
        await sendMarkdown(bot, ctx.chat.id, formatError(result.message));
        return;
      }
      await sendMarkdown(
        bot,
        ctx.chat.id,
        formatCloseConfirmation(ticker, result.pnl ?? 0, result.pnlPct ?? 0)
      );
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi: ${err}`));
    }
  });

  // /close TICKER GIÁ_ĐÓNG
  bot.command("close", async (ctx) => {
    const parts = (ctx.match ?? "").trim().split(/\s+/);
    const ticker = parts[0]?.toUpperCase();
    const closePrice = parseFloat(parts[1] ?? "");

    if (!ticker || isNaN(closePrice)) {
      await ctx.reply("❌ Dùng: /close TICKER GIÁ\nVD: /close HPG 28.5");
      return;
    }

    try {
      const result = await tracker.closeAllByTicker(ticker, closePrice);
      if (!result.success) {
        await sendMarkdown(bot, ctx.chat.id, formatError(result.message));
        return;
      }
      await sendMarkdown(
        bot,
        ctx.chat.id,
        formatCloseConfirmation(ticker, result.pnl ?? 0, result.pnlPct ?? 0)
      );
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi: ${err}`));
    }
  });

  // /review TICKER  — chạy portfolio-review-graph cho vị thế đang mở của TICKER
  bot.command("review", async (ctx) => {
    const ticker = ctx.match?.trim().toUpperCase();
    if (!ticker) {
      await ctx.reply("❌ Dùng: /review TICKER (vd: /review HPG)");
      return;
    }

    await ctx.reply(`🔍 Đang đánh giá vị thế ${ticker}...`);

    try {
      const position = await prisma.paperPosition.findFirst({
        where: { ticker, status: "open" },
      });

      if (!position) {
        await ctx.reply(`❌ Không có vị thế mở cho ${ticker}`);
        return;
      }

      const result = await runPositionReview(llm, position.id);
      if (!result) {
        await ctx.reply(`ℹ️ ${ticker} mở hôm nay, chưa cần review`);
        return;
      }

      await sendMarkdown(bot, ctx.chat.id, formatDailyReviews([result]));
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi review: ${err}`));
    }
  });

  // ==================== WATCHLIST ====================

  bot.command("watchlist", async (ctx) => {
    try {
      const tickers = await getWatchlist();
      await sendMarkdown(bot, ctx.chat.id, formatWatchlist(tickers));
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi: ${err}`));
    }
  });

  bot.command("add", async (ctx) => {
    const ticker = ctx.match?.trim().toUpperCase();
    if (!ticker) {
      await ctx.reply("❌ Dùng: /add TICKER (vd: /add HPG)");
      return;
    }

    try {
      const added = await addToWatchlist(ticker);
      if (added) {
        await ctx.reply(`✅ Đã thêm ${ticker} vào watchlist`);
      } else {
        await ctx.reply(`ℹ️ ${ticker} đã có trong watchlist`);
      }
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi: ${err}`));
    }
  });

  bot.command("remove", async (ctx) => {
    const ticker = ctx.match?.trim().toUpperCase();
    if (!ticker) {
      await ctx.reply("❌ Dùng: /remove TICKER (vd: /remove HPG)");
      return;
    }

    try {
      const removed = await removeFromWatchlist(ticker);
      if (removed) {
        await ctx.reply(`✅ Đã xóa ${ticker} khỏi watchlist`);
      } else {
        await ctx.reply(`❌ ${ticker} không có trong watchlist`);
      }
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi: ${err}`));
    }
  });

  bot.command("check", async (ctx) => {
    try {
      const tickers = await getWatchlist();
      if (tickers.length === 0) {
        await ctx.reply("📋 Watchlist trống. Dùng /add TICKER để thêm mã.");
        return;
      }
      await ctx.reply(`🔍 Đang scan ${tickers.length} mã: ${tickers.join(", ")}...`);
      const results = await runMonitorBatch(llm, tickers);
      await sendMarkdown(bot, ctx.chat.id, formatWatchlistScan(results));
    } catch (err) {
      await sendMarkdown(bot, ctx.chat.id, formatError(`Lỗi scan: ${err}`));
    }
  });
}
