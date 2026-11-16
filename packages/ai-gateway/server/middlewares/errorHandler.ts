import type { Context } from "hono"
import { GatewayError } from "../../domain/errors.js"

export function errorHandler(err: Error, c: Context) {
  if (err instanceof GatewayError) {
    return c.json(
      {
        error: {
          message: err.message,
          type: err.code,
          code: err.code,
          details: err.details,
        },
      },
      err.statusCode as any,
    )
  }

  console.error("[AI Gateway Unhandled Error]:", err)

  return c.json(
    {
      error: {
        message: err.message || "An unexpected internal server error occurred",
        type: "api_error",
        code: "internal_server_error",
      },
    },
    500,
  )
}
