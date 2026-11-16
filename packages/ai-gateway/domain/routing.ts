export const MAX_GATEWAY_ATTEMPTS = 3

export type GatewayOperation =
  | "text.generate"
  | "text.stream"
  | "object.stream"
  | "vision.generate"
  | "image.generate"
  | "embedding.generate"
  | "speech.transcribe"
  | "speech.synthesize"

export type RouteErrorCode =
  | "invalid_request"
  | "auth"
  | "rate_limit"
  | "quota"
  | "timeout"
  | "network"
  | "provider"
  | "unsupported"
  | "aborted"

/** Failure of one route attempt, classified so the executor can decide whether to fall back. */
export class RouteError extends Error {
  readonly code: RouteErrorCode
  readonly status?: number

  constructor(
    code: RouteErrorCode,
    message: string,
    options: { cause?: unknown; status?: number } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = "RouteError"
    this.code = code
    this.status = options.status
  }
}

export interface GatewayRouteCandidate {
  /** Stable, secret-free route identity for diagnostics and health tracking. */
  routeId: string
  providerId: string
  model?: string
  operations: readonly GatewayOperation[]
  enabled: boolean
  /** The feature-selected route remains first; cost sorting applies to fallback routes. */
  pinned?: boolean
  /** Estimated request cost in USD. Unknown estimates remain undefined and sort last. */
  estimatedCostUsd?: number
  /** Stable order from user configuration, used only as a tie-breaker. */
  configurationOrder: number
  cooldownUntil?: number
}

export interface GatewayAttemptAudit {
  providerId: string
  model?: string
  status: "success" | "error" | "aborted"
  errorCode?: RouteErrorCode
  latencyMs: number
  estimatedCostUsd?: number
}

export interface GatewayAuditMetadata {
  operation: GatewayOperation
  selectedProviderId: string
  selectedModel?: string
  fallbackUsed: boolean
  estimatedCostUsd?: number
  attempts: GatewayAttemptAudit[]
}

export interface GatewayAttemptObserver {
  onAttemptComplete?(attempt: GatewayAttemptAudit): void
}

export interface GatewayAttempt<T> {
  candidate: GatewayRouteCandidate
  execute: (signal: AbortSignal) => Promise<T>
}

export interface GatewayStreamAttempt<T> {
  candidate: GatewayRouteCandidate
  execute: (signal: AbortSignal) => Promise<AsyncIterable<T>>
}
