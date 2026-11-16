# AI Gateway — AGENTS Guide

Provider-agnostic AI Gateway & SSE streaming engine in TypeScript: accepts requests in client format (OpenAI, Claude, Gemini, Responses, Ollama) → translates to upstream format → streams back in client format.

## Entry points (import these, not deep internal paths)

| Entry   | Path                                                 | Runtime                 | Use when                                                               |
| ------- | ---------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| Core    | `index.ts`                                           | Browser / Worker / Node | Translators, adapters, inference, pipeline, in-memory repos            |
| Routing | `routing.ts`                                         | Browser / Worker / Node | Cross-provider fallback only (planner, executor, health, `RouteError`) |
| Server  | `server/index.ts` (`@workmate-ai/ai-gateway/server`) | **Node only**           | Hono app, AES encryption, **SQLite default store**, Drizzle schema     |

Host apps must not import `server/` into browser/extension bundles. In this monorepo, `.oxlintrc.json` blocks that. Package name: `@workmate-ai/ai-gateway`.

## Request Lifecycle (Chat)

### 1. Low-Level Inference Lifecycle (`inferenceService.execute`)

`Inbound Request` → `authMiddleware` (tenant & application from API key) → `routes/inference.ts` (detect client wire format) → `inferenceService.execute()` → reserve quota → `executeGatewayAttempts()` over `model` then `fallbackModels` (next provider on retryable errors) → per-route: `credentialResolver.resolve()` + credential cooldown → translate request (source → OpenAI → target) → `runRtkInterceptor()` → `providers.getAdapter(provider).execute()` → `createGatewaySSEStream()` (parse SSE → translate response → client SSE) → settle quota & record usage.

On failure after all routes, reserved credits are released. `RouteError` wrappers are unwrapped so HTTP handlers still see domain errors (`UpstreamError`, …).

### 2. High-Level Chat & Translation Lifecycle (`chatOrchestrator.send`)

1. AbortSignal check & bind.
2. Context aggregation (`styleProfile`, `conversation`, `history`).
3. 5-Phase Prompt Pipeline (Resolve → Aggregate → Conditional Layers → Interpolate → Post-appends).
4. Record user message (if repo provided).
5. Cache lookup via async SHA-256 key (`crypto.subtle`). Hit → `{ cached: true }`.
6. Call `inferenceService.execute({ model: target, … })`.
7. Normalize output (strip `<think>`, sentinels, HTML markers).
8. Store completion in cache; return `{ text, cached, attempt, usage }`.

## Directory Map

- `domain/` — Entities, ports (`ProviderAdapter`, repositories, `SecretCipher`), `routing.ts` types (`GatewayRouteCandidate`, `RouteError`), domain errors.
- `engine/` — Format detection, request/response translators, SSE stream controller, RTK compressor.
- `pipeline/` — Prompt pipeline, Web-Crypto prompt cache, output normalizer, `ChatOrchestrator`.
- `adapters/`
  - `providers/` — API + web-session adapters and `ProviderRegistry` (**construct; do not use a module singleton**).
  - `db/memory/` — In-memory repos (safe in core; tests).
  - `db/schema/` + `db/sqlite/` — Drizzle **SQLite** schema, `better-sqlite3` client, default repos (**server entry only**).
  - `security/` — AES-256-GCM envelope encryption (**server entry only**).
- `application/` — `inferenceService`, `credentialResolver`, `accountFallbackService`, `quotaService`, `embeddingService`, `auditService`, and `routing/`.
- `server/` — Hono composition root; `createGatewayApp` defaults to SQLite (`GATEWAY_DB_PATH` or `:memory:`; standalone uses `data/ai-gateway.sqlite`).
- `index.ts` / `routing.ts` — Public core / routing-only entries.

## Reuse rules (keep the library host-agnostic)

1. **Composition root owns wiring.** Apps construct `ProviderRegistry`, `AccountFallbackService`, `SecretCipher`, and pass them into `CredentialResolver` / `InferenceService`. Prefer `createGatewayApp()` on Node; wire manually for browser/core-only.
2. **No host imports.** Code under this tree must not import `@/types`, `@/utils`, `@/entrypoints`, or other app modules.
3. **No Node APIs in core.** No `process.env`, `crypto` (Node), `Buffer`, `fs`, `hono`, or `drizzle-orm` on paths reachable from `index.ts` / `routing.ts`. Inject env via `readEnvKey`; inject crypto via `SecretCipher`.
4. **No module-level mutable singletons** for providers or credential health. `translatorRegistry` remains a shared default registry of pure functions only.
5. **Secrets.** Never log or return raw API keys. Encrypt with `createEnvelopeCipher()` / `encryptSecret` on write; `maskSecret` on read. `GATEWAY_ENCRYPTION_KEY` is required for the Node cipher.

## Remaining optional work

1. Publish `@workmate-ai/ai-gateway` outside this monorepo.
2. Expose `fallbackModels` on HTTP routes (available today on `InferenceService.execute` only).
3. Optional Postgres adapter later — SQLite remains the default.

## Quick Commands

- Start service: `pnpm gateway:start` (or `pnpm --filter @workmate-ai/ai-gateway start`)
- Run tests: `pnpm test:gateway`
- Typecheck package: `pnpm --filter @workmate-ai/ai-gateway typecheck`
