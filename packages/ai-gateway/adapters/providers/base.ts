import type {
  ProviderAdapter,
  ProviderExecutionOptions,
  ProviderExecutionResult,
} from "../../domain/ports/providerAdapter.js"
import { UpstreamError } from "../../domain/errors.js"

export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly providerId: string
  abstract readonly defaultBaseUrl: string

  supportsModel(_model: string): boolean {
    return true
  }

  abstract buildUrl(options: ProviderExecutionOptions): string
  abstract buildHeaders(options: ProviderExecutionOptions): Record<string, string>
  abstract formatRequestBody(options: ProviderExecutionOptions): Record<string, unknown>

  async execute(options: ProviderExecutionOptions): Promise<ProviderExecutionResult> {
    const url = this.buildUrl(options)
    const headers = this.buildHeaders(options)
    const body = this.formatRequestBody(options)
    const timeoutMs = options.timeoutMs || 60000

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort(
        new Error(`Upstream request to ${this.providerId} timed out after ${timeoutMs}ms`),
      )
    }, timeoutMs)

    // Chain client cancellation signal to abortController
    if (options.signal) {
      options.signal.addEventListener("abort", () => abortController.abort(), { once: true })
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortController.signal,
      })

      clearTimeout(timeoutId)

      const respHeaders: Record<string, string> = {}
      response.headers.forEach((v, k) => {
        respHeaders[k] = v
      })

      if (!response.ok) {
        let errorText = ""
        try {
          const errJson = await response.json()
          errorText = JSON.stringify(errJson)
        } catch {
          errorText = await response.text()
        }
        throw new UpstreamError(this.providerId, response.status, errorText)
      }

      if (options.stream && response.body) {
        return {
          isStream: true,
          statusCode: response.status,
          headers: respHeaders,
          stream: response.body,
          abortController,
        }
      }

      const json = await response.json()
      return {
        isStream: false,
        statusCode: response.status,
        headers: respHeaders,
        data: json,
        usage: json.usage
          ? {
              promptTokens: json.usage.prompt_tokens || 0,
              completionTokens: json.usage.completion_tokens || 0,
              totalTokens: json.usage.total_tokens || 0,
            }
          : undefined,
      }
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err instanceof UpstreamError) throw err
      throw new UpstreamError(this.providerId, 502, err?.message || "Failed to fetch from upstream")
    }
  }
}
