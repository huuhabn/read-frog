# AI Gateway Standalone Service

## 1. Overview

Build a standalone AI Gateway service with a separate web dashboard for
platform administrators and SaaS tenants.

The Gateway exposes inference APIs and management APIs. The dashboard
consumes only the Management API; it must never connect directly to
PostgreSQL, Redis, provider APIs, or internal workers.

The platform supports a **Hybrid credential model**:

- **Shared API Keys:** the platform owns provider credentials and
  allocates usage quota or credits to tenants.
- **BYOK (Bring Your Own Key):** tenants connect their own provider
  credentials.
- **Hybrid:** tenants can use Shared or BYOK credentials according to
  platform and tenant policies.

The solution must remain provider-agnostic and usable by Laravel,
Next.js, Node.js, Bun, and other HTTP clients.

## 2. High-level architecture

```text
SaaS Applications
       |
       | Inference API (REST / SSE)
       v
+------------------------------------+
|         AI Gateway Service         |
|                                    |
| Authentication / Authorization     |
| Tenant & Application Context       |
| Credential Resolution              |
| Quota / Credit Reservation         |
| Provider Routing                   |
| Retry / Fallback                   |
| Usage / Cost Metering              |
| Management API                     |
+------------------------------------+
       |                       ^
       |                       | HTTPS Management API
       v                       |
 Provider APIs           +---------------------+
                         | Admin / Tenant UI   |
                         | Next.js Dashboard   |
                         +---------------------+

Infrastructure:
- PostgreSQL: persistent configuration, usage, ledger, audit
- Redis: cache, rate limits, distributed locks
- Queue: asynchronous usage events, settlement, reconciliation
- Workers: background processing
```

### Architectural boundaries

- Gateway Core must not depend on Hono, PostgreSQL, Redis, or a
  specific provider.
- Provider adapters implement provider contracts and do not depend on
  the dashboard or HTTP server.
- Management API is the only interface used by the dashboard.
- Admin and tenant interfaces share UI primitives but have different
  authorization boundaries.
- API server and workers may run as separate processes/containers from
  the same codebase.

## 3. Applications and access surfaces

### Platform Admin

Platform administrators manage the complete Gateway:

- Providers and models
- Platform credentials
- Applications and tenants
- Pricing and routing defaults
- Tenant policies and quotas
- Usage, costs, and credit adjustments
- Audit logs and system health

### Tenant Dashboard

Tenant users manage only their own configuration:

- AI provider mode (Shared, BYOK, Hybrid)
- Own provider credentials
- Allowed provider/model preferences
- Usage and cost reports
- Credit balance and quota
- Tenant API keys
- Usage limits and notifications, where permitted

Tenant users must never be able to access platform credentials, other
tenants, platform pricing controls, or global policies.

## 4. Recommended frontend stack

---

Area Recommendation

---

Framework Next.js App Router

Language TypeScript strict

Styling Tailwind CSS 4

Components shadcn/ui

Data fetching TanStack Query

Forms React Hook Form

Validation Zod

Charts Recharts

API contract OpenAPI-generated types/client
where practical

Authentication Secure server-side session or
short-lived access tokens

Testing Vitest, React Testing Library,
Playwright
-----------------------------------------------------------------------

The dashboard should be a separate deployable application. It can live
in the same repository without requiring a monorepo package
architecture.

## 5. Dashboard information architecture

### 5.1 Platform Admin navigation

```text
Admin
├── Overview
├── Providers
│   ├── Provider List
│   ├── Provider Details
│   └── Credentials
├── Models
│   ├── Model Registry
│   ├── Model Capabilities
│   └── Pricing
├── Applications
├── Tenants
│   ├── Tenant List
│   ├── Tenant Details
│   ├── Provider Configurations
│   ├── Policies
│   └── Quotas & Credits
├── Routing
│   ├── Global Defaults
│   └── Routing Policies
├── Usage & Costs
├── Credit Ledger
├── Audit Logs
└── System Settings
```

### 5.2 Tenant navigation

```text
Tenant
├── Overview
├── AI Settings
├── Providers & Models
├── API Keys
├── Usage
├── Credits & Quota
└── Activity
```

## 6. Screen specifications

### 6.1 Overview dashboard

Platform admin metrics:

- Total requests and successful requests
- Input/output tokens
- Provider cost
- Customer charges or credits consumed
- Active tenants and applications
- Error rate
- Average and percentile latency
- Provider availability

Tenant overview:

- Requests and token usage
- Usage against quota
- Credit balance
- Provider/model usage breakdown
- Recent requests and errors

Metrics must clearly distinguish provider cost from customer charge.

### 6.2 Providers

Provider list fields:

- Provider name and slug
- Enabled/disabled status
- Credential status
- Supported capabilities
- Health status and last health check
- Number of available models

Provider detail actions:

- Add or update platform credential
- Enable or disable provider
- Configure endpoint and timeout
- Test connection
- View available models
- Inspect health and recent errors

Provider credentials must be write-only in the UI. After saving, show a
masked identifier or configured status, never the original secret.

### 6.3 Models

Model registry fields:

- Provider
- Provider model identifier
- Display name
- Input/output modalities
- Context window
- Streaming support
- Tool calling support
- Embeddings support
- Availability status
- Pricing version

Model pricing should be versioned with effective dates. Historical usage
must retain the pricing version used at request time.

### 6.4 Tenants and applications

Tenant list:

- Tenant identifier and name
- Status
- Linked applications
- Credential mode
- Subscription reference
- Quota and credit status
- Created date

Tenant detail tabs:

- Overview
- Applications
- Credentials
- Provider configuration
- Policies
- Quotas and credits
- Usage and costs
- Audit history

Applications represent SaaS products or backend integrations that are
authorized to call the Gateway. API keys should be scoped to an
application and, where applicable, a tenant.

### 6.5 Credentials and BYOK

Credential form:

- Provider
- Credential label
- API key / secret
- Optional base URL, only for supported custom endpoints
- Optional organization/project identifier
- Validation/test action

Credential lifecycle:

- Create
- Validate
- Rotate
- Revoke
- Disable

Security requirements:

- Encrypt secrets at rest using envelope encryption.
- Use a KMS-managed key-encryption key where available.
- Never return decrypted secrets from APIs.
- Never log credentials or include them in traces/errors.
- Restrict decryption to the execution path that needs the credential.
- Record credential changes in audit logs.
- Validate custom endpoints against SSRF, private-network, localhost,
  and cloud metadata access.

### 6.6 Tenant AI Settings

The tenant can select a permitted credential mode:

- Shared: use platform credentials.
- BYOK: use tenant-owned credentials.
- Hybrid: allow both according to policy.

Configuration precedence:

1.  Request-level choice, only if authorized.
2.  Tenant policy.
3.  Platform default.

A request override must never bypass provider permissions, model
allowlists, budget limits, credential ownership, or tenant isolation.

Tenant settings should include:

- Default provider
- Default model
- Allowed providers
- Allowed models
- Credential mode
- Routing preference
- Usage limits, if tenant-editable
- Fallback policy, if tenant-editable

### 6.7 Routing and policies

Admin controls:

- Manual provider/model selection
- Priority routing
- Capability-based routing
- Retry count and eligible error classes
- Fallback chain
- Provider/model allowlists
- Per-tenant overrides

Advanced strategies such as lowest-cost, weighted, latency-based, and
circuit-breaker-aware routing can be added after the MVP.

Do not allow fallback to another provider after streaming content has
already been emitted to the client unless the API explicitly supports a
safe restart protocol.

### 6.8 Usage, costs, and credits

Usage filters:

- Date range
- Application
- Tenant
- Provider
- Model
- Credential mode
- Request status

Display separate metrics:

- Provider cost: what the platform or tenant owes the provider.
- Customer charge: what the SaaS charges the customer.
- Token usage: provider-reported or estimated usage.
- Credit consumption: ledger-based customer balance changes.

Credit ledger entries must be immutable. Corrections should be
represented by compensating transactions, not by editing historical
entries.

## 7. Management API outline

The dashboard communicates with the Gateway over authenticated HTTPS.

### Platform endpoints

Endpoint Purpose

---

`GET /v1/admin/dashboard` Platform metrics
`/v1/admin/providers` Manage providers
`/v1/admin/models` Manage models and capabilities
`/v1/admin/pricing` Manage pricing versions
`/v1/admin/applications` Manage SaaS applications
`/v1/admin/tenants` Manage tenants
`/v1/admin/policies` Manage global policies
`/v1/admin/usage` Platform usage analytics
`/v1/admin/audit-logs` Audit history

### Tenant endpoints

---

Endpoint Purpose

---

`GET /v1/tenant/settings` Read tenant AI settings

`PATCH /v1/tenant/settings` Update permitted settings

`/v1/tenant/credentials` Create, list, rotate, revoke BYOK
credentials

`/v1/tenant/providers` Read permitted provider
configurations

`/v1/tenant/models` Read allowed models

`/v1/tenant/usage` Tenant usage analytics

`/v1/tenant/credits` Credit balance and ledger

`/v1/tenant/api-keys` Manage tenant API keys, if
supported
-----------------------------------------------------------------------

Exact routes and request/response schemas should be documented in
OpenAPI before frontend implementation.

### Inference endpoints

Endpoint Purpose

---

`POST /v1/chat/completions` Chat completion and SSE streaming
`GET /v1/models` Models visible to the caller
`POST /v1/embeddings` Embeddings, when enabled
`GET /v1/usage` Usage for the authenticated scope

OpenAI compatibility should be documented per endpoint and feature. Do
not claim full compatibility unless behavior and schemas are actually
compatible.

## 8. Backend domain model

Suggested core entities:

Entity/table Responsibility

---

`applications` Registered SaaS integrations
`tenants` Customer tenants
`tenant_applications` Tenant/application relationship
`api_keys` Hashed Gateway API keys and scopes
`providers` Provider definitions
`models` Provider model registry
`model_pricing` Versioned pricing
`platform_credentials` Encrypted platform credentials
`tenant_credentials` Encrypted BYOK credentials
`tenant_provider_configs` Tenant provider configuration
`tenant_policies` Tenant routing and access policies
`ai_requests` Request lifecycle records
`ai_usage_records` Token usage
`ai_cost_records` Provider cost
`ai_quotas` Quota limits and periods
`ai_credit_accounts` Current credit account state
`ai_credit_transactions` Immutable credit ledger
`audit_logs` Administrative and security events
`usage_events` Outbox/event delivery records

Every tenant-scoped query must enforce tenant scope server-side.
Composite indexes should support tenant/time-based usage queries.
PostgreSQL Row-Level Security may be added as defense in depth.

Do not persist prompts and completions by default. If content logging is
required, define purpose, consent/authorization, access controls,
retention, and deletion policies.

## 9. Credit reservation and settlement

For Shared usage, reserve estimated credits before dispatching the
provider request.

```text
PENDING
   |
   v
RESERVED
   |
   +----> COMPLETED ----> SETTLED
   |
   +----> FAILED --------> RELEASED
   |
   +----> UNKNOWN -------> RECONCILIATION
```

Requirements:

- Reservation must be atomic under concurrent requests.
- Settlement must be idempotent.
- Failed requests can release reservation only when provider execution
  is known not to have incurred cost.
- Unknown provider outcomes require reconciliation.
- Streaming usage should be settled after completion or marked for
  reconciliation if interrupted.
- BYOK provider cost is generally billed directly by the provider to
  the tenant; the Gateway may still meter usage or charge a separate
  platform fee.

## 10. Authentication and authorization

Use separate access boundaries:

- Platform admin identity and roles.
- Tenant user identity and roles.
- SaaS application credentials for inference.
- Tenant-scoped API keys, where applicable.
- Internal service credentials for service-to-service operations.

Recommended roles:

Role Access

---

Platform Super Admin Full platform control
Platform Operator Provider and operational management
Billing Admin Usage, costs, credits, pricing permissions
Tenant Owner Full access within own tenant
Tenant Admin Tenant configuration and credentials
Tenant Developer API keys and technical settings
Tenant Viewer Read-only usage and configuration

Enforce authorization on every backend operation. Hiding UI elements is
not an authorization mechanism.

## 11. Frontend project structure

```text
dashboard/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (admin)/
│   │   │   ├── dashboard/
│   │   │   ├── providers/
│   │   │   ├── models/
│   │   │   ├── applications/
│   │   │   ├── tenants/
│   │   │   ├── credentials/
│   │   │   ├── routing/
│   │   │   ├── usage/
│   │   │   ├── billing/
│   │   │   ├── audit-logs/
│   │   │   └── settings/
│   │   └── (tenant)/
│   │       ├── overview/
│   │       ├── ai-settings/
│   │       ├── providers/
│   │       ├── api-keys/
│   │       ├── usage/
│   │       └── credits/
│   ├── components/
│   ├── features/
│   │   ├── providers/
│   │   ├── models/
│   │   ├── tenants/
│   │   ├── credentials/
│   │   ├── routing/
│   │   ├── usage/
│   │   └── billing/
│   ├── hooks/
│   ├── lib/
│   │   ├── api/
│   │   ├── auth/
│   │   └── validation/
│   └── types/
├── package.json
└── next.config.ts
```

Keep API clients, schemas, and feature components organized by domain.
Generate types from OpenAPI where practical to reduce contract drift.

## 12. Deployment

Suggested container/process topology:

```text
                 Nginx / Load Balancer
                          |
              +-----------+-----------+
              |                       |
         Gateway API             Dashboard
              |
       +------+------+
       |             |
   API replicas   Worker replicas
       |             |
       +------+------+
              |
       PostgreSQL / Redis / Queue
```

The dashboard can be deployed separately from the Gateway API. The
Gateway API and workers can use the same application image with
different entry commands.

Start with Docker Compose for local development and a small deployment.
Split API and worker scaling when traffic and queue load justify it.

## 13. Implementation phases

### Phase 1 --- UI foundation

- Authentication and role-based layouts
- Platform dashboard shell
- Provider list and provider details
- Model registry
- OpenAPI-backed API client

### Phase 2 --- Tenant management

- Applications
- Tenant list and details
- Tenant policies
- Tenant AI settings
- Provider allowlists

### Phase 3 --- Hybrid credentials

- Platform credentials
- Tenant BYOK credentials
- Credential validation
- Rotation and revocation
- Secret masking and audit logs

### Phase 4 --- Usage and billing UI

- Usage dashboards
- Provider cost reports
- Credit balances
- Immutable credit ledger
- Quota configuration

### Phase 5 --- Routing and operations

- Routing policies
- Retry/fallback controls
- Provider health
- Audit logs
- Operational alerts

### Phase 6 --- Production hardening

- E2E tests
- Tenant isolation tests
- Permission tests
- Accessibility and responsive checks
- Load testing
- Security review
- Backup and recovery verification

## 14. MVP acceptance criteria

The first usable release is complete when:

1.  A platform admin can register and configure a provider.
2.  A platform admin can enable models and set versioned pricing.
3.  A platform admin can register applications and tenants.
4.  A tenant can configure Shared, BYOK, or Hybrid mode within allowed
    policies.
5.  BYOK secrets are encrypted, masked, and never returned after
    creation.
6.  An application can call the inference API with authenticated tenant
    context.
7.  Provider usage and cost are recorded with the correct tenant and
    credential mode.
8.  Shared quota reservation and settlement are concurrency-safe and
    idempotent.
9.  Tenant users cannot access another tenant's data or credentials.
10. Admin actions and credential changes are auditable.
11. Streaming requests are metered and interrupted requests have a
    defined reconciliation path.

## 15. Recommended MVP scope

Build first:

- Providers: OpenAI, Gemini, Anthropic
- Chat Completions API with SSE
- Provider/model registry
- Platform Shared credentials
- Tenant BYOK credentials
- Tenant/application authentication
- Basic manual and priority routing
- Retry and safe fallback
- Usage and provider cost metering
- Shared quota and credit reservation
- Admin screens for Providers, Models, Tenants, Credentials
- Tenant screens for AI Settings, BYOK, Usage, Credits

Defer advanced routing, elaborate analytics, custom dashboard builders,
and broad provider coverage until the core multi-tenant and billing
flows are proven.

## 16. Key architecture decisions

Decision Recommendation

---

Service architecture Modular Monolith
Deployment Standalone Service
Repository Single repository is sufficient
Runtime Node.js + Bun
Backend TypeScript + Hono
Frontend Separate Next.js application
Database PostgreSQL
Cache / coordination Redis
Queue BullMQ or equivalent
API REST + SSE
Provider integration Adapter Pattern
Credential model Shared + BYOK + Hybrid
Billing boundary Gateway metering; SaaS owns subscription billing
Authorization Platform and tenant RBAC
Deployment Docker

**Core principle:** The Gateway owns AI connectivity, routing,
credentials, usage metering, and provider-cost measurement. Each SaaS
remains responsible for its own product permissions, subscription
lifecycle, invoices, and customer-facing commercial rules.
