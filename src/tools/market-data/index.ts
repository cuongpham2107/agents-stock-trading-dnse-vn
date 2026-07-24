import { DynamicTool } from "@langchain/core/tools";
import {
  createGetClosePriceTool,
  createGetInstrumentsTool,
  createGetSecdefTool,
  createGetOhlcHistoryTool,
  createGetHistoryTradesTool,
  createGetLatestTradesTool,
  createGetLatestQuotesTool,
  createGetMarketWorkingDatesTool,
  createGetForeignTradingTool,
  createGetTradingSessionTool,
} from "./tools";

// ==================== MARKET DATA TOOLS ====================

export {
  createGetClosePriceTool,
  createGetInstrumentsTool,
  createGetSecdefTool,
  createGetOhlcHistoryTool,
  createGetHistoryTradesTool,
  createGetLatestTradesTool,
  createGetLatestQuotesTool,
  createGetMarketWorkingDatesTool,
  createGetForeignTradingTool,
  createGetTradingSessionTool,
} from "./tools";

export function createMarketDataTools(): DynamicTool[] {
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
