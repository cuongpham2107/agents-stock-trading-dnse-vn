// ==================== SHARED STORES ====================

export interface StoreConfig {
  namespace: string;
}

export interface AnalysisResult {
  ticker: string;
  date: string;
  result: string;
  timestamp: number;
}

export interface MarketSnapshot {
  ticker: string;
  date: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// ==================== IN-MEMORY STORE ====================

class MemoryStore {
  private store: Map<string, Map<string, unknown>> = new Map();

  get(namespace: string, key: string): unknown {
    return this.store.get(namespace)?.get(key);
  }

  put(namespace: string, key: string, value: unknown): void {
    if (!this.store.has(namespace)) {
      this.store.set(namespace, new Map());
    }
    this.store.get(namespace)!.set(key, value);
  }

  delete(namespace: string, key: string): boolean {
    return this.store.get(namespace)?.delete(key) || false;
  }

  list(namespace: string): unknown[] {
    const ns = this.store.get(namespace);
    if (!ns) return [];
    return Array.from(ns.values());
  }

  clear(namespace: string): void {
    this.store.delete(namespace);
  }
}

// ==================== SINGLETON STORE ====================

const globalStore = new MemoryStore();

export function getStore(): MemoryStore {
  return globalStore;
}

// ==================== ANALYSIS STORE ====================

export class AnalysisStore {
  private namespace = "analyses";

  save(analysis: AnalysisResult): void {
    const key = `${analysis.ticker}-${analysis.date}`;
    getStore().put(this.namespace, key, analysis);
  }

  get(ticker: string, date: string): AnalysisResult | undefined {
    const key = `${ticker}-${date}`;
    return getStore().get(this.namespace, key) as AnalysisResult | undefined;
  }

  getLatest(ticker: string): AnalysisResult | undefined {
    const all = getStore().list(this.namespace) as AnalysisResult[];
    const filtered = all.filter((a) => a.ticker === ticker);
    if (filtered.length === 0) return undefined;
    return filtered.sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  list(): AnalysisResult[] {
    return getStore().list(this.namespace) as AnalysisResult[];
  }
}

// ==================== MARKET STORE ====================

export class MarketStore {
  private namespace = "market";

  save(snapshot: MarketSnapshot): void {
    const key = `${snapshot.ticker}-${snapshot.date}`;
    getStore().put(this.namespace, key, snapshot);
  }

  get(ticker: string, date: string): MarketSnapshot | undefined {
    const key = `${ticker}-${date}`;
    return getStore().get(this.namespace, key) as MarketSnapshot | undefined;
  }
}

// ==================== SINGLETON INSTANCES ====================

export const analysisStore = new AnalysisStore();
export const marketStore = new MarketStore();
