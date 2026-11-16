export class GatewayError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: unknown
  public readonly isGatewayError = true

  constructor(message: string, statusCode = 500, code = "internal_error", details?: unknown) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class AuthError extends GatewayError {
  constructor(
    message = "Unauthorized: Invalid or missing authentication credentials",
    details?: unknown,
  ) {
    super(message, 401, "unauthorized", details)
  }
}

export class ForbiddenError extends GatewayError {
  constructor(
    message = "Forbidden: Caller does not have permission to perform this action",
    details?: unknown,
  ) {
    super(message, 403, "forbidden", details)
  }
}

export class NotFoundError extends GatewayError {
  constructor(message = "Resource not found", details?: unknown) {
    super(message, 404, "not_found", details)
  }
}

export class ValidationError extends GatewayError {
  constructor(message = "Validation error", details?: unknown) {
    super(message, 400, "invalid_request_error", details)
  }
}

export class QuotaExceededError extends GatewayError {
  constructor(message = "Quota or credit balance exceeded", details?: unknown) {
    super(message, 402, "quota_exceeded", details)
  }
}

export class RateLimitError extends GatewayError {
  public readonly retryAfterSeconds?: number

  constructor(message = "Rate limit exceeded", retryAfterSeconds?: number, details?: unknown) {
    super(message, 429, "rate_limit_exceeded", details)
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class ProviderUnavailableError extends GatewayError {
  public readonly provider: string

  constructor(provider: string, message?: string, details?: unknown) {
    super(
      message || `Provider '${provider}' is currently unavailable`,
      503,
      "provider_unavailable",
      details,
    )
    this.provider = provider
  }
}

export class ContextLengthExceededError extends GatewayError {
  constructor(message = "Maximum context length exceeded for this model", details?: unknown) {
    super(message, 400, "context_length_exceeded", details)
  }
}

export class UpstreamError extends GatewayError {
  public readonly provider: string
  public readonly upstreamStatusCode: number
  public readonly rawBody?: unknown

  constructor(provider: string, upstreamStatusCode: number, message: string, rawBody?: unknown) {
    super(
      `Upstream [${provider}] error (${upstreamStatusCode}): ${message}`,
      upstreamStatusCode >= 400 && upstreamStatusCode < 600 ? upstreamStatusCode : 502,
      "upstream_error",
      rawBody,
    )
    this.provider = provider
    this.upstreamStatusCode = upstreamStatusCode
    this.rawBody = rawBody
  }
}
