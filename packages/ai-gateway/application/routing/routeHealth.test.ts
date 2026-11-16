import type { GatewayRouteCandidate } from "../../domain/routing.js"
import { describe, expect, it } from "vitest"
import { RouteError } from "../../domain/routing.js"
import { GatewayHealthRegistry } from "./routeHealth.js"

const candidate: GatewayRouteCandidate = {
  routeId: "route",
  providerId: "provider",
  operations: ["text.stream"],
  enabled: true,
  configurationOrder: 0,
}

describe("GatewayHealthRegistry", () => {
  it("opens an ephemeral cooldown after consecutive retryable failures", () => {
    const health = new GatewayHealthRegistry({ failureThreshold: 2, cooldownMs: 50 })
    health.recordFailure(candidate.routeId, new RouteError("network", "offline"), 100)
    expect(health.withHealth(candidate).cooldownUntil).toBeUndefined()
    health.recordFailure(candidate.routeId, new RouteError("timeout", "slow"), 100)
    expect(health.withHealth(candidate).cooldownUntil).toBe(150)
    health.recordSuccess(candidate.routeId)
    expect(health.withHealth(candidate).cooldownUntil).toBeUndefined()
  })

  it("does not penalize terminal request or authentication errors", () => {
    const health = new GatewayHealthRegistry({ failureThreshold: 1 })
    health.recordFailure(candidate.routeId, new RouteError("auth", "bad key"), 100)
    expect(health.withHealth(candidate).cooldownUntil).toBeUndefined()
  })
})
