# Kiến trúc Hợp nhất: AI Gateway & Chat/Translation Prompt Pipeline

Tài liệu này mô tả kiến trúc tổng thể của hệ thống **AI Gateway** kết hợp cùng **Chat & Translation Prompt Pipeline**. Hệ thống được xây dựng theo chuẩn **Clean Architecture (Hexagonal)** với **ba entrypoint công khai**: lõi runtime-agnostic (`index.ts`), routing-only (`routing.ts`), và Node-only server (`server/index.ts` — Hono + mã hoá + Drizzle).

---

## 1. Mục tiêu và Nguyên tắc Cốt lõi

1. **Phong cách & Ngữ cảnh độc lập Model (Context Isolation)**:
   - Cuộc trò chuyện lưu giữ StyleProfile và các điều kiện dịch riêng biệt. Khi đổi model giữa chừng (ví dụ từ Claude sang Gemini hay DeepSeek), prompt vẫn giữ nguyên phong cách, glossary và luật lệ.
2. **Deterministic Prompt Pipeline & Anti-Injection**:
   - Pipeline 5 giai đoạn: _Resolve → Aggregate → Layers → Interpolate → Post-appends_.
   - Nguyên tắc bất di bất dịch: **Thay token trong template trước, chèn nội dung user sau**. Tránh tình trạng glossary hoặc user text chứa `{{token}}` làm vỡ hoặc hack cấu trúc prompt.
3. **Bộ nhớ đệm thông minh (Deterministic Cache)**:
   - Cache key được băm SHA-256 từ _(finalSystemPrompt + userMessage + targetModel + params)_ sau giai đoạn post-appends.
   - Tiết kiệm 100% token và độ trễ đối với các đoạn văn bản/dịch lặp lại.
4. **Account Fallback & Cross-Provider Routing**:
   - Credential pool: xoay API keys/accounts theo priority, cooldown exponential backoff (2s–4 min) trên 429 / 503 / 401.
   - Provider routes: `fallbackModels` + `executeGatewayAttempts` / `GatewayHealthRegistry` chuyển sang provider/model khác khi lỗi có thể thử lại.
5. **Universal Wire Translation & Web Session Support**:
   - Client gửi OpenAI, Claude, Gemini hoặc Ollama; gateway dịch hai chiều sang format provider đích.
   - API key chính thức và Web Session (ChatGPT, DeepSeek, Perplexity, Gemini, Muse Web).
6. **Bảo mật qua port `SecretCipher`**:
   - Triển khai Node: AES-256-GCM + HKDF-SHA256; mask `sk-a...7890` khi đọc. Host browser có thể cung cấp cipher riêng hoặc không lưu secret trong process.
7. **Tái sử dụng không sửa lõi**:
   - Composition root của host (hoặc `createGatewayApp`) inject registry, cipher, `readEnvKey`. Không import module của host app vào thư viện.

---

## 2. Mô hình Kiến trúc 6 Tầng (6-Layer Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1  UI / Client Layer                                                  │
│     <Chat> · useRoutedChat · useRoutePreview · Translation Editor      │
├────────────────────────────────────────────────────────────────────────┤
│ L2  Prompt Pipeline (`pipeline/promptPipeline.ts`)                     │
│     Resolver → Aggregator → Conditional Layers → Interpolate → PostApp │
├────────────────────────────────────────────────────────────────────────┤
│ L3  Cache Layer (`pipeline/promptCache.ts`)                            │
│     PromptCachePort: InMemoryPromptCache (LRU+TTL) / Dexie / Redis     │
├────────────────────────────────────────────────────────────────────────┤
│ L4  AI Gateway Engine & Router                                         │
│     InferenceService · application/routing/* · CredentialResolver      │
│     AccountFallbackService · RTK · Quota                               │
├────────────────────────────────────────────────────────────────────────┤
│ L5  Adapters & Output Normalization                                    │
│     Providers · Translators · OutputNormalizer                         │
├────────────────────────────────────────────────────────────────────────┤
│ L6  Security & Storage (ports + adapters)                              │
│     SecretCipher · InMemory repos (core) · Envelope + Drizzle (server) │
└────────────────────────────────────────────────────────────────────────┘
```

### Bản đồ quan hệ các module trong Codebase:

| Tầng                  | Thành phần                                                                                              | Trách nhiệm                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **L1: UI**            | Host app (extension sidepanel, Next.js UI, …)                                                           | Gửi `send` / gọi HTTP / hiển thị stream & attempt         |
| **L2: Pipeline**      | `pipeline/promptPipeline.ts`                                                                            | Biên dịch system prompt, glossary, luật điều kiện         |
| **L3: Cache**         | `pipeline/promptCache.ts`                                                                               | SHA-256 (`crypto.subtle`) + LRU/TTL qua `PromptCachePort` |
| **L4: Engine/Router** | `application/inferenceService.ts`, `application/routing/`                                               | Quota, RTK, credential + **cross-provider** fallback      |
| **L5: Adapters**      | `adapters/providers/`, `pipeline/outputNormalizer.ts`                                                   | Gọi upstream, dịch wire format, chuẩn hoá output          |
| **L6: Security/DB**   | Port `SecretCipher`; SQLite (`db/sqlite` + `db/schema`) mặc định trên server; `db/memory` cho test/core | Mã hoá key, lưu tenant/credential/ledger                  |

---

## 3. Vòng đời Chi tiết của Một Lượt `send(text, { target?, params? })`

```
 [1] Nhận Input (text, target, params, options)
      └─ Khởi tạo AbortController & liên kết signal
  │
 [2] Nạp Context
      └─ Nạp conversation, styleProfile (glossary, tone, rules), history
  │
 [3] Prompt Pipeline
      ├─ Giai đoạn 1: Resolve (Ưu tiên: Base Rules < Profile System < StyleOverride)
      ├─ Giai đoạn 2: Aggregate (Lọc glossary khớp đoạn text, gom history, metadata)
      ├─ Giai đoạn 3: Conditional Layers (Batch sentinel, HTML markers, Math formula, JSON schema)
      ├─ Giai đoạn 4: Interpolate (Thay các biến {{targetLanguage}}, {{tone}} trong template)
      └─ Giai đoạn 5: Post-appends (Nối glossary khớp và user input vào sau - Chống Injection)
  │
 [4] Lưu Tin nhắn User (nếu có Message Repository)
  │
 [5] Cache Lookup (L3)
      ├─ Tạo Deterministic Key: SHA-256(finalPrompt + userMessage + target + params)
      └─ HIT ──► [9] (Bỏ qua gọi AI, lấy kết quả cache ngay tức thì)
         MISS ── tiếp tục [6]
  │
 [6] Build Plan & Model Resolution (L4)
      └─ Virtual Combo / Model target → Danh sách attempts (Credentials sắp theo priority, loại bỏ cooldown)
  │
 [7] Execute vòng Fallback (InferenceService)
      ├─ Quota Reservation (Trừ credit tạm tính)
      ├─ RTK Token-Killer (Nén khoảng trắng, optimize tool calls, inject system prompt)
      ├─ Wire Format Translation (Chuẩn hóa sang request format của Provider đích)
      ├─ Provider Execution (Gọi API / Web Session Adapter)
      │    ├─ Thành công ──► Nhận response/stream, settle quota, reset failCount về 0
      │    └─ Thất bại ──► classifyError (429/503/401)
      │         ├─ Đưa credential vào Cooldown Pool (exponential backoff 2s - 4 min)
      │         ├─ Thử attempt kế tiếp trong plan (Next Connection / Next Provider)
      │         └─ Nếu hết attempt ──► Ném lỗi "All connections failed" kèm errors[]
  │
 [8] Output Normalization & Stream Processing
      ├─ Loại bỏ tag suy luận `<think>...</think>` (cho DeepSeek-R1, QwQ, v.v.)
      ├─ Nhận diện Sentinels (ví dụ `{{NO_TRANSLATION_NEEDED}}`)
      ├─ Kiểm tra HTML markers / code blocks còn nguyên vẹn
      └─ Lưu completion đã chuẩn hóa vào Cache (L3)
  │
 [9] Ghi nhận & Lưu trữ
      ├─ Ghi Audit Log (tenant, provider, model, latency, tokens, status)
      ├─ Lưu tin trả lời assistant vào Message Repository
      └─ Cập nhật Conversation metadata
  │
 [10] Trả về Client / UI
      └─ Trả về text / stream kèm thông tin attempt đã dùng thành công ({ provider, model, cached: boolean })
```

---

## 4. Đặc tả Chi tiết các Tầng Mới Triển khai

### 4.1. Prompt Pipeline (L2) - `packages/ai-gateway/pipeline/promptPipeline.ts`

Pipeline bảo đảm prompt đầu ra có tính **tất định (deterministic)** và **an toàn (injection-proof)**:

1. **Resolve**:
   $$\text{Final System} = \text{BASE\_RULES} \oplus \text{profile.systemPrompt} \oplus \text{conversation.styleOverride}$$
2. **Aggregate**:
   - Quét văn bản đầu vào để tìm các thuật ngữ trong Glossary (sử dụng Substring Matching tối ưu).
   - Chỉ thuật ngữ **thực sự xuất hiện** trong văn bản mới được nạp vào prompt. Nếu văn bản không chứa thuật ngữ nào, prompt sạch từng byte, giúp tăng tỷ lệ hit Cache.
3. **Conditional Layers**:
   - `BatchLayer`: Khi dịch mảng câu, tự động chèn quy tắc phân cách và sentinel.
   - `HtmlMarkerLayer`: Khi phát hiện tag HTML hoặc marker (ví dụ `<ph id="1"/>`), kích hoạt chỉ dẫn bảo toàn nguyên vẹn vị trí marker.
   - `MathFormulaLayer`: Bảo toàn công thức LaTeX / Markdown math.
   - `StructuredOutputLayer`: Ràng buộc định dạng JSON schema khi có cấu hình.
4. **Interpolate (An toàn)**:
   - Thay thế các placeholder `{{placeholder}}` trong template hệ thống.
   - Không bao giờ chạy interpolate trên dữ liệu do người dùng nhập hoặc glossary.
5. **Post-appends**:
   - Nối glossary khớp, tài liệu ngữ cảnh bổ sung và input của user vào phần cuối sau khi template đã compile xong.

### 4.2. Cache Layer (L3) - `packages/ai-gateway/pipeline/promptCache.ts`

- **Port Interface**:
  ```typescript
  export interface PromptCachePort {
    get(key: string): Promise<CachedResponse | null> | CachedResponse | null
    set(key: string, value: CachedResponse, ttlMs?: number): Promise<void> | void
    delete(key: string): Promise<void> | void
    clear(): Promise<void> | void
  }
  ```
- **Triển khai mặc định**: `InMemoryPromptCache` hỗ trợ TTL (Time-To-Live) và dung lượng tối đa (LRU Eviction).
- **Cache Key Generator**:
  ```typescript
  hash(finalSystemPrompt + "::" + userMessage + "::" + target + "::" + JSON.stringify(params))
  ```

### 4.3. Output Normalizer (L5) - `packages/ai-gateway/pipeline/outputNormalizer.ts`

- **Reasoning Tag Stripping**: Xóa toàn bộ khối `<think>[\s\S]*?</think>` khỏi văn bản trả về cuối cùng hoặc lọc bỏ các chunk `<think>` khi đang streaming qua `TransformStream`.
- **Sentinel Detection**: Bóc tách các chuỗi sentinel đặc biệt như `{{NO_TRANSLATION_NEEDED}}`.
- **HTML Marker Validation**: Kiểm tra tính toàn vẹn của danh sách marker ban đầu (ví dụ `<span id="m1">`) so với kết quả dịch; gắn cờ cảnh báo hoặc ném lỗi nếu model làm mất marker.

### 4.4. Chat Orchestrator - `packages/ai-gateway/pipeline/chatOrchestrator.ts`

Đóng gói trọn vẹn vòng đời 10 bước trong một giao diện cấp cao duy nhất:

```typescript
const orchestrator = new ChatOrchestrator({
  inferenceService,
  cache: new InMemoryPromptCache({ maxEntries: 1000, defaultTtlMs: 3600_000 }),
  conversationRepo?: myConversationRepo,
});

// Gọi non-streaming
const result = await orchestrator.send("Translate this text to Vietnamese", {
  conversationId: "conv-123",
  target: "smart-translation-combo", // hoặc "openai/gpt-4o"
  styleProfile: {
    targetLanguage: "Vietnamese",
    glossary: { "AI Gateway": "Cổng kết nối AI", "cooldown": "thời gian hồi" },
  },
});

console.log(result.text, result.cached, result.attempt);
```

---

## 5. Hướng dẫn Tích hợp và Mở rộng

Nguyên tắc: **mở rộng bằng adapter + composition root, không sửa lõi theo từng app**. Chi tiết entrypoint và ví dụ nằm trong `README.md` và `AGENTS.md`.

1. **Browser / Worker / chỉ cần routing**:
   - Import `@workmate-ai/ai-gateway/routing` (hoặc lõi `index.ts` nếu cần pipeline/adapters).
   - Wire `CredentialResolver` / `InferenceService` bằng `SecretCipher` của host; **không** import `server/`.
2. **Server / Microservice (Hono + SQLite)**:
   - `pnpm gateway:start` hoặc `createGatewayApp()` từ `@workmate-ai/ai-gateway/server` (SQLite mặc định).
   - Client gọi `/v1/chat/completions` (và các endpoint khác trong README).
3. **Provider mới**:
   - Kế thừa `BaseProviderAdapter` hoặc `BaseWebSessionAdapter` ở **host**.
   - `const providers = new ProviderRegistry(); providers.register(…); createGatewayApp({ providers })`.
4. **Tái sử dụng nhiều app Node**:
   - Package workspace `@workmate-ai/ai-gateway` đã có `exports` `.` / `./routing` / `./server`. Publish khi cần dùng ngoài monorepo.
