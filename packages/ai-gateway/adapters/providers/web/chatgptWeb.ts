import type { ProviderExecutionOptions } from "../../../domain/ports/providerAdapter.js"
import { BaseWebSessionAdapter, DEFAULT_WEB_USER_AGENT } from "./baseWebSession.js"

export class ChatGptWebAdapter extends BaseWebSessionAdapter {
  readonly providerId = "chatgpt-web"
  readonly defaultBaseUrl = "https://chatgpt.com"
  readonly isWebSession = true

  buildUrl(options: ProviderExecutionOptions): string {
    const base = options.credential.baseUrl || this.defaultBaseUrl
    return `${base.replace(/\/+$/, "")}/backend-api/conversation`
  }

  buildHeaders(options: ProviderExecutionOptions): Record<string, string> {
    const secret = options.credential.apiKey
    const cookie = this.formatCookieHeader(secret)
    const headers: Record<string, string> = {
      "User-Agent": DEFAULT_WEB_USER_AGENT,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Origin: "https://chatgpt.com",
      Referer: "https://chatgpt.com/",
      ...options.headers,
    }

    // If apiKey is a JWT token
    if (secret.startsWith("eyJ") || (!secret.includes("=") && secret.length > 50)) {
      headers.Authorization = `Bearer ${secret}`
    } else if (cookie) {
      headers.Cookie = cookie.includes("=") ? cookie : `__Secure-next-auth.session-token=${cookie}`
    }

    return headers
  }

  formatRequestBody(options: ProviderExecutionOptions): Record<string, unknown> {
    const messages = (options.body.messages as Array<Record<string, unknown>>) || []
    const lastUserMsg = messages
      .slice()
      .reverse()
      .find((m) => m.role === "user")

    const userText =
      typeof lastUserMsg?.content === "string"
        ? lastUserMsg.content
        : JSON.stringify(lastUserMsg?.content || "")

    const msgId = crypto.randomUUID()
    const parentMsgId = crypto.randomUUID()

    return {
      action: "next",
      messages: [
        {
          id: msgId,
          author: { role: "user" },
          content: { content_type: "text", parts: [userText] },
          metadata: {},
        },
      ],
      model: options.model.replace("chatgpt-web/", "") || "gpt-4o",
      parent_message_id: parentMsgId,
      timezone_offset_min: -420,
      suggestions: [],
      history_and_training_disabled: true,
      conversation_mode: { kind: "primary_assistant" },
      force_paragen: false,
    }
  }
}
