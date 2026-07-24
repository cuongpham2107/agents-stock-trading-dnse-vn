import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

// ==================== MESSAGE TYPES ====================

export type Message = HumanMessage | AIMessage | SystemMessage | ToolMessage;

export interface ConversationEntry {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ==================== MESSAGE HISTORY ====================

export class MessageHistory {
  private history: ConversationEntry[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  /**
   * Add user message
   */
  addUserMessage(content: string): void {
    this.history.push({
      role: "user",
      content,
      timestamp: Date.now(),
    });
    this.trimHistory();
  }

  /**
   * Add assistant message
   */
  addAssistantMessage(content: string, metadata?: Record<string, unknown>): void {
    this.history.push({
      role: "assistant",
      content,
      timestamp: Date.now(),
      metadata,
    });
    this.trimHistory();
  }

  /**
   * Add system message
   */
  addSystemMessage(content: string): void {
    this.history.push({
      role: "system",
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Add tool result
   */
  addToolResult(toolName: string, result: string): void {
    this.history.push({
      role: "tool",
      content: `[${toolName}] ${result}`,
      timestamp: Date.now(),
      metadata: { toolName },
    });
    this.trimHistory();
  }

  /**
   * Get LangChain messages format
   */
  toLangChainMessages(): Message[] {
    return this.history.map((entry) => {
      switch (entry.role) {
        case "user":
          return new HumanMessage(entry.content);
        case "assistant":
          return new AIMessage(entry.content);
        case "system":
          return new SystemMessage(entry.content);
        case "tool":
          return new ToolMessage({
            content: entry.content,
            tool_call_id: entry.metadata?.toolName as string || "unknown",
          });
        default:
          return new HumanMessage(entry.content);
      }
    });
  }

  /**
   * Get recent messages
   */
  getRecent(count: number): ConversationEntry[] {
    return this.history.slice(-count);
  }

  /**
   * Get history as string
   */
  toString(): string {
    return this.history
      .map((entry) => `[${entry.role}] ${entry.content}`)
      .join("\n");
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Trim history to max size
   */
  private trimHistory(): void {
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  /**
   * Get history length
   */
  getLength(): number {
    return this.history.length;
  }
}

// ==================== CONVERSATION MANAGER ====================

export class ConversationManager {
  private conversations: Map<string, MessageHistory> = new Map();
  private activeConversation: string | null = null;

  /**
   * Create new conversation
   */
  createConversation(id: string): MessageHistory {
    const history = new MessageHistory();
    this.conversations.set(id, history);
    return history;
  }

  /**
   * Get conversation
   */
  getConversation(id: string): MessageHistory | undefined {
    return this.conversations.get(id);
  }

  /**
   * Set active conversation
   */
  setActive(id: string): void {
    this.activeConversation = id;
  }

  /**
   * Get active conversation
   */
  getActive(): MessageHistory | undefined {
    if (!this.activeConversation) return undefined;
    return this.conversations.get(this.activeConversation);
  }

  /**
   * List all conversations
   */
  listConversations(): string[] {
    return Array.from(this.conversations.keys());
  }

  /**
   * Delete conversation
   */
  deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }
}
