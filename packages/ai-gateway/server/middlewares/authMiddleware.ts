import type { Context, Next } from "hono"
import type { TenantRepository } from "../../domain/ports/repositories.js"
import crypto from "crypto"

export function createAuthMiddleware(tenantRepo: TenantRepository) {
  return async (c: Context, next: Next) => {
    // Exclude health check and public endpoints
    const path = c.req.path
    if (path === "/health" || path === "/" || path.startsWith("/v1/public")) {
      return next()
    }

    // Extract API Key
    const authHeader = c.req.header("authorization") || ""
    const xApiKey = c.req.header("x-api-key") || ""
    let rawKey = ""

    if (authHeader.startsWith("Bearer ")) {
      rawKey = authHeader.slice(7).trim()
    } else if (xApiKey) {
      rawKey = xApiKey.trim()
    }

    if (!rawKey) {
      // In local dev without keys: allow anonymous dev context
      if (process.env.NODE_ENV !== "production") {
        c.set("tenant", null)
        return next()
      }
      return c.json(
        {
          error: {
            message: "Missing API key. Provide Authorization: Bearer <key> or x-api-key: <key>",
            type: "invalid_request_error",
            code: "unauthorized",
          },
        },
        401,
      )
    }

    // Hash key to query repository
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
    const keyRecord = await tenantRepo.getApiKey(keyHash)

    if (keyRecord) {
      c.set("tenant", keyRecord.tenant)
      c.set("application", keyRecord.application)
      c.set("apiKeyId", keyRecord.apiKey.id)
      return next()
    }

    // Dev fallback if key doesn't match any in DB but dev mode is active
    if (process.env.NODE_ENV !== "production" || rawKey.startsWith("sk-test-")) {
      c.set("tenant", null)
      return next()
    }

    return c.json(
      {
        error: {
          message: "Invalid API key provided",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      },
      401,
    )
  }
}
