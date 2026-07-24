import { DynamicTool } from "@langchain/core/tools";
import FirecrawlApp from "firecrawl";

// ==================== FIRECRAWL TOOLS ====================

const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || "http://localhost:3002";

let firecrawlApp: FirecrawlApp | null = null;

function getFirecrawlApp(): FirecrawlApp {
  if (!firecrawlApp) {
    firecrawlApp = new FirecrawlApp({ apiUrl: FIRECRAWL_API_URL });
  }
  return firecrawlApp;
}

// ==================== FIRECRAWL SCRAPE ====================

export function createFirecrawlScrapeTool(): DynamicTool {
  return new DynamicTool({
    name: "firecrawl_scrape",
    description: "Scrape nội dung từ URL và trả về markdown sạch.",
    func: async (url: string) => {
      try {
        const result = await getFirecrawlApp().scrapeUrl(url.trim(), {
          formats: ["markdown"],
        });
        return result.markdown?.substring(0, 8000) || "Không thể scrape trang web.";
      } catch (error) {
        return `Lỗi khi scrape: ${error}`;
      }
    },
  });
}

// ==================== FIRECRAWL SEARCH ====================

export function createFirecrawlSearchTool(): DynamicTool {
  return new DynamicTool({
    name: "firecrawl_search",
    description: "Tìm kiếm web và lấy nội dung đầy đủ từ kết quả.",
    func: async (query: string) => {
      try {
        const result = await getFirecrawlApp().search(query.trim(), {
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
}

// ==================== FIRECRAWL CRAWL ====================

export function createFirecrawlCrawlTool(): DynamicTool {
  return new DynamicTool({
    name: "firecrawl_crawl",
    description: "Crawl toàn bộ website và lấy nội dung từ tất cả các trang con.",
    func: async (input: string) => {
      try {
        const { url, limit } = JSON.parse(input);
        const result = await getFirecrawlApp().crawlUrl(url, {
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
}

// ==================== EXPORT ALL FIRECRAWL TOOLS ====================

export function createAllFirecrawlTools(): DynamicTool[] {
  return [
    createFirecrawlScrapeTool(),
    createFirecrawlSearchTool(),
    createFirecrawlCrawlTool(),
  ];
}
