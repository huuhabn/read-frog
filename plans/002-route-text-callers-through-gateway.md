# Plan 002: Route direct text callers through AI gateway

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 04f7cd9d..HEAD -- src/utils/web-chat/ai/service.ts src/utils/host/translate/api/ai.ts src/entrypoints/background/background-stream.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-background-ai-gateway-foundation.md
- **Category**: architecture
- **Planned at**: commit `04f7cd9d`, 2026-11-15

## Why this matters

Web Chat multi-reply suggestions and AI translation currently invoke the Vercel AI SDK directly from frontend/content-adjacent modules, bypassing background token accounting, circuit breaking, retry policies, and candidate routing. Migrating these callers to use the background AI gateway ensures unified attempt orchestration, consistent audit logging, and zero bundle leakage of heavy AI SDK modules into user-facing tabs.

## Current state

- `src/utils/web-chat/ai/service.ts` directly imports `generateText` from `ai` and `getModelById` from `@/utils/providers/model`.
- `src/utils/host/translate/api/ai.ts` directly imports `generateText` from `ai`.
- `src/entrypoints/background/llm-generate-text.ts` handles non-streaming background text execution via `generateTextForProviderRef`, but lacks fallback candidate awareness.
- `src/entrypoints/background/background-stream.ts` has `generateTextForProviderRef` executing a single provider ref without route planning.

Current code excerpt in `src/utils/web-chat/ai/service.ts:117-126`:

```typescript
  try {
    const response = await generateText({
      model,
      system: fullSystemPrompt,
      prompt: processedPrompt,
      temperature: 0.7,
    })
```

And in `src/utils/host/translate/api/ai.ts:55-64`:

```typescript
const { text: translatedText } = await generateText({
  model,
  instructions: systemPrompt,
  prompt,
  reasoning,
  temperature,
  providerOptions,
  abortSignal: options?.signal,
  maxRetries: 0,
})
```

## Commands you will need

| Purpose      | Command                                                                                          | Expected on success          |
| ------------ | ------------------------------------------------------------------------------------------------ | ---------------------------- |
| Install      | `pnpm install`                                                                                   | exit 0                       |
| Format check | `pnpm fmt:check`                                                                                 | exit 0, no unformatted files |
| Lint         | `pnpm lint`                                                                                      | exit 0, no errors            |
| Typecheck    | `pnpm type-check`                                                                                | exit 0, no errors            |
| Unit tests   | `SKIP_FREE_API=true pnpm test -- src/entrypoints/background/__tests__/llm-generate-text.test.ts` | pass                         |
| Caller tests | `SKIP_FREE_API=true pnpm test -- src/utils/web-chat/ai/__tests__/service-audit-log.test.ts`      | pass                         |
| Full tests   | `SKIP_FREE_API=true pnpm test`                                                                   | all test suites pass         |
| Build        | `pnpm build && pnpm build:firefox`                                                               | exit 0                       |

## Suggested executor toolkit

- `ai-sdk`: generateText API.
- `webext-core`: background messaging patterns.

## Scope

**In scope**:

- Candidate extraction helper:
  - `src/entrypoints/background/ai-gateway-candidates.ts`
  - `src/entrypoints/background/__tests__/ai-gateway-candidates.test.ts`
- Background text generation handler:
  - `src/entrypoints/background/llm-generate-text.ts`
  - `src/entrypoints/background/__tests__/llm-generate-text.test.ts`
  - `src/entrypoints/background/background-stream.ts` (`generateTextForProviderRef`)
  - `src/types/background-generate-text.ts`
- Direct callers:
  - `src/utils/host/translate/api/ai.ts`
  - `src/utils/web-chat/ai/service.ts`
  - `src/utils/web-chat/ai/__tests__/service-audit-log.test.ts`

**Out of scope**:

- Options UI settings for automatic routing (deferred to Plan 003).
- Media and TTS generation (deferred to Plan 004).
- PII masking/unmasking algorithms in Web Chat (preserved as-is).

## Git workflow

- Branch: `advisor/001-background-ai-gateway`
- Conventional commit: `feat(ai): route text generation through gateway`

## Steps

### Step 1: Create background route candidate builder

Create `src/entrypoints/background/ai-gateway-candidates.ts` and tests `src/entrypoints/background/__tests__/ai-gateway-candidates.test.ts`.

- Implement `buildBackgroundGenerateTextCandidates(payload: BackgroundGenerateTextPayload): BackgroundGenerateTextCandidate[]`.
- Map primary `providerRef` and `fallbackProviderRefs` into `GatewayRouteCandidate` objects with operations `["text.generate"]`.
- Retain secret-bearing configs inside the background execution closure only.

**Verify**: `SKIP_FREE_API=true pnpm test -- src/entrypoints/background/__tests__/ai-gateway-candidates.test.ts` → all pass.

### Step 2: Route `generateTextForProviderRef` via gateway attempts

Update `src/entrypoints/background/background-stream.ts` and `src/entrypoints/background/llm-generate-text.ts`.

- In `generateTextForProviderRef`:
  - Build candidate list with `buildBackgroundGenerateTextCandidates(payload)`.
  - Use `planGatewayRoutes("text.generate", candidates, { maxAttempts: payload.maxGatewayAttempts ?? 1 })`.
  - Execute attempts via `executeGatewayAttempts`.
  - In each attempt execute closure: handle both `system` hosted streams and `local` LLM provider `generateText`.
  - Capture token usage via `options.onUsage?.(capturedUsage)`.
  - Record audit log with the actual `selectedProviderRef`.

**Verify**: `SKIP_FREE_API=true pnpm test -- src/entrypoints/background/__tests__/llm-generate-text.test.ts` → all pass.

### Step 3: Migrate Web Chat AI service to background gateway

Update `src/utils/web-chat/ai/service.ts`.

- Remove direct imports of `generateText` from `ai` and `getModelById` from `@/utils/providers/model`.
- Resolve fallback providers from `config?.providersConfig`.
- Send message `sendMessage("backgroundGenerateText", ...)` with `providerRef`, `fallbackProviderRefs`, and `maxGatewayAttempts: 3`.

**Verify**: `SKIP_FREE_API=true pnpm test -- src/utils/web-chat/ai/__tests__/service-audit-log.test.ts` → all pass.

### Step 4: Wrap translation AI provider with gateway attempts

Update `src/utils/host/translate/api/ai.ts`.

- Wrap local `generateText` with `executeGatewayAttempts`.
- Normalize error: if `error instanceof GatewayError && error.cause !== undefined`, unwrap to `error.cause`.

**Verify**: `pnpm type-check && pnpm lint` → exit 0.

### Step 5: Full regression validation

Run complete test suite and build.

**Verify**: `SKIP_FREE_API=true pnpm test && pnpm build` → all exit 0.

## Test plan

- Unit tests for candidate extraction from single and multiple provider refs.
- Unit tests verifying fallback execution when primary candidate fails with retryable error.
- Regression tests verifying Web Chat PII masking and audit log recording.

## Done criteria

- [ ] `pnpm type-check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm fmt:check` exits 0
- [ ] `grep -rn 'import { generateText } from "ai"' src/utils/web-chat/` returns no matches
- [ ] `SKIP_FREE_API=true pnpm test` exits 0
- [ ] `pnpm build` exits 0

## STOP conditions

- If eliminating direct AI SDK import in Web Chat causes circular dependencies.
- If payload size over `chrome.runtime.sendMessage` exceeds browser quotas.

## Maintenance notes

- Subsequent plans: Plan 003 introduces UI controls to configure automatic routing fallback lists.
