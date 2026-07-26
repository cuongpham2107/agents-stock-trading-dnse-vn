# Kế hoạch tính năng mới

## Tổng quan

Ba nhóm tính năng cần xây dựng, có liên quan chặt chẽ với nhau:

1. **Telegram Integration** — nhận lệnh và gửi báo cáo qua bot Telegram
2. **Daily Monitor** — tự động quét danh sách mã theo lịch hằng ngày
3. **Portfolio Tracker** — theo dõi vị thế thực tế và đánh giá nên giữ/mua/bán

---

## 1. Telegram Integration

### Mục tiêu
- Nhận lệnh từ người dùng qua Telegram chat
- Gửi báo cáo phân tích sau khi graph chạy xong
- Nhận cảnh báo từ daily monitor và portfolio review

### Luồng hoạt động

```
User → Telegram Bot → Webhook/Polling → Command Parser
                                              ↓
                                    Trading Graph / Portfolio Graph
                                              ↓
                                    Format Markdown → Telegram API → User
```

### Các lệnh cần hỗ trợ

| Lệnh | Mô tả |
|---|---|
| `/analyze HPG` | Phân tích đầy đủ 7 bước |
| `/quick HPG` | Phân tích nhanh (chỉ market + news) |
| `/portfolio` | Xem danh mục + P&L hiện tại |
| `/buy HPG 1000 20.8` | Ghi nhận mua 1000 cổ HPG giá 20.8 |
| `/sell HPG 500` | Đóng một phần vị thế HPG |
| `/close HPG` | Đóng toàn bộ vị thế HPG, dừng theo dõi |
| `/check` | Chạy daily monitor ngay lập tức |
| `/review HPG` | Chạy portfolio-review-graph cho HPG ngay |
| `/watchlist` | Xem danh sách theo dõi |
| `/add HPG` | Thêm mã vào watchlist |
| `/remove HPG` | Xoá mã khỏi watchlist |

### Files cần tạo

```
src/telegram/
  bot.ts          — khởi tạo bot, polling/webhook
  handlers.ts     — xử lý từng lệnh
  formatter.ts    — format kết quả graph thành Markdown Telegram
  types.ts        — TelegramCommand, TelegramContext
```

### Biến môi trường cần thêm

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_CHAT_IDS=123456789,987654321   # whitelist chat ID
```

### Thư viện
- Đề xuất dùng `grammy` vì TypeScript-native, middleware pattern sạch

---

## 2. Daily Monitor Graph

### Mục tiêu
- Chạy tự động theo lịch (cron) mỗi ngày
- Quét danh sách watchlist (không phải vị thế — chỉ là mã quan tâm)
- Gửi báo cáo tổng hợp qua Telegram

### Câu hỏi thiết kế: Dùng graph mới hay graph cũ?

**Nên tạo graph mới riêng** vì:
- `trading-graph` chạy ~2 phút/mã — quá chậm nếu quét 10+ mã
- Monitor cần **screening nhanh**, không cần debate 2 vòng bull/bear
- Output khác nhau: trading-graph ra quyết định chi tiết, monitor ra tín hiệu alert đơn giản

### `monitor-graph` — thiết kế nhẹ hơn

```
fetch_data → [market_analyst, news_analyst] (song song, tái dùng analysts subgraph)
                        ↓
               quick_screener (1 LLM call → ALERT | WATCH | OK)
                        ↓
               output
```

So sánh:

| | `trading-graph` | `monitor-graph` |
|---|---|---|
| Mục đích | Phân tích kỹ trước khi vào lệnh | Screening hằng ngày nhanh |
| LLM calls | 8-10 calls | 3 calls |
| Thời gian | ~2 phút | ~20-30 giây |
| Output | Quyết định chi tiết + reasoning | ALERT/WATCH/OK + lý do ngắn |
| Debate | 2 vòng bull/bear | Không có |

### Cron schedule

```
src/scheduler/
  cron.ts         — setup cron jobs
  daily-scan.ts   — logic chạy monitor cho toàn watchlist
  watchlist.ts    — CRUD watchlist (lưu vào .memory/)
```

| Thời gian | Hành động |
|---|---|
| 08:00 | Quét watchlist → gửi báo cáo tổng quan trước phiên |
| 11:30 | Alert nhanh nếu có mã biến động mạnh |
| 15:30 | Chạy portfolio-review-graph cho **mọi vị thế đang mở** → gửi Telegram |

> **Lưu ý quan trọng:** 15:30 chạy portfolio-review-graph tự động, **không chờ user gõ lệnh**. Đây là khác biệt chính so với `/portfolio` (chủ động). Cron phải lấy toàn bộ Position có `status = "open"` rồi chạy review cho từng cái.

---

## 3. Portfolio Tracker (Paper Trading)

### Khái niệm — Paper Trading
Toàn bộ giao dịch là **giả định** (paper trading), không kết nối với lệnh thật ở sàn DNSE. Mục đích là:
- Ghi nhận quyết định "nếu tôi mua hôm nay" để theo dõi hiệu quả
- Hàng ngày cập nhật giá thị trường, tính lãi/lỗ so với giá vốn giả định
- Đánh giá lại: với vị thế đang giả định giữ, hôm nay nên làm gì tiếp

### Luồng sử dụng điển hình

```
26/07: trading-graph phân tích HPG → khuyến nghị MUA
  → User gõ /buy HPG 1000 20.8 (giả định mua 1000 cổ giá 20.8)
  → Hệ thống ghi nhận: paper_trade mở, giá vốn 20.8

27/07 15:30 (cron tự động):
  → Fetch giá HPG hôm nay = 21.2
  → Tính P&L: +400k (+1.9%)
  → Cập nhật bản ghi ngày 27/07: currentPrice=21.2, pnl=+400k
  → portfolio-review-graph đánh giá: HOLD (xu hướng tốt, giữ)
  → Telegram: "HPG: +1.9% | Khuyến nghị: HOLD"

28/07 15:30:
  → Giá HPG = 19.5
  → P&L: -1300k (-6.25%)
  → portfolio-review-graph: FULL_SELL (giá giảm mạnh, cắt lỗ)
  → Telegram: "⚠️ HPG: -6.25% | Khuyến nghị: CẮT LỖ"
  → User quyết định: /close HPG để đóng vị thế
```

### Dữ liệu

```typescript
// Vị thế giả định đang mở
interface PaperPosition {
  id: string
  ticker: string
  quantity: number          // số cổ giả định
  avgCost: number           // giá vốn giả định
  openDate: string          // ngày giả định mua
  status: "open" | "closed"
  closeDate?: string
  closedPrice?: number
  realizedPnl?: number      // lãi/lỗ khi đóng
  note?: string             // lý do mở vị thế (vd: "trading-graph khuyến nghị MUA")
}

// Snapshot P&L theo ngày (lịch sử)
interface DailyReview {
  id: string
  positionId: string
  date: string
  currentPrice: number
  pnl: number               // tuyệt đối (VND)
  pnlPct: number            // phần trăm
  recommendation: "HOLD" | "BUY_MORE" | "PARTIAL_SELL" | "FULL_SELL"
  reasoning: string
}
```

### Quy tắc

| Điều kiện | Hành động |
|---|---|
| Mua hôm nay, cùng ngày | Ghi nhận ngay, **không review** — chưa có biến động |
| Từ ngày hôm sau trở đi | Review tự động lúc 15:30 mỗi ngày |
| P&L thay đổi > 3% so với hôm qua | Luôn gửi Telegram dù recommendation giống |
| Recommendation đổi trạng thái | Luôn gửi Telegram |
| Recommendation giống hôm qua, P&L bình thường | Im lặng |
| Status = "closed" | Bỏ qua trong cron |

### `portfolio-review-graph`

```
load_position (lấy PaperPosition + DailyReview hôm qua)
    ↓
fetch_data (giá thị trường hôm nay từ DNSE API)
    ↓
[market_analyst, news_analyst] (song song — tái dùng analysts subgraph)
    ↓
position_evaluator
  Context: "Đang giả định giữ {qty} cổ {ticker}, giá vốn {avgCost},
            giá hôm nay {currentPrice}, P&L hiện tại {pnlPct}%"
  Output: HOLD | BUY_MORE | PARTIAL_SELL | FULL_SELL + reasoning
    ↓
save_daily_review (ghi DailyReview vào DB)
    ↓
check_alert (so sánh vs hôm qua → quyết định có gửi Telegram không)
```

### Files cần tạo

```
src/portfolio/
  tracker.ts                    — CRUD PaperPosition và DailyReview
  portfolio-review-graph.ts     — graph đánh giá vị thế
  agents/
    position-evaluator.ts       — agent đánh giá với context vị thế cụ thể
```

---

## 5. Storage — SQLite thay vì JSON

### Tại sao chuyển sang SQLite

| | JSON file hiện tại | SQLite |
|---|---|---|
| Query theo ticker/date | Scan toàn bộ file | Index, WHERE clause |
| Lịch sử P&L theo ngày | Khó | `SELECT * FROM daily_reviews WHERE ticker='HPG'` |
| Concurrent access | Không an toàn | WAL mode, transaction |
| Backup | Copy file | Copy file (cũng là 1 file) |
| Setup | Không cần gì | Không cần Docker service |

**Quyết định: SQLite** — dùng `bun:sqlite` (built-in, không cần thêm package). Không dùng PostgreSQL vì không cần multi-user concurrent writes.

### Schema

```sql
-- Bộ nhớ dài hạn (thay thế long-term-memory.json)
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,        -- "trading/experiences", "market/knowledge"
  key TEXT NOT NULL,
  value TEXT NOT NULL,            -- JSON string
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(namespace, key)
);
CREATE INDEX idx_memories_namespace ON memories(namespace);

-- Vị thế paper trading
CREATE TABLE paper_positions (
  id TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_cost REAL NOT NULL,
  open_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'closed'
  close_date TEXT,
  closed_price REAL,
  realized_pnl REAL,
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_positions_ticker ON paper_positions(ticker);
CREATE INDEX idx_positions_status ON paper_positions(status);

-- Lịch sử review hàng ngày
CREATE TABLE daily_reviews (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES paper_positions(id),
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  current_price REAL NOT NULL,
  pnl REAL NOT NULL,
  pnl_pct REAL NOT NULL,
  recommendation TEXT NOT NULL,   -- HOLD | BUY_MORE | PARTIAL_SELL | FULL_SELL
  reasoning TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(position_id, date)
);
CREATE INDEX idx_reviews_position ON daily_reviews(position_id);
CREATE INDEX idx_reviews_date ON daily_reviews(date);
```

### Files cần tạo

```
src/db/
  database.ts     — singleton SQLite connection, khởi tạo schema
  schema.ts       — CREATE TABLE statements
  migrations.ts   — migrate từ JSON sang SQLite (chạy 1 lần)
```

### DB path

```env
DB_PATH=.data/dnse.db   # mặc định, có thể override qua .env
```

### Docker volume

SQLite chỉ là 1 file — mount vào volume để persist khi container restart:

```yaml
volumes:
  - ./.data:/app/.data
```



Với kịch bản theo dõi vị thế hàng ngày, alert thông minh cần được xây dựng **cùng lúc** với portfolio-review-graph, không phải sau:

- **Chỉ gửi Telegram khi có thay đổi** — so sánh `lastReviewResult` với kết quả hôm nay
- **Threshold biến động giá** — luôn alert nếu giá thay đổi > 5% trong ngày dù kết quả giống hôm qua
- **Format Telegram:** tóm tắt ngắn (3-4 dòng), có nút inline để xem chi tiết hoặc xác nhận

---

## Thứ tự triển khai (đã cập nhật)

```
Phase 1 — Nền tảng dữ liệu
  ├── Portfolio Tracker (CRUD vị thế, tính P&L)
  ├── Watchlist (CRUD danh sách theo dõi)
  └── Position lifecycle (open/closed, lastReviewResult)

Phase 2 — Graphs
  ├── monitor-graph (screening nhanh cho watchlist)
  ├── portfolio-review-graph (đánh giá vị thế)
  └── Alert logic (so sánh kết quả vs hôm qua, threshold giá)

Phase 3 — Automation + Integration
  ├── Cron scheduler (08:00 watchlist, 11:30 alert, 15:30 portfolio review)
  ├── Telegram bot + command handlers
  └── Formatter Telegram (Markdown, inline buttons)

Phase 4 — Polish
  └── Thống kê P&L theo tuần/tháng
```

---

## Kiến trúc tổng thể

```
Telegram Bot (chủ động)
    ├── /analyze → trading-graph (phân tích sâu)
    ├── /quick   → monitor-graph (nhanh)
    ├── /check   → monitor-graph × watchlist
    ├── /buy|sell|close → portfolio-tracker (ghi nhận vị thế)
    ├── /review HPG → portfolio-review-graph (đánh giá ngay)
    └── /portfolio → hiển thị tất cả vị thế + P&L

Cron Scheduler (tự động)
    ├── 08:00 → monitor-graph × watchlist → Telegram
    ├── 11:30 → monitor-graph × watchlist (chỉ alert nếu ALERT)
    └── 15:30 → portfolio-review-graph × tất cả Position "open"
                → so sánh vs hôm qua
                → Telegram chỉ khi có thay đổi hoặc giá biến động >5%

Memory Layer (.memory/)
    ├── trading/experiences      — kinh nghiệm phân tích cũ
    ├── portfolio/positions      — vị thế hiện tại (open/closed)
    ├── portfolio/reviews        — lịch sử review theo ngày
    └── watchlist/tickers        — danh sách theo dõi
```

---

## Ghi chú kỹ thuật

- **Grammy vs node-telegram-bot-api**: Grammy được đề xuất vì TypeScript native, middleware sạch
- **Cron**: `node-cron` hoặc tích hợp vào LangGraph scheduler nếu dùng LangGraph Cloud
- **Concurrency khi scan**: dùng `Promise.all` với giới hạn song song (tránh rate limit DNSE API) — ví dụ tối đa 3 mã cùng lúc
- **Webhook vs Polling**: polling cho dev, webhook cho production (cần HTTPS)
- **Graph reuse**: `monitor-graph` và `portfolio-review-graph` đều tái dùng `createAnalystsSubgraph()` đã có — không viết lại
