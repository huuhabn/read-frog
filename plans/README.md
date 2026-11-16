# AI Gateway SaaS Plans

These plans define the next phase of `@workmate-ai/ai-gateway` as a standalone multi-tenant SaaS gateway. They replace the previous extension-focused and broad dashboard plans. Execute in dependency order; each plan is self-contained.

## Execution order

| Plan | Title                                                       | Priority | Effort | Depends on | Status |
| ---- | ----------------------------------------------------------- | -------: | -----: | ---------- | ------ |
| 001  | Establish standalone SaaS tenant and master-tenant contract |       P1 |      M | —          | TODO   |
| 002  | Simplify the public gateway API                             |       P1 |      M | 001        | TODO   |
| 003  | Unify routing options and introduce a model catalog         |       P1 |      L | 002        | TODO   |
| 004  | Enforce tenant budgets and accurate pricing                 |       P1 |      L | 001, 003   | TODO   |
| 005  | Add request observability and provider conformance kit      |       P2 |      L | 003, 004   | TODO   |
| 006  | Build SaaS model catalog and tenant dashboard               |       P2 |      L | 003–005    | TODO   |

## Product decisions

- The master tenant is internal to the platform and is not customer-selectable or visible through tenant APIs.
- Trusted platform/system requests without a customer tenant are attributed to the master tenant.
- The master tenant has unlimited quota while still recording usage, cost metadata, and audit events.
- Customer tenants remain subject to explicit policy; a missing limit does not implicitly mean unlimited.
- Keep SQLite for the first standalone SaaS iteration. Plan a database migration only when deployment or load evidence requires it.
- Keep prompt and response content out of operational request logs by default.

## Dependency notes

- 001 establishes tenant identity, trust boundaries, and accounting semantics before other SaaS features.
- 002 adds the simple typed API that 003 configures.
- 003 establishes route options and model metadata consumed by 004 and 005.
- 004 depends on 001's master tenant policy and 003's model pricing metadata.
- 006 follows the stable catalog, budget, and request-log contracts from 003–005.

Status values: TODO | IN PROGRESS | DONE | BLOCKED (with reason) | REJECTED (with rationale).
