import { DynamicTool } from "@langchain/core/tools";
import { TavilySearch } from "@langchain/tavily";
import FirecrawlApp from "firecrawl";

// ==================== WEB TOOLS ====================

let firecrawlApp: FirecrawlApp | null = null;

function getFirecrawlApp(): FirecrawlApp {
  if (!firecrawlApp) {
    const apiUrl = process.env.FIRECRAWL_API_URL || "http://localhost:3002";
    firecrawlApp = new FirecrawlApp({ apiUrl });
  }
  return firecrawlApp;
}

// ==================== TAVILY SEARCH ====================

function createTavilySearchTool(): DynamicTool | null {
  if (!process.env.TAVILY_API_KEY) {
    return null;
  }

  return new DynamicTool({
    name: "tavily_search",
    description: "Tìm kiếm web nhanh bằng Tavily. Input: query string.",
    func: async (query: string) => {
      const tavily = new TavilySearch({ maxResults: 5 });
      const result = await tavily.invoke({ query });
      return typeof result === "string" ? result : JSON.stringify(result);
    },
  });
}

// ==================== WEB FETCH ====================

function createWebFetchTool(): DynamicTool {
  return new DynamicTool({
    name: "web_fetch",
    description: "Đọc nội dung từ một URL cụ thể. Input: URL string.",
    func: async (url: string) => {
      try {
        const response = await fetch(url.trim());
        const text = await response.text();
        const cleanText = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 5000);
        return cleanText || "Không thể đọc nội dung trang web.";
      } catch (error) {
        return `Lỗi khi fetch URL: ${error}`;
      }
    },
  });
}

// ==================== FIRECRAWL SCRAPE ====================

function createFirecrawlScrapeTool(): DynamicTool | null {
  if (!process.env.FIRECRAWL_API_URL && !process.env.FIRECRAWL_API_KEY) {
    return null;
  }

  return new DynamicTool({
    name: "firecrawl_scrape",
    description: "Scrape nội dung từ URL và trả về markdown sạch. Input: URL string.",
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

function createFirecrawlSearchTool(): DynamicTool | null {
  if (!process.env.FIRECRAWL_API_URL && !process.env.FIRECRAWL_API_KEY) {
    return null;
  }

  return new DynamicTool({
    name: "firecrawl_search",
    description: "Tìm kiếm web và lấy nội dung đầy đủ từ kết quả. Input: query string.",
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

// ==================== CREATE ALL WEB TOOLS ====================

export function createWebTools(): DynamicTool[] {
  const tools: DynamicTool[] = [];

  const tavilyTool = createTavilySearchTool();
  if (tavilyTool) tools.push(tavilyTool);

  tools.push(createWebFetchTool());

  const firecrawlScrape = createFirecrawlScrapeTool();
  if (firecrawlScrape) tools.push(firecrawlScrape);

  const firecrawlSearch = createFirecrawlSearchTool();
  if (firecrawlSearch) tools.push(firecrawlSearch);

  return tools;
}
