import type { ProviderExecutionOptions } from "../../../domain/ports/providerAdapter.js"
import { BaseWebSessionAdapter, DEFAULT_WEB_USER_AGENT } from "./baseWebSession.js"

export class DeepSeekWebAdapter extends BaseWebSessionAdapter {
  readonly providerId = "deepseek-web"
  readonly defaultBaseUrl = "https://chat.deepseek.com"
  readonly isWebSession = true

  buildUrl(options: ProviderExecutionOptions): string {
    const base = options.credential.baseUrl || this.defaultBaseUrl
    return `${base.replace(/\/+$/, "")}/api/v0/chat/completion`
  }

  buildHeaders(options: ProviderExecutionOptions): Record<string, string> {
    const token = options.credential.apiKey.trim()
    return {
      "User-Agent": DEFAULT_WEB_USER_AGENT,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Origin: "https://chat.deepseek.com",
      Referer: "https://chat.deepseek.com/",
      Authorization: `Bearer ${token}`,
      "X-Client-Platform": "web",
      "X-Client-Version": "2.0.0",
      ...options.headers,
    }
  }

  formatRequestBody(options: ProviderExecutionOptions): Record<string, unknown> {
    const messages = (options.body.messages as Array<Record<string, unknown>>) || []
    const promptParts = messages.map((m) => {
      const role = m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "Human"
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content || "")
      return `${role}: ${text}`
    })

    const fullPrompt = promptParts.join("\n\n")
    const thinkingEnabled = options.model.includes("reasoner") || options.model.includes("r1")

    return {
      chat_session_id: options.body.chat_session_id || `session_${Date.now()}`,
      parent_message_id: null,
      prompt: fullPrompt,
      refusal_reason: null,
      search_enabled: false,
      thinking_enabled: thinkingEnabled,
    }
  }
}
