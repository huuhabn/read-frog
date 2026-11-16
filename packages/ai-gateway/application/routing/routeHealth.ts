import type { GatewayRouteCandidate } from "../../domain/routing.js"
import { RouteError } from "../../domain/routing.js"
import { isRouteErrorRetryable } from "./routeExecutor.js"

interface GatewayRouteHealth {
  consecutiveFailures: number
  cooldownUntil?: number
}

export interface GatewayHealthRegistryOptions {
  failureThreshold?: number
  cooldownMs?: number
}

/** Ephemeral health only: a service-worker restart deliberately clears it. */
export class GatewayHealthRegistry {
  private readonly routes = new Map<string, GatewayRouteHealth>()
  private readonly failureThreshold: number
  private readonly cooldownMs: number

  constructor(options: GatewayHealthRegistryOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 2
    this.cooldownMs = options.cooldownMs ?? 30_000
  }

  recordSuccess(routeId: string) {
    this.routes.delete(routeId)
  }

  recordFailure(routeId: string, error: RouteError, now = Date.now()) {
    if (!isRouteErrorRetryable(error)) return
    const previous = this.routes.get(routeId)
    const consecutiveFailures = (previous?.consecutiveFailures ?? 0) + 1
    this.routes.set(routeId, {
      consecutiveFailures,
      cooldownUntil:
        consecutiveFailures >= this.failureThreshold ? now + this.cooldownMs : undefined,
    })
  }

  withHealth(candidate: GatewayRouteCandidate): GatewayRouteCandidate {
    const health = this.routes.get(candidate.routeId)
    return health?.cooldownUntil ? { ...candidate, cooldownUntil: health.cooldownUntil } : candidate
  }
}
