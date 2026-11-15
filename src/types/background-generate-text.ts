import type { ProviderRequestRouting } from "./hosted-request"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"

export type BackgroundGenerateTextPayload = ProviderRequestRouting<PromptableProviderRef> & {
  instructions: string
  prompt: string
  /**
   * Hosted billing idempotency key. Mint a fresh one per real model call — a
   * retry after an unusable answer is a new call, and reusing the key would
   * replay the original response.
   */
  requestId?: string
  /** Local providers only; hosted retries are the caller's business. */
  maxRetries?: number
  temperature?: number
  /** Ordered fallback snapshots. Credentials stay inside each execution closure. */
  fallbackProviderRefs?: PromptableProviderRef[]
  /** Defaults to one for compatibility until automatic routing is enabled. */
  maxGatewayAttempts?: number
  /** The caller owns the audit record (for example after PII unmasking). */
  skipAudit?: boolean
}

export interface BackgroundGenerateTextResponse {
  text: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}
