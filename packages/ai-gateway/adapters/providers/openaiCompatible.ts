import type { ProviderExecutionOptions } from "../../domain/ports/providerAdapter.js"
import { BaseProviderAdapter } from "./base.js"

export class OpenAICompatibleAdapter extends BaseProviderAdapter {
  readonly providerId: string
  readonly defaultBaseUrl: string

  constructor(providerId = "openai", defaultBaseUrl = "https://api.openai.com/v1") {
    super()
    this.providerId = providerId
    this.defaultBaseUrl = defaultBaseUrl
  }

  buildUrl(options: ProviderExecutionOptions): string {
    const base = options.credential.baseUrl || this.defaultBaseUrl
    const cleanBase = base.replace(/\/+$/, "")
    return cleanBase.endsWith("/chat/completions") ? cleanBase : `${cleanBase}/chat/completions`
  }

  buildHeaders(options: ProviderExecutionOptions): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.credential.apiKey}`,
      ...options.headers,
    }
    if (options.credential.organizationId) {
      headers["OpenAI-Organization"] = options.credential.organizationId
    }
    if (options.credential.projectId) {
      headers["OpenAI-Project"] = options.credential.projectId
    }
    return headers
  }

  formatRequestBody(options: ProviderExecutionOptions): Record<string, unknown> {
    return {
      ...options.body,
      model: options.model,
      stream: options.stream,
    }
  }
}
