import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicTool } from "@langchain/core/tools";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { TavilySearch } from "@langchain/tavily";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import FirecrawlApp from "firecrawl";
import { McpClient } from "./mcp-client.js";
import { analyze } from "./graph/trading-graph.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { LLMManager, getAllModels, getModelsByProvider, type LLMProvider } from "./llm/index.js";
import * as readline from "readline";

// ==================== FIRECRAWL TOOLS ====================

const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || "http://localhost:3002";
const firecrawlApp = new FirecrawlApp({ apiUrl: FIRECRAWL_API_URL });

const webFetchTool = new DynamicTool({
  name: "web_fetch",
  description: "Đọc nội dung từ một URL cụ thể.",
  func: async (url: string) => {
    try {
      const response = await fetch(url.trim());
      const text = await response.text();
      const cleanText = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 5000);
      return cleanText || "Không thể đọc nội dung trang web.";
    } catch (error) {
      return `Lỗi khi fetch URL: ${error}`;
    }
  },
});

const firecrawlScrapeTool = new DynamicTool({
  name: "firecrawl_scrape",
  description: "Scrape nội dung từ URL và trả về markdown sạch.",
  func: async (url: string) => {
    try {
      const result = await firecrawlApp.scrapeUrl(url.trim(), {
        formats: ["markdown"],
      });
      return result.markdown?.substring(0, 8000) || "Không thể scrape trang web.";
    } catch (error) {
      return `Lỗi khi scrape: ${error}`;
    }
  },
});

const firecrawlSearchTool = new DynamicTool({
  name: "firecrawl_search",
  description: "Tìm kiếm web và lấy nội dung đầy đủ từ kết quả.",
  func: async (query: string) => {
    try {
      const result = await firecrawlApp.search(query.trim(), {
        limit: 5,
        scrapeOptions: { formats: ["markdown"] },
      });
      const data = (result as unknown as { data?: Array<{ markdown?: string; metadata?: { sourceURL?: string } }> }).data;
      if (!data || data.length === 0) {
        return "Không tìm thấy kết quả.";
      }
      return data
        .map((r, i) =>
          `--- Kết quả ${i + 1} (${r.metadata?.sourceURL || "N/A"}) ---\n${r.markdown?.substring(0, 2000) || ""}`
        )
        .join("\n\n");
    } catch (error) {
      return `Lỗi khi search: ${error}`;
    }
  },
});

const firecrawlCrawlTool = new DynamicTool({
  name: "firecrawl_crawl",
  description: "Crawl toàn bộ website và lấy nội dung từ tất cả các trang con.",
  func: async (input: string) => {
    try {
      const { url, limit } = JSON.parse(input);
      const result = await firecrawlApp.crawlUrl(url, {
        limit: limit || 10,
        scrapeOptions: { formats: ["markdown"] },
      });
      const data = (result as unknown as { data?: Array<{ markdown?: string; metadata?: { sourceURL?: string } }> }).data;
      if (!data || data.length === 0) {
        return "Không crawl được trang nào.";
      }
      return data
        .map((r, i) =>
          `--- Trang ${i + 1}: ${r.metadata?.sourceURL || "N/A"} ---\n${r.markdown?.substring(0, 1000) || ""}`
        )
        .join("\n\n");
    } catch (error) {
      return `Lỗi khi crawl: ${error}`;
    }
  },
});

// ==================== CONFIG ====================

const MCP_COMMAND = process.env.MCP_COMMAND || "bun";
const MCP_ARGS = process.env.MCP_ARGS
  ? JSON.parse(process.env.MCP_ARGS)
  : ["run", "src/index.ts"];
const MCP_CWD = process.env.MCP_CWD || new URL("../mcp", import.meta.url).pathname;

// ==================== LLM MANAGER ====================

const llmManager = new LLMManager({
  quickModel: process.env.QUICK_MODEL || "Nemotron 70B",
  deepModel: process.env.DEEP_MODEL || "Nemotron 70B",
  quickApiKey: process.env.LLM_API_KEY || process.env.NVIDIA_API_KEY,
  deepApiKey: process.env.LLM_API_KEY || process.env.NVIDIA_API_KEY,
});

// ==================== CREATE TOOLS ====================

async function createLangChainTools(mcpClient: McpClient): Promise<DynamicTool[]> {
  const tools = await mcpClient.listTools();

  return tools.map(
    (tool) =>
      new DynamicTool({
        name: tool.name,
        description: tool.description || "",
        func: async (input: string) => {
          try {
            const args = JSON.parse(input);
            return await mcpClient.callTool(tool.name, args);
          } catch {
            return await mcpClient.callTool(tool.name, { symbol: input.trim() });
          }
        },
      })
  );
}

// ==================== CHECKPOINT SETUP ====================

async function setupCheckpoint() {
  const checkpointer = await SqliteSaver.fromConnString("file:checkpoints.db");
  return checkpointer;
}

// ==================== MAIN ====================

async function main() {
  console.log("Connecting to DNSE MCP Server...");

  const mcpClient = new McpClient();
  await mcpClient.connect({
    command: MCP_COMMAND,
    args: MCP_ARGS,
    cwd: MCP_CWD,
    env: {
      DNSE_API_KEY: process.env.DNSE_API_KEY || "",
      DNSE_API_SECRET: process.env.DNSE_API_SECRET || "",
    },
  });

  console.log("Connected! Loading tools...");
  const mcpTools = await createLangChainTools(mcpClient);

  const tavilyTool = new TavilySearch({
    maxResults: 5,
  });
  const allTools = [
    ...mcpTools,
    tavilyTool,
    webFetchTool,
    firecrawlScrapeTool,
    firecrawlSearchTool,
    firecrawlCrawlTool,
  ];

  console.log(`Loaded ${allTools.length} tools: ${allTools.map((t) => t.name).join(", ")}`);

  // Setup checkpoint for persistence
  const checkpointer = await setupCheckpoint();
  console.log("Checkpoint initialized.");

  // Hiển thị models đang dùng
  const currentModels = llmManager.getCurrentModels();
  console.log(`\n[LLM] Quick model: ${currentModels.quick}`);
  console.log(`[LLM] Deep model: ${currentModels.deep}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n=== DNSE TradingAgents ===");
  console.log("Hệ thống phân tích đầu tư đa agent");
  console.log("");
  console.log("LỆNH:");
  console.log("  analyze <ticker>           - Phân tích mã chứng khoán");
  console.log("  switch <model>             - Switch quick model");
  console.log("  switch-deep <model>        - Switch deep model");
  console.log("  models                     - Liệt kê models có sẵn");
  console.log("  models-provider <provider> - Liệt kê models theo provider");
  console.log("  current                    - Xem models đang dùng");
  console.log("  exit                       - Thoát");
  console.log("");

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question("You: ", (answer) => {
        resolve(answer);
      });
    });
  };

  while (true) {
    const userInput = await askQuestion();

    if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
      console.log("Goodbye!");
      break;
    }

    if (!userInput.trim()) continue;

    // Parse command
    const parts = userInput.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();

    // Switch quick model
    if (command === "switch" && parts[1]) {
      const modelName = parts.slice(1).join(" ");
      try {
        llmManager.switchQuickModel(modelName);
        const current = llmManager.getCurrentModels();
        console.log(`\n[OK] Switched quick model to: ${current.quick}\n`);
      } catch (error) {
        console.log(`\n[Lỗi] Không thể switch model: ${error}\n`);
      }
      continue;
    }

    // Switch deep model
    if (command === "switch-deep" && parts[1]) {
      const modelName = parts.slice(1).join(" ");
      try {
        llmManager.switchDeepModel(modelName);
        const current = llmManager.getCurrentModels();
        console.log(`\n[OK] Switched deep model to: ${current.deep}\n`);
      } catch (error) {
        console.log(`\n[Lỗi] Không thể switch model: ${error}\n`);
      }
      continue;
    }

    // List all models
    if (command === "models") {
      console.log("\n=== AVAILABLE MODELS ===\n");
      const models = getAllModels();
      console.log("| Tên | Provider | Tier | Mô tả |");
      console.log("|-----|----------|------|-------|");
      for (const model of models) {
        console.log(`| ${model.name} | ${model.provider} | ${model.tier} | ${model.description} |`);
      }
      console.log("");
      continue;
    }

    // List models by provider
    if (command === "models-provider" && parts[1]) {
      const provider = parts[1] as LLMProvider;
      console.log(`\n=== MODELS FOR ${provider.toUpperCase()} ===\n`);
      const models = getModelsByProvider(provider);
      if (models.length === 0) {
        console.log("Không tìm thấy models cho provider này.");
      } else {
        console.log("| Tên | Model ID | Tier | Mô tả |");
        console.log("|-----|----------|------|-------|");
        for (const model of models) {
          console.log(`| ${model.name} | ${model.model} | ${model.tier} | ${model.description} |`);
        }
      }
      console.log("");
      continue;
    }

    // Show current models
    if (command === "current") {
      const current = llmManager.getCurrentModels();
      console.log(`\n[LLM] Quick model: ${current.quick}`);
      console.log(`[LLM] Deep model: ${current.deep}\n`);
      continue;
    }

    // Check if it's an analyze command
    const analyzeMatch = userInput.match(/^analyze\s+(\w+)$/i);
    if (analyzeMatch && analyzeMatch[1]) {
      const ticker = analyzeMatch[1].toUpperCase();
      const date = new Date().toISOString().split("T")[0] || new Date().toISOString();

      console.log(`\n[Bắt đầu phân tích ${ticker}...]`);
      console.log("[Quy trình: Data → 4 Analysts → Bull/Bear Debate → Research Manager → Trader → Risk Team → Portfolio Manager]");

      try {
        const llm = llmManager.getQuickLLM();
        const result = await analyze(llm as ChatOpenAI, ticker, date);

        console.log("\n" + "=".repeat(60));
        console.log("KẾT QUẢ PHÂN TÍCH");
        console.log("=".repeat(60));
        console.log(result);
        console.log("=".repeat(60));
        console.log("\n⚠️ LƯU Ý: Đây là phân tích tham khảo, không phải lời khuyên tài chính.");
        console.log("   Hãy tham vấn cố vấn tài chính trước khi quyết định.\n");
      } catch (error) {
        console.error(`\nLỗi khi phân tích: ${error}\n`);
      }
    } else {
      // Regular chat mode
      const chatLlm = llmManager.getQuickLLM();
      const modelWithTools = (chatLlm as ChatOpenAI).bindTools(allTools);
      const chatHistory: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [];
      chatHistory.push(new SystemMessage(SYSTEM_PROMPT));
      chatHistory.push(new HumanMessage(userInput));

      try {
        const response = await modelWithTools.invoke(chatHistory);

        if (response.tool_calls && response.tool_calls.length > 0) {
          chatHistory.push(response);

          for (const toolCall of response.tool_calls) {
            console.log(`\n[Calling tool: ${toolCall.name}]`);

            const tool = allTools.find((t) => t.name === toolCall.name);
            if (tool) {
              const args = typeof toolCall.args === "string"
                ? JSON.parse(toolCall.args)
                : toolCall.args;
              const toolResult = await (tool as DynamicTool).invoke(args);
              const resultStr = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
              console.log(`[Tool result: ${resultStr.substring(0, 200)}...]`);
              chatHistory.push(
                new ToolMessage({
                  content: resultStr,
                  tool_call_id: toolCall.id!,
                })
              );
            }
          }

          const finalResponse = await modelWithTools.invoke(chatHistory);
          const aiMessage =
            typeof finalResponse.content === "string"
              ? finalResponse.content
              : JSON.stringify(finalResponse.content);
          console.log(`\nAssistant: ${aiMessage}\n`);
        } else {
          const aiMessage =
            typeof response.content === "string"
              ? response.content
              : JSON.stringify(response.content);
          console.log(`\nAssistant: ${aiMessage}\n`);
        }
      } catch (error) {
        console.error(`\nError: ${error}\n`);
      }
    }
  }

  await mcpClient.close();
  rl.close();
}

main().catch(console.error);
