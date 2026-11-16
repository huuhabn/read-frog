# Plan 005: Add request observability and a provider conformance kit

> **Executor instructions**: Keep request, attempt, usage, and admin audit records distinct. Update `plans/README.md` when done.
>
> **Drift check**: `git diff --stat c44e88ea..HEAD -- packages/ai-gateway`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/003-unified-routing-and-model-catalog.md, plans/004-enforce-budgets-and-accurate-pricing.md
- **Category**: direction
- **Planned at**: commit `c44e88ea`, 2026-11-17

## Why this matters

The gateway records aggregate usage and audit events, but operational diagnosis needs a request record and ordered attempt records showing which provider/model was tried, latency, first-token latency, timeout/error, and final outcome. Vercel's logs make each routed attempt inspectable. A reusable adapter conformance suite will also lower the cost of adding providers while checking streaming, cancellation, usage, and credential safety consistently.

## Current state

- `domain/entities/usage.ts` has usage/cost/latency, but not ordered route attempts.
- `domain/entities/auditLog.ts` covers administrative actions, a different concern.
- `adapters/db/schema/ledger.ts` stores usage records and reservations.
- `application/routing/routeExecutor.ts` already observes attempts in-process but does not persist a full request timeline.
- `adapters/providers/base.ts` implements fetch, timeout, abort and response/error normalization.
- Provider adapters live in `adapters/providers/` and include API and web-session implementations.
- README documents provider extension by registering a `BaseProviderAdapter` subclass.

## Scope

**In scope**: request/attempt domain records, SQLite schema/repository, request correlation IDs, configurable prompt-free metadata retention, optional OpenTelemetry port, provider conformance test helpers and fixtures.

**Out of scope**: admin dashboard UI, prompt/response retention by default, external log vendor lock-in, automatic provider/model scraping.

## Steps

### Step 1: Define request and attempt records

Represent one inbound request and its ordered attempts separately from usage totals and admin audit logs. Include tenant/application/API key IDs, requested model, final model/provider, credential class (never secret), timestamps, latency, first-token latency, status, typed error code, timeout metadata, and route decision. Do not persist prompt or response text by default.

**Verify**: domain tests validate status transitions and prohibit raw credential fields in the record type.

### Step 2: Persist lifecycle events and correlate responses

Inject a request recorder port into inference; write request start, each attempt outcome, and terminal state. Return `x-request-id` and structured attempts metadata to HTTP clients. Ensure streaming records finalize exactly once on completion, error, or disconnect. Add retention configuration and paginated filtering by tenant, provider, model, status, and time range.

**Verify**: SQLite integration tests cover success/failover/error/abort and assert exactly one terminal request record with ordered attempts; API tests prove tenant isolation and pagination.

### Step 3: Add optional OpenTelemetry export port

Define a host-neutral event/export interface. Add an optional Node adapter only under server entry; core imports must not gain OpenTelemetry or Node dependencies. Export sanitized spans and counters with request/attempt IDs, provider/model, status and latency, but no prompt, response, API key, cookie or session token.

**Verify**: core dependency-boundary test and exporter tests assert sensitive fields are absent.

### Step 4: Build provider conformance test helpers

Create reusable tests for URL/headers/body, credential masking, timeout/abort, non-2xx mapping, streaming framing, usage parsing, and capability claims. Allow providers to declare unsupported cases; make skips explicit. Convert representative API and web-session adapters first, then document how a new provider runs the suite.

**Verify**: all currently registered adapters either pass supported conformance tests or declare a tested unsupported capability; package tests pass.

## Test plan

- Lifecycle persistence tests for non-stream and stream success.
- Multi-attempt ordering and failure metadata tests.
- Exactly-once terminal event tests for disconnect and exceptions.
- Tenant isolation, pagination and retention tests.
- Sensitive metadata redaction tests.
- Provider suite tests with mocked fetch and deterministic streams.

## Done criteria

- [ ] Each request can be inspected without storing prompt/response content.
- [ ] Each provider attempt is ordered and has status/latency/error metadata.
- [ ] Stream completion/abort produces one terminal record.
- [ ] HTTP exposes a request ID and safe attempt metadata.
- [ ] Optional telemetry does not add Node dependencies to core.
- [ ] Every registered provider has conformance coverage or explicit tested capability exclusions.
- [ ] Package typecheck and tests pass.

## STOP conditions

- Existing audit/usage schemas cannot be migrated without dropping customer history.
- Request-level records require prompt/response persistence to function; stop and propose a privacy-preserving alternative.
- A provider conformance expectation would break documented web-session behavior; record the exception rather than normalizing it incorrectly.

## Maintenance notes

Keep operational logs separate from admin audit logs and billing records. Treat provider/model IDs and error messages as untrusted metadata and sanitize before logs. Add future adapters to the conformance suite before registering them by default.
