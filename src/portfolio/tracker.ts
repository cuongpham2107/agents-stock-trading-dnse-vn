import prisma from "../db/prisma";

// ==================== TYPES ====================

export interface BuyPositionInput {
  ticker: string;
  quantity: number;
  avgCost: number;
  note?: string;
}

export interface ClosePositionInput {
  positionId: string;
  closePrice: number;
}

export interface DailyReviewInput {
  positionId: string;
  currentPrice: number;
  recommendation: "HOLD" | "BUY_MORE" | "PARTIAL_SELL" | "FULL_SELL";
  reasoning?: string;
}

// ==================== PORTFOLIO TRACKER ====================

export class PaperPortfolioTracker {
  /**
   * Mở vị thế mua giả định (paper trading)
   */
  async openPosition(input: BuyPositionInput) {
    const today = new Date().toISOString().split("T")[0] ?? "";
    
    const position = await prisma.paperPosition.create({
      data: {
        ticker: input.ticker.toUpperCase(),
        quantity: input.quantity,
        avgCost: input.avgCost,
        openDate: today,
        status: "open",
        note: input.note || null,
      },
    });

    return {
      success: true,
      positionId: position.id,
      ticker: position.ticker,
      quantity: position.quantity,
      avgCost: position.avgCost,
      openDate: position.openDate,
      message: `✅ Đã ghi nhận mua giả định ${position.ticker}\n` +
        `- Số lượng: ${position.quantity}\n` +
        `- Giá mua: ${position.avgCost.toLocaleString("vi-VN")}đ\n` +
        `- Ngày: ${position.openDate}\n` +
        `- Position ID: ${position.id.slice(0, 8)}`,
    };
  }

  /**
   * Đóng vị thế (chốt lãi/lỗ giả định)
   */
  async closePosition(input: ClosePositionInput) {
    const position = await prisma.paperPosition.findUnique({
      where: { id: input.positionId },
    });

    if (!position) {
      return { success: false, message: "❌ Không tìm thấy vị thế" };
    }

    if (position.status === "closed") {
      return { success: false, message: "❌ Vị thế đã đóng trước đó" };
    }

    const today = new Date().toISOString().split("T")[0];
    const pnl = (input.closePrice - position.avgCost) * position.quantity;
    const pnlPct = ((input.closePrice - position.avgCost) / position.avgCost) * 100;

    const closed = await prisma.paperPosition.update({
      where: { id: input.positionId },
      data: {
        status: "closed",
        closeDate: today,
        closedPrice: input.closePrice,
        realizedPnl: pnl,
      },
    });

    return {
      success: true,
      message: `✅ Đã đóng vị thế ${closed.ticker}\n` +
        `- Giá đóng: ${input.closePrice.toLocaleString("vi-VN")}đ\n` +
        `- P&L: ${pnl.toLocaleString("vi-VN")}đ (${pnlPct.toFixed(2)}%)`,
    };
  }

  /**
   * Lấy tất cả vị thế đang mở
   */
  async getOpenPositions() {
    return prisma.paperPosition.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Lấy tất cả vị thế
   */
  async getAllPositions() {
    return prisma.paperPosition.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reviews: {
          orderBy: { date: "desc" },
          take: 7, // 7 ngày gần nhất
        },
      },
    });
  }

  /**
   * Lấy chi tiết một vị thế
   */
  async getPosition(positionId: string) {
    return prisma.paperPosition.findUnique({
      where: { id: positionId },
      include: {
        reviews: {
          orderBy: { date: "desc" },
        },
      },
    });
  }

  /**
   * Thêm review hàng ngày cho một vị thế
   */
  async addDailyReview(input: DailyReviewInput) {
    const position = await prisma.paperPosition.findUnique({
      where: { id: input.positionId },
    });

    if (!position) {
      return { success: false, message: "❌ Không tìm thấy vị thế" };
    }

    const today = new Date().toISOString().split("T")[0] ?? "";
    const pnl = (input.currentPrice - position.avgCost) * position.quantity;
    const pnlPct = ((input.currentPrice - position.avgCost) / position.avgCost) * 100;

    const review = await prisma.dailyReview.create({
      data: {
        positionId: input.positionId,
        ticker: position.ticker,
        date: today,
        currentPrice: input.currentPrice,
        pnl,
        pnlPct,
        recommendation: input.recommendation,
        reasoning: input.reasoning || null,
      },
    });

    return {
      success: true,
      review,
    };
  }

  /**
   * Lấy review gần nhất cho một vị thế
   */
  async getLatestReview(positionId: string) {
    return prisma.dailyReview.findFirst({
      where: { positionId },
      orderBy: { date: "desc" },
    });
  }

  /**
   * Lấy tổng P&L của tất cả vị thế đang mở
   */
  async getTotalUnrealizedPnL(currentPrices: Record<string, number>) {
    const positions = await this.getOpenPositions();
    
    let totalPnL = 0;
    const details: Record<string, { pnl: number; pnlPct: number }> = {};

    for (const pos of positions) {
      const currentPrice = currentPrices[pos.ticker];
      if (currentPrice) {
        const pnl = (currentPrice - pos.avgCost) * pos.quantity;
        const pnlPct = ((currentPrice - pos.avgCost) / pos.avgCost) * 100;
        totalPnL += pnl;
        details[pos.ticker] = { pnl, pnlPct };
      }
    }

    return { totalPnL, details };
  }

  /**
   * Đóng toàn bộ vị thế theo ticker (dùng giá thị trường mới nhất từ DB review)
   */
  async closeAllByTicker(ticker: string, closePrice: number) {
    const positions = await prisma.paperPosition.findMany({
      where: { ticker: ticker.toUpperCase(), status: "open" },
    });

    if (positions.length === 0) {
      return { success: false, message: `❌ Không có vị thế mở cho ${ticker}` };
    }

    const today = new Date().toISOString().split("T")[0] ?? "";
    let totalPnl = 0;

    for (const pos of positions) {
      const pnl = (closePrice - pos.avgCost) * pos.quantity;
      totalPnl += pnl;
      await prisma.paperPosition.update({
        where: { id: pos.id },
        data: { status: "closed", closeDate: today, closedPrice: closePrice, realizedPnl: pnl },
      });
    }

    const pnlPct = totalPnl / positions.reduce((s, p) => s + p.avgCost * p.quantity, 0) * 100;
    return {
      success: true,
      pnl: totalPnl,
      pnlPct,
      message: `✅ Đã đóng ${positions.length} vị thế ${ticker}`,
    };
  }

  /**
   * Bán một phần vị thế theo ticker (ghi nhận giảm quantity)
   */
  async sellPartialByTicker(ticker: string, sellQty: number, closePrice: number) {
    const position = await prisma.paperPosition.findFirst({
      where: { ticker: ticker.toUpperCase(), status: "open" },
      orderBy: { createdAt: "asc" },
    });

    if (!position) {
      return { success: false, message: `❌ Không có vị thế mở cho ${ticker}` };
    }

    const sellQtyActual = Math.min(sellQty, position.quantity);
    const pnl = (closePrice - position.avgCost) * sellQtyActual;
    const pnlPct = ((closePrice - position.avgCost) / position.avgCost) * 100;
    const remaining = position.quantity - sellQtyActual;
    const today = new Date().toISOString().split("T")[0] ?? "";

    if (remaining <= 0) {
      // Đóng hẳn
      await prisma.paperPosition.update({
        where: { id: position.id },
        data: { status: "closed", closeDate: today, closedPrice: closePrice, realizedPnl: pnl },
      });
    } else {
      // Giảm quantity
      await prisma.paperPosition.update({
        where: { id: position.id },
        data: { quantity: remaining },
      });
    }

    return {
      success: true,
      pnl,
      pnlPct,
      remaining,
      message: `✅ Đã bán ${sellQtyActual} cổ ${ticker} @ ${closePrice.toLocaleString("vi-VN")}đ\n` +
        `P&L: ${pnl >= 0 ? "+" : ""}${pnl.toLocaleString("vi-VN")}đ (${pnlPct.toFixed(2)}%)\n` +
        (remaining > 0 ? `Còn lại: ${remaining} cổ` : "Đã đóng toàn bộ"),
    };
  }

  /**
   * Xóa một vị thế
   */
  async deletePosition(positionId: string) {
    // Xóa reviews trước
    await prisma.dailyReview.deleteMany({
      where: { positionId },
    });

    // Xóa position
    await prisma.paperPosition.delete({
      where: { id: positionId },
    });

    return { success: true, message: "Đã xóa vị thế" };
  }
}

// ==================== SINGLETON ====================

let globalTracker: PaperPortfolioTracker | null = null;

export function getPortfolioTracker(): PaperPortfolioTracker {
  if (!globalTracker) {
    globalTracker = new PaperPortfolioTracker();
  }
  return globalTracker;
}