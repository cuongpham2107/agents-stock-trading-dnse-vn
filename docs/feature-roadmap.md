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

## 3. Portfolio Tracker Graph

### Mục tiêu
- Ghi nhận vị thế thực tế (mua ngày nào, giá bao nhiêu, số lượng bao nhiêu)
- Mỗi ngày **tự động** đánh giá lại: nên giữ, mua thêm, hay bán
- Tính toán P&L theo thời gian thực
- Chỉ báo Telegram khi **trạng thái thay đổi** so với hôm trước

### Vòng đời một vị thế

```
Mở vị thế (/buy HPG 1000 20.8)
    ↓
Theo dõi tự động hàng ngày
  - Cron 15:30 chạy portfolio-review-graph cho vị thế này
  - Nếu kết quả khác hôm qua (HOLD→SELL hoặc HOLD→BUY_MORE): gửi Telegram
  - Nếu kết quả giống hôm qua (HOLD→HOLD): im lặng, không spam
    ↓
Đóng vị thế (một trong hai cách):
  a) Graph ra FULL_SELL → gửi Telegram khuyến nghị → user xác nhận bằng /close HPG
  b) User tự tay bán ở sàn và gõ /close HPG để cập nhật hệ thống
    ↓
Vị thế status = "closed" → cron bỏ qua → dừng theo dõi
```

**Quy tắc rõ ràng:**
- Graph **không tự thực hiện giao dịch thật** — chỉ ra khuyến nghị
- Người dùng quyết định tay sau khi nhận báo cáo
- `/close HPG` hoặc `/sell HPG` phải được gõ thủ công để đóng vị thế

### Dữ liệu vị thế

```typescript
interface Position {
  ticker: string
  quantity: number         // số cổ phiếu đang giữ
  avgCost: number          // giá vốn bình quân
  buyDate: string          // ngày mở vị thế
  status: "open" | "closed"
  lastReviewDate: string   // ngày review cuối
  lastReviewResult: "HOLD" | "BUY_MORE" | "PARTIAL_SELL" | "FULL_SELL"
  lastUpdated: string
}
```

### Quy tắc đánh giá lại

| Điều kiện | Hành động |
|---|---|
| Mua hôm nay, cùng ngày | **Không review** — chưa có đủ dữ liệu biến động |
| Từ ngày hôm sau trở đi | Bắt đầu chu kỳ review hàng ngày lúc 15:30 |
| Kết quả = kết quả hôm qua | Im lặng, không gửi Telegram |
| Kết quả khác hôm qua | Gửi Telegram ngay |
| Status = "closed" | Bỏ qua hoàn toàn |

### `portfolio-review-graph` — thiết kế

```
load_position
    ↓
fetch_data (dữ liệu thị trường hôm nay)
    ↓
[market_analyst, news_analyst] (song song — tái dùng analysts subgraph)
    ↓
position_evaluator
  Input: vị thế (giá vốn, số lượng, ngày mua) + dữ liệu thị trường hôm nay
  So sánh: giá hiện tại vs giá vốn, P&L%, xu hướng, news sentiment
  Output: HOLD | BUY_MORE | PARTIAL_SELL | FULL_SELL + lý do + mức giá đề xuất
    ↓
compare_with_yesterday
  Nếu giống hôm qua → flag "no_change" → không gửi Telegram
  Nếu khác → flag "changed" → gửi Telegram
    ↓
save_review_result (cập nhật lastReviewDate, lastReviewResult trong Position)
```

**Khác biệt với trading-graph:**

`trading-graph` hỏi: *"Có nên vào lệnh không?"*

`portfolio-review-graph` hỏi: *"Tôi đang giữ 1000 cổ HPG giá vốn 20.8 (đang lãi/lỗ X%), với tình hình hôm nay tôi nên làm gì?"* — prompt phải bao gồm thông tin vị thế cụ thể.

### Files cần tạo

```
src/portfolio/
  tracker.ts                    — CRUD vị thế (lưu vào .memory/portfolio/)
  portfolio-review-graph.ts     — graph đánh giá vị thế
  agents/
    position-evaluator.ts       — agent so sánh vị thế vs thị trường
```

---

## 4. Alert thông minh (tích hợp vào Phase 2, không để đến Phase 4)

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
