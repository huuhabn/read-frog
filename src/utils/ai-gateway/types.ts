export type GatewayOperation =
  | "text.generate"
  | "text.stream"
  | "object.stream"
  | "vision.generate"
  | "image.generate"
  | "embedding.generate"
  | "speech.transcribe"
  | "speech.synthesize"

export type GatewayErrorCode =
  | "invalid_request"
  | "auth"
  | "rate_limit"
  | "quota"
  | "timeout"
  | "network"
  | "provider"
  | "unsupported"
  | "aborted"

export class GatewayError extends Error {
  readonly code: GatewayErrorCode
  readonly status?: number

  constructor(
    code: GatewayErrorCode,
    message: string,
    options: { cause?: unknown; status?: number } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = "GatewayError"
    this.code = code
    this.status = options.status
  }
}

export type GatewayEvent =
  | { type: "start"; providerId: string; model?: string }
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | { type: "tool-call"; id: string; name: string; input: unknown }
  | { type: "media"; mediaType: string; data: unknown }
  | { type: "usage"; inputTokens?: number; outputTokens?: number; totalTokens?: number }
  | { type: "finish"; reason?: string }
  | { type: "error"; error: GatewayError }

export interface GatewayRequest<TInput = unknown> {
  operation: GatewayOperation
  requestId: string
  feature: string
  input: TInput
}

export interface GatewayResult<TOutput = unknown> {
  output: TOutput
  providerId: string
  model?: string
  usage?: Extract<GatewayEvent, { type: "usage" }>
  finishReason?: string
}

export interface GatewayRouteCandidate {
  /** Stable, secret-free route identity for diagnostics and health tracking. */
  routeId: string
  providerId: string
  model?: string
  operations: readonly GatewayOperation[]
  enabled: boolean
  /** Estimated request cost in USD. Unknown estimates remain undefined and sort last. */
  estimatedCostUsd?: number
  /** Stable order from user configuration, used only as a tie-breaker. */
  configurationOrder: number
  cooldownUntil?: number
}

export interface GatewayAttempt<T> {
  candidate: GatewayRouteCandidate
  execute: (signal: AbortSignal) => Promise<T>
}

export interface GatewayStreamAttempt<T> {
  candidate: GatewayRouteCandidate
  execute: (signal: AbortSignal) => Promise<AsyncIterable<T>>
}

export interface ProviderAdapter<TInput = unknown, TOutput = unknown> {
  readonly id: string
  readonly operations: readonly GatewayOperation[]
  supports(request: GatewayRequest<TInput>): boolean
  estimateCostUsd?(request: GatewayRequest<TInput>): number | undefined
  execute(request: GatewayRequest<TInput>, signal: AbortSignal): Promise<TOutput>
  normalizeError(error: unknown, signal?: AbortSignal): GatewayError
}
