import { ChatOpenAI } from "@langchain/openai";

// ==================== STREAMING MANAGER ====================

export interface StreamChunk {
  node: string;
  content: string;
  timestamp: number;
}

export class StreamingManager {
  private chunks: StreamChunk[] = [];
  private onChunk?: (chunk: StreamChunk) => void;

  constructor(onChunk?: (chunk: StreamChunk) => void) {
    this.onChunk = onChunk;
  }

  /**
   * Stream LLM response token-by-token
   */
  async streamLLMResponse(
    llm: ChatOpenAI,
    messages: { role: string; content: string }[],
    nodeName: string
  ): Promise<string> {
    const stream = await llm.stream(messages as any);
    let fullContent = "";

    for await (const chunk of stream) {
      const content =
        typeof chunk.content === "string"
          ? chunk.content
          : JSON.stringify(chunk.content);

      if (content) {
        fullContent += content;
        const streamChunk: StreamChunk = {
          node: nodeName,
          content,
          timestamp: Date.now(),
        };
        this.chunks.push(streamChunk);
        this.onChunk?.(streamChunk);
      }
    }

    return fullContent;
  }

  /**
   * Get all chunks
   */
  getChunks(): StreamChunk[] {
    return this.chunks;
  }

  /**
   * Get chunks by node
   */
  getChunksByNode(nodeName: string): StreamChunk[] {
    return this.chunks.filter((c) => c.node === nodeName);
  }

  /**
   * Clear chunks
   */
  clear(): void {
    this.chunks = [];
  }
}

// ==================== STREAM WRITER (for LangGraph custom mode) ====================

let currentWriter: ((data: unknown) => void) | null = null;

export function setStreamWriter(writer: (data: unknown) => void): void {
  currentWriter = writer;
}

export function getStreamWriter(): (data: unknown) => void {
  if (!currentWriter) {
    return (data: unknown) => {
      console.log("[Stream]", data);
    };
  }
  return currentWriter;
}

export function emitProgress(node: string, message: string): void {
  const writer = getStreamWriter();
  writer({ type: "progress", node, message, timestamp: Date.now() });
}

export function emitComplete(node: string, result: unknown): void {
  const writer = getStreamWriter();
  writer({ type: "complete", node, result, timestamp: Date.now() });
}

export function emitError(node: string, error: string): void {
  const writer = getStreamWriter();
  writer({ type: "error", node, error, timestamp: Date.now() });
}
