# DNSE TradingAgents - Hệ thống Phân tích Đầu tư Đa Agent

Hệ thống phân tích đầu tư chứng khoán Việt Nam với kiến trúc 5 tầng, được thiết kế theo [TradingAgents](https://github.com/TauricResearch/TradingAgents) gốc.

## Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TradingAgents Graph                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Market    │───▶│  Sentiment  │───▶│    News     │───▶│Fundamentals │  │
│  │   Analyst   │    │   Analyst   │    │   Analyst   │    │   Analyst   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│        │                  │                  │                  │            │
│        └──────────────────┴──────────────────┴──────────────────┘            │
│                                    │                                        │
│                                    ▼                                        │
│                    ┌───────────────────────────────┐                        │
│                    │      Investment Debate        │                        │
│                    │  ┌─────────┐   ┌─────────┐   │                        │
│                    │  │  Bull   │◄─▶│  Bear   │   │                        │
│                    │  │Researcher│   │Researcher│   │                        │
│                    │  └─────────┘   └─────────┘   │                        │
│                    └───────────────┬───────────────┘                        │
│                                    │                                        │
│                                    ▼                                        │
│                    ┌───────────────────────────────┐                        │
│                    │     Research Manager          │                        │
│                    │        (Deep LLM)             │                        │
│                    └───────────────┬───────────────┘                        │
│                                    │                                        │
│                                    ▼                                        │
│                    ┌───────────────────────────────┐                        │
│                    │           Trader              │                        │
│                    └───────────────┬───────────────┘                        │
│                                    │                                        │
│                                    ▼                                        │
│                    ┌───────────────────────────────┐                        │
│                    │       Risk Debate             │                        │
│                    │  ┌─────────┐ ┌─────────┐     │                        │
│                    │  │Aggressive│ │Conserv. │     │                        │
│                    │  └────┬────┘ └────┬────┘     │                        │
│                    │       │           │           │                        │
│                    │       ▼           ▼           │                        │
│                    │     ┌─────────────────┐      │                        │
│                    │     │     Neutral     │      │                        │
│                    │     └─────────────────┘      │                        │
│                    └───────────────┬───────────────┘                        │
│                                    │                                        │
│                                    ▼                                        │
│                    ┌───────────────────────────────┐                        │
│                    │    Portfolio Manager          │                        │
│                    │        (Deep LLM)             │                        │
│                    └───────────────┬───────────────┘                        │
│                                    │                                        │
│                                    ▼                                        │
│                              ┌──────────┐                                   │
│                              │   END    │                                   │
│                              └──────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cấu trúc thư mục

```
dnse/
├── src/
│   ├── index.ts                 # Entry point (chạy MCP hoặc Agent)
│   ├── mcp/                     # MCP Server - 10 tools DNSE
│   │   ├── index.ts             # MCP entry point
│   │   ├── server.ts            # HMAC signing, HTTP client
│   │   └── tools/               # 10 tools DNSE API
│   │
│   ├── agents/                  # TradingAgents - LangGraph.js
│   │   ├── analysts/            # 4 Analyst nodes
│   │   │   ├── market-analyst.ts
│   │   │   ├── sentiment-analyst.ts
│   │   │   ├── news-analyst.ts
│   │   │   └── fundamentals-analyst.ts
│   │   ├── researchers/         # Bull/Bear researchers
│   │   │   ├── bull-researcher.ts
│   │   │   └── bear-researcher.ts
│   │   ├── managers/            # Research Manager + Portfolio Manager
│   │   │   ├── research-manager.ts
│   │   │   └── portfolio-manager.ts
│   │   ├── trader/              # Trader
│   │   │   │   └── trader.ts
│   │   │   └── risk/             # Risk Team (3 analysts)
│   │   │       └── risk-debate.ts
│   │   ├── graph/                # LangGraph StateGraph
│   │   │   └── trading-graph.ts
│   │   ├── types/                # TypeScript types
│   │   │   └── index.ts
│   │   ├── prompts.ts            # System prompts
│   │   ├── mcp-client.ts         # MCP client wrapper
│   │   └── index.ts              # Entry point
│   └── package.json
│
├── firecrawl/                    # Firecrawl self-hosted
├── docker-compose.yaml           # Docker services
└── README.md
```

## Luồng chạy (Flow)

### 1. Analysts (Sequential)
```
Market Analyst → Sentiment Analyst → News Analyst → Fundamentals Analyst
```
- Mỗi analyst lấy dữ liệu từ snapshot + tools
- **News & Sentiment Analyst** ưu tiên tìm tin từ: CafeF, VnExpress, Vietstock, StockBiz
- Output: Báo cáo phân tích + Markdown table tóm tắt

### 2. Investment Debate (Conditional Loop)
```
Bull Researcher ↔ Bear Researcher (N rounds)
```
- Mỗi bên đưa ra luận điểm và phản biện
- Dựa trên báo cáo từ 4 analysts
- Kết thúc khi đạt max rounds

### 3. Research Manager
- Trọng tài giữa Bull/Bear
- Output: Investment Plan với Rating (Buy/Overweight/Hold/Underweight/Sell)
- Dùng Deep LLM

### 4. Trader
- Nhận Investment Plan từ Research Manager
- Output: Transaction Proposal (Action, Target Price, Stop Loss, Position Size)

### 5. Risk Debate (Conditional Loop)
```
Aggressive Analyst → Conservative Analyst → Neutral Analyst (N rounds)
```
- Mỗi bên phản biện về rủi ro
- Aggressive: Ủng hộ risk cao
- Conservative: Thận trọng, bảo vệ vốn
- Neutral: Cân bằng

### 6. Portfolio Manager
- Tổng hợp risk debate
- Output: FINAL TRADE DECISION (Approve/Reject/Modify)
- Dùng Deep LLM

## Tools

### MCP Tools (10 tools DNSE)
| Tool | Mô tả | Endpoint |
|------|-------|----------|
| `get_close_price` | Giá đóng cửa gần nhất | `GET /price/{symbol}/close` |
| `get_instruments` | Thông tin mã chứng khoán | `GET /instruments` |
| `get_secdef` | Giá trần/sàn/tham chiếu | `GET /price/{symbol}/secdef` |
| `get_ohlc_history` | Lịch sử nến OHLCV | `GET /price/ohlc` |
| `get_history_trades` | Lịch sử khớp lệnh | `GET /price/{symbol}/trades` |
| `get_latest_trades` | Khớp lệnh gần nhất | `GET /price/{symbol}/trades/latest` |
| `get_latest_quotes` | Bid/ask gần nhất | `GET /price/{symbol}/quotes/latest` |
| `get_market_working_dates` | Ngày làm việc | `GET /market/working-dates` |
| `get_foreign_trading` | Dữ liệu NĐT nước ngoài | `GET /price/{symbol}/foreign-trading` |
| `get_trading_session` | Phiên giao dịch | `GET /market/trading-session` |

### Web Search Tools (5 tools)
| Tool | Mô tả | Nguồn |
|------|-------|-------|
| `tavily_search` | Tìm kiếm web nhanh | Tavily API |
| `web_fetch` | Đọc URL | Native fetch |
| `firecrawl_scrape` | Scrape URL → markdown | Firecrawl |
| `firecrawl_search` | Tìm kiếm + nội dung | Firecrawl |
| `firecrawl_crawl` | Crawl website | Firecrawl |

## Agent Roles

| Agent | LLM | Nguồn dữ liệu | Nhiệm vụ |
|-------|-----|----------------|----------|
| **Market Analyst** | Quick | OHLC, giá, bid/ask | Phân tích kỹ thuật |
| **Sentiment Analyst** | Quick | CafeF, VnExpress, StockBiz, Reddit | Sentiment đa nguồn |
| **News Analyst** | Quick | CafeF, VnExpress, Investing.com | Tin tức, vĩ mô |
| **Fundamentals Analyst** | Quick | DNSE MCP | Tài chính, dòng tiền |
| **Bull Researcher** | Quick | Từ 4 analysts | Luận điểm MUA |
| **Bear Researcher** | Quick | Từ 4 analysts | Luận điểm BÁN |
| **Research Manager** | Deep | Bull vs Bear debate | Trọng tài, Investment Plan |
| **Trader** | Quick | Research Manager | Transaction Proposal |
| **Aggressive Analyst** | Quick | Trader proposal | Ủng hộ risk cao |
| **Conservative Analyst** | Quick | Trader proposal | Thận trọng, bảo vệ vốn |
| **Neutral Analyst** | Quick | Trader proposal | Cân bằng |
| **Portfolio Manager** | Deep | Risk debate | Duyệt cuối cùng |

## Nguồn tin tức Việt Nam

| Trang | URL | Loại tin |
|-------|-----|----------|
| **CafeF** | cafef.vn | Phân tích chuyên sâu, phân tích từ chuyên gia |
| **VnExpress** | vnexpress.net/kinh-doanh/chung-khoan | Tin nhanh thị trường, dòng tiền NĐTNN |
| **Vietstock** | voso.vn | Phân tích kỹ thuật, dữ liệu giá |
| **StockBiz** | stockbiz.vn | Cộng đồng nhà đầu tư, thảo luận forum |
| **Tin Nhanh CK** | tinnhanhchungkhoan.vn | Tin real-time, cảnh báo thị trường |
| **Investing.com** | investing.com/vi | Dữ liệu quốc tế, chỉ số vĩ mô |

**Cách tìm kiếm:**
```bash
# Tìm tin CafeF về HPG
tavily_search("HPG site:cafef.vn")

# Tìm tin VnExpress về thị trường
tavily_search("thị trường chứng khoán site:vnexpress.net")

# Đọc chi tiết từ CafeF
firecrawl_scrape("https://cafef.vn/tin-tai-chinh.chn")
```

## Cài đặt

```bash
# 1. Clone và cài dependencies
cd /Users/cuongpham/Deverlop/typescript/dnse

# 2. Cài MCP Server
cd mcp && bun install
cp .env.example .env  # Thêm API keys

# 3. Cài Agent
cd ../agent && bun install
cp .env.example .env  # Thêm API keys (xem hướng dẫn bên dưới)

# 4. Start Firecrawl (nếu cần)
cd .. && docker compose up -d
```

## Cấu hình LLM

### Providers hỗ trợ

| Provider | Quick Model | Deep Model | API Key |
|----------|-------------|------------|---------|
| **NVIDIA NIM** | Nemotron 70B, Llama 3.1 70B | Nemotron 70B | `NVIDIA_API_KEY` |
| **OpenAI** | GPT-4o-mini | GPT-4o | `LLM_API_KEY` |
| **Anthropic** | Claude 3.5 Haiku | Claude Sonnet 4 | `LLM_API_KEY` |
| **Google** | Gemini 2.0 Flash | Gemini 2.5 Pro | `LLM_API_KEY` |
| **Ollama** | Llama 3.1 8B | Llama 3.1 70B | Không cần |
| **DeepSeek** | DeepSeek V3 | DeepSeek V3 | `LLM_API_KEY` |

### Quick vs Deep Model

- **Quick Model**: Dùng cho Analysts, Researchers, Trader (nhanh, chi phí thấp)
- **Deep Model**: Dùng cho Research Manager, Portfolio Manager (chậm hơn, chính xác hơn)

### Cấu hình trong .env

```bash
# Chọn provider
LLM_PROVIDER=nvidia

# Quick model (cho analyst)
QUICK_MODEL=Nemotron 70B

# Deep model (cho research manager)
DEEP_MODEL=Nemotron 70B

# API Key
LLM_API_KEY=your_api_key_here
```

## Sử dụng

### Khởi chạy nhanh

```bash
# Khởi chạy tất cả (MCP + Agent)
bun run start.ts

# Hoặc chạy từng service
bun run start.ts --mcp        # Chỉ chạy MCP Server
bun run start.ts --agent      # Chỉ chạy Agent
bun run start.ts --firecrawl  # Chỉ chạy Firecrawl (Docker)
bun run start.ts --docker     # Chạy tất cả qua Docker Compose
```

### Khởi chạy thủ công

```bash
# Terminal 1: Start MCP Server
cd mcp && bun run start

# Terminal 2: Start Agent
cd agent && bun run start
```

### Lệnh trong Agent

```bash
# Phân tích mã cổ phiếu
> analyze HPG
> analyze VCB
> analyze VNM

# Switch model
> switch GPT-4o-mini        # Switch quick model
> switch-deep Claude Sonnet 4  # Switch deep model

# Xem models
> models                     # Liệt kê tất cả models
> models-provider nvidia     # Models theo provider
> current                    # Models đang dùng

# Thoát
> exit
```

### Switch Model

```bash
# Switch sang OpenAI
> switch GPT-4o-mini
> switch-deep GPT-4o

# Switch sang Anthropic
> switch Claude 3.5 Haiku
> switch-deep Claude Sonnet 4

# Switch sang Google
> switch Gemini 2.0 Flash
> switch-deep Gemini 2.5 Pro

# Switch sang Ollama (local)
> switch Llama 3.1 8B
> switch-deep Llama 3.1 70B
```

## Ví dụ output

```
============================================================
KẾT QUẢ PHÂN TÍCH
============================================================
FINAL TRADE DECISION: APPROVE HPG
Action: BUY
Target: 28.5
Stop Loss: 24.0
Position: 3-5% portfolio
Timeframe: 1-3 tháng

Reasoning: Dựa trên phân tích kỹ thuật xu hướng tăng, dòng tiền NĐTNN mua ròng,
tin tức tích cực về kết quả kinh doanh Q1/2026.

Risk Adjustments: Giảm vị thế từ 5% xuống 3% do thị trường biến động.
============================================================

⚠️ LƯU Ý: Đây là phân tích tham khảo, không phải lời khuyên tài chính.
   Hãy tham vấn cố vấn tài chính trước khi quyết định.
```

## Tech Stack

- **Runtime:** Bun
- **Orchestration:** LangGraph.js (StateGraph + Conditional Edges)
- **Checkpoint:** @langchain/langgraph-checkpoint-sqlite
- **MCP:** @modelcontextprotocol/sdk
- **LLM:** LangChain + Multi-provider support
  - NVIDIA NIM (OpenAI-compatible)
  - OpenAI
  - Anthropic
  - Google Gemini
  - Ollama (Local)
  - DeepSeek
- **Web Search:** Tavily + Firecrawl (self-hosted)
- **Language:** TypeScript
- **Container:** Docker + Docker Compose
