import { z } from "zod";
import { API_BASE_URL, type DnseServer } from "../server.ts";

export const getHistoryTradesSchema = {
  symbol: z.string().describe('Mã chứng khoán, ví dụ "HPG"'),
  boardId: z
    .enum(["G1", "G4", "T1", "T3", "T4", "T6"])
    .describe(
      "Mã bảng giao dịch: G1 (Lô chẵn), G4 (Lô lẻ), T1 (Thỏa thuận trong giờ), T3 (Thỏa thuận sau giờ), T4 (Thỏa thuận lô lẻ trong giờ), T6 (Thỏa thuận lô lẻ sau giờ)"
    ),
  from: z.string().describe("Thời gian bắt đầu (timestamp)"),
  to: z.string().describe("Thời gian kết thúc (timestamp, không vượt quá 1 ngày)"),
  limit: z.number().int().positive().optional().describe("Số bản ghi tối đa"),
};

export async function getHistoryTrades(
  server: DnseServer,
  args: {
    symbol: string;
    boardId: "G1" | "G4" | "T1" | "T3" | "T4" | "T6";
    from: string;
    to: string;
    limit?: number;
  }
): Promise<string> {
  const { symbol, boardId, from, to, limit } = args;
  const path = `/price/${symbol}/trades`;
  const params = new URLSearchParams({
    boardId,
    from,
    to,
  });

  if (limit) {
    params.append("limit", limit.toString());
  }

  const url = `${API_BASE_URL}${path}?${params.toString()}`;

  return server.getJson(path, url);
}
