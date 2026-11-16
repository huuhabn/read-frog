# AI Gateway Standalone Service (TypeScript)

A high-performance, provider-agnostic **AI Gateway & SSE Streaming Engine** written in **TypeScript** using **Clean Architecture (Hexagonal)** and **Hono**.

It acts as a unified facade for Large Language Model (LLM) inference: accepting requests in any client format (`OpenAI`, `Anthropic Claude`, `Google Gemini`, `Codex Responses API`, or `Ollama`), translating them to any target provider format, and streaming back responses via Server-Sent Events (SSE) with on-the-fly chunk translation, token counting, and client disconnect handling.

---

## 1. Key Capabilities

- **Clean Architecture (Hexagonal)**: Core engine and domain logic are 100% independent of any HTTP framework or database.
- **Bi-directional Format Translation**:
  - **Inbound Client Formats**: OpenAI (`/v1/chat/completions`), Anthropic Claude (`/v1/messages`), Google Gemini (`/v1beta/models/...`), OpenAI Responses API (`/v1/responses`), Ollama (`/api/chat`, `/api/generate`).
  - **Upstream Providers**: Generic OpenAI-compatible (OpenAI, DeepSeek, Groq, Mistral, Together, OpenRouter, Ollama) + Native Anthropic Claude + Native Google Gemini.
  - **Translation Routing**: Direct route optimization (e.g., `claude:kiro`) or pivot routing through intermediate OpenAI representation.
- **Resilient SSE Streaming**:
  - Native Web Streams (`ReadableStream`, `TransformStream`).
  - Client disconnect awareness (`AbortSignal` propagation to immediately abort upstream calls and avoid wasted tokens).
  - Real-time token metering and reconciliation.
- **Hybrid Credential Model & Security**:
  - Supports **Platform Shared Keys**, **Tenant BYOK (Bring Your Own Key)**, and **Hybrid** mode.
  - **AES-256-GCM Envelope Encryption** for all stored credentials with per-record random salt & IV.
  - Secrets are write-only in APIs and masked (`sk-a...7890`) upon read.
- **Pluggable RTK (Request Token-Killer)**:
  - Fail-open in-place compression of oversized `tool_result` blocks.
  - System prompt guidance injection (e.g. concise prompt / custom prompt).
- **Three public entry points** (pick the smallest that fits):
  - `index.ts` — runtime-agnostic core (translators, adapters, inference, pipeline).
  - `routing.ts` — routing-only (planner / executor / health / `RouteError`); safe for small browser bundles.
  - `server/index.ts` — **Node only** (Hono app, AES envelope encryption, **SQLite by default**, Drizzle schema).
- **Default persistence**: `createGatewayApp()` opens SQLite (`GATEWAY_DB_PATH` or `:memory:`). Standalone writes `data/ai-gateway.sqlite` unless `GATEWAY_DB_PATH` is set. Pass custom repos to override.
- **Host-agnostic by construction**: core takes `SecretCipher`, `ProviderRegistry`, `AccountFallbackService`, and optional `readEnvKey` via constructors. Wire in a composition root; do not edit library internals per host app.
- **Package**: published in this monorepo as `@workmate-ai/ai-gateway` (`exports`: `.`, `./routing`, `./server`).

---

## 2. Directory Structure

```text
packages/ai-gateway/                # @workmate-ai/ai-gateway
├── domain/                         # Pure domain (no Node / DB drivers)
│   ├── entities/ · ports/ · routing.ts · errors.ts
├── engine/                         # Translators, SSE streams, RTK
├── adapters/
│   ├── providers/                  # Upstream API + web-session adapters
│   ├── security/                   # AES-256-GCM (Node / server entry)
│   └── db/
│       ├── memory/                 # In-memory repos (tests / ephemeral)
│       ├── schema/                 # Drizzle SQLite schema (server)
│       └── sqlite/                 # better-sqlite3 client + repos (default)
├── application/                    # Inference, credentials, routing, quota, …
├── pipeline/                       # Prompt pipeline, cache, ChatOrchestrator
├── server/                         # Hono composition root + standalone
├── routing.ts                      # Routing-only public entry
├── index.ts                        # Core public entry
└── package.json                    # exports: ".", "./routing", "./server"
```

---

## 3. Quick Start & Reuse Modes

Clean Architecture with **three** ways to consume the same code. Prefer the smallest entry that covers your use case. Do **not** fork or patch library internals per host app—extend through ports and the composition root.

| Mode                                    | Entry                                           | Typical host                              |
| --------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| Standalone HTTP microservice            | `server/standalone.ts` via `pnpm gateway:start` | Any HTTP client                           |
| In-process Node (Next.js, workers, CLI) | `server` → `createGatewayApp()`                 | Node 18+                                  |
| Core / routing only (no Hono)           | `index.ts` or `routing.ts`                      | Browser, extension, Edge-compatible hosts |

### How to reuse in another JS/Node app (without editing this library)

1. **Import an entry**, never deep-couple to host aliases inside the library.
2. **Wire once** in the host composition root (`createGatewayApp` or manual constructors).
3. **Implement host-specific ports only when needed**: credential storage, `SecretCipher` (or use `createEnvelopeCipher` on Node), audit log repo, prompt cache.
4. **Register custom providers** on a `ProviderRegistry` instance and pass it in; do not mutate shared globals.
5. **Use routing alone** when you already have your own model runtime (e.g. AI SDK) and only need attempt/fallback/health.

**Reuse checklist:** depend on `@workmate-ai/ai-gateway`, import only `.` / `./routing` / `./server`, override storage via repos or `GATEWAY_DB_PATH`. Optional later: publish outside this monorepo.

---

### A. Standalone Microservice

```bash
# Requires GATEWAY_ENCRYPTION_KEY (32-byte hex or passphrase)
# SQLite file: GATEWAY_DB_PATH or ./data/ai-gateway.sqlite
pnpm gateway:start
```

Listens on `GATEWAY_PORT` / `PORT` (default `3001`):

```text
[AI Gateway] Standalone service listening on http://0.0.0.0:3001
  - Health Check:       http://localhost:3001/health
  - OpenAI Endpoint:    http://localhost:3001/v1/chat/completions
  - Claude Endpoint:    http://localhost:3001/v1/messages
  - Gemini Endpoint:    http://localhost:3001/v1beta/models/...
  - Models Endpoint:    http://localhost:3001/v1/models
  - Management API:     http://localhost:3001/v1/admin/*, /v1/tenant/*
```

---

### B. In-process Node (composition root = `createGatewayApp`)

#### 1. Next.js App Router (streaming SSE)

```typescript
import { createGatewayApp } from "@workmate-ai/ai-gateway/server"

const { inferenceService } = createGatewayApp()

export async function POST(req: Request) {
  const body = await req.json()

  const result = await inferenceService.execute({
    sourceFormat: "openai",
    model: body.model || "gpt-4o",
    // Optional: try these models/providers if the primary fails with a retryable error
    fallbackModels: body.fallbackModels,
    body: { ...body, stream: true },
    clientSignal: req.signal,
  })

  if (result.isStream) {
    return new Response(result.stream, {
      status: result.statusCode,
      headers: result.headers,
    })
  }

  return Response.json(result.data, { status: result.statusCode })
}
```

#### 2. Background workers / job queues

```typescript
import { createGatewayApp } from "@workmate-ai/ai-gateway/server"

const { inferenceService } = createGatewayApp()

async function processJob(articleText: string) {
  const response = await inferenceService.execute({
    sourceFormat: "openai",
    model: "claude-3-5-haiku-20241022",
    body: {
      messages: [
        { role: "system", content: "You summarize news articles." },
        { role: "user", content: articleText },
      ],
      stream: false,
    },
  })

  if (!response.isStream) {
    console.log(response.data)
  }
}
```

#### 3. Format translators only (no network)

```typescript
import { translatorRegistry, FORMATS } from "@workmate-ai/ai-gateway"

const openaiRequest = translatorRegistry.translateRequest(FORMATS.CLAUDE, FORMATS.OPENAI, {
  model: "claude-3-5-sonnet",
  system: "You are a helpful coding assistant.",
  messages: [{ role: "user", content: "Write a quicksort in TS." }],
  max_tokens: 2000,
})
```

#### 4. Routing only (host owns the model runtime)

Use when the host already calls providers (e.g. AI SDK) and only needs attempt ordering, cooldown, and pre-output stream fallback:

```typescript
import {
  executeGatewayStreamAttempts,
  planGatewayRoutes,
  GatewayHealthRegistry,
  type GatewayRouteCandidate,
} from "@workmate-ai/ai-gateway/routing"

const health = new GatewayHealthRegistry()
const planned = planGatewayRoutes("text.stream", candidates, { health })
// Wrap each candidate.execute(...) with your own provider call, then:
// for await (const part of executeGatewayStreamAttempts(attempts, signal, isVisible, health)) { … }
```

#### 5. ChatOrchestrator & Prompt Pipeline

```typescript
import { createGatewayApp } from "@workmate-ai/ai-gateway/server"

const { chatOrchestrator } = createGatewayApp()

const res1 = await chatOrchestrator.send("Please translate this text: AI Gateway is powerful.", {
  target: "openai/gpt-4o",
  styleProfile: {
    targetLanguage: "Vietnamese",
    tone: "formal and precise",
    glossary: { "AI Gateway": "Cổng kết nối AI" },
  },
  params: { temperature: 0.3 },
})
console.log(res1.text, res1.cached) // cached: false

const res2 = await chatOrchestrator.send("Please translate this text: AI Gateway is powerful.", {
  target: "openai/gpt-4o",
  styleProfile: {
    targetLanguage: "Vietnamese",
    tone: "formal and precise",
    glossary: { "AI Gateway": "Cổng kết nối AI" },
  },
  params: { temperature: 0.3 },
})
console.log(res2.cached) // true
```

#### 6. Manual core wiring (browser / Edge / no Hono)

When you cannot use `server/`, construct services yourself. Encryption must come from a host-provided `SecretCipher` (or keep secrets out of this process):

```typescript
import {
  AccountFallbackService,
  CredentialResolver,
  InferenceService,
  InMemoryCredentialRepository,
  InMemoryUsageLedger,
  ProviderRegistry,
  QuotaService,
} from "@workmate-ai/ai-gateway"

const providers = new ProviderRegistry()
const credentialHealth = new AccountFallbackService()
const cipher = {
  encrypt: (value: string) => value,
  decrypt: (value: string) => value,
} // replace with a real SecretCipher in production

const credentialResolver = new CredentialResolver(
  new InMemoryCredentialRepository(),
  cipher,
  credentialHealth,
)
const usageLedger = new InMemoryUsageLedger()
const inferenceService = new InferenceService(
  credentialResolver,
  new QuotaService(usageLedger),
  usageLedger,
  { providers, credentialHealth },
)
```

---

## 4. API Endpoints & Postman Collection

> [!TIP]
> Import [`postman_collection.json`](./postman_collection.json) into Postman. It includes the configured variables `baseUrl`, `apiKey`, and `tenantId`.

### 4.1 Inference & Pipeline APIs

| Endpoint                                           | Standard / Protocol | Description                                                                    |
| :------------------------------------------------- | :------------------ | :----------------------------------------------------------------------------- |
| `POST /v1/chat/pipeline`                           | AI Gateway Pipeline | High-level 10-step lifecycle (Prompt Pipeline, L3 Cache, Fallback, Normalizer) |
| `POST /v1/chat/completions`                        | OpenAI              | OpenAI Chat Completions API with streaming SSE                                 |
| `POST /v1/messages`                                | Anthropic           | Anthropic Claude Messages API                                                  |
| `POST /v1/responses`                               | Codex               | Codex Responses API                                                            |
| `POST /v1beta/models/:model:streamGenerateContent` | Google Gemini       | Google Gemini SSE API                                                          |
| `POST /api/chat`, `/api/generate`                  | Ollama              | Ollama compatibility endpoints                                                 |
| `POST /v1/embeddings`                              | OpenAI / Gemini     | Text Embeddings API (OpenAI `text-embedding-3`, Gemini `text-embedding-004`)   |
| `GET /v1/models`                                   | OpenAI              | List enabled models                                                            |

### 4.2 Management APIs

| Endpoint                      | Method | Description                               |
| :---------------------------- | :----- | :---------------------------------------- |
| `GET /health`                 | GET    | Service health check                      |
| `POST /v1/admin/tenants`      | POST   | Register SaaS tenant                      |
| `POST /v1/tenant/credentials` | POST   | Add or rotate BYOK encrypted credential   |
| `GET /v1/tenant/credentials`  | GET    | List tenant credentials (masked secrets)  |
| `GET /v1/tenant/usage`        | GET    | Retrieve token usage and cost metrics     |
| `GET /v1/admin/audit-logs`    | GET    | List all platform and tenant audit events |
| `GET /v1/tenant/audit-logs`   | GET    | List tenant-specific audit events         |

---

## 5. Usage Examples

### 5.1 Calling OpenAI Endpoint with Streaming

```bash
curl -N http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Explain Clean Architecture in 2 sentences."}
    ],
    "stream": true
  }'
```

### 5.2 Calling Claude Messages Endpoint (Gateway auto-translates to upstream)

```bash
curl -N http://localhost:3001/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-test-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Write a TypeScript function to reverse a string."}
    ],
    "max_tokens": 1024,
    "stream": true
  }'
```

### 5.3 Registering a Tenant & Storing BYOK Credentials

```bash
# 1. Create a tenant
curl -X POST http://localhost:3001/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "id": "tenant-saas-1",
    "name": "My SaaS App",
    "slug": "my-saas",
    "credentialMode": "byok"
  }'

# 2. Add encrypted BYOK API key (Write-only)
curl -X POST http://localhost:3001/v1/tenant/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-saas-1",
    "provider": "anthropic",
    "apiKey": "sk-ant-api03-abcdef1234567890",
    "label": "Production Anthropic Key"
  }'
```

### 5.4 Generating Text Embeddings (`/v1/embeddings`)

```bash
curl -X POST http://localhost:3001/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test-key" \
  -d '{
    "model": "text-embedding-3-small",
    "input": ["Tài liệu kiến trúc AI Gateway", "Clean Architecture TypeScript"]
  }'
```

### 5.5 Calling Prompt Pipeline Endpoint (`/v1/chat/pipeline`)

```bash
# Lần 1: Cache Miss -> Biên dịch Prompt 5 bước -> Lọc Glossary -> Fallback Router -> Normalizer -> Lưu Cache
curl -X POST http://localhost:3001/v1/chat/pipeline \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test-key" \
  -d '{
    "text": "Dịch đoạn này: Cổng kết nối AI rất tiện lợi với <b>HTML tags</b>.",
    "target": "openai/gpt-4o",
    "styleProfile": {
      "targetLanguage": "English",
      "tone": "concise",
      "glossary": {
        "Cổng kết nối AI": "AI Gateway"
      }
    },
    "bypassCache": false
  }'
```

Output:

```json
{
  "text": "Translate this: AI Gateway is very convenient with <b>HTML tags</b>.",
  "cached": false,
  "attempt": {
    "provider": "openai",
    "model": "gpt-4o"
  },
  "usage": {
    "promptTokens": 36,
    "completionTokens": 14,
    "totalTokens": 50
  }
}
```

_(Lần gọi thứ 2 với cùng input và profile sẽ trả về ngay lập tức `"cached": true` từ bộ nhớ đệm L3 với chi phí 0 token!)_

---

## 6. Security & Credential Encryption

Credentials are encrypted at rest via the **`SecretCipher` port**. The Node implementation (`createEnvelopeCipher` / `encryptSecret` / `decryptSecret` in `adapters/security/`, exported from `server`) uses **AES-256-GCM**:

- **Master Key**: Required `GATEWAY_ENCRYPTION_KEY` (32-byte hex or passphrase). Encrypt/decrypt throw when unset.
- **Per-record Key**: `HKDF-SHA256` with a unique 16-byte random salt.
- **Integrity**: 16-byte authentication tag.
- **Storage Format**: `enc:v1:<salt_hex>:<iv_hex>:<tag_hex>:<ciphertext_hex>`.
- **Masking**: `maskSecret` for API/UI display (e.g. `sk-a...7890`).
- **Injection**: `CredentialResolver` receives a `SecretCipher`; it never reads `process.env` for keys except through optional `readEnvKey` passed by the composition root.

---

## 7. Web Session Providers & Custom Adapters

### 7.1 Web Session Providers (ChatGPT Web, DeepSeek Web, Perplexity Web, Gemini Web, Muse Web)

Ngoài các provider dùng API key truyền thống, AI Gateway hỗ trợ kết nối trực tiếp với các tài khoản Web Session thông qua Session Token hoặc Cookie:

- **`chatgpt-web`**: Kết nối tới `chatgpt.com/backend-api/conversation` qua Access Token hoặc session cookie (`__Secure-next-auth.session-token`).
- **`deepseek-web`**: Kết nối tới `chat.deepseek.com/api/v0/chat/completion` qua `userToken`.
- **`perplexity-web`**: Kết nối tới `www.perplexity.ai/rest/sse/prompt_completion` qua session cookie.
- **`gemini-web`**: Kết nối tới `gemini.google.com` qua cookie phiên đăng nhập Google (`__Secure-1PSID` và `__Secure-1PSIDTS`).
- **`muse-web`**: Kết nối tới `muse.ai` qua cookie Hatch session (`hatch_sess`, `hatch_gw`, `hatch_vml`).

Ví dụ lưu thông tin xác thực Muse Web Session:

```bash
curl -X POST http://localhost:3001/v1/tenant/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "my-tenant",
    "provider": "muse-web",
    "apiKey": "hatch_sess=...; hatch_gw=...",
    "label": "My Muse Web Account"
  }'
```

### 7.3 Account Fallback, Provider Fallback & Cooldown

Two layers (both in core; no host edits required):

1. **Credential pool** (`AccountFallbackService`): on 429 / auth failure / 503 overload, the credential enters cooldown (exponential backoff, 2s → 4 min). `CredentialResolver.filterAvailable` skips hot credentials; success resets backoff.
2. **Provider routes** (`application/routing` + `InferenceService`): pass `fallbackModels` to try the next provider/model after retryable failures. Route health cooldown lives in `GatewayHealthRegistry`. Non-retryable errors (e.g. 400) stop immediately and release reserved credits.

### 7.4 Adding a Custom Provider Adapter

1. Extend `BaseProviderAdapter` in the **host** (or a small adapter module), not by forking the library:

   ```typescript
   import { BaseProviderAdapter, type ProviderExecutionOptions } from "@workmate-ai/ai-gateway"

   export class MyCustomAdapter extends BaseProviderAdapter {
     readonly providerId = "my-custom"
     readonly defaultBaseUrl = "https://api.my-service.com/v1"

     buildUrl(options: ProviderExecutionOptions): string {
       return `${this.defaultBaseUrl}/chat`
     }

     buildHeaders(options: ProviderExecutionOptions): Record<string, string> {
       return {
         Authorization: `Bearer ${options.credential.apiKey}`,
         "Content-Type": "application/json",
       }
     }

     formatRequestBody(options: ProviderExecutionOptions): Record<string, unknown> {
       return { ...options.body, model: options.model }
     }
   }
   ```

2. Register on a **new** `ProviderRegistry` and pass it into the composition root:

   ```typescript
   import { ProviderRegistry } from "@workmate-ai/ai-gateway"
   import { createGatewayApp } from "@workmate-ai/ai-gateway/server"

   const providers = new ProviderRegistry()
   providers.register(new MyCustomAdapter())
   const { app } = createGatewayApp({ providers })
   ```

---

## 8. Testing

```bash
pnpm test:gateway
pnpm exec tsc --noEmit
```
