import prisma from "../db/prisma";

// ==================== WATCHLIST CRUD ====================

export async function getWatchlist(): Promise<string[]> {
  const items = await prisma.watchlist.findMany({ orderBy: { addedAt: "asc" } });
  return items.map((i) => i.ticker);
}

export async function addToWatchlist(ticker: string, note?: string): Promise<boolean> {
  const upper = ticker.toUpperCase();
  const existing = await prisma.watchlist.findUnique({ where: { ticker: upper } });
  if (existing) return false; // already exists

  await prisma.watchlist.create({ data: { ticker: upper, note: note ?? null } });
  return true;
}

export async function removeFromWatchlist(ticker: string): Promise<boolean> {
  const upper = ticker.toUpperCase();
  const existing = await prisma.watchlist.findUnique({ where: { ticker: upper } });
  if (!existing) return false;

  await prisma.watchlist.delete({ where: { ticker: upper } });
  return true;
}
