import { DynamicTool } from "@langchain/core/tools";
import { DnseServer, API_BASE_URL } from "../dnse/server.ts";

// ==================== DNSE TOOLS ====================

let dnseServer: DnseServer | null = null;

function getDnseServer(): DnseServer {
  if (!dnseServer) {
    const apiKey = process.env.DNSE_API_KEY || "";
    const apiSecret = process.env.DNSE_API_SECRET || "";
    dnseServer = new DnseServer(apiKey, apiSecret);
  }
  return dnseServer;
}

// ==================== GET CLOSE PRICE ====================

export function createGetClosePriceTool(): DynamicTool {
  return new DynamicTool({
    name: "get_close_price",
    description: "Lấy giá đóng cửa gần nhất của một mã chứng khoán từ DNSE OpenAPI. Input: JSON string với symbol (required) và boardId (optional).",
    func: async (input: string) => {
      try {
        const args = JSON.parse(input);
        const { symbol, boardId } = args;
        const path = `/price/${symbol}/close`;
        let url = `${API_BASE_URL}${path}`;
        if (boardId) {
          url += `?boardId=${encodeURIComponent(boardId)}`;
        }
        return await getDnseServer().getJson(path, url);
      } catch (error) {
        return `Lỗi: ${error}`;
      }
    },
  });
}

// ==================== GET INSTRUMENTS ====================

export function createGetInstrumentsTool(): DynamicTool {
  return new DynamicTool({
    name: "get_instruments",
    description: "Truy vấn danh sách thông tin cơ bản của các mã chứng khoán. Input: JSON string với symbol, marketId, securityGroupId, indexName, limit, page (tất cả optional).",
    func: async (input: string) => {
      try {
        const args = JSON.parse(input);
        const path = "/instruments";
        const params = new URLSearchParams();
        if (args.symbol) params.append("symbol", args.symbol);
        if (args.marketId) params.append("marketId", args.marketId);
        if (args.securityGroupId) params.append("securityGroupId", args.securityGroupId);
        if (args.indexName) params.append("indexName", args.indexName);
        if (args.limit) params.append("limit", args.limit.toString());
        if (args.page) params.append("page", args.page.toString());
        const queryString = params.toString();
        const url = `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;
        return await getDnseServer().getJson(path, url);
      } catch (error) {
        return `Lỗi: ${error}`;
      }
    },
  });
}

// ==================== GET SECDEF ====================

export function createGetSecdefTool(): DynamicTool {
  return new DynamicTool({
    name: "get_secdef",
    description: "Truy vấn thông tin giá trần/sàn/tham chiếu và trạng thái giao dịch. Input: JSON string với symbol (required) và boardId (optional).",
    func: async (input: string) => {
      try {
        const args = JSON.parse(input);
        const { symbol, boardId } = args;
        const path = `/price/${symbol}/secdef`;
        let url = `${API_BASE_URL}${path}`;
        if (boardId) {
          url += `?boardId=${encodeURIComponent(boardId)}`;
        }
        return await getDnseServer().getJson(path, url);
      } catch (error) {
        return `Lỗi: ${error}`;
      }
    },
  });
}

// ==================== GET OHLC HISTORY ====================

export function createGetOhlcHistoryTool(): DynamicTool {
  return new DynamicTool({
    name: "get_ohlc_history",
    description: "Truy vấn lịch sử nến (OHLCV) theo khung thời gian. Input: JSON string với symbol (required), type (STOCK|DERIVATIVE|INDEX), resolution (1|3|5|15|30|1h|1D|1W), from, to (required).",
    func: async (input: string) => {
      try {
        const args = JSON.parse(input);
        const path = "/price/ohlc";
        const params = new URLSearchParams({
          symbol: args.symbol,
          type: args.type,
          resolution: args.resolution,
          from: args.from,
          to: args.to,
        });
        const url = `${API_BASE_URL}${path}?${params.toString()}`;
        return await getDnseServer().getJson(path, url);
      } catch (error) {
        return `Lỗi: ${error}`;
      }
    },
  });
}

// ==================== GET HISTORY TRADES ====================

export function createGetHistoryTradesTool(): DynamicTool {
  return new DynamicTool({
    name: "get_history_trades",
    description: "Truy vấn lịch sử khớp lệnh. Input: JSON string với symbol (required), boardId (G1|G4|T1|T3|T4|T6), from, to (required), limit (optional).",
    func: async (input: string) => {
      try {
        const args = JSON.parse(input);
        const { symbol, boardId, from, to, limit } = args;
        const path = `/price/${symbol}/trades`;
        const params = new URLSearchParams({ boardId, from, to });
        if (limit) params.append("limit", limit.toString());
        const url = `${API_BASE_URL}${path}?${params.toString()}`;
        return await getDnseServer().getJson(path, url);
      } catch (error) {
        return `Lỗi: ${error}`;
      }
    },
  });
}

// ==================== GET LATEST TRADES ====================

export function createGetLatestTradesTool(): DynamicTool {
  return new DynamicTool({
    name: "get_latest_trades",
    description: "Truy vấn thông tin giao dịch khớp lệnh gần nhất. Input: JSON string với symbol (required) và boardId (G1|G4|T1|T3|T4|T6).",
    func: async (input: string) => {
      try {
        const args = JSON.parse(input);
        const { symbol, boardId } = args;
        const path = `/price/${symbol}/trades/latest`;
        const params = new URLSearchParams({ boardId });
        const url = `${API_BASE_URL}${path}?${params.toString()}`;
        return await getDnseServer().getJson(path, url);
      } catch (error) {
        return `Lỗi: ${error}`;
      }
    },
  });
}

// ==================== GET LATEST QUOTES ====================

export function createGetLatestQuotesTool(): DynamicTool {
  return new DynamicTool({
    name: "get_latest_quotes",
    description: "Truy vấn dữ liệu bid/ask gần nhất. Input: JSON string với symbol (required) và boardId (optional).",
    func: async (input: string) => {
      try {
        const args = JSON.parse(input);
        const { symbol, boardId } = args;
        const path = `/price/${symbol}/quotes/latest`;
        let url = `${API_BASE_URL}${path}`;
        if (boardId) {
          url += `?boardId=${encodeURIComponent(boardId)}`;
        }
        return await getDnseServer().getJson(path, url);
      } catch (error) {
        return `Lỗi: ${error}`;
      }
    },
  });
}

// ==================== GET MARKET WORKING DATES ====================

export function createGetMarketWorkingDatesTool(): DynamicTool {
  return new DynamicTool({
    name: "get_market_working_dates",
    description: "Truy vấn danh sách ngày làm việc trong vòng 1 năm. Không cần input.",
    func: async () => {
      try {
        const path = "/market/working-dates";
        const url = `${API_BASE_URL}${path}`;
        return await getDnseServer().getJson(path, url);
      } catch (error) {
        return `Lỗi: ${error}`;
      }
    },
  });
}

// ==================== GET FOREIGN TRADING ====================

export function createGetForeignTradingTool(): DynamicTool {
  return new DynamicTool({
    name: "get_foreign_trading",
    description: "Truy vấn dữ liệu giao dịch của nhà đầu tư nước ngoài. Input: JSON string với symbol (required), from, to (required), boardId (optional), limit (optional).",
    func: async (input: string) => {
      try {
        const args = JSON.parse(input);
        const { symbol, from, to, boardId, limit } = args;
        const path = `/price/${symbol}/foreign-trading`;
        const params = new URLSearchParams({ from, to });
        if (boardId) params.append("boardId", boardId);
        if (limit) params.append("limit", limit.toString());
        const url = `${API_BASE_URL}${path}?${params.toString()}`;
        return await getDnseServer().getJson(path, url);
      } catch (error) {
        return `Lỗi: ${error}`;
      }
    },
  });
}

// ==================== GET TRADING SESSION ====================

export function createGetTradingSessionTool(): DynamicTool {
  return new DynamicTool({
    name: "get_trading_session",
    description: "Truy vấn thông tin phiên giao dịch hiện tại. Input: JSON string với tscProdGrpId (FBX|FIO|HCX|STO|STX|UPX) và boardId (optional).",
    func: async (input: string) => {
      try {
        const args = JSON.parse(input);
        const { tscProdGrpId, boardId } = args;
        const path = "/market/trading-session";
        const params = new URLSearchParams({ tscProdGrpId });
        if (boardId) params.append("boardId", boardId);
        const url = `${API_BASE_URL}${path}?${params.toString()}`;
        return await getDnseServer().getJson(path, url);
      } catch (error) {
        return `Lỗi: ${error}`;
      }
    },
  });
}

// ==================== CREATE ALL DNSE TOOLS ====================

export function createAllDnseTools(): DynamicTool[] {
  return [
    createGetClosePriceTool(),
    createGetInstrumentsTool(),
    createGetSecdefTool(),
    createGetOhlcHistoryTool(),
    createGetHistoryTradesTool(),
    createGetLatestTradesTool(),
    createGetLatestQuotesTool(),
    createGetMarketWorkingDatesTool(),
    createGetForeignTradingTool(),
    createGetTradingSessionTool(),
  ];
}
