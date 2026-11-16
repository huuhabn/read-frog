import type { ProviderExecutionOptions } from "../../../domain/ports/providerAdapter.js"
import { BaseWebSessionAdapter, DEFAULT_WEB_USER_AGENT } from "./baseWebSession.js"

export class GeminiWebAdapter extends BaseWebSessionAdapter {
  readonly providerId = "gemini-web"
  readonly defaultBaseUrl = "https://gemini.google.com"
  readonly isWebSession = true

  buildUrl(options: ProviderExecutionOptions): string {
    const base = options.credential.baseUrl || this.defaultBaseUrl
    return `${base.replace(/\/+$/, "")}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`
  }

  /**
   * Normalizes Gemini web cookies.
   * Accepts:
   * - standard cookie string: "__Secure-1PSID=...; __Secure-1PSIDTS=..."
   * - JSON object with keys: { "__Secure-1PSID": "...", "__Secure-1PSIDTS": "..." }
   * - single raw token string: treats as __Secure-1PSID
   */
  protected normalizeGeminiCookie(raw: string): string {
    if (!raw) return ""
    const trimmed = raw.trim()

    if (trimmed.startsWith("{")) {
      try {
        const obj = JSON.parse(trimmed)
        const parts: string[] = []
        if (obj["__Secure-1PSID"]) parts.push(`__Secure-1PSID=${obj["__Secure-1PSID"]}`)
        if (obj["__Secure-1PSIDTS"]) parts.push(`__Secure-1PSIDTS=${obj["__Secure-1PSIDTS"]}`)
        if (obj["__Secure-1PSIDCC"]) parts.push(`__Secure-1PSIDCC=${obj["__Secure-1PSIDCC"]}`)
        if (Array.isArray(obj.cookies)) {
          return obj.cookies
            .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
            .join("; ")
        }
        if (parts.length > 0) return parts.join("; ")
      } catch {
        /* fallback to raw */
      }
    }

    if (!trimmed.includes("=")) {
      return `__Secure-1PSID=${trimmed}`
    }

    return trimmed
  }

  buildHeaders(options: ProviderExecutionOptions): Record<string, string> {
    const cookie = this.normalizeGeminiCookie(options.credential.apiKey)
    return {
      "User-Agent": DEFAULT_WEB_USER_AGENT,
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Origin: "https://gemini.google.com",
      Referer: "https://gemini.google.com/app",
      "X-Same-Domain": "1",
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    }
  }

  formatRequestBody(options: ProviderExecutionOptions): Record<string, unknown> {
    const messages = (options.body.messages as Array<Record<string, unknown>>) || []
    let systemText = ""
    const conversation: string[] = []
    let currentUserText = ""

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (!msg) continue
      const role = msg.role
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content || "")

      if (role === "system") {
        systemText = text
      } else if (i === messages.length - 1 && role === "user") {
        currentUserText = text
      } else {
        const label = role === "assistant" ? "Model" : "User"
        conversation.push(`${label}: ${text}`)
      }
    }

    const promptBlocks: string[] = []
    if (systemText) {
      promptBlocks.push(`Instructions:\n${systemText}`)
    }
    if (conversation.length > 0) {
      promptBlocks.push(`Previous Conversation:\n${conversation.join("\n")}`)
    }
    if (currentUserText) {
      promptBlocks.push(`User Request:\n${currentUserText}`)
    }

    const fullPrompt = promptBlocks.join("\n\n") || currentUserText

    return {
      prompt: fullPrompt,
      model: options.model.replace("gemini-web/", "") || "gemini-2.5-pro",
      stream: options.stream,
    }
  }
}
