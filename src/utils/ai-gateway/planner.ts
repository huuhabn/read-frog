import type { GatewayOperation, GatewayRouteCandidate } from "./types"

export interface GatewayRoutePlanOptions {
  now?: number
  maxAttempts?: number
}

export function planGatewayRoutes(
  operation: GatewayOperation,
  candidates: readonly GatewayRouteCandidate[],
  options: GatewayRoutePlanOptions = {},
): GatewayRouteCandidate[] {
  const now = options.now ?? Date.now()
  const maxAttempts = Math.max(0, options.maxAttempts ?? 3)

  return candidates
    .filter(
      (candidate) =>
        candidate.enabled &&
        candidate.operations.includes(operation) &&
        (candidate.cooldownUntil === undefined || candidate.cooldownUntil <= now),
    )
    .toSorted((left, right) => {
      const leftCost = left.estimatedCostUsd ?? Number.POSITIVE_INFINITY
      const rightCost = right.estimatedCostUsd ?? Number.POSITIVE_INFINITY
      return leftCost - rightCost || left.configurationOrder - right.configurationOrder
    })
    .slice(0, maxAttempts)
}
