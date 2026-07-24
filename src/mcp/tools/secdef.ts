import { z } from "zod";
import { API_BASE_URL, type DnseServer } from "../server.ts";

export const getSecdefSchema = {
  symbol: z.string().describe('Mã chứng khoán, ví dụ "HPG"'),
  boardId: z
    .string()
    .optional()
    .describe(
      'Mã bảng giao dịch: G1 (lô chẵn), G4 (lô lẻ), T1, T3, T4, T6'
    ),
};

export async function getSecdef(
  server: DnseServer,
  args: { symbol: string; boardId?: string }
): Promise<string> {
  const { symbol, boardId } = args;
  const path = `/price/${symbol}/secdef`;

  let url = `${API_BASE_URL}${path}`;
  if (boardId) {
    url += `?boardId=${encodeURIComponent(boardId)}`;
  }

  return server.getJson(path, url);
}
