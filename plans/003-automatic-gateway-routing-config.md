# Plan 003: Add automatic gateway routing configuration and audit tracking

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat c34fb094..HEAD -- src/types/config src/utils/config/migration-scripts src/entrypoints/options/pages/providers`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-route-text-callers-through-gateway.md
- **Category**: architecture
- **Planned at**: commit `c34fb094`, 2026-11-15

## Why this matters

The AI gateway supports candidate failover, but users currently have no UI controls to enable/disable automatic fallback, configure maximum attempts, or restrict specific sensitive providers from being used as automatic fallbacks. Furthermore, audit logs do not track route IDs or failover attempts. Adding schema version v124, audit log fields, and an Options configuration page provides full transparency and user control over routing decisions.

## Current state

- Config schema is at version 123 (`CURRENT_CONFIG_VERSION = 123`).
- `src/types/config/config.ts` lacks `aiGateway` section.
- Dexie audit-log table (`src/utils/db/dexie/tables/audit-log.ts`) lacks `routeId`, `attemptCount`, and `fallbackAttempt` tracking.
- Options page has no "Automatic AI routing" configuration section.

## Commands you will need

| Purpose      | Command                                                                                                        | Expected on success          |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Install      | `pnpm install`                                                                                                 | exit 0                       |
| Format check | `pnpm fmt:check`                                                                                               | exit 0, no unformatted files |
| Lint         | `pnpm lint`                                                                                                    | exit 0, no errors            |
| Typecheck    | `pnpm type-check`                                                                                              | exit 0, no errors            |
| Config tests | `SKIP_FREE_API=true pnpm test -- src/utils/config/migration-scripts/v123-to-v124.test.ts`                      | pass                         |
| Audit tests  | `SKIP_FREE_API=true pnpm test -- src/utils/audit-log/__tests__/audit-log-service.test.ts`                      | pass                         |
| Options test | `SKIP_FREE_API=true pnpm test -- src/entrypoints/options/pages/providers/__tests__/automatic-routing.test.tsx` | pass                         |
| Full tests   | `SKIP_FREE_API=true pnpm test`                                                                                 | all test suites pass         |
| Build        | `pnpm build && pnpm build:firefox`                                                                             | exit 0                       |

## Scope

**In scope**:

- Config schema and migration:
  - `src/types/config/ai-gateway.ts`
  - `src/types/config/config.ts`
  - `src/utils/constants/config.ts` (`CURRENT_CONFIG_VERSION = 124`)
  - `src/utils/config/migration-scripts/v123-to-v124.ts`
  - `src/utils/config/migration-scripts/v123-to-v124.test.ts`
  - `src/utils/config/__tests__/example/v124.ts`
- Audit log tracking:
  - `src/utils/db/dexie/tables/audit-log.ts`
  - `src/utils/audit-log/audit-log-service.ts`
  - `src/utils/audit-log/__tests__/audit-log-service.test.ts`
  - `src/entrypoints/options/pages/advanced/audit-logs/audit-log-detail-modal.tsx`
- Options UI:
  - `src/entrypoints/options/pages/providers/automatic-routing/index.tsx`
  - `src/entrypoints/options/pages/providers/__tests__/automatic-routing.test.tsx`
  - `src/entrypoints/options/pages/providers/index.tsx`
  - Locale strings across `src/locales/*.yml`

**Out of scope**:

- Modifying provider connection forms or API keys.
- Changing sidepanel layouts.

## Git workflow

- Branch: `advisor/001-background-ai-gateway`
- Conventional commit: `feat(ai): configure automatic gateway routing`

## Steps

### Step 1: Define config schema and v123 -> v124 migration

Create `src/types/config/ai-gateway.ts`:

- Define `AIGatewayConfigSchema`: `{ enabled: boolean; maxAttempts: number; excludedProviderIds: string[] }`.
- Update `src/types/config/config.ts` and `src/utils/constants/config.ts` to version 124.
- Implement migration in `src/utils/config/migration-scripts/v123-to-v124.ts`.
- Add test in `src/utils/config/migration-scripts/v123-to-v124.test.ts`.

**Verify**: `SKIP_FREE_API=true pnpm test -- src/utils/config/migration-scripts/v123-to-v124.test.ts` → all pass.

### Step 2: Add gateway routing fields to audit log

Update `src/utils/db/dexie/tables/audit-log.ts` and `src/utils/audit-log/audit-log-service.ts`:

- Add `gatewayRouteId`, `attemptCount`, `isFallbackAttempt` to audit log record schema.
- Update `audit-log-detail-modal.tsx` to display gateway route and attempt count when present.

**Verify**: `SKIP_FREE_API=true pnpm test -- src/utils/audit-log/__tests__/audit-log-service.test.ts` → all pass.

### Step 3: Implement Automatic Routing UI in Options

Create `src/entrypoints/options/pages/providers/automatic-routing/index.tsx`:

- Render switches for enabling automatic failover and toggling fallback exclusion per provider.
- Number of attempts selector (`1` to `3`).
- Mount into `src/entrypoints/options/pages/providers/index.tsx`.
- Add i18n keys to `src/locales/*.yml`.

**Verify**: `SKIP_FREE_API=true pnpm test -- src/entrypoints/options/pages/providers/__tests__/automatic-routing.test.tsx` → all pass.

### Step 4: Verification gate

Run full verification suite.

**Verify**: `pnpm type-check && pnpm lint && SKIP_FREE_API=true pnpm test && pnpm build` → all exit 0.

## Test plan

- Migration unit tests verifying default `aiGateway` values injected for v123 config.
- Audit log service tests verifying routeId and attemptCount preservation.
- Options UI component tests for toggle interactions and atom synchronization.

## Done criteria

- [ ] `pnpm type-check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm fmt:check` exits 0
- [ ] `SKIP_FREE_API=true pnpm test` exits 0
- [ ] Config migration v123 -> v124 is tested and verified

## STOP conditions

- If migration corrupts existing stored provider configurations or API keys.
- If UI renders unlocalized text in supported languages.

## Maintenance notes

- Coordinates with Plan 004 for media gateway routing audit logs.
