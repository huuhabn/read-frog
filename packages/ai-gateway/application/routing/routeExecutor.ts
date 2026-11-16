import type {
  GatewayAttempt,
  GatewayAttemptObserver,
  RouteErrorCode,
  GatewayStreamAttempt,
} from "../../domain/routing.js"
import type { GatewayHealthRegistry } from "./routeHealth.js"
import { RouteError, MAX_GATEWAY_ATTEMPTS } from "../../domain/routing.js"

function notifyAttempt(
  observer: GatewayAttemptObserver,
  attempt: Parameters<NonNullable<GatewayAttemptObserver["onAttemptComplete"]>>[0],
) {
  try {
    observer.onAttemptComplete?.(attempt)
  } catch {
    // Diagnostics must never change routing or provider execution semantics.
  }
}

function abortError(signal: AbortSignal): RouteError {
  return new RouteError("aborted", "AI gateway request was aborted", { cause: signal.reason })
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  for (const key of ["status", "statusCode"] as const) {
    const value = (error as Record<string, unknown>)[key]
    if (typeof value === "number") return value
  }
  return undefined
}

export function normalizeRouteError(error: unknown, signal?: AbortSignal): RouteError {
  if (error instanceof RouteError) return error
  if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
    return signal
      ? abortError(signal)
      : new RouteError("aborted", "AI gateway request was aborted", { cause: error })
  }

  const status = readStatus(error)
  const message = error instanceof Error ? error.message : String(error)
  let code: RouteErrorCode
  if (status === 401 || status === 403) code = "auth"
  else if (status === 429) code = "rate_limit"
  else if (status !== undefined && status >= 500) code = "provider"
  else if (status !== undefined && status >= 400) code = "invalid_request"
  else if (/timeout|timed out/i.test(message)) code = "timeout"
  else if (/network|fetch failed|connection|socket/i.test(message)) code = "network"
  else code = "provider"

  return new RouteError(code, message, { cause: error, status })
}

export function isRouteErrorRetryable(error: RouteError): boolean {
  return ["rate_limit", "quota", "timeout", "network", "provider"].includes(error.code)
}

export async function executeGatewayAttempts<T>(
  attempts: readonly GatewayAttempt<T>[],
  signal: AbortSignal,
  observer: GatewayAttemptObserver = {},
  health?: GatewayHealthRegistry,
): Promise<T> {
  if (signal.aborted) throw abortError(signal)
  if (attempts.length === 0) throw new RouteError("unsupported", "No compatible AI route")

  let lastError: RouteError | undefined
  for (const attempt of attempts.slice(0, MAX_GATEWAY_ATTEMPTS)) {
    if (signal.aborted) throw abortError(signal)
    const startedAt = performance.now()
    try {
      const result = await attempt.execute(signal)
      health?.recordSuccess(attempt.candidate.routeId)
      notifyAttempt(observer, {
        providerId: attempt.candidate.providerId,
        model: attempt.candidate.model,
        status: "success",
        latencyMs: Math.round(performance.now() - startedAt),
        estimatedCostUsd: attempt.candidate.estimatedCostUsd,
      })
      return result
    } catch (error) {
      lastError = normalizeRouteError(error, signal)
      health?.recordFailure(attempt.candidate.routeId, lastError)
      notifyAttempt(observer, {
        providerId: attempt.candidate.providerId,
        model: attempt.candidate.model,
        status: lastError.code === "aborted" ? "aborted" : "error",
        errorCode: lastError.code,
        latencyMs: Math.round(performance.now() - startedAt),
        estimatedCostUsd: attempt.candidate.estimatedCostUsd,
      })
      if (!isRouteErrorRetryable(lastError)) throw lastError
    }
  }
  throw lastError ?? new RouteError("unsupported", "No compatible AI route")
}

export function executeGatewayStreamAttempts<T>(
  attempts: readonly GatewayStreamAttempt<T>[],
  signal: AbortSignal,
  isVisibleOutput: (event: T) => boolean,
  health?: GatewayHealthRegistry,
  observer: GatewayAttemptObserver = {},
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      if (signal.aborted) throw abortError(signal)
      if (attempts.length === 0) throw new RouteError("unsupported", "No compatible AI route")

      let lastError: RouteError | undefined
      for (const attempt of attempts.slice(0, MAX_GATEWAY_ATTEMPTS)) {
        if (signal.aborted) throw abortError(signal)
        let hasVisibleOutput = false
        const startedAt = performance.now()
        try {
          const stream = await attempt.execute(signal)
          for await (const event of stream) {
            if (signal.aborted) throw abortError(signal)
            hasVisibleOutput ||= isVisibleOutput(event)
            yield event
          }
          health?.recordSuccess(attempt.candidate.routeId)
          notifyAttempt(observer, {
            providerId: attempt.candidate.providerId,
            model: attempt.candidate.model,
            status: "success",
            latencyMs: Math.round(performance.now() - startedAt),
            estimatedCostUsd: attempt.candidate.estimatedCostUsd,
          })
          return
        } catch (error) {
          lastError = normalizeRouteError(error, signal)
          health?.recordFailure(attempt.candidate.routeId, lastError)
          notifyAttempt(observer, {
            providerId: attempt.candidate.providerId,
            model: attempt.candidate.model,
            status: lastError.code === "aborted" ? "aborted" : "error",
            errorCode: lastError.code,
            latencyMs: Math.round(performance.now() - startedAt),
            estimatedCostUsd: attempt.candidate.estimatedCostUsd,
          })
          if (hasVisibleOutput || !isRouteErrorRetryable(lastError)) throw lastError
        }
      }
      throw lastError ?? new RouteError("unsupported", "No compatible AI route")
    },
  }
}
