# Plan 006: Build the SaaS model catalog and tenant dashboard

> **Executor instructions**: Start only after the management API and model, pricing, budget, and request-log contracts are stable. Keep all UI access behind authorized management APIs.
>
> **Drift check**: `git diff --stat c44e88ea..HEAD -- packages/ai-gateway plans/ai-gateway-standalone-admin-dashboard.md`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/003-unified-routing-and-model-catalog.md, plans/004-enforce-budgets-and-accurate-pricing.md, plans/005-observability-and-provider-kit.md
- **Category**: direction
- **Planned at**: commit `c44e88ea`, 2026-11-17

## Why this matters

The existing dashboard proposal describes a broad SaaS control plane, but building it before model, budget, and request-log contracts stabilize would lock in provisional schemas. Deliver the usable customer workflow after those contracts land: browse models and capabilities, create/rotate credentials, configure allowed models and fallbacks, inspect usage and requests, and manage budgets. Platform-admin functions remain distinct from tenant functions, with strict server-side authorization.

## Current state

- `plans/ai-gateway-standalone-admin-dashboard.md` specifies Admin and Tenant navigation and recommends a separate Next.js App Router application.
- Current service management routes are in `packages/ai-gateway/server/routes/management.ts` and `models.ts`.
- Current SQLite model repository provides provider/enabled filters but is not yet a full metadata catalog.
- Current tenant entity includes provider/model allowlists and monthly spend field.
- Plans 003–005 establish catalog/pricing, budget, and request-log contracts required by this UI.
- Existing architecture requires dashboards to call Management API and never access database/provider APIs directly.

## Scope

**In scope**: separate Next.js dashboard app, generated or shared API client, platform admin and tenant role boundaries, catalog browser, tenant provider/model configuration, credential create/rotate/masked view, budgets, usage, request/attempt logs, audit history.

**Out of scope**: changing inference engine, direct database access from UI, displaying raw secrets, platform master tenant as a selectable tenant, payments/invoices, migrating SQLite to Postgres/Redis.

## Steps

### Step 1: Finalize API contract and authorization matrix

Document role/route/resource authorization for platform admin, tenant admin, tenant member, and API client. Reuse the stable contracts from preceding plans. Generate typed client from OpenAPI if the service exposes a complete schema; otherwise add a small explicit typed client. Ensure master tenant is hidden from customer list/detail routes.

**Verify**: API authorization tests cover every role/action pair and cross-tenant access; client typecheck passes.

### Step 2: Scaffold a separate dashboard application

Follow the existing plan's Next.js App Router, TypeScript, Tailwind, shared component, query/form, and test recommendations. Configure server-side session handling and call the Management API server-side for secrets and privileged actions. Do not place provider credentials in browser storage.

**Verify**: app build, typecheck, lint and smoke tests pass; bundle contains no DB driver or provider API clients.

### Step 3: Implement tenant workflows

Build model catalog browsing with filters for capability, provider, price and data policy; tenant settings for allowed providers/models and fallback preferences; masked credential creation/rotation; budgets; usage summary; request logs with attempt detail. Show unknown price and unsupported capability explicitly rather than filling guessed values.

**Verify**: component/API tests cover empty, loading, error and populated states; end-to-end tests prove tenant A cannot read or mutate tenant B data.

### Step 4: Implement platform admin workflows

Build provider/model controls, shared credential rotation, tenant lifecycle, global policy, usage and audit views. Require admin authorization server-side for every action. Exclude master tenant from destructive customer operations and expose its usage only in a dedicated platform operations view.

**Verify**: admin role tests cover allowed actions and non-admin denials; credential responses are masked; destructive actions require explicit confirmation and emit audit events.

### Step 5: Reconcile the existing dashboard proposal

Update `plans/ai-gateway-standalone-admin-dashboard.md` to mark superseded sections or link to the delivered feature plan. Avoid maintaining conflicting navigation, infrastructure, or authorization definitions.

**Verify**: docs review confirms one current dashboard contract and links to the relevant API/model/budget/log plans.

## Test plan

- API authorization matrix and cross-tenant isolation.
- UI tests for model filtering, fallback selection, budget form validation, masked secrets and request-log filters.
- E2E tenant and admin journeys.
- Build/dependency boundary check ensuring UI does not connect directly to database/provider.
- Use the test stack selected in the existing dashboard proposal unless repository-wide standards have changed.

## Done criteria

- [ ] Tenant users can browse models and manage only authorized tenant resources.
- [ ] Platform admins can manage shared providers/models/tenants with audited actions.
- [ ] Master tenant is not customer-selectable or exposed in tenant APIs.
- [ ] Credentials are write-only/masked and never persisted in browser storage.
- [ ] Usage, budget and request logs match backend records.
- [ ] Cross-tenant E2E tests pass.
- [ ] Dashboard build, typecheck, lint and tests pass.

## STOP conditions

- Management API authorization matrix is incomplete or dashboard would need direct DB access.
- Required model/budget/log API fields differ from preceding plans without a reviewed migration.
- Authentication/session design cannot distinguish platform admin from tenant users.

## Maintenance notes

Treat the dashboard as a client of the versioned Management API. Every new management action needs an authorization test and audit event. Revisit infrastructure only when measured SQLite limits or multi-instance deployment requirements justify a separate migration plan.
