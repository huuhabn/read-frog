# Plan 001: Add the background AI gateway foundation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 37a35cc5..HEAD -- src/entrypoints/background/background-stream.ts src/utils/ai-gateway`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: architecture
- **Planned at**: commit `37a35cc5`, 2026-11-15

## Why this matters

Workmate AI already owns streaming, cancellation, local/hosted selection, token usage tracking, and audit logging in the background service worker, but route selection, model construction, and execution are tightly coupled inside monolithic handlers. Direct AI SDK calls also remain scattered in Web Chat and translation modules. Adding a typed gateway foundation behind the existing Port protocol establishes a single owner for routing, attempt orchestration, and safe pre-output failover without breaking existing client contracts or requiring external proxy servers.

## Current state

The relevant files and their roles:

- `src/entrypoints/background/background-stream.ts` — owns background streaming Port lifecycle, snapshot accumulators, and direct local/hosted text execution.
- `src/utils/providers/provider-registry.ts` — resolves one provider for a feature capability, but cannot produce an ordered multi-candidate route plan.
- `src/utils/providers/model.ts` — creates AI SDK provider clients and language models.
- `src/utils/web-chat/ai/service.ts` — direct AI SDK caller (deferred to Plan 002).
- `src/utils/host/translate/api/ai.ts` — direct AI SDK caller (deferred to Plan 002).

Code excerpts from `src/entrypoints/background/background-stream.ts:1060-1073`:

```typescript
const partStream =
  serializablePayload.providerKind === "system"
    ? await createHostedTextPartStream(serializablePayload, signal)
    : await createLocalTextPartStream(serializablePayload, options)

finalSnapshot = await consumeTextPartStream(partStream, {
  onChunk,
  signal,
  onUsage: (u) => {
    capturedUsage = u
  },
})
return finalSnapshot
```

And lines 890–895 showing hosted part stream normalization:

```typescript
    const stream = await procedure(input.data, { signal })
    return normalizeHostedPartStreamErrors(stream)
  } catch (error) {
    throw normalizeHostedAiError(error)
  }
```

Repo conventions:

- Strict linter and formatter: `oxlint` (`pnpm lint`) and `oxfmt` (`pnpm fmt:check`).
- Package manager: `pnpm` exclusively.
- Testing: Vitest (`vitest run`). Live API tests in `src/utils/host/translate/api/__tests__/free-api.test.ts` require `SKIP_FREE_API=true`.
- Bundle constraints: Never statically import `@ai-sdk/*` or heavy provider packages into sidepanel, popup, or content scripts.
- Port envelope compatibility: Must preserve exact error strings and shapes for Port consumers and audit logging.

## Commands you will need

| Purpose      | Command                                                      | Expected on success          |
| ------------ | ------------------------------------------------------------ | ---------------------------- |
| Install      | `pnpm install`                                               | exit 0                       |
| Format check | `pnpm fmt:check`                                             | exit 0, no unformatted files |
| Lint         | `pnpm lint`                                                  | exit 0, no errors            |
| Typecheck    | `pnpm type-check`                                            | exit 0, no errors            |
| Unit tests   | `SKIP_FREE_API=true pnpm test -- src/utils/ai-gateway`       | all gateway tests pass       |
| Stream tests | `SKIP_FREE_API=true pnpm test -- src/entrypoints/background` | all background tests pass    |
| Full tests   | `SKIP_FREE_API=true pnpm test`                               | all test suites pass         |
| Build        | `pnpm build && pnpm build:firefox`                           | exit 0                       |

## Suggested executor toolkit

- `wxt`: Chrome Extension MV3 build system.
- `ai-sdk`: Core AI SDK types and streaming primitives.

## Scope

**In scope**:

- New gateway domain module:
  - `src/utils/ai-gateway/types.ts`
  - `src/utils/ai-gateway/planner.ts`
  - `src/utils/ai-gateway/health.ts`
  - `src/utils/ai-gateway/orchestrator.ts`
  - `src/utils/ai-gateway/index.ts`
- Gateway unit tests:
  - `src/utils/ai-gateway/__tests__/planner.test.ts`
  - `src/utils/ai-gateway/__tests__/health.test.ts`
  - `src/utils/ai-gateway/__tests__/orchestrator.test.ts`
- Background execution integration:
  - `src/entrypoints/background/background-stream.ts` (bridging via `createTextPartStreamViaGateway`)
- Changeset:
  - `.changeset/curly-spoons-route.md`

**Out of scope**:

- Migrating Web Chat (`src/utils/web-chat/ai/service.ts`) or Translation (`src/utils/host/translate/api/ai.ts`) callers (deferred to Plan 002).
- Automatic routing configuration UI or config schema migration v123 -> v124 (deferred to Plan 003).
- Adding Media Operations or Edge TTS routing (deferred to Plan 004).
- Touching the user-owned dirty options file `src/entrypoints/options/pages/providers/feature-providers/index.tsx`.
- Modifying the public Port messaging protocol or changing wire message payloads.
- Porting `open-sse`, Node-specific executors, or remote proxy servers.

## Git workflow

- Branch: `advisor/001-background-ai-gateway`
- Commit per logical unit with Conventional Commits:
  - `feat(ai): add background gateway foundation`
- Include `.changeset/*.md` for versioning.
- Do NOT push or open a PR unless instructed by the operator.

## Steps

### Step 1: Define canonical gateway types and error classes

Create `src/utils/ai-gateway/types.ts` and `src/utils/ai-gateway/index.ts`.
Define typed discriminated unions and interfaces:

- `GatewayOperation`: `"text.generate" | "text.stream" | "object.stream" | "vision.generate" | "image.generate" | "embedding.generate" | "speech.transcribe" | "speech.synthesize"`
- `GatewayErrorCode`: `"invalid_request" | "auth" | "rate_limit" | "quota" | "timeout" | "network" | "provider" | "unsupported" | "aborted"`
- `GatewayError` class extending `Error` with `readonly code: GatewayErrorCode` and `readonly status?: number`.
- `GatewayEvent` union for start, text-delta, reasoning-delta, tool-call, media, usage, finish, and error.
- `GatewayRequest<TInput>` and `GatewayResult<TOutput>`.
- `GatewayRouteCandidate`: secret-free route metadata (`routeId`, `providerId`, `model`, `operations`, `enabled`, `estimatedCostUsd`, `configurationOrder`, `cooldownUntil`).
- `GatewayAttempt<T>` and `GatewayStreamAttempt<T>`.
- `ProviderAdapter<TInput, TOutput>`.
  Export public symbols from `src/utils/ai-gateway/index.ts`.

**Verify**: `pnpm type-check` → exit 0, no type errors.

### Step 2: Implement pure route planner and unit tests

Create `src/utils/ai-gateway/planner.ts` and `src/utils/ai-gateway/__tests__/planner.test.ts`.

- `planGatewayRoutes(operation, candidates, options)`:
  - Filter candidates: must have `candidate.enabled === true`, include `operation` in `candidate.operations`, and not be currently on cooldown (`cooldownUntil === undefined || cooldownUntil <= now`).
  - Sort candidates stably:
    - Known `estimatedCostUsd` ascending (`leftCost - rightCost`).
    - Unset/unknown cost treated as `Number.POSITIVE_INFINITY` (sorts last).
    - `configurationOrder` as tie-breaker (`left.configurationOrder - right.configurationOrder`).
  - Slice to `maxAttempts` (default 3, minimum 0).
- Unit tests cover:
  - Filters disabled routes and unsupported operations.
  - Sorts known cost lowest first.
  - Places unknown cost behind known costs.
  - Preserves configuration order on equal cost.
  - Excludes candidates whose cooldown has not expired.
  - Limits output to `maxAttempts`.

**Verify**: `pnpm vitest run src/utils/ai-gateway/__tests__/planner.test.ts` → all tests pass.

### Step 3: Implement ephemeral in-memory health registry and unit tests

Create `src/utils/ai-gateway/health.ts` and `src/utils/ai-gateway/__tests__/health.test.ts`.

- `GatewayHealthRegistry`:
  - Ephemeral in-memory `Map<string, GatewayRouteHealth>` only. Never persist to disk or Chrome storage (resets cleanly on service worker lifecycle restarts).
  - Default options: `failureThreshold = 2`, `cooldownMs = 30_000` (30 seconds).
  - `recordSuccess(routeId)`: removes route from registry (resets failure counter and clears cooldown).
  - `recordFailure(routeId, error, now)`: ignores non-retryable errors. For retryable errors, increments `consecutiveFailures`. If consecutive failures reaches or exceeds `failureThreshold`, sets `cooldownUntil = now + cooldownMs`.
  - `withHealth(candidate)`: clones candidate and applies `cooldownUntil` if route has active cooldown.
- Unit tests cover:
  - Transient errors below threshold do not trigger cooldown.
  - Consecutive failures reaching threshold set cooldown window.
  - Non-retryable errors (e.g. auth 401) do not increment failure count.
  - Success clears failure count and active cooldown.

**Verify**: `pnpm vitest run src/utils/ai-gateway/__tests__/health.test.ts` → all tests pass.

### Step 4: Implement gateway execution & stream attempt orchestrator and unit tests

Create `src/utils/ai-gateway/orchestrator.ts` and `src/utils/ai-gateway/__tests__/orchestrator.test.ts`.

- `normalizeGatewayError(error, signal)`:
  - If already `GatewayError`, return directly.
  - If `signal?.aborted` or `error.name === "AbortError"`, map to code `"aborted"`.
  - Extract HTTP status if present: 401/403 → `"auth"`, 429 → `"rate_limit"`, >= 500 → `"provider"`, >= 400 → `"invalid_request"`.
  - String regex matching: `timeout|timed out` → `"timeout"`, `network|fetch failed|connection|socket` → `"network"`. Default fallback: `"provider"`.
- `isGatewayErrorRetryable(error)`:
  - Retryable: `"rate_limit"`, `"quota"`, `"timeout"`, `"network"`, `"provider"`.
  - Non-retryable: `"auth"`, `"invalid_request"`, `"unsupported"`, `"aborted"`.
- `executeGatewayAttempts<T>(attempts, signal)`:
  - Checks abort before routing and between attempts.
  - Slices attempts to maximum 3.
  - Executes attempt; if it fails with retryable error, tries next candidate. If non-retryable, rethrows immediately.
  - If all fail, rethrows last error or `new GatewayError("unsupported", "No compatible AI route")`.
- `executeGatewayStreamAttempts<T>(attempts, signal, isVisibleOutput)`:
  - Returns `AsyncIterable<T>`.
  - Checks abort before starting and inside iteration.
  - Executes candidate stream.
  - Tracks `hasVisibleOutput`: `hasVisibleOutput ||= isVisibleOutput(event)`.
  - **CRITICAL FAILOVER INVARIANT**: If an error occurs BEFORE any visible output event, failover to the next candidate attempt. If an error occurs AFTER visible output has been emitted (`hasVisibleOutput === true`), failover is prohibited; rethrow normalized error immediately.
- Unit tests cover:
  - Non-retryable error (auth 401) fails immediately without trying second candidate.
  - Retryable error (rate limit 429 / 500) fails over to second candidate and returns result.
  - Stream error before visible output switches to backup candidate.
  - Stream error after visible output throws immediately and does not retry.
  - Abort signal interrupts execution before routing, during execution, and inside stream loop.

**Verify**: `pnpm vitest run src/utils/ai-gateway/__tests__/orchestrator.test.ts` → all tests pass.

### Step 5: Integrate backward-compatible bridge in `background-stream.ts`

Update `src/entrypoints/background/background-stream.ts`.

- Import `executeGatewayStreamAttempts`, `GatewayError`, and `GatewayRouteCandidate` from `@/utils/ai-gateway`.
- Add `isVisibleTextStreamPart(part: unknown): boolean`:
  - Returns true if `part.type` is in `["text-delta", "reasoning-delta", "tool-call", "tool-input-start", "tool-input-delta"]`.
- Add `createTextPartStreamViaGateway(serializablePayload, options)`:
  - Construct a candidate object representing the active provider (`providerKind`, `providerId`, `operations: ["text.stream"]`).
  - Wrap stream with `executeGatewayStreamAttempts`.
  - In outer async generator, catch errors: if `error instanceof GatewayError && error.cause !== undefined`, unwrap and throw `error.cause`. This guarantees zero regression in legacy Port error codes, message strings, and audit log records.
- In `runStreamTextInBackground`:
  - Replace direct ternary (`serializablePayload.providerKind === "system" ? createHostedTextPartStream(...) : createLocalTextPartStream(...)`) with `createTextPartStreamViaGateway(serializablePayload, options)`.

**Verify**: `SKIP_FREE_API=true pnpm vitest run src/entrypoints/background/__tests__/background-stream.test.ts` → all existing background stream tests pass.

### Step 6: Create changeset and execute full verification suite

- Create `.changeset/curly-spoons-route.md` with summary:
  ```markdown
  ---
  "workmate-ai": patch
  ---

  Add background AI gateway foundation for typed multi-route execution, health cooldowns, and safe pre-output stream failover.
  ```
- Run formatting check, linter, typecheck, complete test suite, and extension builds.

**Verify**: Run the complete verification checklist below. All commands must exit with code 0.

## Test plan

- **New unit tests**:
  - `src/utils/ai-gateway/__tests__/planner.test.ts`: 5+ tests covering filtering, sorting by cost, tie-break by configuration order, cooldown filtering, maxAttempts bounds.
  - `src/utils/ai-gateway/__tests__/health.test.ts`: 4+ tests covering cooldown window, failure threshold, retryable vs non-retryable isolation, success recovery.
  - `src/utils/ai-gateway/__tests__/orchestrator.test.ts`: 7+ tests covering text attempt failover, stream pre-output failover, stream post-output termination, abort propagation, error normalization.
- **Regression testing**:
  - `src/entrypoints/background/__tests__/background-stream.test.ts`: local provider stream, system hosted stream, snapshot calculation, token usage logging, disconnect handling, abort handling.
- **Verification execution**:
  - `SKIP_FREE_API=true pnpm test` exits 0 with zero failures.

## Done criteria

- [ ] `pnpm fmt:check` exits 0 (no formatting violations)
- [ ] `pnpm lint` exits 0 (no oxlint warnings or errors)
- [ ] `pnpm type-check` exits 0 (strict TypeScript compilation passes)
- [ ] `SKIP_FREE_API=true pnpm test -- src/utils/ai-gateway` passes all new unit tests
- [ ] `SKIP_FREE_API=true pnpm test` passes full test suite
- [ ] `pnpm build` (Chrome MV3) exits 0
- [ ] `pnpm build:firefox` (Firefox MV3) exits 0
- [ ] `git diff --name-only` touches only files listed in "In scope"
- [ ] No API keys, credentials, or authorization headers leak into `GatewayRouteCandidate` or gateway diagnostics
- [ ] Changeset file `.changeset/*.md` exists and is formatted properly

## STOP conditions

Stop and report back (do not improvise) if:

- Existing Port envelope or audit log contracts cannot be preserved without modifying caller schemas.
- Provider credentials or Authorization tokens are required inside route candidates or diagnostic logs (secrets must be resolved strictly at final execution adapter).
- Cost-based routing requires guessing model pricing without a verified schema; represent unknown cost as `undefined` sorting last.
- Execution requires modifying the user-owned dirty file `src/entrypoints/options/pages/providers/feature-providers/index.tsx`.
- Vitest or build commands fail twice after reasonable scoped adjustments.

## Maintenance notes

- This plan establishes the typed foundation for the AI Gateway.
- **Subsequent roadmap plans**:
  - **Plan 002**: Migrate direct text callers (`src/utils/web-chat/ai/service.ts` and `src/utils/host/translate/api/ai.ts`) to route via the background AI gateway, eliminating direct AI SDK imports in UI-adjacent code.
  - **Plan 003**: Add automatic gateway routing configuration to Options UI and introduce v124 config migration schema with gateway audit tracking.
  - **Plan 004**: Extend the AI gateway to support media operations (vision, image generation, speech-to-text) and route Edge TTS audio synthesis through gateway attempts.
- **Reviewer checklist**: Verify that failover occurs strictly prior to the first visible stream event (`isVisibleTextStreamPart`), that `error.cause` is unwrapped at the Port bridge to maintain client compatibility, and that no UI bundles statically import AI SDK providers.
