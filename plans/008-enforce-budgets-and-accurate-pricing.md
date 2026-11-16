# Plan 008: Enforce tenant budgets and calculate model pricing accurately

> **Executor instructions**: Implement only after master-tenant semantics and catalog metadata are established. Update `plans/README.md` when done.
>
> **Drift check**: `git diff --stat c44e88ea..HEAD -- packages/ai-gateway`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/005-standalone-saas-master-tenant.md, plans/007-unified-routing-and-model-catalog.md
- **Category**: correctness
- **Planned at**: commit `c44e88ea`, 2026-11-17

## Why this matters

The current `QuotaService` creates a reservation but does not compare accumulated spend to a policy. `InferenceService` estimates all model cost using `$2.5/M tokens` and a fixed customer multiplier. This can both fail to enforce tenant limits and misstate cost. Add explicit period budgets and pricing snapshots, while keeping the platform master tenant unlimited and fully accounted.

## Current state

- `application/quotaService.ts` reserves a default `$0.05` estimate and delegates to `UsageLedger`.
- `domain/entities/tenant.ts` has optional `maxMonthlySpendUsd` but no period/mode/policy entity.
- `domain/entities/usage.ts` records prompt/completion/total tokens and provider/customer cost.
- `application/inferenceService.ts` uses total tokens at a fixed rate in both stream and non-stream paths.
- `adapters/db/schema/ledger.ts` stores reservations and usage records in SQLite.
- `adapters/db/sqlite/sqliteRepos.ts` implements reservation persistence and tenant usage summary.
- Plan 005 defines master tenant unlimited semantics: it bypasses quota enforcement but records usage/audit.
- Plan 007 defines catalog pricing metadata; consume its versioned input/output rates and capability model.

## Scope

**In scope**: budget policy entity/repository, daily/weekly/monthly/lifetime scope for tenant/application/API key, hard/soft cap, atomic reservation, idempotent settle/release, pricing snapshots with input/output/cached/reasoning token classes where provider reports them, master unlimited behavior.

**Out of scope**: payment processing, invoices, wallet top-ups, customer-facing billing UI, speculative cost estimation by model call, external pricing crawler.

## Steps

### Step 1: Define budget and cost policy contracts

Create typed budget periods, scope, hard/soft mode, currency, and pricing version/effective date. Define unknown-price behavior: preserve usage, set cost to unknown, and do not invent a rate. BYOK cost and any platform customer charge must be distinguishable; customer markup is injected policy, not hardcoded in inference.

**Verify**: unit tests validate scope precedence, period boundaries in UTC, and unknown price representation.

### Step 2: Implement atomic budget checks and reservations

Add repository operations that atomically calculate spend plus outstanding reservations and reserve request cost under the applicable hard budget. Use `requestId` as idempotency key. Soft budgets allow the request but report exceeded status; hard budgets reject before upstream execution. Ensure concurrent requests cannot both pass based on the same stale balance.

**Verify**: SQLite integration tests with concurrent reservation attempts prove the hard limit cannot be exceeded by races; retries with the same requestId do not double-reserve.

### Step 3: Reconcile final cost and release reservation

Calculate cost from catalog rate and token categories, snapshot the rate/version onto the usage record, settle actual cost, and release unused reservation. Record estimated/actual delta. For failed/aborted requests, follow explicit policy and record zero or partial usage only when provider reported usage. Master tenant skips limit enforcement but still writes usage and cost metadata.

**Verify**: tests cover exact arithmetic, missing rates, partial usage, retries, failed requests, streams, interruption, and master tenant.

### Step 4: Add budget management contracts

Expose admin and tenant-scoped read/write APIs with authorization. Customer tenant can only manage its own allowed budgets; only platform admin can change global defaults or policies. Validate hard limits, period, and scope. Audit every policy change.

**Verify**: API tests prove tenant isolation, policy validation, audit records, and 403/404 behavior for cross-tenant IDs.

## Test plan

- Period rollover and timezone tests (UTC boundaries).
- Race/idempotency integration tests using SQLite.
- Pricing by input/output/cached token rates and immutable pricing snapshot.
- BYOK vs shared credential accounting.
- Master tenant unlimited enforcement bypass with usage record preserved.
- Streaming success, provider error with usage, client disconnect.
- Follow repository transaction and Vitest conventions.

## Done criteria

- [ ] Customer budget is enforced according to hard/soft mode and period.
- [ ] Reservations are atomic and idempotent.
- [ ] Pricing comes from catalog rates, not a fixed universal multiplier.
- [ ] Unknown rates remain unknown, with token usage retained.
- [ ] Master tenant bypasses limits while usage/audit remain intact.
- [ ] Cross-tenant budget access is denied and audited.
- [ ] Package typecheck and tests pass.

## STOP conditions

- SQLite transaction mechanism cannot ensure atomic aggregate check and reservation.
- Provider usage categories cannot distinguish token classes; store known values without guessing missing categories.
- Billing semantics for failed requests, soft caps, or BYOK cannot be derived from existing product policy. Preserve usage, do not charge speculatively, and request a policy decision.

## Maintenance notes

Budget logic must remain separate from routing. Pricing rows are effective-dated; do not update a rate in place if old usage records depend on it. A future Postgres adapter must preserve idempotency and atomic reservation guarantees.
