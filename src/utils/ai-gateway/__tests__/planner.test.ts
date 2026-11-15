import type { GatewayRouteCandidate } from "../types"
import { describe, expect, it } from "vitest"
import { planGatewayRoutes } from "../planner"

function route(
  overrides: Partial<GatewayRouteCandidate> & Pick<GatewayRouteCandidate, "routeId">,
): GatewayRouteCandidate {
  return {
    providerId: overrides.routeId,
    operations: ["text.stream"],
    enabled: true,
    configurationOrder: 0,
    ...overrides,
  }
}

describe("planGatewayRoutes", () => {
  it("sorts known costs first and uses configuration order as tie-breaker", () => {
    const result = planGatewayRoutes(
      "text.stream",
      [
        route({ routeId: "unknown", configurationOrder: 0 }),
        route({ routeId: "second", estimatedCostUsd: 0.02, configurationOrder: 2 }),
        route({ routeId: "first", estimatedCostUsd: 0.02, configurationOrder: 1 }),
        route({ routeId: "cheap", estimatedCostUsd: 0.01, configurationOrder: 3 }),
      ],
      { maxAttempts: 10 },
    )
    expect(result.map(({ routeId }) => routeId)).toEqual(["cheap", "first", "second", "unknown"])
  })

  it("keeps the feature-pinned route first before cost-sorted fallbacks", () => {
    const result = planGatewayRoutes("text.stream", [
      route({ routeId: "pinned", pinned: true, configurationOrder: 0 }),
      route({ routeId: "cheap", estimatedCostUsd: 0.001, configurationOrder: 1 }),
    ])
    expect(result.map(({ routeId }) => routeId)).toEqual(["pinned", "cheap"])
  })

  it("filters disabled, incompatible and cooling-down routes and caps attempts", () => {
    const result = planGatewayRoutes(
      "text.stream",
      [
        route({ routeId: "disabled", enabled: false }),
        route({ routeId: "wrong", operations: ["image.generate"] }),
        route({ routeId: "cooldown", cooldownUntil: 101 }),
        route({ routeId: "one", configurationOrder: 1 }),
        route({ routeId: "two", configurationOrder: 2 }),
      ],
      { now: 100, maxAttempts: 1 },
    )
    expect(result.map(({ routeId }) => routeId)).toEqual(["one"])
  })
})
