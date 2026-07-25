import { DynamicTool } from "@langchain/core/tools";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ==================== PERSISTENT STORE (SQLite-like) ====================

interface StoreItem {
  key: string;
  value: unknown;
  timestamp: number;
}

class PersistentStore {
  private store: Map<string, Map<string, StoreItem>> = new Map();
  private persistPath: string;

  constructor(dataDir: string = ".memory") {
    this.persistPath = join(dataDir, "long-term-memory.json");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.load();
  }

  private load(): void {
    if (existsSync(this.persistPath)) {
      try {
        const data = JSON.parse(readFileSync(this.persistPath, "utf-8"));
        this.store = new Map(Object.entries(data));
      } catch (error) {
        console.error("[Memory] Lỗi khi tải dữ liệu:", error);
      }
    }
  }

  private save(): void {
    try {
      const data = Object.fromEntries(this.store);
      writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("[Memory] Lỗi khi lưu dữ liệu:", error);
    }
  }

  put(namespace: string[], key: string, value: unknown): void {
    const ns = namespace.join("/");
    if (!this.store.has(ns)) {
      this.store.set(ns, new Map());
    }
    this.store.get(ns)!.set(key, {
      key,
      value,
      timestamp: Date.now(),
    });
    this.save();
  }

  get(namespace: string[], key: string): StoreItem | undefined {
    const ns = namespace.join("/");
    return this.store.get(ns)?.get(key);
  }

  search(namespace: string[], query: string): StoreItem[] {
    if (!query) return [];
    const ns = namespace.join("/");
    const items = Array.from(this.store.get(ns)?.values() || []);
    const queryLower = query.toLowerCase();

    return items.filter((item) => {
      const valueStr = JSON.stringify(item.value).toLowerCase();
      return valueStr.includes(queryLower);
    });
  }

  list(namespace: string[]): StoreItem[] {
    const ns = namespace.join("/");
    return Array.from(this.store.get(ns)?.values() || []);
  }

  delete(namespace: string[], key: string): boolean {
    const ns = namespace.join("/");
    const deleted = this.store.get(ns)?.delete(key) || false;
    if (deleted) this.save();
    return deleted;
  }
}

// ==================== GLOBAL STORE ====================

let globalStore: PersistentStore | null = null;

export function getLongTermStore(): PersistentStore {
  if (!globalStore) {
    globalStore = new PersistentStore(".memory");
  }
  return globalStore;
}

// ==================== MEMORY TYPES ====================

export interface SemanticMemory {
  type: "semantic";
  content: string;
  source: string;
  confidence: number;
  timestamp: number;
}

export interface EpisodicMemory {
  type: "episodic";
  ticker: string;
  date: string;
  event: string;
  outcome: string;
  lesson: string;
  timestamp: number;
}

export interface ProceduralMemory {
  type: "procedural";
  task: string;
  steps: string[];
  successRate: number;
  lastUsed: number;
}

// ==================== MEMORY MANAGER ====================

export class LongTermMemoryManager {
  private store: PersistentStore;

  constructor() {
    this.store = getLongTermStore();
  }

  async saveSemanticMemory(
    namespace: string[],
    key: string,
    memory: Omit<SemanticMemory, "type" | "timestamp">
  ): Promise<void> {
    this.store.put(namespace, key, {
      type: "semantic",
      ...memory,
      timestamp: Date.now(),
    });
  }

  async saveEpisodicMemory(
    namespace: string[],
    key: string,
    memory: Omit<EpisodicMemory, "type" | "timestamp">
  ): Promise<void> {
    this.store.put(namespace, key, {
      type: "episodic",
      ...memory,
      timestamp: Date.now(),
    });
  }

  async saveProceduralMemory(
    namespace: string[],
    key: string,
    memory: Omit<ProceduralMemory, "type" | "lastUsed">
  ): Promise<void> {
    this.store.put(namespace, key, {
      type: "procedural",
      ...memory,
      lastUsed: Date.now(),
    });
  }

  searchMemories(namespace: string[], query: string): unknown[] {
    return this.store.search(namespace, query).map((item) => item.value);
  }

  getMemory(namespace: string[], key: string): unknown | null {
    const item = this.store.get(namespace, key);
    return item?.value || null;
  }

  deleteMemory(namespace: string[], key: string): void {
    this.store.delete(namespace, key);
  }

  listMemories(namespace: string[]): unknown[] {
    return this.store.list(namespace).map((item) => item.value);
  }
}

// ==================== MEMORY TOOLS ====================

export function createMemoryTools(): DynamicTool[] {
  const manager = new LongTermMemoryManager();

  const saveTradingExperience = new DynamicTool({
    name: "save_trading_experience",
    description: "Lưu kinh nghiệm giao dịch vào bộ nhớ lâu dài. Input: JSON với ticker, date, event, outcome, lesson.",
    func: async (input: string) => {
      const data = JSON.parse(input);
      await manager.saveEpisodicMemory(
        ["trading", "experiences"],
        `${data.ticker}-${data.date}`,
        {
          ticker: data.ticker,
          date: data.date,
          event: data.event,
          outcome: data.outcome,
          lesson: data.lesson,
        }
      );
      return `Đã lưu kinh nghiệm giao dịch ${data.ticker} ngày ${data.date}`;
    },
  });

  const searchTradingExperiences = new DynamicTool({
    name: "search_trading_experiences",
    description: "Tìm kiếm kinh nghiệm giao dịch đã lưu. Input: query string.",
    func: async (query: string) => {
      const results = manager.searchMemories(["trading", "experiences"], query);
      if (results.length === 0) return "Không tìm thấy kinh nghiệm nào.";
      return JSON.stringify(results, null, 2);
    },
  });

  const saveMarketKnowledge = new DynamicTool({
    name: "save_market_knowledge",
    description: "Lưu kiến thức về thị trường. Input: JSON với content, source, confidence.",
    func: async (input: string) => {
      const data = JSON.parse(input);
      await manager.saveSemanticMemory(["market", "knowledge"], `knowledge-${Date.now()}`, {
        content: data.content,
        source: data.source,
        confidence: data.confidence || 0.8,
      });
      return "Đã lưu kiến thức thị trường.";
    },
  });

  const searchMarketKnowledge = new DynamicTool({
    name: "search_market_knowledge",
    description: "Tìm kiếm kiến thức thị trường đã lưu. Input: query string.",
    func: async (query: string) => {
      const results = manager.searchMemories(["market", "knowledge"], query);
      if (results.length === 0) return "Không tìm thấy kiến thức nào.";
      return JSON.stringify(results, null, 2);
    },
  });

  const saveTradingProcedure = new DynamicTool({
    name: "save_trading_procedure",
    description: "Lưu quy trình giao dịch. Input: JSON với task, steps.",
    func: async (input: string) => {
      const data = JSON.parse(input);
      await manager.saveProceduralMemory(["trading", "procedures"], `procedure-${data.task}`, {
        task: data.task,
        steps: data.steps,
        successRate: 1.0,
      });
      return `Đã lưu quy trình: ${data.task}`;
    },
  });

  const getTradingHistory = new DynamicTool({
    name: "get_trading_history",
    description: "Lấy lịch sử giao dịch của một mã. Input: ticker string.",
    func: async (ticker: string) => {
      const results = manager.searchMemories(["trading", "experiences"], ticker);
      if (results.length === 0) return `Không có lịch sử giao dịch cho ${ticker}.`;
      return JSON.stringify(results, null, 2);
    },
  });

  const getAllLessons = new DynamicTool({
    name: "get_all_lessons",
    description: "Lấy tất cả bài học từ kinh nghiệm giao dịch. Không cần input.",
    func: async () => {
      const results = manager.listMemories(["trading", "experiences"]);
      const lessons = results
        .filter((r: any) => r.lesson)
        .map((r: any) => `- ${r.ticker} (${r.date}): ${r.lesson}`);

      if (lessons.length === 0) return "Chưa có bài học nào.";
      return `Các bài học đã học:\n${lessons.join("\n")}`;
    },
  });

  return [
    saveTradingExperience,
    searchTradingExperiences,
    saveMarketKnowledge,
    searchMarketKnowledge,
    saveTradingProcedure,
    getTradingHistory,
    getAllLessons,
  ];
}

export function initializeLongTermMemory(): LongTermMemoryManager {
  return new LongTermMemoryManager();
}
