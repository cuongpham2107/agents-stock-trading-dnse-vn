import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicTool } from "@langchain/core/tools";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { analyze } from "./graph/trading-graph";
import { SYSTEM_PROMPT } from "./prompts";
import { LLMManager, getAllModels, getModelsByProvider, type LLMProvider } from "./llm/index";
import { createAllTools } from "./tools/index";
import { MemoryManager } from "./memory/index";
import * as readline from "readline";

// ==================== CONFIG ====================

const llmManager = new LLMManager({
  quickModel: process.env.QUICK_MODEL || "Nemotron 70B",
  deepModel: process.env.DEEP_MODEL || "Nemotron 70B",
  quickApiKey: process.env.LLM_API_KEY || process.env.NVIDIA_API_KEY,
  deepApiKey: process.env.LLM_API_KEY || process.env.NVIDIA_API_KEY,
});

const memoryManager = new MemoryManager(".memory");

// ==================== CHECKPOINT SETUP ====================

async function setupCheckpoint() {
  const checkpointer = await SqliteSaver.fromConnString("file:checkpoints.db");
  return checkpointer;
}

// ==================== MAIN ====================

async function main() {
  console.log("Đang tải tools...");

  const allTools = createAllTools();
  console.log(`Đã tải ${allTools.length} tools: ${allTools.map((t) => t.name).join(", ")}`);

  const checkpointer = await setupCheckpoint();
  console.log("Đã khởi tạo checkpoint.");

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
      console.log("Tạm biệt!");
      break;
    }

    if (!userInput.trim()) continue;

    const parts = userInput.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();

    if (command === "switch" && parts[1]) {
      const modelName = parts.slice(1).join(" ");
      try {
        llmManager.switchQuickModel(modelName);
        const current = llmManager.getCurrentModels();
        console.log(`\n[OK] Đã chuyển quick model sang: ${current.quick}\n`);
      } catch (error) {
        console.log(`\n[Lỗi] Không thể switch model: ${error}\n`);
      }
      continue;
    }

    if (command === "switch-deep" && parts[1]) {
      const modelName = parts.slice(1).join(" ");
      try {
        llmManager.switchDeepModel(modelName);
        const current = llmManager.getCurrentModels();
        console.log(`\n[OK] Đã chuyển deep model sang: ${current.deep}\n`);
      } catch (error) {
        console.log(`\n[Lỗi] Không thể switch model: ${error}\n`);
      }
      continue;
    }

    if (command === "models") {
      console.log("\n=== DANH SÁCH MODELS ===\n");
      const models = getAllModels();
      console.log("| Tên | Provider | Tier | Mô tả |");
      console.log("|-----|----------|------|-------|");
      for (const model of models) {
        console.log(`| ${model.name} | ${model.provider} | ${model.tier} | ${model.description} |`);
      }
      console.log("");
      continue;
    }

    if (command === "models-provider" && parts[1]) {
      const provider = parts[1] as LLMProvider;
      console.log(`\n=== MODELS CHO ${provider.toUpperCase()} ===\n`);
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

    if (command === "current") {
      const current = llmManager.getCurrentModels();
      console.log(`\n[LLM] Quick model: ${current.quick}`);
      console.log(`[LLM] Deep model: ${current.deep}\n`);
      continue;
    }

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
            console.log(`\n[Gọi tool: ${toolCall.name}]`);

            const tool = allTools.find((t) => t.name === toolCall.name);
            if (tool) {
              const args = typeof toolCall.args === "string"
                ? JSON.parse(toolCall.args)
                : toolCall.args;
              const toolResult = await (tool as DynamicTool).invoke(args);
              const resultStr = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
              console.log(`[Kết quả: ${resultStr.substring(0, 200)}...]`);
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
          console.log(`\nTrợ lý: ${aiMessage}\n`);
        } else {
          const aiMessage =
            typeof response.content === "string"
              ? response.content
              : JSON.stringify(response.content);
          console.log(`\nTrợ lý: ${aiMessage}\n`);
        }
      } catch (error) {
        console.error(`\nLỗi: ${error}\n`);
      }
    }
  }

  rl.close();
}

main().catch(console.error);
