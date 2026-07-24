import { z } from "zod";
import { API_BASE_URL, type DnseServer } from "../server.ts";

export const getLatestQuotesSchema = {
  symbol: z.string().describe('Mã chứng khoán, ví dụ "HPG"'),
  boardId: z
    .enum(["G1", "G4", "T1", "T3", "T4", "T6"])
    .optional()
    .describe(
      "Mã bảng giao dịch (tuỳ chọn): G1 (Lô chẵn), G4 (Lô lẻ), T1/T3/T4/T6 (Thỏa thuận)"
    ),
};

export async function getLatestQuotes(
  server: DnseServer,
  args: {
    symbol: string;
    boardId?: "G1" | "G4" | "T1" | "T3" | "T4" | "T6";
  }
): Promise<string> {
  const { symbol, boardId } = args;
  const path = `/price/${symbol}/quotes/latest`;

  let url = `${API_BASE_URL}${path}`;
  if (boardId) {
    url += `?boardId=${encodeURIComponent(boardId)}`;
  }

  return server.getJson(path, url);
}
