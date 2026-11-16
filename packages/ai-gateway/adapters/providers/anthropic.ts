import type { ProviderExecutionOptions } from "../../domain/ports/providerAdapter.js"
import { BaseProviderAdapter } from "./base.js"

export class AnthropicAdapter extends BaseProviderAdapter {
  readonly providerId = "anthropic"
  readonly defaultBaseUrl = "https://api.anthropic.com/v1"

  buildUrl(options: ProviderExecutionOptions): string {
    const base = options.credential.baseUrl || this.defaultBaseUrl
    const cleanBase = base.replace(/\/+$/, "")
    return cleanBase.endsWith("/messages") ? cleanBase : `${cleanBase}/messages`
  }

  buildHeaders(options: ProviderExecutionOptions): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": options.credential.apiKey,
      "anthropic-version": "2023-06-01",
      ...options.headers,
    }
  }

  formatRequestBody(options: ProviderExecutionOptions): Record<string, unknown> {
    return {
      ...options.body,
      model: options.model,
      stream: options.stream,
    }
  }
}
