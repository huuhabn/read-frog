import type { ResolvedCredential } from "../entities/credential.js"
import type { TokenUsage } from "../entities/usage.js"

export interface ProviderExecutionOptions {
  model: string
  body: Record<string, unknown>
  credential: ResolvedCredential
  stream: boolean
  signal?: AbortSignal
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface NonStreamingResult {
  isStream: false
  statusCode: number
  headers: Record<string, string>
  data: Record<string, unknown>
  usage?: TokenUsage
}

export interface StreamingResult {
  isStream: true
  statusCode: number
  headers: Record<string, string>
  stream: ReadableStream<Uint8Array>
  abortController: AbortController
}

export type ProviderExecutionResult = NonStreamingResult | StreamingResult

export interface ProviderAdapter {
  readonly providerId: string
  supportsModel(model: string): boolean
  execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult>
}
