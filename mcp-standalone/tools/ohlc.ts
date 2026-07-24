import { z } from "zod";
import { API_BASE_URL, type DnseServer } from "../server.js";

export const getOhlcHistorySchema = {
  symbol: z.string().describe('Mã chứng khoán, ví dụ "ACB"'),
  type: z
    .enum(["STOCK", "DERIVATIVE", "INDEX"])
    .describe("Loại thị trường: STOCK (Cổ phiếu), DERIVATIVE (Phái sinh), INDEX (Chỉ số)"),
  resolution: z
    .enum(["1", "3", "5", "15", "30", "1h", "1D", "1W"])
    .describe("Khung thời gian nến"),
  from: z.string().describe("Thời gian bắt đầu (timestamp)"),
  to: z.string().describe("Thời gian kết thúc (timestamp)"),
};

export async function getOhlcHistory(
  server: DnseServer,
  args: {
    symbol: string;
    type: "STOCK" | "DERIVATIVE" | "INDEX";
    resolution: "1" | "3" | "5" | "15" | "30" | "1h" | "1D" | "1W";
    from: string;
    to: string;
  }
): Promise<string> {
  const path = "/price/ohlc";
  const params = new URLSearchParams({
    symbol: args.symbol,
    type: args.type,
    resolution: args.resolution,
    from: args.from,
    to: args.to,
  });

  const url = `${API_BASE_URL}${path}?${params.toString()}`;

  return server.getJson(path, url);
}
