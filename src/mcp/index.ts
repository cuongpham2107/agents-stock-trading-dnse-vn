import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.ts";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.ts";
import { DnseServer } from "./server";
import {
  getClosePrice,
  getClosePriceSchema,
} from "./tools/close-price";
import {
  getInstruments,
  getInstrumentsSchema,
} from "./tools/instruments";
import { getSecdef, getSecdefSchema } from "./tools/secdef";
import {
  getOhlcHistory,
  getOhlcHistorySchema,
} from "./tools/ohlc";
import {
  getHistoryTrades,
  getHistoryTradesSchema,
} from "./tools/trades";
import {
  getLatestTrades,
  getLatestTradesSchema,
} from "./tools/latest-trades";
import {
  getLatestQuotes,
  getLatestQuotesSchema,
} from "./tools/latest-quotes";
import {
  getMarketWorkingDates,
  getMarketWorkingDatesSchema,
} from "./tools/working-dates";
import {
  getForeignTrading,
  getForeignTradingSchema,
} from "./tools/foreign-trading";
import {
  getTradingSession,
  getTradingSessionSchema,
} from "./tools/trading-session";

const apiKey = process.env.DNSE_API_KEY || "your_api_key_here";
const apiSecret = process.env.DNSE_API_SECRET || "your_api_secret_here";

const dnseServer = new DnseServer(apiKey, apiSecret);

const server = new McpServer({
  name: "dnse-mcp",
  version: "0.1.0",
});

server.tool(
  "get_close_price",
  "Lấy giá đóng cửa gần nhất của một mã chứng khoán từ DNSE OpenAPI",
  getClosePriceSchema,
  async (args) => {
    const result = await getClosePrice(dnseServer, args);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.tool(
  "get_instruments",
  "Truy vấn danh sách thông tin cơ bản của các mã chứng khoán theo điều kiện lọc",
  getInstrumentsSchema,
  async (args) => {
    const result = await getInstruments(dnseServer, args);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.tool(
  "get_secdef",
  "Truy vấn thông tin giá trần/sàn/tham chiếu và trạng thái giao dịch của mã chứng khoán",
  getSecdefSchema,
  async (args) => {
    const result = await getSecdef(dnseServer, args);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.tool(
  "get_ohlc_history",
  "Truy vấn lịch sử nến (open, high, low, close, volume) theo khung thời gian",
  getOhlcHistorySchema,
  async (args) => {
    const result = await getOhlcHistory(dnseServer, args);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.tool(
  "get_history_trades",
  "Truy vấn lịch sử khớp lệnh của mã chứng khoán theo bảng giao dịch và khoảng thời gian",
  getHistoryTradesSchema,
  async (args) => {
    const result = await getHistoryTrades(dnseServer, args);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.tool(
  "get_latest_trades",
  "Truy vấn thông tin giao dịch khớp lệnh gần nhất của mã chứng khoán",
  getLatestTradesSchema,
  async (args) => {
    const result = await getLatestTrades(dnseServer, args);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.tool(
  "get_latest_quotes",
  "Truy vấn dữ liệu bid/ask gần nhất của mã chứng khoán",
  getLatestQuotesSchema,
  async (args) => {
    const result = await getLatestQuotes(dnseServer, args);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.tool(
  "get_market_working_dates",
  "Truy vấn danh sách ngày làm việc (ngày giao dịch) trong vòng 1 năm",
  getMarketWorkingDatesSchema,
  async () => {
    const result = await getMarketWorkingDates(dnseServer);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.tool(
  "get_foreign_trading",
  "Truy vấn dữ liệu giao dịch của nhà đầu tư nước ngoài",
  getForeignTradingSchema,
  async (args) => {
    const result = await getForeignTrading(dnseServer, args);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.tool(
  "get_trading_session",
  "Truy vấn thông tin phiên giao dịch hiện tại",
  getTradingSessionSchema,
  async (args) => {
    const result = await getTradingSession(dnseServer, args);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
