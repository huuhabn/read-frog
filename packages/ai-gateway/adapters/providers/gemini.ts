import type { ProviderExecutionOptions } from "../../domain/ports/providerAdapter.js"
import { BaseProviderAdapter } from "./base.js"

export class GeminiAdapter extends BaseProviderAdapter {
  readonly providerId = "gemini"
  readonly defaultBaseUrl = "https://generativelanguage.googleapis.com/v1beta"

  buildUrl(options: ProviderExecutionOptions): string {
    const base = (options.credential.baseUrl || this.defaultBaseUrl).replace(/\/+$/, "")
    const action = options.stream ? "streamGenerateContent?alt=sse" : "generateContent"
    return `${base}/models/${options.model}:${action}`
  }

  buildHeaders(options: ProviderExecutionOptions): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-goog-api-key": options.credential.apiKey,
      ...options.headers,
    }
  }

  formatRequestBody(options: ProviderExecutionOptions): Record<string, unknown> {
    return {
      ...options.body,
    }
  }
}
