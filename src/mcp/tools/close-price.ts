import { z } from "zod";
import { API_BASE_URL, type DnseServer } from "../server.ts";

export const getClosePriceSchema = {
  symbol: z.string().describe('Mã chứng khoán, ví dụ "HPG"'),
  boardId: z
    .string()
    .optional()
    .describe('Mã bảng giao dịch (tuỳ chọn), ví dụ "G1" (lô chẵn)'),
};

export async function getClosePrice(
  server: DnseServer,
  args: { symbol: string; boardId?: string }
): Promise<string> {
  const { symbol, boardId } = args;
  const path = `/price/${symbol}/close`;

  let url = `${API_BASE_URL}${path}`;
  if (boardId) {
    url += `?boardId=${encodeURIComponent(boardId)}`;
  }

  return server.getJson(path, url);
}
