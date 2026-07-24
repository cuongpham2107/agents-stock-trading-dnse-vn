import { DynamicTool } from "@langchain/core/tools";
import { createMarketDataTools } from "./market-data/index";
import { createTradingTools } from "./trading/index";
import { createAccountTools } from "./account/index";
import { createWebTools } from "./web/index";

// ==================== TOOL GROUPS ====================

export type ToolGroup = "market-data" | "trading" | "account" | "web";

export interface ToolInfo {
  name: string;
  group: ToolGroup;
  description: string;
}

// ==================== CREATE ALL TOOLS ====================

export function createAllTools(groups?: ToolGroup[]): DynamicTool[] {
  const allGroups: ToolGroup[] = groups || ["market-data", "trading", "account", "web"];

  const tools: DynamicTool[] = [];

  if (allGroups.includes("market-data")) {
    tools.push(...createMarketDataTools());
  }
  if (allGroups.includes("trading")) {
    tools.push(...createTradingTools());
  }
  if (allGroups.includes("account")) {
    tools.push(...createAccountTools());
  }
  if (allGroups.includes("web")) {
    tools.push(...createWebTools());
  }

  return tools;
}

// ==================== GET TOOL INFO ====================

export function getToolInfo(groups?: ToolGroup[]): ToolInfo[] {
  const allTools = createAllTools(groups);
  return allTools.map((t) => ({
    name: t.name,
    group: getToolGroup(t.name),
    description: t.description,
  }));
}

function getToolGroup(name: string): ToolGroup {
  if (name.startsWith("get_") || name === "get_market_working_dates") {
    return "market-data";
  }
  if (name.startsWith("place_") || name.startsWith("cancel_") || name.startsWith("get_order")) {
    return "trading";
  }
  if (name.startsWith("account_") || name === "get_balance" || name === "get_positions") {
    return "account";
  }
  return "web";
}

// ==================== RE-EXPORT ====================

export { createMarketDataTools } from "./market-data/index";
export { createTradingTools } from "./trading/index";
export { createAccountTools } from "./account/index";
export { createWebTools } from "./web/index";
