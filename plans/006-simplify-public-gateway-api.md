# Plan 006: Simplify the public gateway API

> **Executor instructions**: Read this plan fully. Keep `InferenceService` as the advanced compatibility layer while adding a small typed facade. Update `plans/README.md` when done.
>
> **Drift check**: `git diff --stat c44e88ea..HEAD -- packages/ai-gateway`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/005-standalone-saas-master-tenant.md
- **Category**: dx
- **Planned at**: commit `c44e88ea`, 2026-11-17

## Why this matters

Consumers currently choose between raw `InferenceService.execute()` with wire-format details and `ChatOrchestrator.send()` with a translation-oriented prompt pipeline. Add a minimal ergonomic API for common generation, streaming, and embeddings while preserving those lower-level entry points. Keep the core import usable in browser/worker runtimes and the server entry Node-only.

## Current state

- `packages/ai-gateway/index.ts` exports core services and types.
- `packages/ai-gateway/routing.ts` exports routing-only functionality.
- `packages/ai-gateway/server/index.ts` exports Node-only Hono, SQLite and encryption.
- `InferenceService.execute()` requires `sourceFormat`, `model`, and a provider-shaped `body`.
- `ChatOrchestrator.send()` compiles translation/style prompts and handles response cache/normalization.
- Package exports in `packages/ai-gateway/package.json` point directly at `.ts` source and package is private.
- Examples and wiring conventions are in `packages/ai-gateway/README.md` and `AGENTS.md`.

## Scope

**In scope**: typed `GatewayClient`/`createGatewayClient` facade, `generate`, `stream`, and `embed` methods, normalized result metadata, tests, README quick-start, export map only if it remains compatible with workspace tooling.

**Out of scope**: publishing, build artifacts/declarations, protocol route fixes (Plan 005), gateway routing options (Plan 007), pricing/budgets, dashboard.

## Steps

### Step 1: Define simple request/result types

Add core-safe types for model IDs (`provider/model`), prompt/messages, common generation parameters, abort signal, and result metadata. Reuse existing `TokenUsage`, attempt/routing metadata, and domain errors where possible. Do not import Hono, Drizzle, Node crypto, or app modules from core.

**Verify**: type-level tests or ordinary compile-time usage fixtures compile through the core package entry.

### Step 2: Implement the facade over existing services

Create an injectable facade that accepts `InferenceService` and optionally `ChatOrchestrator`. Implement `generate()` and `stream()` by delegating to inference with OpenAI canonical format; implement `embed()` through `EmbeddingService`. Make missing optional services fail with a typed configuration error. Preserve stream cancellation and return the existing `ReadableStream` abstraction.

**Verify**: unit tests assert delegation arguments, result metadata, error propagation, and AbortSignal propagation.

### Step 3: Export public API and document install/use choices

Export facade/types from `index.ts`. Add a minimal quick-start to README for core-only, Node server, and standalone HTTP usage. Document that `createGatewayApp()` uses SQLite by default and is Node-only. Do not imply this private workspace package is publish-ready.

**Verify**: add compile fixture importing only from `@workmate-ai/ai-gateway`; run package typecheck and tests.

## Test plan

- Test generate non-stream and stream return shapes.
- Test embedding delegation.
- Test configured/unconfigured optional services.
- Test abort and provider errors are not swallowed.
- Model tests after existing `application/inferenceService.test.ts` and `server/server.test.ts`.

## Done criteria

- [ ] Common calls do not require callers to construct `sourceFormat` or provider wire request bodies.
- [ ] Raw `InferenceService` remains publicly available for advanced use.
- [ ] Core facade imports no Node-only dependencies.
- [ ] README clearly distinguishes client, server, and standalone modes.
- [ ] Typecheck and package tests pass.

## STOP conditions

- Simplified facade requires making the core package depend on Hono/SQLite/Node APIs.
- Existing result compatibility cannot be preserved without a major-version decision.
- Package export behavior differs between workspace and intended consumer hosts with no agreed build strategy.

## Maintenance notes

Keep the facade thin: policy belongs in application services, provider-specific options belong in Plan 007. Any future method should reuse normalized request/result types instead of adding a parallel API family.
