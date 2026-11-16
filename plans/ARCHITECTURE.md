# Kiến trúc hợp nhất: Chat/Dịch đa nhà cung cấp với Prompt Pipeline

Ba nhãn trạng thái dùng trong tài liệu:

- **[Có code]**: đã viết trong cuộc trò chuyện (`schema.js`, `routing.js`, `example.jsx`), chưa chạy thử.
- **[Đề xuất]**: thiết kế mới, chưa có code.
- **[Workmate]**: lấy từ tài liệu Workmate AI do người dùng cung cấp; chưa đọc mã nguồn của họ nên không xác nhận cách cài đặt thực tế.

---

## 1. Mục tiêu

Ứng dụng chat và dịch chạy trên trình duyệt:

- Mỗi cuộc trò chuyện có phong cách riêng, đổi model giữa chừng không mất phong cách.
- Gọi nhiều nhà cung cấp AI qua một lớp chung, tự xoay key và chuyển nguồn dự phòng khi lỗi.
- Prompt dựng theo lớp có điều kiện, an toàn trước chèn chuỗi và ổn định để cache được.

## 2. Kiến trúc tổng thể

```
┌────────────────────────────────────────────────────────────┐
│ L1  UI (React)                                [Có code]    │
│     <Chat> · useRoutedChat · useRoutePreview               │
├────────────────────────────────────────────────────────────┤
│ L2  Prompt Pipeline                           [Đề xuất]    │
│     Resolver → Aggregator → Layers → Tokens → Post-appends │
├────────────────────────────────────────────────────────────┤
│ L3  Cache                                     [Đề xuất]    │
├────────────────────────────────────────────────────────────┤
│ L4  Router                                    [Có code]    │
│     Planner · Executor · Error classifier · Health         │
├────────────────────────────────────────────────────────────┤
│ L5  Adapters + Output Normalization     [Có code / Đề xuất]│
├────────────────────────────────────────────────────────────┤
│ L6  Lưu trữ Dexie                             [Có code]    │
└────────────────────────────────────────────────────────────┘
          Mỗi tầng chỉ gọi tầng ngay dưới nó
```

Bản đã có code hiện gộp L2 vào `buildContext`, chưa có L3, và L5 chưa có bước chuẩn hóa đầu ra.

## 3. Dữ liệu (L6) [Có code]

| Bảng                      | Vai trò                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `connections`             | Key, baseUrl, format, priority, isActive, health (`failCount`, `cooldownUntil`, `lastError`) |
| `combos`                  | Tên model ảo → danh sách `{provider, model}` theo thứ tự                                     |
| `styleProfiles`           | Phong cách chat hoặc cấu hình dịch (glossary, tone, giữ nguyên)                              |
| `conversations`           | `styleProfileId`, `styleOverride`, `target`, `params`                                        |
| `messages`                | Lịch sử, index `[conversationId+createdAt]`                                                  |
| `usageLogs`, `usageDaily` | Log từng lần gọi và tổng hợp theo ngày                                                       |
| `settings`                | Cài đặt chung                                                                                |

## 4. Hợp đồng giữa các tầng

```
Request chuẩn  : { system, messages[{role: user|assistant, content}], params }
Attempt        : { connection, provider, model }
Response chuẩn : { text, usage?: {promptTokens, completionTokens, cost} }
Lỗi chuẩn      : Error { status, retryAfterMs? }
```

Chi tiết riêng của provider (role `model` của Gemini, header, tên field token) chỉ tồn tại trong adapter.

## 5. Prompt Pipeline (L2) [Đề xuất, tham khảo Workmate]

### 5.1 Các giai đoạn

| #   | Giai đoạn        | Việc làm                                                                                                                                 |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Resolve**      | Chọn prompt gốc theo thứ tự ưu tiên: styleOverride của cuộc trò chuyện → profile → mặc định                                              |
| 2   | **Aggregate**    | Gom ngữ cảnh: lịch sử, glossary khớp đoạn đang dịch, metadata nếu có (tiêu đề, mô tả)                                                    |
| 3   | **Layers**       | Thêm quy tắc theo điều kiện của đầu vào (xem 5.2)                                                                                        |
| 4   | **Interpolate**  | Thay placeholder trong **template** (`{{targetLanguage}}`, `{{input}}`...); trường rỗng thay bằng giá trị mô tả như "No title available" |
| 5   | **Post-appends** | Nối nội dung có nguồn từ người dùng **sau** khi thay token: glossary khớp, đoạn ngữ cảnh                                                 |
| 6   | **Cache lookup** | Có thì trả về, không thì sang Router                                                                                                     |
| 7   | **Execute**      | Router gọi provider                                                                                                                      |
| 8   | **Normalize**    | Làm sạch đầu ra (xem mục 8)                                                                                                              |
| 9   | **Store**        | Lưu cache, messages, usage                                                                                                               |

### 5.2 Lớp prompt có điều kiện

Mỗi lớp tự quyết định có thêm vào hay không dựa trên đầu vào:

```
[Prompt gốc: BASE_RULES + prompt dịch/profile + styleOverride]
   ▼ nếu là batch       → quy tắc dấu phân cách và sentinel
   ▼ nếu có HTML marker → quy tắc giữ nguyên marker
   ▼ nếu có công thức   → quy tắc giữ nguyên token atom
   ▼ Interpolate token
   ▼ Post-appends: glossary khớp → ngữ cảnh xung quanh → hợp đồng đầu ra có cấu trúc
```

### 5.3 Hai quy tắc quan trọng

1. **Thay token trước, nối nội dung người dùng sau.** Nếu glossary chứa chuỗi như `{{input}}` mà bị nối trước khi thay token, nó có thể làm hỏng cấu trúc prompt. Lịch sử và tin nhắn mới cũng không đi qua bước thay token.
2. **Chỉ chèn glossary khớp đoạn đang dịch.** Không khớp thì prompt giữ nguyên từng byte như khi không có glossary, nên cache không bị vỡ. Workmate dùng Aho-Corasick để tìm khớp; với glossary nhỏ, tìm chuỗi đơn giản có thể đủ (đánh giá của tác giả tài liệu này, chưa đo).

### 5.4 Thứ tự ưu tiên

```
Prompt : BASE_RULES < prompt dịch < profile.systemPrompt < conversation.styleOverride
Params : profile.params < conversation.params < params truyền vào send()
```

Thứ tự `messages` gửi đi: few-shot của profile → lịch sử → tin mới.

## 6. Cache (L3) [Đề xuất]

- Phù hợp nhất với **dịch** (cùng đoạn, cùng cấu hình thì cùng kết quả). Với chat nhiều lượt, lịch sử luôn đổi nên cache ít giá trị.
- Khóa cache nên gồm: văn bản đầu vào, target/model, hash của system prompt cuối cùng, params. Hash prompt cuối cùng nên tạo **sau** bước post-appends, để thay đổi glossary khớp làm đổi khóa.
- Lưu trong bộ nhớ và IndexedDB. Cần chính sách hết hạn và dung lượng tối đa (chưa thiết kế chi tiết).
- Với `temperature` cao, cache làm mất tính đa dạng; chỉ cache khi profile cho phép.

## 7. Router (L4) [Có code]

| Thành phần       | Việc làm                                                                                                                                            | Hàm               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Planner          | target → danh sách attempt: model theo thứ tự combo, trong mỗi model thử connection theo priority, xoay vòng cùng priority, bỏ cooldown, loại trùng | `buildPlan`       |
| Executor         | Vòng lặp thử, ghi log, cập nhật health                                                                                                              | `runWithFallback` |
| Error classifier | Lỗi → hành động                                                                                                                                     | `classifyError`   |
| Health tracker   | `failCount`, `cooldownUntil`, backoff gấp đôi, reset khi thành công                                                                                 | trong executor    |

### Xử lý lỗi

| Tình huống         | Hành động                               | Cooldown                                         |
| ------------------ | --------------------------------------- | ------------------------------------------------ |
| 401/403            | Sang connection khác                    | 1 giờ                                            |
| 429                | Sang connection khác                    | `retryAfterMs` hoặc 60s                          |
| 404                | Bỏ model đó ở các connection còn lại    | không                                            |
| 400/422            | Dừng hẳn                                | không                                            |
| 5xx, mạng, timeout | Sang connection khác                    | 15s, gấp đôi mỗi lần lỗi liên tiếp, tối đa 1 giờ |
| Người dùng hủy     | Ném `AbortError`, không phạt connection | không                                            |

Các ngưỡng là giá trị đề xuất, cần chỉnh theo hạn mức thực tế. Chọn model cố định (`provider/model`) thì không có fallback sang model khác; muốn vậy cần cho `buildPlan` nhận nhiều target.

### Vòng đời một connection

```
active ──lỗi──► cooling (cooldownUntil > now)
  ▲                  │ hết hạn
  └─ thành công: failCount = 0 ◄─┘ (lượt kế tiếp là lượt thăm dò)
```

`isActive = 0` là tắt thủ công, độc lập với cooldown.

## 8. Adapter và chuẩn hóa đầu ra (L5)

**Adapter** [Có code: gemini, openai-compatible; anthropic chưa có]: map request → gọi mạng (nhận `signal`) → map response → chuẩn hóa lỗi (đọc `Retry-After`). Tra theo `connection.format`; DeepSeek, Groq, OpenRouter dùng chung adapter `openai`.

**Chuẩn hóa đầu ra** [Đề xuất, tham khảo Workmate], chạy sau `execute`:

- Bỏ khối `<think>...</think>` của model suy luận.
- Nhận sentinel (ví dụ `{{NO_TRANSLATION_NEEDED}}`) và chuyển thành chuỗi rỗng hoặc bỏ qua.
- Với dịch HTML: kiểm tra marker còn nguyên; nếu mất, coi là lỗi của lượt đó.
- Với đầu ra có cấu trúc (JSON): kiểm tra schema, lỗi thì thử lại hoặc báo lỗi.

**Vercel AI SDK** là lựa chọn thay cho adapter tự viết (Workmate dùng `generateText`). SDK xử lý việc gọi một provider, không xử lý xoay key, cooldown, fallback nên Router vẫn nằm phía trên, `execute` sẽ gọi SDK. Chưa kiểm chứng cách SDK trả lỗi và `Retry-After` để biết có đủ cho `classifyError` hay không.

## 9. Vòng đời một lượt `send(text, {target?, params?})`

```
[1] Nhận input, tạo AbortController
[2] Nạp conversation, styleProfile, lịch sử
[3] Pipeline: Resolve → Aggregate → Layers → Interpolate → Post-appends
[4] Lưu tin nhắn user
[5] Cache lookup ── hit → [9]
[6] buildPlan(target ?? conv.target)
[7] Execute (vòng fallback)
     ├ thành công → tiếp
     └ lỗi → classifyError → next-connection / next-model / abort
         hết attempt → ném "Tất cả connection đều thất bại" (kèm errors[])
[8] Normalize đầu ra, lưu cache
[9] Ghi nhận: reset health, logUsage, lưu tin trả lời (kèm provider/model), cập nhật conversation
[10] Trả về UI: text + attempt đã dùng, hoặc error kèm chi tiết
```

## 10. Nguyên tắc thiết kế

- Cấu hình là dữ liệu: thêm provider cùng giao thức chỉ cần thêm một dòng `connections`.
- Định dạng trung gian: chi tiết provider không lọt ra ngoài adapter.
- Gọi mạng được tiêm vào (`execute`): router kiểm thử được mà không cần mạng.
- Health lưu cùng connection: cooldown còn nguyên sau khi tải lại trang.
- Phong cách gắn với cuộc trò chuyện, không gắn với provider.
- Prompt tất định: cùng đầu vào và cấu hình thì cùng prompt, để cache hoạt động.

## 11. Bảo mật và rủi ro

- API key lưu **plaintext** trong IndexedDB; mọi script cùng origin (kể cả lỗi XSS, extension) đọc được. Chỉ phù hợp app cá nhân/local. Nếu triển khai cho nhiều người, nên chuyển L3–L5 lên backend.
- Gọi trực tiếp từ trình duyệt có thể bị CORS chặn (chưa kiểm chứng từng provider).
- Nội dung người dùng chèn vào prompt (glossary, ngữ cảnh) phải đi sau bước thay token (mục 5.3).
- Glossary hoặc văn bản đầu vào có thể chứa chỉ dẫn nhằm đánh lừa model (prompt injection); việc nối đúng thứ tự không ngăn được chuyện này, cần thêm quy tắc trong system prompt và kiểm tra đầu ra.
