import type { GatewayAttempt, GatewayErrorCode, GatewayStreamAttempt } from "./types"
import { GatewayError } from "./types"

function abortError(signal: AbortSignal): GatewayError {
  return new GatewayError("aborted", "AI gateway request was aborted", { cause: signal.reason })
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  for (const key of ["status", "statusCode"] as const) {
    const value = (error as Record<string, unknown>)[key]
    if (typeof value === "number") return value
  }
  return undefined
}

export function normalizeGatewayError(error: unknown, signal?: AbortSignal): GatewayError {
  if (error instanceof GatewayError) return error
  if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
    return signal
      ? abortError(signal)
      : new GatewayError("aborted", "AI gateway request was aborted", { cause: error })
  }

  const status = readStatus(error)
  const message = error instanceof Error ? error.message : String(error)
  let code: GatewayErrorCode
  if (status === 401 || status === 403) code = "auth"
  else if (status === 429) code = "rate_limit"
  else if (status !== undefined && status >= 500) code = "provider"
  else if (status !== undefined && status >= 400) code = "invalid_request"
  else if (/timeout|timed out/i.test(message)) code = "timeout"
  else if (/network|fetch failed|connection|socket/i.test(message)) code = "network"
  else code = "provider"

  return new GatewayError(code, message, { cause: error, status })
}

export function isGatewayErrorRetryable(error: GatewayError): boolean {
  return ["rate_limit", "quota", "timeout", "network", "provider"].includes(error.code)
}

export async function executeGatewayAttempts<T>(
  attempts: readonly GatewayAttempt<T>[],
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) throw abortError(signal)
  if (attempts.length === 0) throw new GatewayError("unsupported", "No compatible AI route")

  let lastError: GatewayError | undefined
  for (const attempt of attempts.slice(0, 3)) {
    if (signal.aborted) throw abortError(signal)
    try {
      return await attempt.execute(signal)
    } catch (error) {
      lastError = normalizeGatewayError(error, signal)
      if (!isGatewayErrorRetryable(lastError)) throw lastError
    }
  }
  throw lastError ?? new GatewayError("unsupported", "No compatible AI route")
}

export function executeGatewayStreamAttempts<T>(
  attempts: readonly GatewayStreamAttempt<T>[],
  signal: AbortSignal,
  isVisibleOutput: (event: T) => boolean,
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      if (signal.aborted) throw abortError(signal)
      if (attempts.length === 0) throw new GatewayError("unsupported", "No compatible AI route")

      let lastError: GatewayError | undefined
      for (const attempt of attempts.slice(0, 3)) {
        if (signal.aborted) throw abortError(signal)
        let hasVisibleOutput = false
        try {
          const stream = await attempt.execute(signal)
          for await (const event of stream) {
            if (signal.aborted) throw abortError(signal)
            hasVisibleOutput ||= isVisibleOutput(event)
            yield event
          }
          return
        } catch (error) {
          lastError = normalizeGatewayError(error, signal)
          if (hasVisibleOutput || !isGatewayErrorRetryable(lastError)) throw lastError
        }
      }
      throw lastError ?? new GatewayError("unsupported", "No compatible AI route")
    },
  }
}
