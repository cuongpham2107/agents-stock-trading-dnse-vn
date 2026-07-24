import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

// ==================== CHECKPOINT MANAGER ====================

export class CheckpointManager {
  private checkpointer: SqliteSaver | null = null;
  private connString: string;

  constructor(connString: string = "file:checkpoints.db") {
    this.connString = connString;
  }

  async initialize(): Promise<void> {
    this.checkpointer = await SqliteSaver.fromConnString(this.connString);
    console.log("[Checkpoint] Initialized");
  }

  getCheckpointer(): SqliteSaver {
    if (!this.checkpointer) {
      throw new Error("Checkpointer not initialized. Call initialize() first.");
    }
    return this.checkpointer;
  }
}
