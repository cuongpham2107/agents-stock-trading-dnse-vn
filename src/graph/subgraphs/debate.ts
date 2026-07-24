import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { DebateStateAnnotation, type DebateState } from "../state";
import { runBullResearcher } from "../../agents/researchers/bull-researcher";
import { runBearResearcher } from "../../agents/researchers/bear-researcher";

// ==================== DEBATE SUBGRAPH ====================

export function createDebateSubgraph(llm: ChatOpenAI, maxRounds: number = 2) {
  // Node: Bull Researcher
  async function bullResearcher(state: DebateState): Promise<Partial<DebateState>> {
    console.log("[Debate] Đang chạy Bull Researcher...");

    const marketReport = JSON.parse(state.marketReport || "{}");
    const newsReport = JSON.parse(state.newsReport || "{}");
    const sentimentReport = JSON.parse(state.sentimentReport || "{}");
    const fundamentalsReport = JSON.parse(state.fundamentalsReport || "{}");

    const debateState = state.investmentDebateState;
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
      messages: [{ role: "assistant", content: argument }],
    };
  }

  // Node: Bear Researcher
  async function bearResearcher(state: DebateState): Promise<Partial<DebateState>> {
    console.log("[Debate] Đang chạy Bear Researcher...");

    const marketReport = JSON.parse(state.marketReport || "{}");
    const newsReport = JSON.parse(state.newsReport || "{}");
    const sentimentReport = JSON.parse(state.sentimentReport || "{}");
    const fundamentalsReport = JSON.parse(state.fundamentalsReport || "{}");

    const debateState = state.investmentDebateState;
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
    const debateState = state.investmentDebateState;
    if (debateState.count >= maxRounds * 2) {
      return "__end__";
    }
    return debateState.count % 2 === 0 ? "Bear Researcher" : "Bull Researcher";
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
