# Plan 001: Add the background AI gateway foundation

> Execute step by step. Preserve existing behavior and stop rather than inventing provider capabilities. Do not update `plans/README.md`; the reviewer owns it.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: architecture
- **Planned at**: commit `37a35cc5`, 2026-11-15

## Why this matters

Workmate AI already owns streaming, cancellation, local/hosted selection and audit in the background service worker, but route selection, model construction and execution are coupled. Direct AI SDK calls also remain in Web Chat and translation. Add a typed gateway foundation behind the existing Port protocol so routing and safe failover have one owner without porting the Node-only `open-sse` server.

## Current state

- `src/entrypoints/background/background-stream.ts` owns Port lifecycle and local/hosted text execution.
- `src/utils/providers/provider-registry.ts` resolves one provider for a feature capability, but cannot produce an ordered route plan.
- `src/utils/providers/model.ts` creates AI SDK provider clients and models.
- `src/utils/web-chat/ai/service.ts` and `src/utils/host/translate/api/ai.ts` still call AI SDK directly.
- Keep the Port envelope compatible. Sidepanel/content must not statically import AI SDK/provider packages.
- Preserve caller-owned PII preparation and translation queue scheduling/rate limiting.

## Scope

In scope:

- New gateway domain modules under `src/utils/ai-gateway/`.
- Background execution integration in `src/entrypoints/background/background-stream.ts` and its tests.
- Provider registry/model helpers required to resolve safe candidate metadata.
- Focused tests under existing provider/background test directories.
- One `.changeset/*.md` file.

Out of scope:

- The dirty user-owned `src/entrypoints/options/pages/providers/feature-providers/index.tsx`.
- New remote services or public OpenAI-compatible HTTP/SSE endpoints.
- Porting `open-sse`, Node executors, browser automation, OAuth, proxy or CLI code.
- Migrating Web Chat, translation, TTS, STT, embeddings or image generation callers in this plan.
- Advertising a media capability without an existing working transport.

## Required design

1. Define discriminated gateway operation/request/result/error/event types for text generation/streaming and extensible media operations. Secret-bearing provider config must not enter route-plan or diagnostic types.
2. Define provider adapter and candidate interfaces. Adapters expose supported operations, optional cost estimation, execution and error normalization.
3. Implement a pure route planner that filters enabled/compatible candidates and sorts known estimated cost ascending, configuration order as tie-break, unknown cost last.
4. Implement attempt orchestration with one external `AbortSignal`, maximum three routes, no hidden AI SDK retries, and failover only for network, timeout, 429/rate-limit, temporary quota and 5xx/provider errors. Never fail over auth, invalid request, unsupported or abort errors.
5. For streaming, permit failover only before the first visible/canonical output event. After output begins, propagate the normalized error.
6. Add in-memory health cooldown only; do not persist transient health. Credentials are resolved only at background execution.
7. Integrate the existing local/system text branches through the gateway while preserving the current Port messages, snapshots, usage and audit behavior.

## Tests

- Route sorting: known cost, equal-cost config order, unknown cost last.
- Capability/enabled filtering and maximum attempt count.
- Retryable versus terminal error matrix.
- Abort before routing, during attempt and between attempts.
- Stream failure before first output falls back; failure after output does not.
- Plans/events/diagnostics contain no API key, Authorization header, custom headers or full provider config.
- Existing background-stream local, hosted, disconnect, audit and error tests remain green.

## Verification

Run in order:

```bash
pnpm fmt:check
pnpm lint
pnpm type-check
SKIP_FREE_API=true pnpm test
pnpm build
pnpm build:firefox
```

All commands must exit 0. Confirm `git diff --name-only` contains no user-owned dirty file and no files unrelated to the scope.

## STOP conditions

- Existing Port or audit behavior cannot be preserved without a breaking contract change.
- Provider credentials would need to cross into UI-visible route plans or diagnostics.
- Cost-first routing requires guessed pricing; represent unknown cost instead.
- The work requires touching the user-owned dirty options file.
- A media capability has no real provider transport in the repository.
- Verification fails twice after a reasonable scoped correction.

## Maintenance notes

This foundation precedes caller migration and real media adapters. Later plans should migrate direct text callers first, then add each media operation only with a real adapter and contract tests. Reviewers should scrutinize retry ownership, abort propagation, secret redaction and whether any UI bundle imports AI SDK providers.
