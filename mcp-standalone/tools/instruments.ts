import { z } from "zod";
import { API_BASE_URL, type DnseServer } from "../server.js";

export const getInstrumentsSchema = {
  symbol: z
    .string()
    .optional()
    .describe('Danh sách mã chứng khoán, ví dụ "HPG,VCB"'),
  marketId: z
    .string()
    .optional()
    .describe(
      "Mã thị trường niêm yết: STO (HOSE), STX (HNX), UPX (UPCOM), DVX (Phái sinh), HCX (Trái phiếu)"
    ),
  securityGroupId: z
    .string()
    .optional()
    .describe(
      "Nhóm chứng khoán: ST (Cổ phiếu), EF (ETF), EW (Chứng quyền), FU (HĐTL), BS (Trái phiếu)"
    ),
  indexName: z
    .string()
    .optional()
    .describe("Chỉ số thị trường: VN30, VN100, HNX30"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Số bản ghi trên mỗi trang (mặc định 100)"),
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Trang hiện tại (bắt đầu từ 1)"),
};

export async function getInstruments(
  server: DnseServer,
  args: {
    symbol?: string;
    marketId?: string;
    securityGroupId?: string;
    indexName?: string;
    limit?: number;
    page?: number;
  }
): Promise<string> {
  const path = "/instruments";
  const params = new URLSearchParams();

  if (args.symbol) params.append("symbol", args.symbol);
  if (args.marketId) params.append("marketId", args.marketId);
  if (args.securityGroupId)
    params.append("securityGroupId", args.securityGroupId);
  if (args.indexName) params.append("indexName", args.indexName);
  if (args.limit) params.append("limit", args.limit.toString());
  if (args.page) params.append("page", args.page.toString());

  const queryString = params.toString();
  const url = `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;

  return server.getJson(path, url);
}
