import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { DebateStateAnnotation, type DebateState } from "../state";
import { runBullResearcher } from "../../agents/researchers/bull-researcher";
import { runBearResearcher } from "../../agents/researchers/bear-researcher";

// ==================== DEBATE SUBGRAPH ====================

/** Parse nếu là JSON, fallback về {summary: raw} nếu là text/Markdown */
function safeParseReport(report: string): Record<string, unknown> {
  try {
    return JSON.parse(report || "{}");
  } catch {
    return { summary: report };
  }
}

/** Guard: đảm bảo debateState luôn khởi tạo đủ field (LangGraph subgraph không propagate default từ Annotation) */
function resolveDebateState(raw: unknown) {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    history: typeof d.history === "string" ? d.history : "",
    bullHistory: typeof d.bullHistory === "string" ? d.bullHistory : "",
    bearHistory: typeof d.bearHistory === "string" ? d.bearHistory : "",
    currentResponse: typeof d.currentResponse === "string" ? d.currentResponse : "",
    judgeDecision: typeof d.judgeDecision === "string" ? d.judgeDecision : "",
    count: typeof d.count === "number" ? d.count : 0,
  };
}

export function createDebateSubgraph(llm: ChatOpenAI, maxRounds: number = 2) {
  // Node: Bull Researcher
  async function bullResearcher(state: DebateState): Promise<Partial<DebateState>> {
    console.log("[Debate] Đang chạy Bull Researcher...");

    const marketReport = safeParseReport(state.marketReport);
    const newsReport = safeParseReport(state.newsReport);
    const sentimentReport = safeParseReport(state.sentimentReport);
    const fundamentalsReport = safeParseReport(state.fundamentalsReport);

    const debateState = resolveDebateState(state.investmentDebateState);
    const bullReport = await runBullResearcher(
      llm,
      marketReport,
      newsReport,
      sentimentReport,
      fundamentalsReport,
      state.ticker,
      debateState.history ? debateState.history.split("\n") : []
    );

    const argument = `Bull Researcher: ${bullReport.argument}`;

    return {
      investmentDebateState: {
        ...debateState,
        history: debateState.history + "\n" + argument,
        bullHistory: debateState.bullHistory + "\n" + argument,
        count: debateState.count + 1,
      },
    };
  }

  // Node: Bear Researcher
  async function bearResearcher(state: DebateState): Promise<Partial<DebateState>> {
    console.log("[Debate] Đang chạy Bear Researcher...");

    const marketReport = safeParseReport(state.marketReport);
    const newsReport = safeParseReport(state.newsReport);
    const sentimentReport = safeParseReport(state.sentimentReport);
    const fundamentalsReport = safeParseReport(state.fundamentalsReport);

    const debateState = resolveDebateState(state.investmentDebateState);
    const bearReport = await runBearResearcher(
      llm,
      marketReport,
      newsReport,
      sentimentReport,
      fundamentalsReport,
      state.ticker,
      debateState.history ? debateState.history.split("\n") : []
    );

    const argument = `Bear Researcher: ${bearReport.argument}`;

    return {
      investmentDebateState: {
        ...debateState,
        history: debateState.history + "\n" + argument,
        bearHistory: debateState.bearHistory + "\n" + argument,
        count: debateState.count + 1,
      },
      messages: [{ role: "assistant", content: argument }],
    };
  }

  // Conditional edge: Continue debate or end
  function shouldContinueDebate(state: DebateState): string {
    const debateState = resolveDebateState(state.investmentDebateState);
    if (debateState.count >= maxRounds * 2) {
      return "__end__";
    }
    return debateState.count % 2 === 0 ? "Bull Researcher" : "Bear Researcher";
  }

  // Build subgraph
  const workflow = new StateGraph(DebateStateAnnotation)
    .addNode("Bull Researcher", bullResearcher)
    .addNode("Bear Researcher", bearResearcher)

    .addEdge(START, "Bull Researcher")
    .addConditionalEdges("Bull Researcher", shouldContinueDebate, {
      "Bear Researcher": "Bear Researcher",
      [END]: END,
    })
    .addConditionalEdges("Bear Researcher", shouldContinueDebate, {
      "Bull Researcher": "Bull Researcher",
      [END]: END,
    });

  return workflow.compile();
}
