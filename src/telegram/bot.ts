import { Bot, GrammyError, HttpError } from "grammy";
import type { TelegramContext } from "./types";

// ==================== SINGLETON BOT ====================

let botInstance: Bot<TelegramContext> | null = null;

export function createBot(token: string): Bot<TelegramContext> {
  if (botInstance) return botInstance;

  botInstance = new Bot<TelegramContext>(token);
  return botInstance;
}

export function getBot(): Bot<TelegramContext> {
  if (!botInstance) throw new Error("Bot chưa được khởi tạo — gọi createBot() trước");
  return botInstance;
}

// ==================== WHITELIST MIDDLEWARE ====================

export function createWhitelistMiddleware(allowedChatIds: string[]) {
  return async (ctx: TelegramContext, next: () => Promise<void>) => {
    if (allowedChatIds.length === 0) {
      return next();
    }
    const chatId = String(ctx.chat?.id ?? "");
    if (!allowedChatIds.includes(chatId)) {
      console.warn(`[Telegram] Từ chối chat ID: ${chatId}`);
      return;
    }
    return next();
  };
}

// ==================== ERROR HANDLER ====================

export function setupErrorHandler(bot: Bot<TelegramContext>) {
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[Telegram] Lỗi khi xử lý update ${ctx.update.update_id}:`);
    if (err.error instanceof GrammyError) {
      console.error("Lỗi Telegram API:", err.error.description);
    } else if (err.error instanceof HttpError) {
      console.error("Lỗi HTTP:", err.error);
    } else {
      console.error("Lỗi không xác định:", err.error);
    }
  });
}

// ==================== SEND HELPER ====================

/**
 * Gửi tin nhắn MarkdownV2 — tự động fallback sang plain text nếu parse lỗi
 */
export async function sendMarkdown(
  bot: Bot<TelegramContext>,
  chatId: number | string,
  text: string
): Promise<void> {
  try {
    await bot.api.sendMessage(chatId, text, { parse_mode: "MarkdownV2" });
  } catch {
    // Fallback sang plain text nếu Markdown bị lỗi syntax
    const plain = text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "");
    await bot.api.sendMessage(chatId, plain);
  }
}
