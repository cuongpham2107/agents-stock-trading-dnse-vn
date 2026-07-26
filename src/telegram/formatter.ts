import type { MonitorResult, PositionReviewResult } from "./types";

// ==================== TELEGRAM MARKDOWN FORMATTER ====================

/**
 * Escape Markdown v2 — bắt buộc với parseMode MarkdownV2 của Telegram
 */
export function esc(text: string | number): string {
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

// ==================== ANALYSIS RESULT ====================

/**
 * Format kết quả trading-graph thành Markdown ngắn gọn cho Telegram
 */
export function formatAnalysisResult(ticker: string, result: string): string {
  const lines = result.split("\n").filter(Boolean);
  const preview = lines.slice(0, 12).join("\n");

  return [
    `📊 *Phân tích ${esc(ticker)}*`,
    "",
    esc(preview),
    "",
    `_⚠️ Đây là phân tích tham khảo, không phải lời khuyên tài chính\\._`,
  ].join("\n");
}

/**
 * Format kết quả monitor-graph nhanh
 */
export function formatMonitorResult(ticker: string, result: string): string {
  return [
    `⚡ *Quick scan: ${esc(ticker)}*`,
    "",
    esc(result.slice(0, 600)),
  ].join("\n");
}

// ==================== PORTFOLIO ====================

export function formatPortfolio(
  positions: Array<{
    id: string;
    ticker: string;
    quantity: number;
    avgCost: number;
    status: string;
    openDate: string;
    realizedPnl: number | null;
  }>
): string {
  if (positions.length === 0) {
    return "📋 *Danh mục trống*\n\nDùng `/buy TICKER SỐ\\_LƯỢNG GIÁ` để thêm vị thế\\.";
  }

  const open = positions.filter((p) => p.status === "open");
  const closed = positions.filter((p) => p.status === "closed");

  const lines: string[] = ["📋 *Danh mục Paper Trading*", ""];

  if (open.length > 0) {
    lines.push("🟢 *Đang mở:*");
    for (const p of open) {
      const id = p.id.slice(0, 8);
      lines.push(
        `  • ${esc(p.ticker)} \\| ${esc(p.quantity)} cổ \\| Giá vốn: ${esc(formatPrice(p.avgCost))}đ`,
        `    ID: \`${esc(id)}\` \\| Ngày mở: ${esc(p.openDate)}`
      );
    }
    lines.push("");
  }

  if (closed.length > 0) {
    lines.push("🔴 *Đã đóng:*");
    for (const p of closed) {
      const pnl = p.realizedPnl ?? 0;
      const emoji = pnl >= 0 ? "📈" : "📉";
      lines.push(
        `  • ${esc(p.ticker)} \\| P&L: ${emoji} ${esc(formatPnL(pnl))}đ`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ==================== BUY / CLOSE ====================

export function formatBuyConfirmation(
  ticker: string,
  quantity: number,
  avgCost: number,
  positionId: string,
  date: string
): string {
  return [
    `✅ *Đã ghi nhận mua giả định*`,
    "",
    `  Mã: *${esc(ticker)}*`,
    `  Số lượng: ${esc(quantity)} cổ`,
    `  Giá mua: ${esc(formatPrice(avgCost))}đ`,
    `  Ngày: ${esc(date)}`,
    `  ID: \`${esc(positionId.slice(0, 8))}\``,
    "",
    `_Dùng \`/review ${esc(ticker)}\` để đánh giá ngay_`,
  ].join("\n");
}

export function formatCloseConfirmation(
  ticker: string,
  pnl: number,
  pnlPct: number
): string {
  const emoji = pnl >= 0 ? "📈" : "📉";
  return [
    `✅ *Đã đóng vị thế ${esc(ticker)}*`,
    "",
    `  P&L: ${emoji} ${esc(formatPnL(pnl))}đ \\(${esc(pnlPct.toFixed(2))}%\\)`,
  ].join("\n");
}

// ==================== DAILY REVIEW ====================

export function formatDailyReviews(reviews: PositionReviewResult[]): string {
  if (reviews.length === 0) return "ℹ️ Không có vị thế nào cần review hôm nay\\.";

  const lines: string[] = ["📊 *Portfolio Review hàng ngày*", ""];

  for (const r of reviews) {
    const pnlEmoji = r.pnl >= 0 ? "📈" : "📉";
    const recEmoji: Record<string, string> = {
      HOLD: "⏸",
      BUY_MORE: "🟢",
      PARTIAL_SELL: "🟡",
      FULL_SELL: "🔴",
    };
    const changeNote = r.changed ? " 🔔 *Đổi trạng thái*" : "";

    lines.push(
      `${recEmoji[r.recommendation] ?? "•"} *${esc(r.ticker)}*${changeNote}`,
      `  Giá: ${esc(formatPrice(r.currentPrice))}đ \\| P&L: ${pnlEmoji} ${esc(formatPnL(r.pnl))}đ \\(${esc(r.pnlPct.toFixed(2))}%\\)`,
      `  Khuyến nghị: *${esc(r.recommendation)}*`,
      `  ${esc(r.reasoning.slice(0, 200))}`,
      ""
    );
  }

  return lines.join("\n");
}

// ==================== WATCHLIST SCAN ====================

export function formatWatchlistScan(results: MonitorResult[]): string {
  if (results.length === 0) return "ℹ️ Watchlist trống\\.";

  const alerts = results.filter((r) => r.signal === "ALERT");
  const watches = results.filter((r) => r.signal === "WATCH");
  const ok = results.filter((r) => r.signal === "OK");

  const lines: string[] = ["🔍 *Watchlist Scan*", ""];

  if (alerts.length > 0) {
    lines.push("🚨 *ALERT:*");
    for (const r of alerts) {
      lines.push(
        `  • *${esc(r.ticker)}* — ${esc(r.reason)}`,
        `    Giá: ${esc(formatPrice(r.currentPrice))}đ${r.priceChange !== undefined ? ` \\(${esc(r.priceChange.toFixed(1))}%\\)` : ""}`,
        ""
      );
    }
  }

  if (watches.length > 0) {
    lines.push("👀 *WATCH:*");
    for (const r of watches) {
      lines.push(`  • *${esc(r.ticker)}* — ${esc(r.reason)}`);
    }
    lines.push("");
  }

  if (ok.length > 0) {
    lines.push(`✅ *OK:* ${ok.map((r) => esc(r.ticker)).join(", ")}`);
  }

  return lines.join("\n");
}

// ==================== WATCHLIST ====================

export function formatWatchlist(tickers: string[]): string {
  if (tickers.length === 0) {
    return "📋 *Watchlist trống*\n\nDùng `/add TICKER` để thêm mã\\.";
  }
  return [
    `📋 *Watchlist \\(${esc(tickers.length)} mã\\)*`,
    "",
    tickers.map((t) => `  • ${esc(t)}`).join("\n"),
    "",
    `_Dùng \`/check\` để scan ngay, \`/remove TICKER\` để xóa_`,
  ].join("\n");
}

// ==================== HELPERS ====================

function formatPrice(price: number): string {
  return price.toLocaleString("vi-VN");
}

function formatPnL(pnl: number): string {
  const prefix = pnl >= 0 ? "+" : "";
  return `${prefix}${pnl.toLocaleString("vi-VN")}`;
}

export function formatError(message: string): string {
  return `❌ ${esc(message)}`;
}

export function formatHelp(): string {
  return [
    "🤖 *DNSE TradingAgents Bot*",
    "",
    "*Phân tích:*",
    "  /analyze TICKER — Phân tích đầy đủ 7 bước",
    "  /quick TICKER — Phân tích nhanh",
    "",
    "*Paper Trading:*",
    "  /buy TICKER SỐ\\_LƯỢNG GIÁ — Ghi nhận mua giả định",
    "  /sell TICKER SỐ\\_LƯỢNG — Đóng một phần vị thế",
    "  /close TICKER — Đóng toàn bộ vị thế",
    "  /portfolio — Xem danh mục \\+ P&L",
    "  /review TICKER — Đánh giá vị thế ngay",
    "",
    "*Watchlist:*",
    "  /watchlist — Xem danh sách theo dõi",
    "  /add TICKER — Thêm mã vào watchlist",
    "  /remove TICKER — Xóa mã khỏi watchlist",
    "  /check — Chạy scan watchlist ngay",
    "",
    "_⚠️ Tất cả giao dịch là giả định \\(paper trading\\)_",
  ].join("\n");
}
