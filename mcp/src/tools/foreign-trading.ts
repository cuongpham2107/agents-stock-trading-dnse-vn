import { z } from "zod";
import { API_BASE_URL, type DnseServer } from "../server.js";

export const getForeignTradingSchema = {
  symbol: z.string().describe('Mã chứng khoán, ví dụ "HPG"'),
  boardId: z
    .enum(["G1", "G4", "T1", "T3", "T4", "T6"])
    .optional()
    .describe("Mã bảng giao dịch (tuỳ chọn)"),
  from: z.string().describe("Thời gian bắt đầu (timestamp)"),
  to: z.string().describe("Thời gian kết thúc (timestamp, không quá 1 ngày)"),
  limit: z.number().int().positive().optional().describe("Số bản ghi tối đa"),
  order: z.string().optional().describe("Sắp xếp kết quả"),
};

export async function getForeignTrading(
  server: DnseServer,
  args: {
    symbol: string;
    boardId?: "G1" | "G4" | "T1" | "T3" | "T4" | "T6";
    from: string;
    to: string;
    limit?: number;
    order?: string;
  }
): Promise<string> {
  const { symbol, boardId, from, to, limit, order } = args;
  const path = `/price/${symbol}/foreign-trading`;
  const params = new URLSearchParams({ from, to });

  if (boardId) params.append("boardId", boardId);
  if (limit) params.append("limit", limit.toString());
  if (order) params.append("order", order);

  const url = `${API_BASE_URL}${path}?${params.toString()}`;

  return server.getJson(path, url);
}
