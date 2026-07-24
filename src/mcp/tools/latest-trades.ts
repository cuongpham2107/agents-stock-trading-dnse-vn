import { z } from "zod";
import { API_BASE_URL, type DnseServer } from "../server.ts";

export const getLatestTradesSchema = {
  symbol: z.string().describe('Mã chứng khoán, ví dụ "HPG"'),
  boardId: z
    .enum(["G1", "G4", "T1", "T3", "T4", "T6"])
    .describe(
      "Mã bảng giao dịch: G1 (Lô chẵn), G4 (Lô lẻ), T1 (Thỏa thuận trong giờ), T3 (Thỏa thuận sau giờ), T4 (Thỏa thuận lô lẻ trong giờ), T6 (Thỏa thuận lô lẻ sau giờ)"
    ),
};

export async function getLatestTrades(
  server: DnseServer,
  args: {
    symbol: string;
    boardId: "G1" | "G4" | "T1" | "T3" | "T4" | "T6";
  }
): Promise<string> {
  const { symbol, boardId } = args;
  const path = `/price/${symbol}/trades/latest`;
  const params = new URLSearchParams({ boardId });

  const url = `${API_BASE_URL}${path}?${params.toString()}`;

  return server.getJson(path, url);
}
