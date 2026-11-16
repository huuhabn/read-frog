import type { GatewayOperation, GatewayRouteCandidate } from "../../domain/routing.js"
import type { GatewayHealthRegistry } from "./routeHealth.js"
import { MAX_GATEWAY_ATTEMPTS } from "../../domain/routing.js"

export interface GatewayRoutePlanOptions {
  now?: number
  maxAttempts?: number
  health?: GatewayHealthRegistry
}

export function planGatewayRoutes(
  operation: GatewayOperation,
  candidates: readonly GatewayRouteCandidate[],
  options: GatewayRoutePlanOptions = {},
): GatewayRouteCandidate[] {
  const now = options.now ?? Date.now()
  const maxAttempts = Math.max(0, options.maxAttempts ?? MAX_GATEWAY_ATTEMPTS)

  return candidates
    .map((candidate) => options.health?.withHealth(candidate) ?? candidate)
    .filter(
      (candidate) =>
        candidate.enabled &&
        candidate.operations.includes(operation) &&
        (candidate.cooldownUntil === undefined || candidate.cooldownUntil <= now),
    )
    .toSorted((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
      const leftCost = left.estimatedCostUsd ?? Number.POSITIVE_INFINITY
      const rightCost = right.estimatedCostUsd ?? Number.POSITIVE_INFINITY
      return leftCost - rightCost || left.configurationOrder - right.configurationOrder
    })
    .slice(0, maxAttempts)
}
