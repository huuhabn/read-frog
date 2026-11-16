import type { ProviderExecutionOptions } from "../../../domain/ports/providerAdapter.js"
import { BaseWebSessionAdapter, DEFAULT_WEB_USER_AGENT } from "./baseWebSession.js"

export class MuseWebAdapter extends BaseWebSessionAdapter {
  readonly providerId = "muse-web"
  readonly defaultBaseUrl = "https://muse.ai"
  readonly isWebSession = true

  buildUrl(options: ProviderExecutionOptions): string {
    const base = options.credential.baseUrl || this.defaultBaseUrl
    return `${base.replace(/\/+$/, "")}/api/session`
  }

  /**
   * Normalizes Muse.ai cookies:
   * Extracts hatch_sess, hatch_gw, hatch_vml, hatch_native_auth_device
   */
  protected normalizeMuseCookie(raw: string): string {
    if (!raw) return ""
    const trimmed = raw.trim()

    if (trimmed.startsWith("{")) {
      try {
        const obj = JSON.parse(trimmed)
        const parts: string[] = []
        const targetCookies = ["hatch_sess", "hatch_gw", "hatch_vml", "hatch_native_auth_device"]
        for (const k of targetCookies) {
          if (obj[k]) parts.push(`${k}=${obj[k]}`)
        }
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
      return `hatch_sess=${trimmed}`
    }

    return trimmed
  }

  buildHeaders(options: ProviderExecutionOptions): Record<string, string> {
    const cookie = this.normalizeMuseCookie(options.credential.apiKey)
    return {
      "User-Agent": DEFAULT_WEB_USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: "https://muse.ai",
      Referer: "https://muse.ai/",
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    }
  }

  formatRequestBody(options: ProviderExecutionOptions): Record<string, unknown> {
    const messages = (options.body.messages as Array<Record<string, unknown>>) || []
    const promptParts = messages.map((m) => {
      const role = m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User"
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content || "")
      return `${role}: ${text}`
    })

    const fullPrompt = promptParts.join("\n\n")
    const model = options.model.replace("muse-web/", "") || "muse-chat"

    return {
      prompt: fullPrompt,
      model,
      kind: model.includes("image") ? "image" : model.includes("video") ? "video" : "chat",
      stream: options.stream,
    }
  }
}
