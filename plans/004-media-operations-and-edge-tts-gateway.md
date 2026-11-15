# Plan 004: Extend AI gateway for media operations and Edge TTS synthesis

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 2309cbe3..HEAD -- src/entrypoints/background/edge-tts.ts src/utils/ai-gateway`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/001-background-ai-gateway-foundation.md
- **Category**: architecture
- **Planned at**: commit `2309cbe3`, 2026-11-15

## Why this matters

Edge TTS audio synthesis and multimodal AI operations (vision analysis, image generation, speech-to-text) currently lack gateway orchestration, structured error normalization, health cooldown tracking, and attempt fallbacks. Extending the background AI gateway to handle media operations and TTS requests provides unified retry resilience, health tracking, and error reporting across all AI modalities in the extension.

## Current state

- Edge TTS synthesis (`src/entrypoints/background/edge-tts.ts`) calls WebSocket endpoint directly without attempt fallbacks or health cooldowns.
- Media operations (vision, image generation, transcription) are either handled ad-hoc or lack unified gateway attempt orchestration.
- Gateway types (`src/utils/ai-gateway/types.ts`) define `vision.generate`, `image.generate`, `speech.transcribe`, and `speech.synthesize`, but have no background dispatcher.

## Commands you will need

| Purpose      | Command                                                                                         | Expected on success          |
| ------------ | ----------------------------------------------------------------------------------------------- | ---------------------------- |
| Install      | `pnpm install`                                                                                  | exit 0                       |
| Format check | `pnpm fmt:check`                                                                                | exit 0, no unformatted files |
| Lint         | `pnpm lint`                                                                                     | exit 0, no errors            |
| Typecheck    | `pnpm type-check`                                                                               | exit 0, no errors            |
| Media tests  | `SKIP_FREE_API=true pnpm test -- src/entrypoints/background/__tests__/ai-media-gateway.test.ts` | pass                         |
| TTS tests    | `SKIP_FREE_API=true pnpm test -- src/entrypoints/background/__tests__/edge-tts.test.ts`         | pass                         |
| Full tests   | `SKIP_FREE_API=true pnpm test`                                                                  | all test suites pass         |
| Build        | `pnpm build && pnpm build:firefox`                                                              | exit 0                       |

## Scope

**In scope**:

- Edge TTS gateway routing:
  - `src/entrypoints/background/edge-tts.ts`
  - `src/entrypoints/background/__tests__/edge-tts.test.ts`
  - `src/utils/server/edge-tts/synthesize.ts`
- Media gateway operations:
  - `src/types/background-media.ts`
  - `src/entrypoints/background/ai-media-gateway.ts`
  - `src/entrypoints/background/__tests__/ai-media-gateway.test.ts`
  - `src/entrypoints/background/index.ts`
  - `src/utils/message.ts` (message handlers)
- Pinned routing and health cooldowns:
  - `src/utils/ai-gateway/health.ts`
  - `src/utils/ai-gateway/orchestrator.ts`
  - `src/utils/ai-gateway/planner.ts`

**Out of scope**:

- Offscreen document audio playback implementation.
- UI styling of speech player components.

## Git workflow

- Branch: `advisor/001-background-ai-gateway`
- Conventional commit: `feat(ai): add media gateway operations and TTS routing`

## Steps

### Step 1: Implement Edge TTS synthesis via gateway attempts

Update `src/entrypoints/background/edge-tts.ts` and tests `src/entrypoints/background/__tests__/edge-tts.test.ts`:

- Wrap Edge TTS WebSocket synthesis inside `executeGatewayAttempts`.
- Apply health tracking and retryable error classification for network/socket dropouts.

**Verify**: `SKIP_FREE_API=true pnpm test -- src/entrypoints/background/__tests__/edge-tts.test.ts` → all pass.

### Step 2: Implement Media Gateway operations dispatcher

Create `src/entrypoints/background/ai-media-gateway.ts` and `src/types/background-media.ts`:

- Define operations for `vision.generate`, `image.generate`, and `speech.transcribe`.
- Implement payload validation and error normalization.
- Register message handlers in `src/entrypoints/background/index.ts` and `src/utils/message.ts`.

**Verify**: `SKIP_FREE_API=true pnpm test -- src/entrypoints/background/__tests__/ai-media-gateway.test.ts` → all pass.

### Step 3: Integrate pinned routing and health cooldowns

Update `src/utils/ai-gateway/planner.ts` and `src/utils/ai-gateway/orchestrator.ts`:

- Support pinned route candidate selection when caller requests a specific provider.
- Record failure and cooldowns into `GatewayHealthRegistry`.

**Verify**: `SKIP_FREE_API=true pnpm test -- src/utils/ai-gateway` → all pass.

### Step 4: Verification gate

Run full verification suite.

**Verify**: `pnpm type-check && pnpm lint && SKIP_FREE_API=true pnpm test && pnpm build` → all exit 0.

## Test plan

- Unit tests for Edge TTS gateway synthesis retry on network disconnection.
- Unit tests for vision and image generation payload validation and error mappings.
- Pinned candidate routing test ensuring pinned route bypasses default cost ranking while respecting cooldown.

## Done criteria

- [ ] `pnpm type-check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm fmt:check` exits 0
- [ ] `SKIP_FREE_API=true pnpm test` exits 0
- [ ] Media operations and Edge TTS pass all automated tests

## STOP conditions

- If Edge WebSocket protocol cannot be wrapped in standard `AbortSignal` lifecycle.
- If media payloads exceed background message size limits.

## Maintenance notes

- Completes the full multi-modal AI Gateway roadmap.
