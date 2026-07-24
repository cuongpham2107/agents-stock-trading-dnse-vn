# TradingAgents - Tài liệu tham khảo

## Tóm tắt điều hành

TradingAgents là một framework giao dịch chứng khoán đa-tác-nhân dựa trên LLM, mô phỏng môi trường làm việc nhóm của một công ty giao dịch chuyên nghiệp. Mục tiêu của bài báo là sử dụng hàng loạt tác nhân LLM chuyên biệt (chuyên viên phân tích cơ bản, phân tích tâm lý, phân tích tin tức, phân tích kỹ thuật, các nhà nghiên cứu (bullish/bearish), và nhà quản lý rủi ro) để tích hợp đa dạng thông tin tài chính và tạo ra quyết định giao dịch tốt hơn.

Các tác nhân này giao tiếp qua "giao thức giao tiếp có cấu trúc" nhằm tránh tình trạng thông tin bị biến đổi qua nhiều vòng trao đổi (hiện tượng telephone). Kết quả là TradingAgents xây dựng được một môi trường hợp tác phức tạp, nơi các chuyên gia thảo luận và cân nhắc lẫn nhau trước khi ra quyết định.

**Kết quả thí nghiệm:**
- Lợi nhuận tích lũy cao nhất ~23.2% (so với ~17% của phương pháp tốt nhất)
- Sharpe Ratio đến 8.21 (so với ~2-3 ở phương pháp khác)
- Vượt trội so với buy-and-hold và các phương pháp chỉ báo truyền thống

## Phương pháp và nền tảng lý thuyết

TradingAgents mô phỏng quy trình ra quyết định của một nhóm quants chuyên nghiệp bằng bảy vai trò rõ ràng:

### 1. Fundamental Analyst (Chuyên gia phân tích cơ bản)
Đánh giá báo cáo tài chính, EPS, tỷ lệ ROE… để xác định giá trị nội tại của công ty.

### 2. Sentiment Analyst (Chuyên gia phân tích tâm lý)
Thu thập và xử lý tin trên mạng xã hội (Reddit, Twitter…), tính điểm tâm lý, đánh giá xu hướng "đám đông" trong ngắn hạn.

### 3. News Analyst (Chuyên gia tin tức)
Theo dõi bản tin kinh tế, chính sách toàn cầu, phân tích tác động chuỗi sự kiện vĩ mô lên thị trường.

### 4. Technical Analyst (Chuyên gia kỹ thuật)
Thực thi mã tính toán chỉ báo kỹ thuật (MACD, RSI, Bollinger…), phát hiện mẫu giá và xu hướng kĩ thuật.

### 5. Researcher Team (Nhóm nghiên cứu bullish/bearish)
Gồm các tác nhân đem đến góc nhìn khác nhau:
- **Bullish**: Tập trung nêu các yếu tố tích cực
- **Bearish**: Tập trung nhược điểm và rủi ro
- Họ tranh luận nhiều vòng dựa trên các báo cáo từ Analyst Team
- Một tác nhân điều phối (facilitator) chọn góc nhìn chung

### 6. Trader Agents (Các nhà giao dịch)
Nhóm này bao gồm nhiều nhà giao dịch với mức độ chịu rủi ro khác nhau:
- **Mạo hiểm**: Chấp nhận rủi ro cao để có lợi nhuận cao
- **Trung bình**: Cân bằng giữa lợi nhuận và rủi ro
- **Thận trọng**: Ưu tiên bảo vệ vốn

### 7. Risk Management Team (Quản lý rủi ro)
- Liên tục kiểm soát danh mục đầu tư
- Đánh giá biến động, thanh khoản và rủi ro
- Đưa ra khuyến nghị (đặt lệnh chặn lỗ, đa dạng hoá)
- "Giám sát" các quyết định giao dịch
- Trình báo cáo cho Portfolio Manager phê duyệt cuối cùng

## Sơ đồ luồng

```
┌─────────────────────────────────────────────────────────────────┐
│                    TradingAgents Flow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Fundamental │  │  Sentiment  │  │    News     │            │
│  │  Analyst    │  │  Analyst    │  │  Analyst    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                │                │                     │
│         │    ┌───────────┴───────────┐    │                     │
│         │    │                       │    │                     │
│         │    │                       │    │                     │
│  ┌──────┴────┴───────────────────────┴────┴──────┐              │
│  │              Technical Analyst                │              │
│  └──────────────────────┬────────────────────────┘              │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Researcher Team (Bull/Bear Debate)            │   │
│  └───────────────────────┬─────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Trader Agents                              │   │
│  │  (Risk-Seeking / Risk-Neutral / Risk-Averse)            │   │
│  └───────────────────────┬─────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Risk Management Team                          │   │
│  └───────────────────────┬─────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Portfolio Manager (Phê duyệt cuối cùng)       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Giao tiếp có cấu trúc

Thay vì trao đổi tự do bằng ngôn ngữ tự nhiên, mỗi tác nhân xuất báo cáo dạng có cấu trúc theo vai trò của mình:

- **Analyst Team**: Tạo "báo cáo phân tích" ngắn gọn chứa chỉ số chính và kết luận
- **Trader Agents**: Tạo "báo cáo quyết định" giải thích lý do vào/ra lệnh
- **Các tác nhân chỉ nói chuyện ngôn ngữ tự nhiên trong tranh luận nội bộ** (hội thoại đa vòng giữa bullish/bearish hoặc risk-seeking/averse)

Thiết kế này dựa trên khuôn khổ **ReAct (Reasoning+Acting)**, giúp ghi lại quá trình tư duy (log) và đồng bộ trạng thái toàn cục.

Giao thức này hạn chế việc "thông tin bị biến dạng" qua nhiều vòng hội thoại, giúp giữ mọi đầu vào quan trọng luôn hiện diện và minh bạch.

## Lựa chọn mô hình nền

TradingAgents sử dụng kết hợp mô hình LLM "nhanh" và "sâu" dựa trên nhiệm vụ:

| Loại mô hình | Nhiệm vụ | Ví dụ |
|-------------|----------|-------|
| **Quick-thinking** | Tóm tắt, truy xuất dữ liệu, chuyển đổi bảng thành văn bản | GPT-4o-mini, GPT-4o |
| **Deep-thinking** | Viết báo cáo, ra quyết định, phân tích dữ liệu chứng khoán | GPT-4o đầy đủ, o1-preview |

- Mọi **Analyst node** dựa vào mô hình sâu để phân tích chắc chắn
- **Trader/Researcher** dùng mô hình sâu để tạo ra insight có luận cứ

Thiết kế này cho phép chạy hoàn toàn qua API (không cần GPU) và dễ dàng thay thế backbone (ví dụ mô hình mã nguồn mở) mà không phụ thuộc phần cứng riêng.

## Điểm mới so với các công trình trước

| Điểm mới | Mô tả |
|----------|-------|
| **Mô phỏng vai trò chuyên môn** | Chi tiết vai trò trong công ty giao dịch |
| **Giao tiếp có cấu trúc** | Giảm mất mát thông tin qua các vòng hội thoại |
| **Quản lý rủi ro** | Đưa nhóm quản lý rủi ro và cá nhân hóa theo hồ sơ rủi ro |

Hợp tác đa tác nhân này mở rộng khả năng xử lý thông tin và giải thích ra quyết định, khác hẳn các mô hình học sâu "hộp đen" truyền thống.

## Áp dụng vào dự án DNSE TradingAgents

Dựa trên tài liệu này, dự án DNSE TradingAgents đã triển khai:

| Vai trò trong bài báo | Triển khai trong DNSE |
|----------------------|----------------------|
| Fundamental Analyst | `fundamentals-analyst.ts` |
| Sentiment Analyst | `social-analyst.ts` |
| News Analyst | `news-analyst.ts` |
| Technical Analyst | `market-analyst.ts` |
| Bullish Researcher | `bull-researcher.ts` |
| Bearish Researcher | `bear-researcher.ts` |
| Risk-Seeking | `risky-analyst.ts` |
| Risk-Neutral | `neutral-analyst.ts` |
| Risk-Averse | `safe-analyst.ts` |
| Portfolio Manager | `portfolio-manager.ts` |
