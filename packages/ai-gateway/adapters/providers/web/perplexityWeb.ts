import type { ProviderExecutionOptions } from "../../../domain/ports/providerAdapter.js"
import { BaseWebSessionAdapter, DEFAULT_WEB_USER_AGENT } from "./baseWebSession.js"

export class PerplexityWebAdapter extends BaseWebSessionAdapter {
  readonly providerId = "perplexity-web"
  readonly defaultBaseUrl = "https://www.perplexity.ai"
  readonly isWebSession = true

  buildUrl(options: ProviderExecutionOptions): string {
    const base = options.credential.baseUrl || this.defaultBaseUrl
    return `${base.replace(/\/+$/, "")}/rest/sse/prompt_completion`
  }

  buildHeaders(options: ProviderExecutionOptions): Record<string, string> {
    const cookie = this.formatCookieHeader(options.credential.apiKey)
    return {
      "User-Agent": DEFAULT_WEB_USER_AGENT,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Origin: "https://www.perplexity.ai",
      Referer: "https://www.perplexity.ai/",
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    }
  }

  formatRequestBody(options: ProviderExecutionOptions): Record<string, unknown> {
    const messages = (options.body.messages as Array<Record<string, unknown>>) || []
    const lastUserMsg = messages
      .slice()
      .reverse()
      .find((m) => m.role === "user")

    const queryStr =
      typeof lastUserMsg?.content === "string"
        ? lastUserMsg.content
        : JSON.stringify(lastUserMsg?.content || "")

    return {
      version: "2.18",
      source: "default",
      query_str: queryStr,
      mode: options.model.includes("pro") ? "copilot" : "concise",
      timezone: "Asia/Ho_Chi_Minh",
    }
  }
}
