import { z } from "zod";
import { API_BASE_URL, type DnseServer } from "../server.ts";

export const getTradingSessionSchema = {
  tscProdGrpId: z
    .enum(["FBX", "FIO", "HCX", "STO", "STX", "UPX"])
    .describe(
      "Nhóm sản phẩm theo thị trường: FBX (HĐTL Trái phiếu), FIO (HĐTL Chỉ số), HCX (Trái phiếu HNX), STO (Cổ phiếu HOSE), STX (Cổ phiếu HNX), UPX (Upcom)"
    ),
  boardId: z
    .enum(["G1", "G4", "T1", "T3", "T4", "T6"])
    .optional()
    .describe("Mã bảng giao dịch (tuỳ chọn)"),
};

export async function getTradingSession(
  server: DnseServer,
  args: {
    tscProdGrpId: "FBX" | "FIO" | "HCX" | "STO" | "STX" | "UPX";
    boardId?: "G1" | "G4" | "T1" | "T3" | "T4" | "T6";
  }
): Promise<string> {
  const { tscProdGrpId, boardId } = args;
  const path = "/market/trading-session";
  const params = new URLSearchParams({ tscProdGrpId });

  if (boardId) params.append("boardId", boardId);

  const url = `${API_BASE_URL}${path}?${params.toString()}`;

  return server.getJson(path, url);
}
