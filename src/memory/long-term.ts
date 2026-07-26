import { DynamicTool } from "@langchain/core/tools";
import prisma from "../db/prisma";

// ==================== PERSISTENT STORE (Prisma-based) ====================

interface StoreItem {
  key: string;
  value: unknown;
  timestamp: number;
}

class PersistentStore {
  private namespace: string;

  constructor(namespace: string = "default") {
    this.namespace = namespace;
  }

  async put(key: string, value: unknown): Promise<void> {
    const existing = await prisma.memory.findUnique({
      where: { namespace_key: { namespace: this.namespace, key } },
    });

    if (existing) {
      await prisma.memory.update({
        where: { id: existing.id },
        data: { value: JSON.stringify(value), updatedAt: new Date() },
      });
    } else {
      await prisma.memory.create({
        data: {
          namespace: this.namespace,
          key,
          value: JSON.stringify(value),
        },
      });
    }
  }

  async get(key: string): Promise<StoreItem | undefined> {
    const record = await prisma.memory.findUnique({
      where: { namespace_key: { namespace: this.namespace, key } },
    });

    if (!record) return undefined;

    return {
      key: record.key,
      value: JSON.parse(record.value),
      timestamp: record.updatedAt.getTime(),
    };
  }

  async search(query: string): Promise<StoreItem[]> {
    if (!query) return [];

    const records = await prisma.memory.findMany({
      where: {
        namespace: this.namespace,
        value: { contains: query },
      },
    });

    return records.map((r) => ({
      key: r.key,
      value: JSON.parse(r.value),
      timestamp: r.updatedAt.getTime(),
    }));
  }

  async list(): Promise<StoreItem[]> {
    const records = await prisma.memory.findMany({
      where: { namespace: this.namespace },
      orderBy: { updatedAt: "desc" },
    });

    return records.map((r) => ({
      key: r.key,
      value: JSON.parse(r.value),
      timestamp: r.updatedAt.getTime(),
    }));
  }

  async delete(key: string): Promise<boolean> {
    const deleted = await prisma.memory.delete({
      where: { namespace_key: { namespace: this.namespace, key } },
    });
    return !!deleted;
  }
}

// ==================== GLOBAL STORE ====================

const stores = new Map<string, PersistentStore>();

export function getLongTermStore(namespace: string = "default"): PersistentStore {
  if (!stores.has(namespace)) {
    stores.set(namespace, new PersistentStore(namespace));
  }
  return stores.get(namespace)!;
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

  constructor(namespace: string = "default") {
    this.store = getLongTermStore(namespace);
  }

  async saveSemanticMemory(
    key: string,
    memory: Omit<SemanticMemory, "type" | "timestamp">
  ): Promise<void> {
    await this.store.put(key, {
      type: "semantic",
      ...memory,
      timestamp: Date.now(),
    });
  }

  async saveEpisodicMemory(
    key: string,
    memory: Omit<EpisodicMemory, "type" | "timestamp">
  ): Promise<void> {
    await this.store.put(key, {
      type: "episodic",
      ...memory,
      timestamp: Date.now(),
    });
  }

  async saveProceduralMemory(
    key: string,
    memory: Omit<ProceduralMemory, "type" | "lastUsed">
  ): Promise<void> {
    await this.store.put(key, {
      type: "procedural",
      ...memory,
      lastUsed: Date.now(),
    });
  }

  async searchMemories(query: string): Promise<unknown[]> {
    const results = await this.store.search(query);
    return results.map((item) => item.value);
  }

  async getMemory(key: string): Promise<unknown | null> {
    const item = await this.store.get(key);
    return item?.value || null;
  }

  async deleteMemory(key: string): Promise<void> {
    await this.store.delete(key);
  }

  async listMemories(): Promise<unknown[]> {
    const results = await this.store.list();
    return results.map((item) => item.value);
  }
}

// ==================== MEMORY TOOLS ====================

export function createMemoryTools(): DynamicTool[] {
  const tradingManager = new LongTermMemoryManager("trading/experiences");
  const marketManager = new LongTermMemoryManager("market/knowledge");
  const procedureManager = new LongTermMemoryManager("trading/procedures");

  const saveTradingExperience = new DynamicTool({
    name: "save_trading_experience",
    description: "Lưu kinh nghiệm giao dịch vào bộ nhớ lâu dài. Input: JSON với ticker, date, event, outcome, lesson.",
    func: async (input: string) => {
      const data = JSON.parse(input);
      await tradingManager.saveEpisodicMemory(`${data.ticker}-${data.date}`, {
        ticker: data.ticker,
        date: data.date,
        event: data.event,
        outcome: data.outcome,
        lesson: data.lesson,
      });
      return `Đã lưu kinh nghiệm giao dịch ${data.ticker} ngày ${data.date}`;
    },
  });

  const searchTradingExperiences = new DynamicTool({
    name: "search_trading_experiences",
    description: "Tìm kiếm kinh nghiệm giao dịch đã lưu. Input: query string.",
    func: async (query: string) => {
      const results = await tradingManager.searchMemories(query);
      if (results.length === 0) return "Không tìm thấy kinh nghiệm nào.";
      return JSON.stringify(results, null, 2);
    },
  });

  const saveMarketKnowledge = new DynamicTool({
    name: "save_market_knowledge",
    description: "Lưu kiến thức về thị trường. Input: JSON với content, source, confidence.",
    func: async (input: string) => {
      const data = JSON.parse(input);
      await marketManager.saveSemanticMemory(`knowledge-${Date.now()}`, {
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
      const results = await marketManager.searchMemories(query);
      if (results.length === 0) return "Không tìm thấy kiến thức nào.";
      return JSON.stringify(results, null, 2);
    },
  });

  const saveTradingProcedure = new DynamicTool({
    name: "save_trading_procedure",
    description: "Lưu quy trình giao dịch. Input: JSON với task, steps.",
    func: async (input: string) => {
      const data = JSON.parse(input);
      await procedureManager.saveProceduralMemory(`procedure-${data.task}`, {
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
      const results = await tradingManager.searchMemories(ticker);
      if (results.length === 0) return `Không có lịch sử giao dịch cho ${ticker}.`;
      return JSON.stringify(results, null, 2);
    },
  });

  const getAllLessons = new DynamicTool({
    name: "get_all_lessons",
    description: "Lấy tất cả bài học từ kinh nghiệm giao dịch. Không cần input.",
    func: async () => {
      const results = await tradingManager.listMemories();
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