# Plan 001: Establish the standalone SaaS tenant and master-tenant contract

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. Stop on any STOP condition. Update `plans/README.md` when complete.
>
> **Drift check**: `git diff --stat c44e88ea..HEAD -- packages/ai-gateway`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `c44e88ea`, 2026-11-17

## Why this matters

The standalone Node service already has tenant entities, API-key authentication, SQLite persistence, and tenant-scoped usage, but it has no explicit platform-owned tenant identity or complete lifecycle contract. Define a protected internal master tenant as the accounting owner for platform-originated requests that have no customer tenant. The master tenant has unlimited quota, while requests attributed to it still produce usage and audit records. This plan establishes identity and policy semantics before exposing the simplified public API or adding budgets and dashboards.

## Confirmed product decision

- The master tenant is an internal platform tenant, not a customer-visible template or selectable special tenant.
- System/platform requests without a customer tenant are attributed to this tenant.
- It has no quota ceiling, but usage and audit events remain recorded.
- Customer tenants remain subject to their configured policy; never infer unlimited status from a missing `maxMonthlySpendUsd` value.
- Master tenant credentials and API keys must not be exposed by tenant management endpoints.

## Current state

- `packages/ai-gateway/domain/entities/tenant.ts` defines `Tenant`, including optional `maxMonthlySpendUsd`, but no tenant kind or master marker.
- `packages/ai-gateway/adapters/db/schema/tenants.ts` stores tenants and API keys in SQLite. Slug is unique; API keys reference tenant IDs.
- `packages/ai-gateway/server/middlewares/authMiddleware.ts` sets tenant to `null` for anonymous development requests and validates API keys in production.
- `packages/ai-gateway/application/quotaService.ts` records a reservation with a default estimate; it does not enforce a spend limit.
- `packages/ai-gateway/application/inferenceService.ts` only reserves/releases/settles quota and records usage when `options.tenant` exists.
- `packages/ai-gateway/server/app.ts` creates the default SQLite store and wires auth, inference, management, and audit services.
- `packages/ai-gateway/server/standalone.ts` starts the service with SQLite by default.
- Existing top-level plan `plans/ai-gateway-standalone-admin-dashboard.md` describes a broader SaaS target using PostgreSQL/Redis/workers. This plan is scoped to the current SQLite service and does not migrate infrastructure.

Relevant current behavior:

```ts
// server/middlewares/authMiddleware.ts
c.set("tenant", null) // development anonymous context
```

```ts
// application/inferenceService.ts
if (options.tenant) {
  await this.quotaService.reserveCredits(options.tenant.id, requestId)
}
```

```ts
// application/quotaService.ts
async reserveCredits(tenantId: string, requestId: string, estimatedCredits = 0.05)
```

Follow package conventions: domain ports/entities stay framework-independent, SQLite-specific changes stay under `adapters/db`, and `server/app.ts` owns runtime wiring. Public Node-only APIs are exported from `packages/ai-gateway/server/index.ts`; core exports remain free of Node dependencies. Use dependency injection like `GatewayAppDependencies` in `server/app.ts`.

## Commands

| Purpose       | Command                                           | Expected |
| ------------- | ------------------------------------------------- | -------- |
| Typecheck     | `pnpm --filter @workmate-ai/ai-gateway typecheck` | exit 0   |
| Package tests | `pnpm --filter @workmate-ai/ai-gateway test`      | all pass |

## Scope

**In scope**:

- Tenant domain/schema and SQLite repository mapping needed for explicit platform-owned tenant identity.
- Idempotent master-tenant provisioning during standalone app composition.
- Internal request context for platform-originated requests and fallback attribution for unauthenticated development requests only.
- Explicit unlimited-quota policy for master tenant while preserving usage and audit writes.
- Tenant-management protections and tests ensuring customer tenant APIs cannot enumerate or mutate the master tenant.

**Out of scope**:

- PostgreSQL, Redis, queues, workers, or dashboard implementation.
- Public endpoint or API-key access to the master tenant.
- General budget enforcement for customer tenants (Plan 004).
- Model catalog/pricing changes (Plan 003).
- Broad inference API redesign (Plan 002).

## Steps

### Step 1: Define master-tenant identity and policy explicitly

Add a typed tenant kind or equivalent explicit immutable marker to the tenant domain model and SQLite schema. Add a migration compatible with existing SQLite databases; existing rows must remain customer tenants. Define a stable internal ID/slug and ensure customer create/update routes reject attempts to set or change the platform marker. Do not use `maxMonthlySpendUsd: null` as the only representation of unlimited policy.

**Verify**: add migration/repository tests proving existing tenants remain customers and the master marker is persisted and read back; `pnpm --filter @workmate-ai/ai-gateway test` passes.

### Step 2: Provision the master tenant idempotently

Add a server composition helper that creates or loads exactly one platform tenant after schema initialization. Repeated `createGatewayApp()` calls against the same database must not duplicate it. Keep provisioning out of browser/core entry points. Return the platform tenant from the composition root only as an internal service dependency; do not expose it from public tenant list APIs.

**Verify**: integration test creates the app twice against the same SQLite database and observes one stable platform tenant; package typecheck and tests pass.

### Step 3: Thread trusted request attribution through inference

Introduce an explicit trusted request context that distinguishes customer API-key requests, platform-originated requests, and development-only anonymous requests. Production public inference routes must continue to require a valid API key. Platform-originated calls may be assigned the master tenant only through an internal trusted path, never from a caller-controlled `tenantId` body/header. Development anonymous requests may use the master tenant for accounting but must remain unavailable in production.

**Verify**: route tests prove missing/invalid production keys remain 401, valid customer keys preserve customer attribution, and only trusted internal/dev contexts resolve to master.

### Step 4: Make master usage unlimited without skipping accounting

Adjust inference accounting so master-tenant requests bypass quota rejection/reservation limits but still record usage, provider/model, token counts, latency, status, and audit context. If reservation records are retained for operational consistency, mark them as unlimited/internal and do not represent a synthetic balance or customer charge. Keep customer reservation behavior unchanged pending Plan 004.

**Verify**: inference tests prove master requests succeed regardless of customer budget state and still write one usage record and audit event for both streaming and non-streaming completion; failure/interruption records retain correct status.

### Step 5: Protect master tenant in management APIs

Review `server/routes/management.ts` and repository methods. Ensure customer-scoped list/get/update/delete paths cannot reveal or mutate the master tenant, platform credentials, or platform API keys. Admin-only provisioning/configuration remains explicit and audited. Avoid adding a general-purpose tenant selector for the master tenant.

**Verify**: management API tests cover tenant enumeration, ID-based access, update/delete attempts, and credential access; all unauthorized cases return the existing domain/API error format.

## Test plan

- Add domain/schema defaults and migration tests.
- Add SQLite provisioning idempotency tests.
- Add auth-context tests for production, development, customer-key, and trusted internal calls.
- Add inference tests for master unlimited accounting on success, failure, streaming completion, and client interruption.
- Add tenant management isolation tests.
- Use `packages/ai-gateway/server/server.test.ts` and `application/inferenceService.test.ts` as structural patterns.

## Done criteria

- [ ] Exactly one stable internal master tenant is provisioned idempotently.
- [ ] Public customers cannot select, enumerate, mutate, or access master credentials.
- [ ] Production public inference still requires a valid customer API key.
- [ ] Trusted platform requests are attributed to master and are not blocked by quota.
- [ ] Master requests still write usage and audit records for stream and non-stream outcomes.
- [ ] Existing customer tenant behavior remains unchanged.
- [ ] `pnpm --filter @workmate-ai/ai-gateway typecheck` and package tests pass.

## STOP conditions

- Existing SQLite migration framework cannot safely add the tenant marker without a data migration strategy.
- Authentication cannot distinguish trusted internal context from caller-controlled input.
- Usage ledger semantics require treating master usage as billable customer usage.
- Any existing endpoint exposes all tenants or tenant credentials without an admin boundary; report the access-control issue before extending it.

## Maintenance notes

Keep master identity as an explicit domain policy, not a magic slug check scattered across inference, management, and persistence. Future customer budgets must exclude master through this policy and must never treat arbitrary tenants with no spend limit as unlimited. If the service moves from SQLite to a distributed database, preserve unique master provisioning under concurrent startup.
