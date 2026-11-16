# Plan 003: Unify routing options and introduce a model catalog

> **Executor instructions**: Follow steps in order; preserve legacy direct-service behavior while introducing the namespaced options. Update `plans/README.md` when complete.
>
> **Drift check**: `git diff --stat c44e88ea..HEAD -- packages/ai-gateway`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/002-simplify-public-gateway-api.md
- **Category**: direction
- **Planned at**: commit `c44e88ea`, 2026-11-17

## Why this matters

Workmate supports provider/model fallback in `InferenceService`, but the HTTP handler does not expose `fallbackModels`, and callers lack one namespaced set of controls for provider ordering, exclusions, timeouts, and fallback models. Provider adapters are registered separately from the SQLite model repository, leaving model capability and pricing metadata disconnected from routing. Vercel's useful pattern is a model string plus one `gateway` options object and a catalog with comparable metadata.

## Current state

- `InferenceOptions` has `fallbackModels?: string[]` in `application/inferenceService.ts`.
- `server/routes/inference.ts` calls `execute()` without mapping any fallback models from request body.
- `application/routing/routePlanner.ts` plans routes from candidate metadata and health.
- `adapters/providers/registry.ts` hardcodes default provider adapter construction.
- `domain/entities/model.ts` and `ModelRepository` provide model persistence, but are not the sole source of adapter capabilities or per-provider pricing.
- `server/routes/models.ts` exposes model listing.
- Vercel documents model fallback arrays, provider `order`/`only`, and per-provider timeouts in `providerOptions.gateway`; reuse the ergonomic grouping, not proprietary semantics.

## Scope

**In scope**: `GatewayOptions` contract; HTTP mapping and validation; route planner controls; provider timeout before first response event; model/provider catalog metadata sufficient for capability filtering; compatibility mapping for direct `fallbackModels` callers.

**Out of scope**: price accuracy implementation (Plan 004); dashboard, automatic model synchronization from external catalog, confidence-based decisions, adaptive latency/cost routing, database migration to Postgres.

## Steps

### Step 1: Define namespaced GatewayOptions

Define a validated, documented shape with `models` (ordered model fallbacks), `providers.order`, `providers.only`, `providers.exclude`, `providerTimeouts`, `maxAttempts`, and optional cache mode. Clarify precedence: explicit `only` filters; `order` only orders eligible providers; model fallback order is preserved; legacy `fallbackModels` maps to `gateway.models` when the new field is absent. Reject conflicting or invalid input with typed `invalid_request` errors.

**Verify**: schema tests cover valid, malformed, conflicting and legacy-equivalent requests.

### Step 2: Expose options consistently through HTTP and facade

Map `body.gateway` from OpenAI-compatible requests and the facade from Plan 002 into core route planning. Never forward gateway-only properties upstream. Add `fallbackModels` legacy compatibility only where required and document deprecation timing; do not silently change customer behavior.

**Verify**: route tests prove HTTP primary/fallback order and that upstream body has no `gateway` control object.

### Step 3: Implement provider constraints, timeouts and attempt metadata

Apply provider filtering/order before execution. Implement timeout as a pre-first-event timeout; once visible output begins, do not retry to prevent duplicate/corrupt output. Return structured attempts with provider, model, result, latency, timeout/error classification and whether visible output started. Respect AbortSignal.

**Verify**: tests cover ordering, filtering, timeout failover before first event, no failover after visible output, and abort cancellation.

### Step 4: Join model metadata to route eligibility

Extend `ModelDefinition` with provider model ID and explicit capability metadata for text, tools, vision, embeddings, audio, image, reasoning, context window and data policies where known. Filter candidates that cannot satisfy the requested operation/input. Unknown capability must remain unknown and not be presented as supported. Keep provider adapter registration injectable and remove duplicated hardcoded model assumptions.

**Verify**: catalog/repository tests and route planner tests demonstrate capability-compatible selection and unknown metadata handling.

### Step 5: Document routing examples

Add simple model fallback, provider order, provider restriction, timeout and legacy migration examples to README. Clearly state that routing fails over only before visible stream output.

**Verify**: docs examples compile in a fixture or are covered by typed tests; package typecheck and tests pass.

## Test plan

- Schema validation and precedence matrix.
- Route ordering/filtering, including cooldown interaction.
- Stream timeout and no-retry-after-visible-output guarantees.
- Capability matching across text/tools/vision/embedding operations.
- Legacy fallbackModels compatibility.
- Use existing `application/routing/routePlanner.test.ts`, `routeExecutor.test.ts`, and `server/server.test.ts` patterns.

## Done criteria

- [ ] In-process and HTTP callers share the same typed routing options.
- [ ] HTTP model fallback is usable without leaking gateway fields upstream.
- [ ] Provider order/allowlist/denylist and timeout behavior are tested.
- [ ] Streams never fail over after visible output.
- [ ] Catalog capability metadata affects eligibility and unknowns are represented honestly.
- [ ] Package typecheck and tests pass.

## STOP conditions

- Existing routing semantics conflict with an explicit customer contract and require a breaking change.
- Provider timeout cannot reliably abort upstream execution for an adapter.
- Model/provider identity cannot be represented without breaking stored rows; stop and propose a migration first.

## Maintenance notes

Keep catalog data versioned independently from route execution code. Provider-specific generation options remain provider-scoped; gateway options control gateway behavior only. Avoid automatic fallback between models with incompatible modalities unless input compatibility is established.
