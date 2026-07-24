import { DynamicTool } from "@langchain/core/tools";
import { TavilySearch } from "@langchain/tavily";

// ==================== TAVILY SEARCH ====================

export function createTavilySearchTool(): TavilySearch {
  return new TavilySearch({
    maxResults: 5,
  });
}

// ==================== WEB FETCH ====================

export function createWebFetchTool(): DynamicTool {
  return new DynamicTool({
    name: "web_fetch",
    description: "Đọc nội dung từ một URL cụ thể.",
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
